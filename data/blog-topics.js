// Programmatic SEO keyword queue for the daily blog.
// The generator publishes the first topic whose keyword hasn't been used yet, so ORDER = publishing order.
//
// Topic shape: { keyword, service, town, angle }
//   keyword  what the article targets (lowercase, how people actually search)
//   service  optional slug from data/services.js — drives interlinks + hero image
//   town     optional slug from data/towns.js — makes it a local article
//   angle    optional direction for the writer
//
// Mix: 2 informational articles, then 1 local article, repeating. CUSTOM_TOPICS lead the informational side.
// Add new keywords anywhere in CUSTOM_TOPICS; anything already published is skipped automatically.

const { services, bySlug: serviceBySlug } = require('./services');
const { towns } = require('./towns');

const CUSTOM_TOPICS = [
  // ---- Emergency & repair (highest buying intent) ----
  { keyword: '24 hour emergency glass repair', service: 'commercial-glass-repairs', angle: 'What a true 24/7 call looks like: board-up, securing the opening, temporary glazing, and scheduling the permanent replacement.' },
  { keyword: 'storefront window board up service', service: 'commercial-glass-repairs', angle: 'When board-up is needed, how fast it happens, what it costs to wait, and how it leads into replacement.' },
  { keyword: 'broken commercial glass insurance claim', service: 'commercial-glass-repairs', angle: 'Photos, police reports, estimates, and what to ask the glass company for so the claim goes smoothly. Do not give legal or insurance advice; tell readers to confirm with their carrier.' },
  { keyword: 'how long does commercial glass replacement take', service: 'commercial-glass-repairs', angle: 'Stock vs custom glass, tempered and insulated lead times, and how to stay open in the meantime. No specific day counts beyond "typically" ranges stated as general.' },
  { keyword: 'replace fogged glass without replacing the window', service: 'insulated-glass', angle: 'Swapping just the insulated glass unit (IGU): when it works, when the frame is the real problem, and what to measure.' },
  { keyword: 'tempered glass door shattered on its own', service: 'tempered-safety-glass', angle: 'Spontaneous breakage: edge damage, nickel sulfide inclusions, frame stress. What to do right away and how to prevent it.' },
  { keyword: 'commercial glass door not latching or locking', service: 'commercial-doors', angle: 'Closer adjustment, sagging hinges/pivots, strike alignment, worn hardware. What staff can check vs when to call a pro.' },
  { keyword: 'commercial glass door dragging on the floor', service: 'commercial-doors', angle: 'Worn pivots, failed continuous hinges, settling frames; why it gets worse in winter.' },
  { keyword: 'cracked office window replacement', service: 'commercial-glass-repairs', angle: 'Safety first, temporary fixes, matching tint/low-E on existing buildings.' },
  { keyword: 'sliding glass door glass replacement', service: 'insulated-glass', angle: 'Replacing the glass panel vs the whole door, tempered requirement, matching the existing unit.' },

  // ---- Storefronts & entrances ----
  { keyword: 'storefront glass replacement', service: 'storefront-doors', angle: 'Single pane vs full re-glaze, matching framing finishes, safety glazing, after-hours installs.' },
  { keyword: 'retail storefront renovation ideas', service: 'storefront-doors', angle: 'More glass, bigger entries, vestibules, finishes, lighting through the glass; practical for New England retail.' },
  { keyword: 'restaurant storefront and entrance glass ideas', service: 'storefront-doors', angle: 'Visibility, vestibules for winter, durable hardware for heavy traffic, cleaning and code-related safety glazing.' },
  { keyword: 'storefront security options for glass', service: 'laminated-safety-glass', angle: 'Laminated glass vs security film vs polycarbonate vs grilles: tradeoffs and layering. No made-up break-in stats.' },
  { keyword: 'panic hardware for glass doors explained', service: 'commercial-doors', angle: 'Rim vs concealed vertical rod devices on glass doors, when it is typically required, and confirming with the local inspector. No code section numbers.' },
  { keyword: 'continuous hinge vs pivot hinge for commercial doors', service: 'commercial-doors', angle: 'How each carries the door, wear patterns, and why heavy-traffic entries often switch to continuous hinges.' },
  { keyword: 'automatic door operator for existing glass door', service: 'commercial-doors', angle: 'Low-energy swing operators vs full automatic sliders, push-plate vs sensors, retrofit considerations, accessibility.' },
  { keyword: 'vestibule entrance for retail and offices', service: 'commercial-doors', angle: 'Why double-door vestibules matter in Massachusetts winters: drafts, heating cost, comfort near the door.' },
  { keyword: 'commercial door weatherstripping replacement', service: 'commercial-doors', angle: 'Signs it is worn, sweeps and seals, quick wins before winter.' },
  { keyword: 'how to clean and maintain storefront glass and doors', service: 'storefront-doors', angle: 'Cleaning, track and threshold care, closer checks, seasonal inspection list.' },

  // ---- Herculite / frameless entrances ----
  { keyword: 'what is a herculite door', service: 'herculite-doors', angle: 'The term, how all-glass doors are built (patch fittings, rails, floor closers), and where they fit best.' },
  { keyword: 'frameless glass entrance doors for offices', service: 'herculite-doors', angle: 'Lobby and suite entries, hardware options, locking, privacy graphics.' },
  { keyword: 'herculite door patch fittings and rails explained', service: 'herculite-doors', angle: 'Top and bottom patches vs full rails, finishes, locks, and which holds up better in heavy traffic.' },

  // ---- Office glass ----
  { keyword: 'glass conference room walls', service: 'office-sliders', angle: 'Single vs double glazed for sound, door options, privacy, whiteboard/glass writing surfaces.' },
  { keyword: 'frosted glass office partitions for privacy', service: 'office-sliders', angle: 'Frosted bands, full etch, decorative film, and switchable smart glass; when each makes sense.' },
  { keyword: 'soundproof glass office partitions', service: 'office-sliders', angle: 'How acoustic double-glazed partitions work, what affects sound control (seals, door gaps, ceilings), realistic expectations.' },
  { keyword: 'sliding glass office doors vs swing doors', service: 'office-sliders', angle: 'Space, accessibility, sound, hardware and maintenance.' },
  { keyword: 'medical office reception sliding glass window', service: 'office-sliders', angle: 'Privacy, security, sliding transaction windows and hygiene for medical and dental front desks.' },
  { keyword: 'switchable smart glass for offices', service: 'office-sliders', angle: 'Privacy glass that turns frosted on demand: how it works, best uses, considerations.' },

  // ---- Heavy glass / showers / railings ----
  { keyword: 'custom frameless glass shower enclosures', service: 'heavy-glass', angle: 'Layouts (inline, neo-angle, steam), hardware finishes, measuring after tile, and timelines.' },
  { keyword: 'frameless shower door cost factors', service: 'heavy-glass', angle: 'Glass thickness, size, hardware, coatings, layout complexity. No dollar figures.' },
  { keyword: 'glass railings for stairs and balconies', service: 'heavy-glass', angle: 'Interior vs exterior railings, standoffs vs channels, safety glass, inspection and code considerations (no section numbers).' },
  { keyword: 'how to keep glass shower doors clean from hard water', service: 'heavy-glass', angle: 'Daily habits, protective coatings, what not to use on hardware.' },
  { keyword: 'custom glass table tops and shelves', service: 'heavy-glass', angle: 'Thickness, edge types (polished, beveled), tempered vs annealed, low-iron vs standard.' },
  { keyword: 'custom wall mirrors for gyms and home studios', service: 'commercial-glass-repairs', angle: 'Sizing, mounting, safety backing, and replacing damaged mirrors in commercial spaces.' },

  // ---- Safety glass ----
  { keyword: 'how to tell if glass is tempered', service: 'tempered-safety-glass', angle: 'Etched bugs/logos, polarized sunglasses trick, edges; and why it matters for replacement.' },
  { keyword: 'can tempered glass be cut', service: 'tempered-safety-glass', angle: 'Why not, how replacement tempered glass is ordered to size, what that means for lead time.' },
  { keyword: 'sound reducing laminated glass for street facing windows', service: 'laminated-safety-glass', angle: 'How the interlayer dampens noise, where it helps (offices, apartments near traffic).' },
  { keyword: 'safety glass for schools and healthcare facilities', service: 'laminated-safety-glass', angle: 'Laminated, tempered and polycarbonate options for high-traffic and vandal-prone areas.' },
  { keyword: 'glass skylight replacement', service: 'laminated-safety-glass', angle: 'Why overhead glass is typically laminated, leaks vs broken glass, polycarbonate options.' },

  // ---- Insulated glass / energy ----
  { keyword: 'double pane vs triple pane glass', service: 'insulated-glass', angle: 'Comfort, weight, cost drivers, when triple pane is worth considering in New England.' },
  { keyword: 'argon gas filled windows explained', service: 'insulated-glass', angle: 'What argon does, whether it leaks out, and how it pairs with low-E.' },
  { keyword: 'condensation between window panes vs on the inside', service: 'insulated-glass', angle: 'Between panes = failed seal; on the room side = humidity. What to do in each case.' },
  { keyword: 'energy efficient glass for commercial buildings', service: 'insulated-glass', angle: 'Low-E, insulated units, tints and re-glazing older storefronts and curtain wall. No made-up savings percentages.' },
  { keyword: 'commercial window glass replacement in winter', service: 'insulated-glass', angle: 'Can it be done in the cold, how crews protect the space, sealant and scheduling considerations.' },

  // ---- Spandrel / curtain wall ----
  { keyword: 'curtain wall glass replacement', service: 'spandrel-glass', angle: 'Re-glazing vision and spandrel units on existing buildings, templating, access and matching appearance.' },
  { keyword: 'matching replacement glass on an older commercial building', service: 'spandrel-glass', angle: 'Tint, coatings, spandrel color, and why sampling and mockups matter.' },
  { keyword: 'back painted glass wall panels and backsplashes', service: 'spandrel-glass', angle: 'Kitchens, lobbies and feature walls: color matching, low-iron glass, installation.' },

  // ---- Lexan / plexiglass ----
  { keyword: 'polycarbonate vs glass for security windows', service: 'lexan-and-plexiglass', angle: 'Impact resistance, scratching, clarity, where each makes sense.' },
  { keyword: 'replacing yellowed or cloudy plexiglass', service: 'lexan-and-plexiglass', angle: 'Why acrylic and polycarbonate age, UV-stabilized options, cut-to-size replacements.' },
  { keyword: 'clear protective barriers and sneeze guards for businesses', service: 'lexan-and-plexiglass', angle: 'Counters, food service, reception, machine guards; mounting and cleaning.' },
  { keyword: 'cut to size plexiglass and lexan sheets', service: 'lexan-and-plexiglass', angle: 'Thickness, finishes (clear, tinted, frosted, mirrored), edges, and common uses.' },

  // ---- Wine rooms ----
  { keyword: 'glass wine cellar doors for homes', service: 'wine-rooms', angle: 'Insulated glass, seals, hardware, and avoiding condensation.' },
  { keyword: 'glass wine wall for restaurants', service: 'wine-rooms', angle: 'Display walls, climate control coordination, access, lighting through glass.' },
  { keyword: 'preventing condensation on glass wine rooms', service: 'wine-rooms', angle: 'Insulated units, dew point basics, HVAC coordination, door seals.' },

  // ---- Property managers / general ----
  { keyword: 'glass company for property managers', service: 'commercial-glass-repairs', angle: 'Multi-location service, photo-documented work orders, building-wide surveys, priority response.' },
  { keyword: 'commercial vs residential glass companies', service: null, angle: 'What differs (framing systems, hardware, safety glazing, scheduling) and why one crew that does both helps owners.' },
  { keyword: 'how to measure for replacement glass', service: 'commercial-glass-repairs', angle: 'Daylight opening vs glass size, why pros re-measure, and what photos to send for a quote.' },
  { keyword: 'do you need a permit to replace commercial glass in massachusetts', service: 'storefront-doors', angle: 'When permits commonly come up (new storefronts, structural or egress changes) vs simple like-for-like replacement. Tell readers to confirm with their local building department; no code section numbers.' },
];

