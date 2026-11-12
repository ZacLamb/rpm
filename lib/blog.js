// Daily programmatic-SEO blog engine.
// - Postgres stores posts (Railway's disk is wiped on every deploy, so files won't work).
// - Once a day it picks the next unused keyword from data/blog-topics.js, asks Claude for an article,
//   strips any link that isn't a real page on this site, and publishes it.
// - Keeps an in-memory index of posts so page renders never wait on the database.

const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const { buildTopics } = require('../data/blog-topics');

const TZ = 'America/New_York';
const ANTHROPIC_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '') + '/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const PUBLISH_HOUR = parseInt(process.env.BLOG_PUBLISH_HOUR || '7', 10);       // earliest ET hour a post can go out
const PUBLISH_WINDOW = Math.max(1, parseInt(process.env.BLOG_PUBLISH_WINDOW || '10', 10)); // hours after that it may land (7 AM–5 PM ET)
const SKIP_PERCENT = Math.min(50, Math.max(0, parseInt(process.env.BLOG_SKIP_PERCENT || '15', 10))); // chance a day is skipped
const POSTS_PER_DAY = Math.max(1, parseInt(process.env.BLOG_POSTS_PER_DAY || '1', 10));
const MAX_FAILS_PER_DAY = 3;
const LOCK_ID = 727274; // advisory lock so two instances never publish at once

let pool = null;
let index = [];            // [{slug,title,excerpt,service_slug,town_slug,image_key,published_at,updated_at,keyword}]
let ctx = null;            // { business, services, serviceBySlug, towns, townBySlug, images, siteUrl }
let running = false;

const enabled = () => Boolean(process.env.DATABASE_URL);
const canGenerate = () => enabled() && Boolean(process.env.ANTHROPIC_API_KEY);

function etDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function etHour(d = new Date()) {
  return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d), 10);
}
function etMinutes(d = new Date()) {
  const [h, m] = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d).split(':').map(Number);
  return h * 60 + m;
}

