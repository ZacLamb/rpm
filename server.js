const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const crypto = require('crypto');

const { services, bySlug: serviceBySlug } = require('./data/services');
const { towns, bySlug: townBySlug } = require('./data/towns');
const images = require('./data/images');
const blog = require('./lib/blog');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = (process.env.SITE_URL || 'https://rpmglass.com').replace(/\/$/, '');
// GHL inbound webhook for the RPM Glass sub-account (env var overrides if it ever changes)
const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL || 'https://services.leadconnectorhq.com/hooks/gqZLaxiRnT93o0AopLh3/webhook-trigger/6d7c2d91-a248-427f-9d47-8ab230dfe520';

// ---------- Spam protection ----------
// Signs a timestamp into every form so we can tell how long the visitor took to submit
// and reject bots that POST without ever loading the page. Set FORM_SECRET in Railway to override.
const FORM_SECRET = process.env.FORM_SECRET || crypto.createHash('sha256').update('rpmglass-form:' + GHL_WEBHOOK_URL).digest('hex');
const MIN_FILL_MS = 3000;            // humans can't fill the form in under 3s
const MAX_TOKEN_AGE_MS = 24 * 3600e3; // token valid for 24h
function makeFormToken() {
  const ts = Date.now().toString(36);
  const sig = crypto.createHmac('sha256', FORM_SECRET).update(ts).digest('hex').slice(0, 24);
  return ts + '.' + sig;
}
function checkFormToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return 'missing-token';
  const [ts, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', FORM_SECRET).update(ts).digest('hex').slice(0, 24);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return 'bad-token';
  const age = Date.now() - parseInt(ts, 36);
  if (!(age >= MIN_FILL_MS)) return 'too-fast';
  if (age > MAX_TOKEN_AGE_MS) return 'expired-token';
  return null;
}
// Valid US/NANP number: 10 digits (optional leading 1), area code + exchange can't start with 0/1
function normalizeUSPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return null;
  if (/^(\d)\1{9}$/.test(d)) return null; // 5555555555 etc.
  return '+1' + d;
}
const BLOCKED_NAMES = /^(roberttet|roberthep|robertgem|robertrem|jamesrem|josephtet|davidtet)$/i;
function spamReason(b) {
  const name = String(b.name || '').trim();
  const msg = String(b.message || '');
  if (b.website) return 'honeypot';
  const tokenErr = checkFormToken(b.ft);
  if (tokenErr) return tokenErr;
  if (!name || name.length > 80 || !/[a-z]/i.test(name)) return 'bad-name';
  if (BLOCKED_NAMES.test(name.replace(/\s+/g, ''))) return 'blocked-name';
  if (/https?:\/\/|www\./i.test(name)) return 'link-in-name';
  if (!normalizeUSPhone(b.phone)) return 'bad-phone';
  if ((msg.match(/https?:\/\//gi) || []).length > 1) return 'links-in-message';
  if (/[\u0400-\u04FF]/.test(name + msg)) return 'cyrillic';
  return null;
}
// Simple in-memory rate limit: max 3 submissions per IP per 10 minutes
const RATE_WINDOW_MS = 10 * 60e3, RATE_MAX = 3;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_MAX;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) if (!list.some(t => now - t < RATE_WINDOW_MS)) hits.delete(ip);
}, RATE_WINDOW_MS).unref();

const business = {
  name: 'RPM Glass',
  legalName: 'RPM Glass & Services Inc.',
  phone: '(774) 456-9850',
  phoneHref: 'tel:+17744569850',
  smsHref: 'sms:+17744569850',
  email: 'info@rpmglass.com',
  street: '160 Otis St.',
  city: 'Northborough',
  state: 'MA',
  zip: '01532',
  lat: 42.3195,
  lng: -71.6412,
  instagram: 'https://www.instagram.com/rpmglass_services',
  yearsInBusiness: 20,
  founded: 2006,
  hours: 'Mon–Fri 7:00 AM – 5:00 PM · 24/7 Emergency Service',
};

