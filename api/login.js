const crypto = require('crypto');

// Hashed passwords — never exposed to the client
const SALT = 'ymip_2026_salt';
const USERS = [
  { username: 'andy', hash: 'a8d2c5ebb3d53c202bb9d40d773971847d5d1aa5627376a524de56e3a02b698d', role: 'admin', name: 'Andy' },
  { username: 'jean', hash: '2e7b44038aeabeb9d4dd6d6f216123c1adf19c71594acd8c333e99cf25833146', role: 'viewer', name: 'Jean Cherubin' },
];

// Session tokens (in-memory, resets on cold start — fine for low traffic)
const sessions = new Map();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting (in-memory)
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function hashPw(pw) {
  return crypto.createHash('sha256').update(SALT + pw).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function isRateLimited(ip) {
  const record = attempts.get(ip);
  if (!record) return false;
  if (Date.now() - record.firstAttempt > LOCKOUT_MS) {
    attempts.delete(ip);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip) {
  const record = attempts.get(ip) || { count: 0, firstAttempt: Date.now() };
  record.count++;
  attempts.set(ip, record);
}

function clearAttempts(ip) {
  attempts.delete(ip);
}

// Clean expired sessions periodically
function cleanSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.created > SESSION_TTL) sessions.delete(token);
  }
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://yesmyip.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  
  // Check rate limit
  if (isRateLimited(ip)) {
    return res.status(429).json({ 
      error: 'Too many attempts. Try again in 15 minutes.',
      locked: true 
    });
  }

  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const hash = hashPw(password);
    const user = USERS.find(u => u.username.toLowerCase() === username.toLowerCase() && u.hash === hash);

    if (!user) {
      recordAttempt(ip);
      const record = attempts.get(ip);
      const remaining = MAX_ATTEMPTS - (record ? record.count : 0);
      return res.status(401).json({ 
        error: 'Invalid credentials',
        remaining: Math.max(0, remaining)
      });
    }

    // Success — clear rate limit, create session
    clearAttempts(ip);
    cleanSessions();
    
    const token = generateToken();
    sessions.set(token, {
      username: user.username,
      role: user.role,
      name: user.name,
      created: Date.now()
    });

    return res.status(200).json({
      token,
      user: { username: user.username, role: user.role, name: user.name }
    });

  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};
