// Higgsfield-generated imagery. Downloaded, resized and converted to WebP at build time (see scripts/fetch-images.js).
// `ar` = aspect ratio used to emit width/height attributes (avoids layout shift / CLS). scripts/fetch-images.js downloads these into public/images at build time
// (Railway runs `npm install` → postinstall). If a download fails, templates fall back to the remote URL.
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3EmROCl8evT8aLsxpJaXd5oq6pI/';

const images = {
  hero:            { file: 'hero-storefront.webp', ar: '16:9',        url: CDN + 'hf_20260914_224044_544bcf84-5f78-456b-8b5d-bc75a86e4d89.png', alt: 'Modern commercial glass storefront installed by RPM Glass' },
  'heavy-glass':   { file: 'heavy-glass.webp', ar: '4:3',            url: CDN + 'hf_20260914_224044_0b62f56c-7456-4bad-bc4b-e602518f70c7.png', alt: 'Installers carrying a heavy glass panel into a commercial building' },
  'laminated-safety-glass': { file: 'laminated-glass.webp', ar: '4:3', url: CDN + 'hf_20260914_224044_9983e8a1-1363-4f7f-ac89-72c4e3bc90ef.png', alt: 'Laminated safety glass cross-section showing the interlayer' },
  'tempered-safety-glass':  { file: 'tempered-glass.webp', ar: '4:3',  url: CDN + 'hf_20260914_224045_f26e6ccc-d499-4d97-8c3e-a2603ef9373a.png', alt: 'Frameless tempered glass railing on a residential deck' },
  'herculite-doors':        { file: 'herculite-doors.webp', ar: '4:3', url: CDN + 'hf_20260914_224044_b6164556-8cde-4199-bdb1-ca22ec03fef4.png', alt: 'All-glass Herculite entrance door in an office lobby' },
  'spandrel-glass':         { file: 'spandrel-glass.webp', ar: '4:3',  url: CDN + 'hf_20260914_224044_1afdaa04-eb6f-4947-b712-50affd9f6b3a.png', alt: 'Office building facade with spandrel and vision glass' },
  'commercial-doors':       { file: 'commercial-doors.webp', ar: '4:3', url: CDN + 'hf_20260914_224044_0435b56b-28de-4be1-9266-b1c4b950a70e.png', alt: 'Aluminum-framed commercial glass entry doors' },
  'office-sliders':         { file: 'office-sliders.webp', ar: '4:3',  url: CDN + 'hf_20260914_224044_bc337fbd-eb08-4891-92f1-e830caade70c.png', alt: 'Frameless glass sliding office partitions' },
  'insulated-glass':        { file: 'insulated-glass.webp', ar: '4:3', url: CDN + 'hf_20260914_224044_ffeeb84b-dc27-45fa-a873-bd6b27cef118.png', alt: 'Insulated glass unit being installed' },
  'lexan-and-plexiglass':   { file: 'lexan-plexiglass.webp', ar: '4:3', url: CDN + 'hf_20260914_224045_f9b3fc92-13a7-4526-ae40-a459514a0929.png', alt: 'Polycarbonate and acrylic sheets in a glass shop' },
  'storefront-doors':       { file: 'storefront-doors.webp', ar: '4:3', url: CDN + 'hf_20260914_224044_ff1562d9-dec8-4a3e-aa87-75376f826e22.png', alt: 'Glass storefront door with sidelights at a downtown boutique' },
  'commercial-glass-repairs': { file: 'glass-repair.webp', ar: '4:3',  url: CDN + 'hf_20260914_224044_a967ed09-7ce6-42e6-8ffb-ae3b61f1e084.png', alt: 'Glazier replacing a cracked storefront window' },
  'wine-rooms':             { file: 'wine-room.webp', ar: '4:3',       url: CDN + 'hf_20260914_224057_3c20c46b-5cf2-48b5-9959-87218091f102.png', alt: 'Glass-enclosed restaurant wine room' },
  crew:            { file: 'crew.webp', ar: '4:3',                   url: CDN + 'hf_20260914_224057_5a28bbb1-a908-42b7-9c92-2797f3f914c3.png', alt: 'RPM Glass installation crew at a job site' },
  // Real team photo — committed in public/images/team.webp, never downloaded (no CDN url).
  team:            { file: 'team.webp', ar: '16:9',                  url: '/images/team.webp', alt: 'The RPM Glass & Services team in front of their van' },
  hospital:        { file: 'hospital-glass.webp', ar: '4:3',         url: CDN + 'hf_20260914_224057_c1f2cf51-9d25-43c4-80cb-5189bdc1de28.png', alt: 'Hospital corridor with glass partition walls' },
  bathroom:        { file: 'shower-mirror.webp', ar: '4:3',          url: CDN + 'hf_20260914_224057_35335e51-a2a4-4e8e-8ae5-35391047b11d.png', alt: 'Frameless shower enclosure and custom mirror' },
  basement:        { file: 'basement-gym.webp', ar: '4:3',           url: CDN + 'hf_20260914_224057_fe1df692-6ee5-4919-b0de-dee7a9306a9b.png', alt: 'Glass-walled home gym in a finished basement' },
  town:            { file: 'downtown.webp', ar: '16:9',               url: CDN + 'hf_20260914_224057_07443128-1500-40b9-bfd1-d7b7670c2f13.png', alt: 'New England downtown with modern glass storefronts' },
};

module.exports = images;
