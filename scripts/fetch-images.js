// Runs on `npm install` (postinstall). Downloads Higgsfield renders into public/images so the
// site serves them locally. Failures are non-fatal — templates fall back to the remote URL.
const fs = require('fs');
const path = require('path');
const images = require('../data/images');

const dir = path.join(__dirname, '..', 'public', 'images');
fs.mkdirSync(dir, { recursive: true });

async function fetchOne(key, { file, url }) {
  const dest = path.join(dir, file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return 'cached';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    return 'downloaded';
  } catch (e) {
    return 'failed (' + e.message + ')';
  }
}

(async () => {
  if (typeof fetch !== 'function') { console.log('[images] Node <18, skipping'); return; }
  const entries = Object.entries(images);
  const results = await Promise.all(entries.map(([k, v]) => fetchOne(k, v).then(r => [k, r])));
  for (const [k, r] of results) console.log(`[images] ${k}: ${r}`);
})();
