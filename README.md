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
   - `GHL_WEBHOOK_URL` — already defaults to the RPM Glass sub-account inbound webhook in `server.js`; only set this if the workflow trigger URL changes. Form posts JSON: full_name, phone, email, town, service, property_type, message, page, source.
4. Point the rpmglass.com domain at the Railway service.

## Editing content
- Services: `data/services.js` (copy, features, FAQs, related links).
- Towns: `data/towns.js` (add a town → page, sitemap, footer and nav update automatically).
- Images: `data/images.js` (swap a URL, redeploy).
- Business info (phone, address, hours): top of `server.js`.

## Daily SEO blog

Articles publish on their own on most days at a varying time between 7 AM and 5 PM ET, with roughly 1 day in 9 skipped (never two in a row) so the cadence looks natural. from the keyword queue in `data/blog-topics.js`, written by Claude, with internal links checked against real site pages. Posts live in Postgres and appear at `/blog`, `/blog/topic/<service>`, `/blog/<slug>`, in `/sitemap.xml`, and as "guides" links on service and town pages.

Railway setup:
1. Add a **Postgres** service to the project and give the site a variable `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`.
2. Add `ANTHROPIC_API_KEY`.
3. Add `ADMIN_KEY` (any long random string) and open `https://rpmglass.com/admin/blog?key=THAT_KEY` to see the queue, log, and a "generate now" button.

Optional variables: `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`), `BLOG_PUBLISH_HOUR` (earliest ET hour, default 7), `BLOG_PUBLISH_WINDOW` (hours after that, default 10), `BLOG_SKIP_PERCENT` (default 15), `BLOG_POSTS_PER_DAY` (default 1), `BLOG_AUTOPUBLISH=false` to pause. The admin page shows the next 14 days of the plan.

Add client keywords to `CUSTOM_TOPICS` at the top of `data/blog-topics.js`; they publish first.
