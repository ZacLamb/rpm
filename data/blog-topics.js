// Programmatic SEO keyword queue for the daily blog.
// The generator publishes the first topic whose keyword hasn't been used yet, so ORDER = publishing order.
//
// To add the client's own keywords, put them in CUSTOM_TOPICS below — they always publish first.
//   { keyword: 'glass door repair near me', service: 'commercial-glass-repairs', town: 'worcester', angle: 'optional extra direction' }
// `service` and `town` are optional slugs (from data/services.js and data/towns.js) and drive the interlinks + hero image.

const { services, bySlug: serviceBySlug } = require('./services');
const { towns } = require('./towns');

const CUSTOM_TOPICS = [
  // Client-supplied keywords go here.
];

// Hand-written topics with real search intent (comparisons, code questions, problems people google)
const EVERGREEN = [
  { keyword: 'tempered vs laminated glass', service: 'tempered-safety-glass', angle: 'Explain the difference, where each is required or better, and how to tell which one you have.' },
  { keyword: 'herculite doors vs aluminum storefront doors', service: 'herculite-doors', angle: 'Compare look, durability, cost drivers, hardware and best-fit applications.' },
  { keyword: 'why insulated glass windows fog up', service: 'insulated-glass', angle: 'Seal failure, what causes it, whether defogging works, and replacing just the glass unit vs the whole window.' },
  { keyword: 'storefront glass broken what to do', service: 'commercial-glass-repairs', angle: 'Step-by-step for a business owner after a break-in or accident: safety, board-up, insurance, replacement timeline.' },
  { keyword: 'glass office partitions vs drywall', service: 'office-sliders', angle: 'Light, acoustics, flexibility, privacy options (frosting, film), and when glass makes sense.' },
  { keyword: 'lexan vs plexiglass', service: 'lexan-and-plexiglass', angle: 'Polycarbonate vs acrylic: impact strength, clarity, scratching, cost drivers and typical uses.' },
  { keyword: 'what is spandrel glass', service: 'spandrel-glass', angle: 'What it is, why commercial buildings use it, opacifier vs ceramic frit, and replacing damaged spandrel panels.' },
  { keyword: 'where is safety glass required by building code', service: 'tempered-safety-glass', angle: 'Hazardous locations in plain English (doors, near doors, near floors, showers, stairs). Advise confirming with the local building department; do not cite specific code section numbers.' },
  { keyword: 'frameless shower glass thickness 3/8 vs 1/2 inch', service: 'heavy-glass', angle: 'Feel, weight, hardware, cost drivers and which suits which layout.' },
  { keyword: 'glass wine room design ideas', service: 'wine-rooms', angle: 'Glass types, doors and seals, temperature/humidity considerations and layout ideas for homes and restaurants.' },
  { keyword: 'ada requirements for commercial glass entry doors', service: 'commercial-doors', angle: 'Opening force, clear width, thresholds, hardware height and closers in plain English. Recommend confirming with the local inspector; no code section numbers.' },
  { keyword: 'laminated glass for break-in protection', service: 'laminated-safety-glass', angle: 'How laminated glass resists forced entry, security film comparison, and where businesses use it.' },
  { keyword: 'storefront door closer not closing properly', service: 'storefront-doors', angle: 'Common symptoms (slamming, not latching, dragging), likely causes, what a pro adjusts vs replaces.' },
  { keyword: 'low-e glass explained', service: 'insulated-glass', angle: 'What low-E coatings do, comfort and energy benefits in New England, and options when replacing glass units.' },
  { keyword: 'commercial glass maintenance checklist for property managers', service: 'commercial-glass-repairs', angle: 'Seasonal checklist: doors, closers, seals, fogged units, cracked panes, safety glazing, documentation.' },
  { keyword: 'how cold weather affects commercial glass doors', service: 'commercial-doors', angle: 'New England winters: contraction, weatherstripping, frozen thresholds, closer adjustments, thermal stress cracks.' },
  { keyword: 'aluminum storefront finishes clear vs bronze vs black anodized', service: 'storefront-doors', angle: 'Look, maintenance and matching existing framing.' },
  { keyword: 'how to choose a commercial glass contractor', service: null, angle: 'What to ask, licensing and insurance, estimates, shop drawings, lead times, red flags. Position RPM Glass naturally, not salesy.' },
];

// Template angles applied to every service
const SERVICE_TEMPLATES = [
  { kw: s => `${s.short.toLowerCase()} cost in massachusetts`, angle: 'What drives the price (size, glass type, hardware, access, permits, timing). Do NOT quote specific dollar figures; explain cost factors and how to get an accurate estimate.' },
  { kw: s => `signs you need ${s.short.toLowerCase()} repair or replacement`, angle: 'Practical warning signs, safety risks of waiting, repair vs replace decision.' },
  { kw: s => `${s.short.toLowerCase()} installation process`, angle: 'What to expect from first call to final install: measure, ordering/fabrication, lead times, install day, cleanup.' },
  { kw: s => `how to maintain ${s.short.toLowerCase()}`, angle: 'Care, cleaning and inspection tips, what owners can do vs what needs a pro.' },
];

function interleave(lists) {
  const out = [];
  const max = Math.max(...lists.map(l => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

function buildTopics() {
  // Informational: rotate services so the same service isn't covered two days in a row
  const templated = SERVICE_TEMPLATES.flatMap(t =>
    services.map(s => ({ keyword: t.kw(s), service: s.slug, angle: t.angle })));
  const informational = interleave([EVERGREEN, templated]).map(t => ({ ...t, type: 'informational' }));

  // Local: only service+town pairs that town actually features (relevant, not every combination)
  const localByService = services.map(s => towns
    .filter(t => t.featured.includes(s.slug))
    .map(t => ({
      type: 'local',
      keyword: `${s.short.toLowerCase()} ${t.name.toLowerCase()} ma`,
      service: s.slug,
      town: t.slug,
      angle: `A genuinely local guide for ${t.name} property owners and businesses: use the town details provided, common building types there, and what to know before hiring.`,
    })));
  const local = interleave(localByService);

  // Publish pattern: 2 informational, then 1 local
  const mixed = [];
  let i = 0, j = 0;
  while (i < informational.length || j < local.length) {
    if (i < informational.length) mixed.push(informational[i++]);
    if (i < informational.length) mixed.push(informational[i++]);
    if (j < local.length) mixed.push(local[j++]);
  }

  const all = [...CUSTOM_TOPICS.map(t => ({ type: t.town ? 'local' : 'informational', ...t })), ...mixed];
  // De-dupe by keyword and drop unknown slugs
  const seen = new Set();
  return all.filter(t => {
    const k = t.keyword.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    if (t.service && !serviceBySlug[t.service]) t.service = null;
    t.keyword = k;
    return true;
  });
}

module.exports = { buildTopics };
