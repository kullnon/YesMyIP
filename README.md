# QualesMiIP.com
## Trilingual IP Address & VPN Site — ES / EN / FR
## GitHub: kullnon | Vercel Deploy

---

## REPO STRUCTURE
```
/                     ← Spanish (default, qualesmiip.com/)
/en/                  ← English (qualesmiip.com/en/)
/fr/                  ← French (qualesmiip.com/fr/)
/legal/               ← Spanish legal pages
/en/legal/            ← English legal pages
/fr/legal/            ← French legal pages
/blog/                ← Spanish articles
/en/blog/             ← English articles
/fr/blog/             ← French articles
/tools/               ← Shared tools (IP lookup, speed, breach, quiz)
/assets/              ← Images, icons, OG images
vercel.json           ← Routing, headers, redirects
sitemap.xml           ← Full trilingual sitemap
robots.txt            ← Crawler rules
manifest.json         ← PWA manifest
deals.json            ← VPN pricing — update monthly
```

---

## DEPLOY IN 4 STEPS (do this now)

### Step 1: Push to GitHub
```bash
cd /path/to/qualesmiip
git init
git add .
git commit -m "Initial commit — trilingual site ES/EN/FR"
git remote add origin https://github.com/kullnon/qualesmiip.git
git push -u origin main
```
→ Go to github.com → New repository → name: "qualesmiip" → public → create
→ Then run the commands above

### Step 2: Deploy to Vercel
1. Go to vercel.com
2. Click "Add New Project"
3. Import from GitHub → select "kullnon/qualesmiip"
4. Framework: Other (static HTML)
5. Click Deploy
→ Live in 30 seconds at qualesmiip-xxx.vercel.app

### Step 3: Connect qualesmiip.com
1. In Vercel → Project Settings → Domains
2. Add domain: qualesmiip.com
3. Vercel shows you DNS records to add
4. Go to your domain registrar → DNS settings
5. Add the CNAME or A records Vercel shows
→ SSL automatic, live in 24-48 hours (usually minutes)

### Step 4: Test all 3 languages
- https://qualesmiip.com → Spanish ✓
- https://qualesmiip.com/en/ → English ✓
- https://qualesmiip.com/fr/ → French ✓

---

## BEFORE YOU LAUNCH — CRITICAL

1. **Replace affiliate links** — search "YOUR_NORDVPN_AFFILIATE_LINK" etc. in all HTML files
   and replace with real links from Impact.com / CJ Affiliate

2. **Replace GA4 ID** — search "G-XXXXXXXXXX" → replace with your real GA4 Measurement ID

3. **Apply for affiliate programs** (same day as deploy):
   - NordVPN: partners.nordvpn.com
   - ExpressVPN: expressvpn.com/order/affiliates
   - Surfshark: surfshark.com/affiliates
   - CyberGhost: cj.com → search CyberGhost

4. **Apply for Google AdSense**: adsense.google.com
   - Need live domain + legal pages published first

5. **Submit sitemap** to Google Search Console:
   - search.google.com/search-console
   - Add property: qualesmiip.com
   - Submit: https://qualesmiip.com/sitemap.xml

---

## SEO — WHY THIS STRUCTURE WINS

Each language has its own URL path:
- / = Spanish = targets "cuál es mi ip" (1.2M monthly searches)
- /en/ = English = targets "what is my ip" (1.5M monthly searches)
- /fr/ = French = targets "quelle est mon ip" (280K monthly searches)

The hreflang tags in every page tell Google which version to show to which users.
Three separate rankings. Triple the organic traffic potential.

Spanish market is huge and UNDERSERVED — WhatIsMyIPAddress.com barely covers it.
This is your first-mover advantage.

---

## UPDATING DEALS (every month)

1. Open deals.json
2. Update prices, deals, expiry dates
3. git add deals.json && git commit -m "Update VPN deals [month]" && git push
→ Vercel auto-deploys in 30 seconds. All pages updated instantly.

---

## ADDING ARTICLES

For each new article:
1. Create: /blog/[slug].html (Spanish)
2. Create: /en/blog/[slug].html (English)  
3. Create: /fr/blog/[slug].html (French)
4. Add URL to sitemap.xml
5. git push → auto-deploy
6. Submit URLs in Google Search Console → Request Indexing

Use Content Factory (in Andy's toolkit) to generate all 3 language versions.

---

## REVENUE TARGETS

| Month | Visitors | Revenue |
|-------|----------|---------|
| 1 | 600 | $8 |
| 3 | 3,500 | $320 |
| 6 | 18,000 | $3,100 |
| 12 | 60,000 | $9,200 |

3 languages × 3× the keyword opportunities = faster growth than English-only.

---

Built with Claude (Anthropic) — April 2026
Maestro Media Group / Andy
