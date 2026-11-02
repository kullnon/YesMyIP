// api/subscribe.js — newsletter signup.
//
//   POST {email, source?, locale?, website?}  → newsletter_subscribers
//
// Replaces the localStorage-only form (signups were never stored server-side).
// `website` is a honeypot: bots that fill it get a fake success and nothing is saved.
// A repeat address is a success, not an error (unique index on lower(email)).

const { isConfigured, insertIgnoreDuplicate, rest } = require('./_lib/supabase');
const { isSynthetic } = require('./_lib/synthetic');

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

function sanitize(v, max) {
  if (typeof v !== 'string') return null;
  const s = v.replace(CONTROL_CHARS, '').trim();
  return s ? s.slice(0, max) : null;
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return null; } }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const body = parseBody(req);
  if (!body) return res.status(400).json({ ok: false, error: 'invalid_body' });
  if (body.website) return res.status(200).json({ ok: true }); // honeypot

  const email = sanitize(body.email, 320);
  if (!email || !EMAIL.test(email)) return res.status(400).json({ ok: false, error: 'invalid_email' });

  if (!isConfigured()) {
    console.error('subscribe: Supabase not configured; signup NOT stored');
    return res.status(503).json({ ok: false, error: 'unavailable' });
  }

  // Flow Watchdog probe (signed x-maestro-synthetic header, _lib/synthetic.js): validated like a
  // real signup, then the write is proven (insert, read back, delete) with a unique reserved
  // address. Nothing else happens for it.
  if (isSynthetic(req.headers, 'yesmyip')) {
    try {
      const probe = `flow-watchdog+${Date.now()}@synthetic.invalid`;
      const rows = await rest('POST', 'newsletter_subscribers', { email: probe, source: 'flow_watchdog', is_test: true });
      const id = rows && rows[0] && rows[0].id;
      if (!id) throw new Error('insert returned no row');
      const back = await rest('GET', `newsletter_subscribers?id=eq.${id}&select=id`);
      await rest('DELETE', `newsletter_subscribers?id=eq.${id}`);
      if (!back || !back.length) throw new Error('read-back missing');
      return res.status(200).json({ ok: true, synthetic: { write: 'verified' } });
    } catch (err) {
      return res.status(503).json({ ok: false, synthetic: { write: 'failed', error: String(err && err.message).slice(0, 200) } });
    }
  }

  try {
    await insertIgnoreDuplicate('newsletter_subscribers', {
      email: email.toLowerCase(),
      source: sanitize(body.source, 50),
      locale: sanitize(body.locale, 5),
      country: sanitize(req.headers['x-vercel-ip-country'], 5),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('subscribe: insert failed', err && err.message);
    return res.status(500).json({ ok: false, error: 'save_failed' });
  }
};