// Resolve image → local path if downloaded, else remote Higgsfield URL
// Bump when css/js change so the 30-day immutable cache is bypassed
const ASSET_V = '20261111c';
const DIMS = { '16:9': [1600, 900], '4:3': [1200, 900] };
function img(key) {
  const entry = images[key];
  if (!entry) return { src: '', alt: '', w: 1200, h: 900 };
  const dir = path.join(__dirname, 'public', 'images');
  const candidates = [entry.file, entry.file.replace(/\.webp$/, '.png')];
  let src = entry.url;
  for (const f of candidates) {
    const p = path.join(dir, f);
    if (fs.existsSync(p) && fs.statSync(p).size > 1000) { src = '/images/' + f; break; }
  }
  const [w, h] = DIMS[entry.ar] || DIMS['4:3'];
  return { src, alt: entry.alt, w, h };
}

// Enforce HTTPS + canonical host (Railway sets x-forwarded-proto). Skips localhost.
app.set('trust proxy', true);
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (/localhost|127\.0\.0\.1|railway\.app$/.test(host)) return next();
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const canonicalHost = SITE_URL.replace(/^https?:\/\//, '');
  if (proto !== 'https' || host !== canonicalHost) return res.redirect(301, SITE_URL + req.originalUrl);
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '30d', immutable: true }));

// Globals for every template
app.use((req, res, next) => {
  res.locals.business = business;
  res.locals.services = services;
  res.locals.towns = towns;
  res.locals.img = img;
  res.locals.assetV = ASSET_V;
  res.locals.siteUrl = SITE_URL;
  res.locals.path = req.path;
  res.locals.canonical = SITE_URL + req.path.replace(/\/$/, '') || SITE_URL;
  res.locals.year = new Date().getFullYear();
  res.locals.googleVerification = process.env.GOOGLE_SITE_VERIFICATION || '';
  res.locals.ogImage = SITE_URL + '/images/og-image.jpg';
  res.locals.formToken = makeFormToken();
  res.locals.blogNav = blog.list().length > 0;
  next();
});

// ---------- Pages ----------
app.get('/', (req, res) => {
  res.render('pages/home', {
    title: 'RPM Glass | Commercial & Residential Glass Installation in Northborough, MA',
    description: 'RPM Glass installs and repairs storefront glass, commercial doors, Herculite doors, office partitions, insulated glass and wine rooms across Central Massachusetts & MetroWest. 20+ years, 24/7 service.',
    schemaType: 'home',
  });
});

app.get('/about', (req, res) => {
  res.render('pages/about', {
    title: 'About RPM Glass | Northborough MA Glass Company Since ' + business.founded,
    description: 'Learn about RPM Glass — a Northborough, MA glass contractor serving commercial and residential clients across Worcester County and MetroWest with transparent pricing and 24/7 support.',
  });
});

app.get('/services', (req, res) => {
  res.render('pages/services', {
    title: 'Glass Services | Storefronts, Doors, Safety Glass & More | RPM Glass',
    description: 'Explore RPM Glass services: storefront doors, commercial glass doors, Herculite doors, office sliders, heavy glass, tempered & laminated safety glass, insulated glass, spandrel, Lexan, repairs and wine rooms.',
  });
});

app.get('/services/:slug', (req, res, next) => {
  const service = serviceBySlug[req.params.slug];
  if (!service) return next();
  const related = service.related.map(s => serviceBySlug[s]).filter(Boolean);
  // Towns whose featured list includes this service, else first 8
  let serviceTowns = towns.filter(t => t.featured.includes(service.slug));
  if (serviceTowns.length < 6) serviceTowns = serviceTowns.concat(towns.filter(t => !serviceTowns.includes(t)).slice(0, 8 - serviceTowns.length));
  res.render('pages/service', {
    title: `${service.name} in Northborough & Central MA | RPM Glass`,
    description: `${service.tagline} RPM Glass provides ${service.name.toLowerCase()} for commercial and residential clients across Worcester County and MetroWest. Call (774) 456-9850.`,
    service, related, serviceTowns, blogPosts: blog.forService(service.slug, 4),
  });
});

