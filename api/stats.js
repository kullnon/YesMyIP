const https = require('https');

// GoatCounter API token — NEVER sent to the browser
const GC_TOKEN = '1wjeluv2hg97jls31ztzix2p2ky0yv472iokx9v3nel42ewrn';
const GC_HOST = 'yesmyip.goatcounter.com';

function gcRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: GC_HOST,
      path: '/api/v0' + path,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + GC_TOKEN,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } 
        catch (e) { reject(new Error('Invalid JSON')); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://yesmyip.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'public, max-age=60'); // Cache for 60s

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Simple auth check — require a session token
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Fetch all stats in parallel
    const [total, hits, locations] = await Promise.all([
      gcRequest('/stats/total'),
      gcRequest('/stats/hits?limit=20'),
      gcRequest('/stats/locations')
    ]);

    return res.status(200).json({
      total: total,
      hits: hits,
      locations: locations
    });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch analytics: ' + e.message });
  }
};
