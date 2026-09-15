# RPM Glass — rpmglass.com

Node/Express + EJS marketing site for RPM Glass (Northborough, MA). Built for GitHub → Railway auto-deploy.

## Pages
- `/` home · `/about` · `/services` · `/services/:slug` (12 service pages) · `/service-areas` · `/service-areas/:slug` (30 town pages) · `/gallery` · `/contact`
- `/sitemap.xml` and `/robots.txt` are generated automatically from the data files.

## Deploy on Railway
1. Push this repo to GitHub and create a Railway service from it. Railway detects Node and runs `npm install` → `npm start`.
2. `npm install` triggers `postinstall`, which downloads the Higgsfield renders in `data/images.js` into `public/images/`. If a download fails the site falls back to the remote URL.
3. Set variables:
   - `SITE_URL` = `https://rpmglass.com`
   - `GHL_WEBHOOK_URL` = inbound-webhook URL from a GHL workflow (form posts JSON: full_name, phone, email, town, service, property_type, message, page, source).
4. Point the rpmglass.com domain at the Railway service.

## Editing content
- Services: `data/services.js` (copy, features, FAQs, related links).
- Towns: `data/towns.js` (add a town → page, sitemap, footer and nav update automatically).
- Images: `data/images.js` (swap a URL, redeploy).
- Business info (phone, address, hours): top of `server.js`.
