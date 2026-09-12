// api/login.js — POST {username, password} → {token, user}
//
// Credentials come from the ADMIN_USERS env var (scrypt hashes, see
// api/_lib/auth.js). The token is HMAC-signed, so /api/verify and /api/stats
// can check it on any lambda instance without shared session state.
//
// Rate limiting is per-instance in-memory: good enough to blunt a password
// spray against a low-traffic admin, not a substitute for strong passwords.

const { authenticateUser, signToken, SESSION_TTL_MS } = require('./_lib/auth');

const attempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  return (xf ? String(xf).split(',')[0] : req.headers['x-real-ip'] || 'unknown').trim();
}
function isLocked(ip) {
  const r = attempts.get(ip);
  if (!r) return false;
  if (Date.now() - r.first > LOCKOUT_MS) { attempts.delete(ip); return false; }
  return r.count >= MAX_ATTEMPTS;
}
function recordFailure(ip) {
  const r = attempts.get(ip) || { count: 0, first: Date.now() };
  r.count += 1;
  attempts.set(ip, r);
  return Math.max(0, MAX_ATTEMPTS - r.count);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = clientIp(req);
  if (isLocked(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.', locked: true });
  }

  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = authenticateUser(username, password);
    if (!user) {
      const remaining = recordFailure(ip);
      return res.status(401).json({ error: 'Invalid credentials', remaining });
    }

    attempts.delete(ip);
    return res.status(200).json({
      token: signToken(user),
      user,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
  } catch (e) {
    console.error('[login]', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
};