// Hand-written evergreen topics (comparisons, code questions, problems people google)
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

// Natural search phrasing per service (the service names on the site don't always match how people search)
const SEARCH_TERM = {
  'storefront-doors': 'storefront doors',
  'commercial-doors': 'commercial glass doors',
  'herculite-doors': 'herculite doors',
  'office-sliders': 'glass office partitions',
  'heavy-glass': 'frameless glass showers',
  'tempered-safety-glass': 'tempered glass',
  'laminated-safety-glass': 'laminated glass',
  'insulated-glass': 'insulated glass replacement',
  'spandrel-glass': 'spandrel glass',
  'lexan-and-plexiglass': 'lexan and plexiglass',
  'commercial-glass-repairs': 'commercial glass repair',
  'wine-rooms': 'glass wine rooms',
};
const term = s => SEARCH_TERM[s.slug] || s.short.toLowerCase();

const COST_TOPICS = services.map(s => ({
  keyword: `${term(s)} cost in massachusetts`,
  service: s.slug,
  angle: 'What drives the price (size, glass type, hardware, access, permits, timing). Do NOT quote specific dollar figures; explain cost factors and how to get an accurate estimate.',
}));

function interleave(lists) {
  const out = [];
  const max = Math.max(0, ...lists.map(l => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

function buildTopics() {
  // Informational: custom topics lead; evergreen and cost topics are woven in behind them
  const informational = [...CUSTOM_TOPICS.filter(t => !t.town), ...interleave([EVERGREEN, COST_TOPICS])]
    .map(t => ({ ...t, type: 'informational' }));

  // Local: custom town topics first, then service+town pairs that town actually features (relevant, not every combination)
  const customLocal = CUSTOM_TOPICS.filter(t => t.town).map(t => ({ ...t, type: 'local' }));
  const localByService = services.map(s => towns
    .filter(t => t.featured.includes(s.slug))
    .map(t => ({
      type: 'local',
      keyword: `${term(s)} ${t.name.toLowerCase()} ma`,
      service: s.slug,
      town: t.slug,
      angle: `A genuinely local guide for ${t.name} property owners and businesses: use the town details provided, common building types there, and what to know before hiring.`,
    })));
  const local = [...customLocal, ...interleave(localByService)];

  // Publish pattern: 2 informational, then 1 local
  const mixed = [];
  let i = 0, j = 0;
  while (i < informational.length || j < local.length) {
    if (i < informational.length) mixed.push(informational[i++]);
    if (i < informational.length) mixed.push(informational[i++]);
    if (j < local.length) mixed.push(local[j++]);
  }

  // De-dupe by keyword and drop unknown slugs
  const seen = new Set();
  return mixed.filter(t => {
    const k = t.keyword.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    if (t.service && !serviceBySlug[t.service]) t.service = null;
    t.keyword = k;
    return true;
  });
}

module.exports = { buildTopics, CUSTOM_TOPICS };
