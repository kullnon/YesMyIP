// api/verify.js — POST with Authorization: Bearer <token> → {valid, user}
//
// Verifies the HMAC signature and expiry (api/_lib/auth.js). The old version
// only checked that the token was 64 hex characters, which any string could be.

const { authenticateRequest } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = authenticateRequest(req);
  if (!user) return res.status(401).json({ valid: false, error: 'Invalid or expired session' });
  return res.status(200).json({ valid: true, user: { username: user.username, name: user.name, role: user.role } });
};
