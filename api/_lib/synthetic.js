// Flow Watchdog synthetic requests (maestro-os, lib/flow-watchdog/sign.ts).
//
// Header  x-maestro-synthetic: v1.<unix-ms>.<base64url Ed25519 signature of "v1.<unix-ms>.<site>">
// signed by maestro-os's private key; verified here with the PUBLIC key (nothing secret in this
// repo). Valid for 5 minutes. A request that passes is a monitoring probe: validate it as usual,
// prove the database write (or skip it), and NEVER send email/SMS/Telegram for it.

const { createPublicKey, verify } = require('crypto');

const SYNTHETIC_HEADER = 'x-maestro-synthetic';
const PUBLIC_KEY_SPKI_B64 = 'MCowBQYDK2VwAyEA4FhPuGzVRUzczD4rBgitV2rmOoVoLdy0MaywUlhW+Q4=';
const MAX_AGE_MS = 5 * 60 * 1000;
let publicKey = null;

function isSynthetic(headers, site, now = Date.now()) {
  const raw = typeof headers.get === 'function' ? headers.get(SYNTHETIC_HEADER) : headers[SYNTHETIC_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return false;
  const m = /^v1\.(\d{10,16})\.([A-Za-z0-9_-]+)$/.exec(String(value).trim());
  if (!m) return false;
  const ts = Number(m[1]);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_AGE_MS) return false;
  try {
    publicKey = publicKey || createPublicKey({ key: Buffer.from(PUBLIC_KEY_SPKI_B64, 'base64'), format: 'der', type: 'spki' });
    return verify(null, Buffer.from(`v1.${m[1]}.${site}`), publicKey, Buffer.from(m[2], 'base64url'));
  } catch (e) {
    return false;
  }
}

module.exports = { SYNTHETIC_HEADER, isSynthetic };
