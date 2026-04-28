const https = require('https');
const fs = require('fs');

const GC_TOKEN = '1wjeluv2hg97jls31ztzix2p2ky0yv472iokx9v3nel42ewrn';
const GC_HOST = 'yesmyip.goatcounter.com';
const STATS_FILE = '/tmp/ymip_cumulative_stats.json';

function gcRequest(reqPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: GC_HOST, path: '/api/v0' + reqPath, method: 'GET',
      headers: { 'Authorization': 'Bearer ' + GC_TOKEN, 'Content-Type': 'application/json' }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function loadCum() {
  try { if (fs.existsSync(STATS_FILE)) return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')); } catch (e) {}
  return { daily: {}, pages: {}, countries: {}, allTime: 0 };
}
function saveCum(d) { try { fs.writeFileSync(STATS_FILE, JSON.stringify(d)); } catch (e) {} }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://yesmyip.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const [total, hits, locations] = await Promise.all([
      gcRequest('/stats/total'), gcRequest('/stats/hits?limit=20'), gcRequest('/stats/locations')
    ]);

    let cum = loadCum();

    // Merge daily — never decrease
    for (const day of (total.stats || [])) {
      cum.daily[day.day] = Math.max(cum.daily[day.day] || 0, day.daily || 0);
    }

    // Merge pages — never decrease
    for (const hit of (hits.hits || [])) {
      cum.pages[hit.path] = Math.max(cum.pages[hit.path] || 0, hit.count || 0);
    }

    // Merge countries — never decrease
    for (const loc of (locations.stats || [])) {
      if (!cum.countries[loc.id]) cum.countries[loc.id] = { name: loc.name, count: 0 };
      cum.countries[loc.id].name = loc.name;
      cum.countries[loc.id].count = Math.max(cum.countries[loc.id].count, loc.count || 0);
    }

    // True all-time = sum of all daily history
    const trueTotal = Object.values(cum.daily).reduce((a, b) => a + b, 0);
    cum.allTime = Math.max(cum.allTime, trueTotal);
    saveCum(cum);

    // Date range calculations
    const now = new Date();
    function dayStr(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
    function daysAgo(n) { const d = new Date(now); d.setDate(d.getDate() - n); return dayStr(d); }
    function sumFrom(start) { let s = 0; for (const [d, c] of Object.entries(cum.daily)) { if (d >= start) s += c; } return s; }

    const todayStr = dayStr(now);
    const todayV = cum.daily[todayStr] || 0;

    // Chart data — last 14 days
    const chart = [];
    for (let i = 13; i >= 0; i--) { const d = daysAgo(i); chart.push({ day: d, daily: cum.daily[d] || 0 }); }

    // Sorted pages and countries
    const sortedPages = Object.entries(cum.pages).map(([p, c]) => ({ path: p, count: c })).sort((a, b) => b.count - a.count).slice(0, 20);
    const sortedCountries = Object.entries(cum.countries).map(([id, d]) => ({ id, name: d.name, count: d.count })).sort((a, b) => b.count - a.count).slice(0, 10);

    return res.status(200).json({
      total: { total: cum.allTime, today: todayV, last7: sumFrom(daysAgo(7)), last30: sumFrom(daysAgo(30)), last90: sumFrom(daysAgo(90)), stats: chart },
      hits: { hits: sortedPages },
      locations: { stats: sortedCountries }
    });
  } catch (e) {
    return res.status(500).json({ error: 'Failed: ' + e.message });
  }
};