// Natural-looking schedule. Each date gets its own publish time and occasionally no post at all.
// It's derived from a hash of the date, so every restart and every instance agrees on the plan.
function dayHash(date) {
  const h = crypto.createHash('sha256').update('rpm-blog:' + date).digest();
  return { a: h.readUInt32BE(0), b: h.readUInt32BE(4), c: h.readUInt32BE(8) };
}
const rawSkip = date => SKIP_PERCENT > 0 && dayHash(date).a % 100 < SKIP_PERCENT;
function prevDate(date) {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10);
}
function dayPlan(date) {
  const skip = rawSkip(date) && !rawSkip(prevDate(date)); // never two skipped days in a row
  const { b, c } = dayHash(date);
  const minuteOfDay = PUBLISH_HOUR * 60 + (b % PUBLISH_WINDOW) * 60 + (c % 60);
  const hh = Math.floor(minuteOfDay / 60), mm = minuteOfDay % 60;
  const label = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'} ET`;
  return { date, skip, minuteOfDay, label };
}
function upcomingPlan(days = 14) {
  const out = []; const d = new Date(etDate() + 'T12:00:00Z');
  for (let i = 0; i < days; i++) { out.push(dayPlan(d.toISOString().slice(0, 10))); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
}

async function init(context) {
  ctx = context;
  if (!enabled()) { console.log('[blog] DATABASE_URL not set — blog disabled'); return; }
  if (!pool) {
  const { Pool } = require('pg');
  const url = process.env.DATABASE_URL;
  const internal = /\.railway\.internal|localhost|127\.0\.0\.1/.test(url);
  pool = new Pool({ connectionString: url, ssl: internal ? false : { rejectUnauthorized: false }, max: 5 });
  pool.on('error', e => console.error('[blog] db pool error:', e.message)); // never let a dropped connection crash the site
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      keyword TEXT UNIQUE NOT NULL,
      topic_type TEXT,
      title TEXT NOT NULL,
      meta_description TEXT,
      excerpt TEXT,
      html TEXT NOT NULL,
      faqs JSONB DEFAULT '[]',
      service_slug TEXT,
      town_slug TEXT,
      image_key TEXT,
      word_count INT,
      model TEXT,
      published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS blog_log (
      id SERIAL PRIMARY KEY,
      ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      et_date TEXT,
      status TEXT,
      keyword TEXT,
      message TEXT
    );
  `);
  await refreshIndex();
  console.log(`[blog] ready — ${index.length} posts, autopublish ${canGenerate() && process.env.BLOG_AUTOPUBLISH !== 'false' ? 'ON' : 'OFF'}`);
  startScheduler();
}

async function refreshIndex() {
  if (!pool) return;
  const { rows } = await pool.query(`SELECT slug, title, excerpt, keyword, service_slug, town_slug, image_key, published_at, updated_at
    FROM blog_posts WHERE published_at <= NOW() ORDER BY published_at DESC`);
  index = rows;
}

// ---------- reads (sync, from the in-memory index) ----------
const list = () => index;
const forService = (slug, n = 4) => index.filter(p => p.service_slug === slug).slice(0, n);
const forTown = (slug, n = 4) => index.filter(p => p.town_slug === slug).slice(0, n);
function related(post, n = 4) {
  const score = p => (p.service_slug && p.service_slug === post.service_slug ? 2 : 0) + (p.town_slug && p.town_slug === post.town_slug ? 1 : 0);
  return index.filter(p => p.slug !== post.slug)
    .map(p => ({ p, s: score(p) }))
    .sort((a, b) => b.s - a.s || new Date(b.p.published_at) - new Date(a.p.published_at))
    .slice(0, n).map(x => x.p);
}
async function getPost(slug) {
  if (!pool) return null;
  const { rows } = await pool.query('SELECT * FROM blog_posts WHERE slug = $1 AND published_at <= NOW()', [slug]);
  return rows[0] || null;
}

// ---------- topic queue ----------
async function nextTopic() {
  const { rows } = await pool.query('SELECT keyword FROM blog_posts');
  const used = new Set(rows.map(r => r.keyword));
  return buildTopics().find(t => !used.has(t.keyword)) || null;
}
async function queueStatus() {
  const topics = buildTopics();
  const used = new Set(index.map(p => p.keyword));
  return { total: topics.length, used: topics.filter(t => used.has(t.keyword)).length, upcoming: topics.filter(t => !used.has(t.keyword)).slice(0, 10) };
}

// ---------- link allowlist ----------
function allowedLinks(topic) {
  const { services, serviceBySlug, towns, townBySlug } = ctx;
  const links = [
    { url: '/contact', label: 'Contact / free estimate' },
    { url: '/services', label: 'All glass services' },
    { url: '/service-areas', label: 'Service areas' },
    { url: '/about', label: 'About RPM Glass' },
    { url: '/gallery', label: 'Project gallery' },
    ...services.map(s => ({ url: '/services/' + s.slug, label: s.name })),
  ];
  const svc = topic.service && serviceBySlug[topic.service];
  const town = topic.town && townBySlug[topic.town];
  // Town pages: the topic town + towns that feature this service (keeps the list relevant, not 30 links)
  const townPages = new Set();
  if (town) townPages.add(town.slug);
  townPages.add('northborough');
  if (svc) towns.filter(t => t.featured.includes(svc.slug)).slice(0, 6).forEach(t => townPages.add(t.slug));
  townPages.forEach(s => links.push({ url: '/service-areas/' + s, label: townBySlug[s].name + ', MA glass services' }));
  // Previous posts: most related first
  related({ slug: '', service_slug: topic.service, town_slug: topic.town }, 12)
    .forEach(p => links.push({ url: '/blog/' + p.slug, label: 'Article: ' + p.title }));
  return links;
}

// ---------- generation ----------
const ARTICLE_TOOL = {
  name: 'publish_article',
  description: 'Publish the finished blog article.',
  input_schema: {
    type: 'object',
    required: ['title', 'slug', 'meta_description', 'excerpt', 'html', 'faqs'],
    properties: {
      title: { type: 'string', description: 'H1 title, 45-70 characters, includes the keyword naturally.' },
      slug: { type: 'string', description: 'URL slug, lowercase-hyphenated, 3-7 words, based on the keyword.' },
      meta_description: { type: 'string', description: '140-158 characters, compelling, includes the keyword.' },
      excerpt: { type: 'string', description: '1-2 sentence summary for the blog index card.' },
      html: { type: 'string', description: 'Article body HTML. Allowed tags: h2, h3, p, ul, ol, li, strong, em, a, blockquote, table, thead, tbody, tr, th, td. No h1, no images, no inline styles, no FAQ section (FAQs go in the faqs field).' },
      faqs: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'object', required: ['q', 'a'], properties: { q: { type: 'string' }, a: { type: 'string', description: 'Plain text, 1-3 sentences.' } } } },
    },
  },
};

function buildPrompt(topic, links) {
  const { business, serviceBySlug, townBySlug } = ctx;
  const svc = topic.service && serviceBySlug[topic.service];
  const town = topic.town && townBySlug[topic.town];
  const facts = [
    `Company: ${business.legalName} ("${business.name}"), ${business.street}, ${business.city}, ${business.state} ${business.zip}. Phone ${business.phone}.`,
    `In business since ${business.founded} (${business.yearsInBusiness}+ years). Hours: ${business.hours}.`,
    'Commercial and residential glass contractor serving Worcester County and MetroWest, Massachusetts. Free estimates. Licensed and insured in MA.',
  ];
  if (svc) facts.push(`Primary service: ${svc.name} — ${svc.intro}\nWhat's included: ${svc.features.join('; ')}.`);
  if (town) facts.push(`Town: ${town.name}, MA (${town.county}, ZIP ${town.zip}); ${town.distance === 'Home base' ? 'RPM Glass is based here' : town.distance + ' from the Northborough shop'}. Local detail: ${town.blurb}`);

  return `You write blog articles for ${business.name}, a glass contractor in Central Massachusetts. Write one genuinely useful article that answers what someone searching this keyword actually wants to know.

TARGET KEYWORD: "${topic.keyword}"
ARTICLE TYPE: ${topic.type}
ANGLE: ${topic.angle || 'Helpful, practical guide.'}

COMPANY FACTS (the only facts about the company you may state):
${facts.join('\n')}

INTERNAL LINKS — you may ONLY link to these URLs, exactly as written (relative paths). Any other link will be deleted.
${links.map(l => `- ${l.url} — ${l.label}`).join('\n')}

REQUIREMENTS
- 900-1,400 words in the html field. Use <h2> sections (and <h3> where useful). Short paragraphs; lists where they help scanning.
- Use the keyword in the first paragraph and in one <h2>, naturally. No keyword stuffing.
- Include 4-7 internal links from the list with descriptive anchor text (never "click here"). Link the primary service page at least once and /contact once in the closing paragraph. If related articles are listed, link 1-2 that genuinely fit.
- Lead with the answer. Practical, specific, written for a business owner, property manager or homeowner in Massachusetts.
- Do NOT invent: prices or dollar figures, statistics, customer names, testimonials, project stories, awards, certifications, warranties, or brand partnerships beyond the facts above. Do NOT cite building-code section numbers. When something depends on the site or local code, say so.
- No fluff intros ("In today's world…"), no mention of being an AI, no "conclusion" heading — end with a short paragraph inviting readers to call ${business.phone} or request a free estimate.
- Do not repeat the title as a heading. Do not include an FAQ section in the html — put 3-5 distinct FAQs in the faqs field instead.

Call publish_article with the finished article.`;
}

async function callClaude(prompt) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 180000);
  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      signal: ac.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        tools: [ARTICLE_TOOL],
        tool_choice: { type: 'tool', name: ARTICLE_TOOL.name },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${data?.error?.message || JSON.stringify(data).slice(0, 300)}`);
    const block = (data.content || []).find(b => b.type === 'tool_use');
    if (!block) throw new Error('No tool_use in response' + (data.stop_reason ? ' (stop_reason ' + data.stop_reason + ')' : ''));
    return block.input;
  } finally { clearTimeout(timer); }
}

// Keep only safe tags, then unwrap any <a> that isn't a real page on this site
function cleanHtml(html, allowedUrls) {
  const safe = sanitizeHtml(String(html || ''), {
    allowedTags: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br'],
    allowedAttributes: { a: ['href'] },
    transformTags: { h1: 'h2', h4: 'h3', h5: 'h3', b: 'strong', i: 'em' },
  });
  let linkCount = 0;
  const out = safe.replace(/<a(?:\s+href="([^"]*)")?>([\s\S]*?)<\/a>/g, (m, href, text) => {
    let h = String(href || '').replace(/&amp;/g, '&').trim();
    h = h.replace(/^https?:\/\/(www\.)?rpmglass\.com/i, '').replace(/\/$/, '') || '/';
    if (!allowedUrls.has(h.split('#')[0])) return text;
    linkCount++;
    return `<a href="${h}">${text}</a>`;
  });
  return { html: out, linkCount };
}

async function generateOne(trigger = 'auto') {
  if (!canGenerate()) throw new Error('DATABASE_URL and ANTHROPIC_API_KEY must both be set');
  const topic = await nextTopic();
  if (!topic) { await log('empty', null, 'Keyword queue is empty — add topics in data/blog-topics.js'); return null; }
  const links = allowedLinks(topic);
  const allowedUrls = new Set(links.map(l => l.url));
  try {
    const out = await callClaude(buildPrompt(topic, links));
    const { html, linkCount } = cleanHtml(out.html, allowedUrls);
    const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    if (words < 500) throw new Error(`Article too short (${words} words)`);
    const faqs = (Array.isArray(out.faqs) ? out.faqs : [])
      .filter(f => f && f.q && f.a).slice(0, 5)
      .map(f => ({ q: sanitizeHtml(String(f.q), { allowedTags: [] }), a: sanitizeHtml(String(f.a), { allowedTags: [] }) }));

    let slug = slugify(out.slug || out.title || topic.keyword) || slugify(topic.keyword);
    const { rows: clash } = await pool.query('SELECT slug FROM blog_posts WHERE slug = $1 OR slug LIKE $2', [slug, slug + '-%']);
    if (clash.some(r => r.slug === slug)) slug = slug + '-' + crypto.randomBytes(2).toString('hex');

    const strip = s => sanitizeHtml(String(s || ''), { allowedTags: [] }).trim();
    const image_key = topic.service && ctx.images[topic.service] ? topic.service : (topic.town ? 'town' : 'hero');
    await pool.query(
      `INSERT INTO blog_posts (slug, keyword, topic_type, title, meta_description, excerpt, html, faqs, service_slug, town_slug, image_key, word_count, model)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [slug, topic.keyword, topic.type, strip(out.title).slice(0, 120), strip(out.meta_description).slice(0, 170), strip(out.excerpt).slice(0, 300),
        html, JSON.stringify(faqs), topic.service || null, topic.town || null, image_key, words, MODEL]
    );
    await refreshIndex();
    await log('published', topic.keyword, `/blog/${slug} · ${words} words · ${linkCount} internal links · ${trigger}`);
    console.log(`[blog] published /blog/${slug} (${words} words, ${linkCount} links)`);
    return slug;
  } catch (e) {
    await log('failed', topic.keyword, e.message);
    console.error('[blog] generation failed:', e.message);
    throw e;
  }
}

