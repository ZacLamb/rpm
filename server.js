const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

const { services, bySlug: serviceBySlug } = require('./data/services');
const { towns, bySlug: townBySlug } = require('./data/towns');
const images = require('./data/images');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = (process.env.SITE_URL || 'https://rpmglass.com').replace(/\/$/, '');
// GHL inbound webhook for the RPM Glass sub-account (env var overrides if it ever changes)
const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL || 'https://services.leadconnectorhq.com/hooks/gqZLaxiRnT93o0AopLh3/webhook-trigger/6d7c2d91-a248-427f-9d47-8ab230dfe520';

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
const ASSET_V = '20261008b';
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
    service, related, serviceTowns,
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
    town, featured, nearby,
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
  if (b.website) return res.redirect('/contact?sent=1'); // honeypot
  const payload = {
    source: 'rpmglass.com',
    page: b.page || '/contact',
    full_name: b.name || '',
    phone: b.phone || '',
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

// ---------- SEO ----------
app.get('/sitemap.xml', (req, res) => {
  const urls = [
    { loc: '/', p: '1.0' }, { loc: '/about', p: '0.7' }, { loc: '/services', p: '0.9' },
    { loc: '/service-areas', p: '0.8' }, { loc: '/gallery', p: '0.6' }, { loc: '/contact', p: '0.8' },
    ...services.map(s => ({ loc: '/services/' + s.slug, p: '0.9' })),
    ...towns.map(t => ({ loc: '/service-areas/' + t.slug, p: '0.7' })),
  ];
  const today = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${SITE_URL}${u.loc}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>${u.p}</priority></url>`).join('\n') +
    `\n</urlset>`;
  res.type('application/xml').send(xml);
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});

// Legacy anchors from the old GHL site
app.get(['/home', '/index.html'], (req, res) => res.redirect(301, '/'));

app.use((req, res) => {
  res.status(404).render('pages/404', { title: 'Page Not Found | RPM Glass', description: 'The page you were looking for could not be found.' });
});

app.listen(PORT, () => console.log(`RPM Glass site running on :${PORT}`));