app.get('/service-areas', (req, res) => {
  res.render('pages/service-areas', {
    title: 'Service Areas | Glass Company Serving Worcester County & MetroWest MA | RPM Glass',
    description: 'RPM Glass serves Northborough, Westborough, Shrewsbury, Marlborough, Worcester, Framingham, Hudson and 20+ more Massachusetts towns with commercial and residential glass installation and repair.',
  });
});

app.get('/service-areas/:slug', (req, res, next) => {
  const town = townBySlug[req.params.slug];
  if (!town) return next();
  const featured = town.featured.map(s => serviceBySlug[s]).filter(Boolean);
  const idx = towns.indexOf(town);
  const nearby = [...towns.slice(idx + 1, idx + 4), ...towns.slice(0, 3)].filter(t => t !== town).slice(0, 5);
  res.render('pages/town', {
    title: `Glass Company in ${town.name}, MA | Storefront, Doors & Glass Repair | RPM Glass`,
    description: `Commercial & residential glass installation and repair in ${town.name}, MA. Storefronts, commercial doors, safety glass, insulated glass and 24/7 emergency service from RPM Glass, ${town.distance === 'Home base' ? 'based in' : town.distance + ' from'} ${town.name}.`,
    town, featured, nearby, blogPosts: blog.forTown(town.slug, 4).concat(blog.list().filter(p => !p.town_slug && town.featured.includes(p.service_slug))).slice(0, 4),
  });
});

app.get('/gallery', (req, res) => {
  const keys = ['hero', 'storefront-doors', 'wine-rooms', 'herculite-doors', 'office-sliders', 'tempered-safety-glass', 'hospital', 'bathroom', 'basement', 'spandrel-glass', 'commercial-doors', 'heavy-glass', 'insulated-glass', 'town'];
  res.render('pages/gallery', {
    title: 'Project Gallery | RPM Glass Northborough MA',
    description: 'Recent commercial and residential glass projects by RPM Glass — storefronts, wine rooms, office partitions, railings, shower enclosures and more across Massachusetts.',
    keys,
  });
});

app.get('/contact', (req, res) => {
  res.render('pages/contact', {
    title: 'Contact RPM Glass | Free Estimate | (774) 456-9850',
    description: 'Request a free estimate from RPM Glass in Northborough, MA. Call (774) 456-9850 or send us your project details — we respond fast, 24/7 for emergencies.',
    sent: req.query.sent === '1',
    error: req.query.error === '1',
  });
});