async function log(status, keyword, message) {
  try { await pool.query('INSERT INTO blog_log (et_date, status, keyword, message) VALUES ($1,$2,$3,$4)', [etDate(), status, keyword, String(message).slice(0, 1000)]); } catch (_) {}
}
async function recentLog(n = 20) {
  if (!pool) return [];
  const { rows } = await pool.query('SELECT * FROM blog_log ORDER BY ran_at DESC LIMIT $1', [n]);
  return rows;
}

// ---------- scheduler ----------
async function tick() {
  if (running || !canGenerate() || process.env.BLOG_AUTOPUBLISH === 'false') return;
  const today = etDate();
  const plan = dayPlan(today);
  if (plan.skip || etMinutes() < plan.minuteOfDay) return;
  running = true;
  let client;
  try {
    client = await pool.connect();
    const { rows: [{ locked }] } = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_ID]);
    if (!locked) return;
    try {
      const { rows: [s] } = await client.query(
        `SELECT COUNT(*) FILTER (WHERE status='published')::int AS done, COUNT(*) FILTER (WHERE status='failed')::int AS fails
         FROM blog_log WHERE et_date = $1 AND message NOT LIKE '%· manual'`, [today]);
      if (s.done >= POSTS_PER_DAY || s.fails >= MAX_FAILS_PER_DAY) return;
      await generateOne('auto').catch(() => {});
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
    }
  } catch (e) {
    console.error('[blog] scheduler error:', e.message);
  } finally {
    if (client) client.release();
    running = false;
  }
}
let schedulerStarted = false;
function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const safeTick = () => tick().catch(e => { running = false; console.error('[blog] tick error:', e.message); });
  setTimeout(safeTick, parseInt(process.env.BLOG_BOOT_DELAY_S || '30', 10) * 1000); // shortly after boot (catches up if a deploy missed the time)
  setInterval(safeTick, 10 * 60 * 1000).unref();   // then every 10 minutes
  setInterval(() => refreshIndex().catch(() => {}), 10 * 60 * 1000).unref();
}

module.exports = {
  init, enabled, canGenerate, list, forService, forTown, related, getPost,
  generateOne, queueStatus, recentLog, upcomingPlan, MODEL,
  _test: { cleanHtml, slugify, buildPrompt, allowedLinks, dayPlan },
};
