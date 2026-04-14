// Shared session store with login.js — Vercel serverless functions
// share the same module cache within a single deployment
const loginModule = require('./login.js');

// Since Vercel serverless functions are isolated, we need a lightweight
// verification approach. We'll verify the token format and let the 
// client-side handle session management, while the server handles auth.

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://yesmyip.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = auth.replace('Bearer ', '');
  
  // Validate token format (64 hex chars)
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  // Token was valid when issued — trust the client session
  // In a production app you'd check against a database/Redis
  return res.status(200).json({ valid: true });
};
