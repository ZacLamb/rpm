const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Services data
const services = [
  {
    slug: 'heavy-glass',
    name: 'Heavy Glass',
    tagline: 'Robust Solutions for High-Demand Applications',
    description: 'Our heavy glass solutions are designed for applications requiring superior strength and durability. Perfect for frameless shower enclosures, glass railings, partitions, and structural applications where standard glass simply won\'t do.',
    features: ['Thickness options from 3/8" to 1" for maximum strength', 'Frameless designs for modern aesthetics', 'Custom cutting and edge finishing', 'Ideal for railings, partitions, and enclosures'],
    applications: ['Frameless shower enclosures', 'Glass railings and balustrades', 'Structural glass walls', 'Commercial storefronts', 'Office partitions']
  },
  {
    slug: 'laminated-safety-glass',
    name: 'Laminated Safety Glass',
    tagline: 'Enhanced Protection with Laminated Layers',
    description: 'Laminated safety glass features a PVB interlayer that holds the glass together even when broken. This makes it ideal for security applications, skylights, and any location where safety is paramount.',
    features: ['PVB interlayer technology for shatter resistance', 'Superior sound reduction properties', 'UV protection to prevent fading', 'Meets building code safety requirements'],
    applications: ['Security windows and doors', 'Skylights and overhead glazing', 'Hurricane and impact-resistant windows', 'Museums and display cases', 'Schools and public buildings']
  },
  {
    slug: 'tempered-safety-glass',
    name: 'Tempered Safety Glass',
    tagline: 'High-Strength Glass for Maximum Safety',
    description: 'Tempered glass is heat-treated to be 4-5 times stronger than regular glass. When broken, it shatters into small, relatively harmless pieces rather than dangerous shards, making it the go-to choice for safety applications.',
    features: ['4-5x stronger than standard glass', 'Safe break pattern into small pieces', 'Heat and thermal shock resistant', 'Building code compliant for safety glazing'],
    applications: ['Shower doors and enclosures', 'Glass doors and sidelites', 'Table tops and shelving', 'Patio doors and windows', 'Commercial storefronts']
  },
  {
    slug: 'herculite-doors',
    name: 'Herculite Doors',
    tagline: 'Elegant and Resilient Glass Doors',
    description: 'Herculite doors combine the beauty of frameless glass with heavy-duty hardware for a stunning, durable entrance solution. These all-glass doors create an open, inviting atmosphere while maintaining security.',
    features: ['Frameless all-glass design', 'Heavy-duty pivot and patch hardware', 'Available in tempered or laminated glass', 'Custom sizes and configurations'],
    applications: ['Retail storefronts', 'Office entrances', 'Restaurant entries', 'Hotel lobbies', 'Boutique shops']
  },
  {
    slug: 'spandrel-glass',
    name: 'Spandrel Glass',
    tagline: 'Architectural Glass for Aesthetic Appeal',
    description: 'Spandrel glass is opaque glass used to conceal structural elements, insulation, and other building components in curtain wall systems. Available in a wide range of colors to match your architectural vision.',
    features: ['Ceramic frit or opacifier coating', 'Wide range of color options', 'Heat-treated for durability', 'Seamless integration with vision glass'],
    applications: ['Curtain wall systems', 'Building facades', 'Column covers', 'Spandrel panels between floors', 'Architectural accent features']
  },
  {
    slug: 'commercial-doors',
    name: 'Commercial Doors',
    tagline: 'Durable and Secure Commercial Entry Solutions',
    description: 'Our commercial door systems are built to withstand high-traffic environments while providing security and aesthetic appeal. From aluminum storefronts to automatic entry systems, we have solutions for every commercial need.',
    features: ['Heavy-duty aluminum frames', 'ADA compliant configurations', 'Multiple hardware options', 'Weather-sealed for energy efficiency'],
    applications: ['Retail stores', 'Office buildings', 'Medical facilities', 'Educational institutions', 'Government buildings']
  },
  {
    slug: 'office-sliders',
    name: 'Office Sliders',
    tagline: 'Modern and Functional Sliding Solutions',
    description: 'Maximize your office space with our sliding glass door systems. These sleek, modern solutions provide privacy when needed while maintaining an open, collaborative atmosphere.',
    features: ['Space-saving sliding operation', 'Soft-close mechanisms available', 'Frosted or clear glass options', 'Sound-dampening configurations'],
    applications: ['Conference rooms', 'Private offices', 'Meeting spaces', 'Huddle rooms', 'Executive suites']
  },
  {
    slug: 'insulated-glass',
    name: 'Insulated Glass',
    tagline: 'Energy-Efficient Glass for Optimal Insulation',
    description: 'Insulated glass units (IGUs) consist of two or more panes separated by a spacer and sealed to create an insulating air space. Perfect for improving energy efficiency and comfort in any building.',
    features: ['Double and triple pane options', 'Argon or krypton gas fill available', 'Low-E coating for solar control', 'Reduces heating and cooling costs'],
    applications: ['Commercial windows', 'Storefronts', 'Curtain walls', 'Skylights', 'Replacement windows']
  },
  {
    slug: 'lexan-plexiglass',
    name: 'Lexan and Plexiglass',
    tagline: 'Versatile and Impact-Resistant Solutions',
    description: 'Lexan (polycarbonate) and Plexiglass (acrylic) offer lightweight, shatter-resistant alternatives to traditional glass. These materials are ideal for security glazing, protective barriers, and applications where impact resistance is critical.',
    features: ['250x stronger than glass (Lexan)', 'Lightweight and easy to fabricate', 'UV-resistant options available', 'Clear optical clarity'],
    applications: ['Security windows and barriers', 'Machine guards', 'Protective shields', 'Display cases', 'Skylights and canopies']
  },
  {
    slug: 'storefront-doors',
    name: 'Storefront Doors',
    tagline: 'Stylish and Secure Storefront Entries',
    description: 'Make a lasting first impression with our storefront door systems. Designed to showcase your business while providing security and energy efficiency, our storefronts combine form and function perfectly.',
    features: ['Narrow sightlines for maximum glass', 'Multiple finish options', 'Integrated panic hardware', 'ADA compliant thresholds'],
    applications: ['Retail stores', 'Restaurants', 'Banks and financial institutions', 'Professional offices', 'Shopping centers']
  },
  {
    slug: 'commercial-glass-repairs',
    name: 'Commercial Glass Repairs',
    tagline: 'Expert Repair Services for Commercial Glass',
    description: 'When your commercial glass is damaged, you need fast, professional repairs. Our experienced technicians handle everything from small chips to full panel replacements, minimizing downtime for your business.',
    features: ['Rapid response service', 'All glass types serviced', 'Board-up and emergency services', 'Insurance claim assistance'],
    applications: ['Storefront repairs', 'Window replacements', 'Door glass repairs', 'Vandalism damage', 'Weather damage restoration']
  },
  {
    slug: 'wine-rooms',
    name: 'Wine Rooms',
    tagline: 'Elegant Wine Storage Solutions for Hospitality',
    description: 'Create a stunning showcase for your wine collection with our custom glass wine room solutions. Perfect for restaurants, bars, and private residences, our wine rooms combine beauty with proper storage conditions.',
    features: ['Custom glass enclosures', 'Temperature-controlled compatible', 'Various glass options available', 'LED lighting integration'],
    applications: ['Restaurant wine displays', 'Bar wine storage', 'Hotel wine rooms', 'Private residence cellars', 'Retail wine shops']
  }
];