// Form → GHL inbound webhook. Payload keys map to workflow fields: full_name, phone, email, town, service, property_type, message, page, source
app.post('/contact', async (req, res) => {
  const b = req.body || {};
  // Spam gets a fake "sent" so bots don't learn they were blocked
  const reason = rateLimited(req.ip) ? 'rate-limit' : spamReason(b);
  if (reason) {
    console.warn('[lead] blocked:', reason, '| ip', req.ip, '| name', String(b.name || '').slice(0, 40), '| phone', String(b.phone || '').slice(0, 20));
    return res.redirect('/contact?sent=1');
  }
  const payload = {
    source: 'rpmglass.com',
    page: b.page || '/contact',
    full_name: String(b.name || '').trim(),
    phone: normalizeUSPhone(b.phone),
    email: b.email || '',
    town: b.town || '',
    service: b.service || '',
    property_type: b.property_type || '',
    message: b.message || '',
    submitted_at: new Date().toISOString(),
  };
  try {
    if (GHL_WEBHOOK_URL) {
      const r = await fetch(GHL_WEBHOOK_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('Webhook ' + r.status);
    } else {
      console.log('[lead] (no webhook configured)', payload);
    }
    res.redirect('/contact?sent=1');
  } catch (e) {
    console.error('[lead] failed', e.message, payload);
    res.redirect('/contact?error=1');
  }
});

// ---------- Blog ----------
const PER_PAGE = 12;
function blogIndex(req, res, next, service) {
  if (!blog.enabled()) return next();
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const all = service ? blog.list().filter(p => p.service_slug === service.slug) : blog.list();
  if (!all.length) return next();
  const pages = Math.ceil(all.length / PER_PAGE);
  if (page > pages) return next();
  const base = service ? '/blog/topic/' + service.slug : '/blog';
  res.render('pages/blog', {
    title: (service ? `${service.name} Articles & Guides` : 'Glass Tips, Guides & Local Insights') + (page > 1 ? ` — Page ${page}` : '') + ' | RPM Glass Blog',
    description: service
      ? `Guides and answers about ${service.name.toLowerCase()} for Massachusetts businesses and homeowners, from the RPM Glass team in Northborough.`
      : 'Practical guides on storefront doors, safety glass, insulated glass, repairs and more for Central Massachusetts businesses and homeowners — from RPM Glass.',
    canonical: SITE_URL + base + (page > 1 ? '?page=' + page : ''),
    posts: all.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    page, pages, base, topicService: service || null,
    blogTopics: [...new Set(blog.list().map(p => p.service_slug).filter(Boolean))],
  });
}
app.get('/blog', (req, res, next) => blogIndex(req, res, next, null));
app.get('/blog/topic/:slug', (req, res, next) => {
  const service = serviceBySlug[req.params.slug];
  if (!service || !blog.forService(service.slug, 1).length) return next();
  blogIndex(req, res, next, service);
});
app.get('/blog/:slug', async (req, res, next) => {
  if (!blog.enabled()) return next();
  try {
    const post = await blog.getPost(req.params.slug);
    if (!post) return next();
    const image = img(post.image_key || 'hero');
    res.render('pages/blog-post', {
      title: post.title + ' | RPM Glass',
      description: post.meta_description || post.excerpt || '',
      ogType: 'article',
      ogImage: image.src.startsWith('http') ? image.src : SITE_URL + image.src,
      preloadImage: image.src,
      post, image,
      postService: post.service_slug ? serviceBySlug[post.service_slug] : null,
      postTown: post.town_slug ? townBySlug[post.town_slug] : null,
      relatedPosts: blog.related(post, 4),
      formService: post.service_slug || undefined,
    });
  } catch (e) { next(e); }
});

// ---------- Blog admin (set ADMIN_KEY in Railway, then open /admin/blog?key=YOUR_KEY) ----------
function adminOk(req) {
  const key = process.env.ADMIN_KEY;
  const given = String((req.query && req.query.key) || (req.body && req.body.key) || '');
  return key && given.length === key.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key));
}
let manualRunning = false;
app.get('/admin/blog', async (req, res) => {
  if (!adminOk(req)) return res.status(404).render('pages/404', { title: 'Page Not Found | RPM Glass', description: '' });
  res.set('X-Robots-Tag', 'noindex, nofollow');
  let q = { total: 0, used: 0, upcoming: [] }, logs = [], dbError = '';
  try { [q, logs] = await Promise.all([blog.queueStatus(), blog.recentLog(25)]); } catch (e) { dbError = e.message; }
  const hour = parseInt(process.env.BLOG_PUBLISH_HOUR || '7', 10);
  const windowH = parseInt(process.env.BLOG_PUBLISH_WINDOW || '10', 10);
  const fmtHour = h => `${((h % 24) + 11) % 12 + 1} ${(h % 24) < 12 ? 'AM' : 'PM'}`;
  const etFmt = (d, opts) => new Date(d).toLocaleString('en-US', { timeZone: 'America/New_York', ...opts });
  res.render('admin/blog', {
    key: String(req.query.key || ''),
    msg: String(req.query.msg || ''),
    msgOk: req.query.ok === '1',
    debug: req.query.debug === '1', // add &debug=1 to the URL to see raw error details
    dbError,
    status: {
      db: blog.enabled() && !dbError,
      apiKey: Boolean(process.env.ANTHROPIC_API_KEY),
      autopublish: process.env.BLOG_AUTOPUBLISH !== 'false',
      model: blog.MODEL,
      canGenerate: blog.canGenerate(),
    },
    scheduleText: `Most days, at a different time between ${fmtHour(hour)} and ${fmtHour(hour + windowH)} ET. About ${process.env.BLOG_SKIP_PERCENT || '15'}% of days are skipped, never two in a row.`,
    plan: blog.upcomingPlan(14),
    queue: q,
    posts: blog.list().slice(0, 12),
    totalPosts: blog.list().length,
    logs,
    etFmt,
  });
});
app.post('/admin/blog/generate', async (req, res) => {
  if (!adminOk(req)) return res.status(404).send('Not found');
  const back = (msg, ok) => res.redirect('/admin/blog?key=' + encodeURIComponent(req.body.key) + (req.body.debug === '1' ? '&debug=1' : '') + '&ok=' + (ok ? 1 : 0) + '&msg=' + encodeURIComponent(msg));
  if (manualRunning) return back('A generation is already running. Refresh in a minute.', false);
  manualRunning = true;
  try {
    const slug = await blog.generateOne('manual');
    back(slug ? 'Published /blog/' + slug : 'Keyword queue is empty.', Boolean(slug));
  } catch (e) { back(req.body.debug === '1' ? 'Failed: ' + e.message : "Couldn't finish that article. Please try again in a few minutes.", false); }
  finally { manualRunning = false; }
});

