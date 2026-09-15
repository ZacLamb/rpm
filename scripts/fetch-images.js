// Runs on `npm install` (postinstall). Downloads the Higgsfield renders, resizes them to a web-friendly
// width and converts to WebP (via sharp) into public/images. Failures are non-fatal — templates fall
// back to a .png copy if sharp is unavailable, or to the remote URL if the download failed.
const fs = require('fs');
const path = require('path');
const images = require('../data/images');

const dir = path.join(__dirname, '..', 'public', 'images');
fs.mkdirSync(dir, { recursive: true });
const MAX_W = 1600, QUALITY = 78;

let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.log('[images] sharp unavailable, saving PNG originals'); }

async function fetchOne(key, { file, url }) {
  const dest = path.join(dir, file);
  const pngDest = dest.replace(/\.webp$/, '.png');
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return 'cached';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (sharp) {
      const out = await sharp(buf).resize({ width: MAX_W, withoutEnlargement: true }).webp({ quality: QUALITY }).toBuffer();
      fs.writeFileSync(dest, out);
      return `webp ${(out.length / 1024).toFixed(0)}KB (from ${(buf.length / 1024).toFixed(0)}KB)`;
    }
    fs.writeFileSync(pngDest, buf);
    return 'png (uncompressed)';
  } catch (e) {
    return 'failed (' + e.message + ') — will use remote URL';
  }
}

(async () => {
  if (typeof fetch !== 'function') { console.log('[images] Node <18, skipping'); return; }
  const results = await Promise.all(Object.entries(images).map(([k, v]) => fetchOne(k, v).then(r => [k, r])));
  for (const [k, r] of results) console.log(`[images] ${k}: ${r}`);
})();