// Company info
const company = {
  name: 'RPM Glass',
  phone: '(774) 456-9850',
  email: 'rpmglassservices@gmail.com',
  address: '160 Otis St., Northborough, MA 01532',
  instagram: 'https://www.instagram.com/rpmglass_services',
  yearsInBusiness: '12+',
  projectsCompleted: '1,000+',
  successRate: '92%'
};

// Routes
app.get('/', (req, res) => {
  res.render('index', { services, company, currentPage: 'home' });
});

app.get('/about', (req, res) => {
  res.render('about', { services, company, currentPage: 'about' });
});

app.get('/services', (req, res) => {
  res.render('services', { services, company, currentPage: 'services' });
});

app.get('/services/:slug', (req, res) => {
  const service = services.find(s => s.slug === req.params.slug);
  if (!service) {
    return res.status(404).render('404', { company, currentPage: '' });
  }
  const relatedServices = services.filter(s => s.slug !== service.slug).slice(0, 3);
  res.render('services/service', { service, relatedServices, services, company, currentPage: 'services' });
});

app.get('/gallery', (req, res) => {
  res.render('gallery', { services, company, currentPage: 'gallery' });
});

app.get('/contact', (req, res) => {
  res.render('contact', { services, company, currentPage: 'contact' });
});

// Sitemap
app.get('/sitemap.xml', (req, res) => {
  const baseUrl = 'https://rpmglass.com';
  const today = new Date().toISOString().split('T')[0];

  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/services</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/gallery</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/contact</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;

  services.forEach(service => {
    sitemap += `
  <url>
    <loc>${baseUrl}/services/${service.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  sitemap += `
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(sitemap);
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { company, currentPage: '' });
});

app.listen(PORT, () => {
  console.log(`RPM Glass server running on port ${PORT}`);
});
