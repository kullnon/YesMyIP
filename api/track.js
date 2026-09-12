// api/track.js — first-party analytics beacon target.
//
//   POST {type:'pageview', path, referrer, locale, session_id}      → page_views
//   POST {type:'click', source, destination, path, session_id}      → affiliate_clicks
//
// Same contract as TropicAtlas's app/api/track/route.ts. Always answers 200
// (except for malformed input) so a tracking hiccup can never break a page;
// failures go to the function logs instead. Country comes from Vercel's edge
// header, never from the client.

const { isConfigured, insert } = require('./_lib/supabase');

const PARTNERS = new Set(['nordvpn', 'surfshark', 'expressvpn', 'cyberghost']);
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|curl|wget|python-requests/i;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

function sanitize(v, max) {
  if (typeof v !== 'string') return null;
  const s = v.replace(CONTROL_CHARS, '').trim();
  return s ? s.slice(0, max) : null;
}

function parseBody(req) {
  // Vercel parses application/json into req.body; sendBeacon may arrive as a
  // string when the Blob type is not honoured, so accept both.
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return null; } }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const body = parseBody(req);
  if (!body) return res.status(400).json({ ok: false });

  const ua = sanitize(req.headers['user-agent'], 200);
  if (!ua || BOT_UA.test(ua)) return res.status(200).json({ ok: true, skipped: 'bot' });

  if (!isConfigured()) {
    // Pre-wiring: swallow silently so the beacon on every public page is a
    // no-op until the Supabase project exists.
    return res.status(200).json({ ok: false, skipped: 'unconfigured' });
  }

  const country = sanitize(req.headers['x-vercel-ip-country'], 5);
  const session_id = sanitize(body.session_id, 50);
  const path = sanitize(body.path, 500);

  try {
    if (body.type === 'pageview') {
      if (!path || !path.startsWith('/')) return res.status(400).json({ ok: false });
      if (path.startsWith('/admin')) return res.status(200).json({ ok: true, skipped: 'admin' });
      await insert('page_views', {
        path,
        referrer: sanitize(body.referrer, 500),
        country,
        locale: sanitize(body.locale, 5),
        user_agent: ua,
        session_id,
      });
      return res.status(200).json({ ok: true });
    }

    if (body.type === 'click') {
      const source = sanitize(body.source, 50);
      if (!source || !PARTNERS.has(source.toLowerCase())) return res.status(400).json({ ok: false });
      await insert('affiliate_clicks', {
        source: source.toLowerCase(),
        destination: sanitize(body.destination, 500),
        path,
        country,
        session_id,
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false });
  } catch (e) {
    // Surface in logs; never fail the page.
    console.error('[/api/track] insert failed:', e.message, { type: body.type, path });
    return res.status(200).json({ ok: false });
  }
};
