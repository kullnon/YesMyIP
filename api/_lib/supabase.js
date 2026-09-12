// api/_lib/supabase.js — minimal Supabase REST client for the serverless
// functions. No npm dependency (this repo has no package.json); PostgREST is
// plain HTTPS and Node 18+ has fetch built in.
//
// Env vars:
//   SUPABASE_URL          https://<ref>.supabase.co
//   SUPABASE_SERVICE_KEY  service-role key. Server-side ONLY — it bypasses RLS.

function config() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  return url && key ? { url, key } : null;
}

function isConfigured() {
  return config() !== null;
}

async function request(path, body, extraHeaders) {
  const cfg = config();
  if (!cfg) throw new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY)');
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/** Insert one row. Returns nothing; throws on failure. */
async function insert(table, row) {
  await request(table, row, { Prefer: 'return=minimal' });
}

/** Call a Postgres function via PostgREST. */
async function rpc(fn, args) {
  return request(`rpc/${fn}`, args || {});
}

module.exports = { isConfigured, insert, rpc };
