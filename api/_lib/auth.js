// api/_lib/auth.js — admin credentials + stateless HMAC session tokens.
//
// Files under api/_lib are shared code, not endpoints: Vercel does not deploy
// underscore-prefixed paths in /api as functions.
//
// Why this exists: the previous login.js kept a static salt and SHA-256 hashes
// in source, sessions in lambda memory (invisible to other instances), and
// verify.js / stats.js accepted ANY well-formed bearer string. Now:
//   - users live in the ADMIN_USERS env var (never in the repo),
//   - passwords are scrypt-hashed with a per-user random salt,
//   - a session is a signed token any instance can verify without shared state.
//
// Env vars (set in Vercel → Project → Settings → Environment Variables):
//   ADMIN_USERS          JSON array: [{"username":"andy","name":"Andy","role":"admin","hash":"scrypt$<salt>$<key>"}]
//                        Make a hash with: node api/_lib/hash-password.js '<password>'
//   ADMIN_SESSION_SECRET 32+ random bytes, e.g. `openssl rand -hex 32`

const crypto = require('crypto');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SCRYPT_KEYLEN = 32;

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** Users from ADMIN_USERS. Malformed env → no users → nobody can log in. */
function loadUsers() {
  const raw = process.env.ADMIN_USERS;
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (u) => u && typeof u.username === 'string' && typeof u.hash === 'string',
    ).map((u) => ({
      username: String(u.username).toLowerCase(),
      name: String(u.name || u.username),
      role: ['admin', 'editor', 'viewer'].includes(u.role) ? u.role : 'viewer',
      hash: u.hash,
    }));
  } catch (e) {
    console.error('[auth] ADMIN_USERS is not valid JSON');
    return [];
  }
}

/** "scrypt$<salt hex>$<key hex>" — salt is random per user. */
function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const key = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(String(password), Buffer.from(parts[1], 'hex'), expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** Constant-time-ish lookup: always run one scrypt even for unknown users. */
function authenticateUser(username, password) {
  const users = loadUsers();
  const user = users.find((u) => u.username === String(username || '').toLowerCase());
  const stored = user ? user.hash : hashPassword('decoy', '00000000000000000000000000000000');
  const ok = verifyPassword(password, stored);
  return ok && user ? { username: user.username, name: user.name, role: user.role } : null;
}

// ---------------------------------------------------------------------------
// Session tokens: base64url(payload).base64url(HMAC-SHA256(payload))
// ---------------------------------------------------------------------------

function getSecret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('ADMIN_SESSION_SECRET is missing or shorter than 32 chars');
  return s;
}

function signToken(user, ttlMs = SESSION_TTL_MS) {
  const payload = b64url(JSON.stringify({
    u: user.username, n: user.name, r: user.role,
    exp: Date.now() + ttlMs,
  }));
  const sig = b64url(crypto.createHmac('sha256', getSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

/** → { username, name, role, exp } or null. Never throws on bad input. */
function verifyToken(token) {
  try {
    if (typeof token !== 'string') return null;
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = b64url(crypto.createHmac('sha256', getSecret()).update(payload).digest());
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(fromB64url(payload).toString('utf8'));
    if (!data || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return { username: data.u, name: data.n, role: data.r, exp: data.exp };
  } catch (e) {
    return null;
  }
}

/** Bearer token from the request → user or null. */
function authenticateRequest(req) {
  const auth = req.headers && req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7).trim());
}

module.exports = {
  SESSION_TTL_MS,
  loadUsers,
  hashPassword,
  verifyPassword,
  authenticateUser,
  signToken,
  verifyToken,
  authenticateRequest,
};
