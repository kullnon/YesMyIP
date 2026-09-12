// api/stats.js — GET, Authorization: Bearer <session token> → dashboard data.
//
// Replaces the GoatCounter proxy (third-party analytics, API token committed
// in this file, running totals in a per-lambda /tmp file). Now one call to
// admin_dashboard_summary() in Supabase (supabase/001_analytics.sql), which
// aggregates the first-party page_views / affiliate_clicks tables in Postgres,
// in America/New_York, with no row cap.
//
// Response shape (all counts are numbers, all keys NY-local):
// {
//   configured: true,
//   generated_at, tz, today_key: 'YYYY-MM-DD', hour_key: 'YYYY-MM-DDTHH',
//   first_pageview_at,
//   ranges: { today|7d|30d|90d|all: { pageviews, visitors, clicks, revenue,
//             clicks_by_source: {nordvpn: n, ...},
//             top_pages: [{path, views, sessions}], top_countries: [{country, count}] } },
//   series: { daily: [{bucket, page_views, unique_visitors, clicks, revenue}], hourly: [...] },
//   recent_clicks: [{source, path, country, created_at}]
// }

const { authenticateRequest } = require('./_lib/auth');
const { isConfigured, rpc } = require('./_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // A real check now: signature + expiry. The previous version accepted any
  // header that started with "Bearer ".
  const user = authenticateRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (!isConfigured()) {
    // Deployed before the Supabase project is wired: tell the dashboard
    // plainly instead of returning zeros that look like data.
    return res.status(503).json({ configured: false, error: 'Analytics database not configured yet' });
  }

  try {
    const data = await rpc('admin_dashboard_summary', {});
    return res.status(200).json({ configured: true, ...data });
  } catch (e) {
    console.error('[/api/stats]', e.message);
    return res.status(500).json({ error: 'Failed to load analytics' });
  }
};