// ---------- SEO ----------
app.get('/sitemap.xml', (req, res) => {
  const posts = blog.enabled() ? blog.list() : [];
  const urls = [
    { loc: '/', p: '1.0' }, { loc: '/about', p: '0.7' }, { loc: '/services', p: '0.9' },
    { loc: '/service-areas', p: '0.8' }, { loc: '/gallery', p: '0.6' }, { loc: '/contact', p: '0.8' },
    ...services.map(s => ({ loc: '/services/' + s.slug, p: '0.9' })),
    ...towns.map(t => ({ loc: '/service-areas/' + t.slug, p: '0.7' })),
    ...(posts.length ? [{ loc: '/blog', p: '0.7', lastmod: new Date(posts[0].published_at).toISOString().slice(0, 10) }] : []),
    ...[...new Set(posts.map(p => p.service_slug).filter(Boolean))].map(s => ({ loc: '/blog/topic/' + s, p: '0.5', lastmod: new Date(posts.find(p => p.service_slug === s).published_at).toISOString().slice(0, 10) })),
    ...posts.map(p => ({ loc: '/blog/' + p.slug, p: '0.6', lastmod: new Date(p.updated_at || p.published_at).toISOString().slice(0, 10) })),
  ];
  const today = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${SITE_URL}${u.loc}</loc><lastmod>${u.lastmod || today}</lastmod><changefreq>monthly</changefreq><priority>${u.p}</priority></url>`).join('\n') +
    `\n</urlset>`;
  res.type('application/xml').send(xml);
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});

// Legacy anchors from the old GHL site
app.get(['/home', '/index.html'], (req, res) => res.redirect(301, '/'));

app.use((req, res) => {
  res.status(404).render('pages/404', { title: 'Page Not Found | RPM Glass', description: 'The page you were looking for could not be found.' });
});

app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).render('pages/404', { title: 'Something went wrong | RPM Glass', description: '' });
});

app.listen(PORT, () => {
  console.log(`RPM Glass site running on :${PORT}`);
  const startBlog = () => blog.init({ business, services, serviceBySlug, towns, townBySlug, images, siteUrl: SITE_URL })
    .catch(e => { console.error('[blog] init failed, retrying in 60s:', e.message); setTimeout(startBlog, 60 * 1000); });
  startBlog();
});
