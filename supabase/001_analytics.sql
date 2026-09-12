-- supabase/001_analytics.sql — first-party analytics for yesmyip.com
--
-- Apply once to the yesmyip Supabase project (SQL editor or MCP apply_migration).
-- Ported from TropicAtlas: page_views + affiliate_clicks written by /api/track,
-- read by /admin through admin_dashboard_summary(). Everything the dashboard
-- shows is aggregated HERE, in Postgres:
--   - no PostgREST 1000-row cap (the old TropicAtlas chart silently dropped the
--     oldest days once page_views passed 1000 rows in a month),
--   - one timezone, America/New_York, for "today", every day bucket and every
--     hour bucket, so a counter and the chart point under it always agree.
--
-- Access: RLS is enabled with NO policies, so the anon key can neither read
-- nor write. Only the service-role key (server-side functions) touches these.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.page_views (
  id          bigint generated always as identity primary key,
  path        text not null,
  referrer    text,
  country     text,
  locale      text,
  user_agent  text,
  session_id  text,
  created_at  timestamptz not null default now()
);
create index if not exists page_views_created_at_idx on public.page_views (created_at desc);
create index if not exists page_views_session_idx    on public.page_views (session_id);
create index if not exists page_views_path_idx       on public.page_views (path);

create table if not exists public.affiliate_clicks (
  id          bigint generated always as identity primary key,
  source      text not null,          -- nordvpn | surfshark | expressvpn | cyberghost
  destination text,
  path        text,
  country     text,
  session_id  text,
  created_at  timestamptz not null default now()
);
create index if not exists affiliate_clicks_created_at_idx on public.affiliate_clicks (created_at desc);
create index if not exists affiliate_clicks_source_idx     on public.affiliate_clicks (source);

-- Manual revenue log (affiliate payouts, AdSense). Empty until someone enters
-- a row, which is the honest state of the Revenue counter: real and zero, not
-- a hardcoded zero.
create table if not exists public.revenue_entries (
  id          bigint generated always as identity primary key,
  source      text not null,
  amount      numeric(12,2) not null,
  currency    text not null default 'USD',
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists revenue_entries_created_at_idx on public.revenue_entries (created_at desc);

alter table public.page_views       enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.revenue_entries  enable row level security;

-- ---------------------------------------------------------------------------
-- admin_traffic_series — zero-filled per-bucket series in New York time.
--   p_bucket 'day'  → keys 'YYYY-MM-DD'
--   p_bucket 'hour' → keys 'YYYY-MM-DDTHH'
-- Every bucket between p_from and p_to is returned, empty ones as zeros: a day
-- with no traffic is a real flat spot, not a gap for the line to jump over.
-- generate_series walks NAIVE local timestamps, so DST cannot skip or double
-- a day.
-- ---------------------------------------------------------------------------

create or replace function public.admin_traffic_series(
  p_from   timestamptz,
  p_to     timestamptz,
  p_bucket text default 'day'
)
returns table (
  bucket          text,
  page_views      bigint,
  unique_visitors bigint,
  clicks          bigint,
  revenue         numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      case when p_bucket = 'hour' then 'hour' else 'day' end                              as unit,
      case when p_bucket = 'hour' then 'YYYY-MM-DD"T"HH24' else 'YYYY-MM-DD' end          as fmt,
      case when p_bucket = 'hour' then interval '1 hour' else interval '1 day' end        as step
  ),
  slots as (
    select to_char(g, params.fmt) as b
    from params,
         generate_series(
           date_trunc(params.unit, p_from at time zone 'America/New_York'),
           date_trunc(params.unit, (p_to - interval '1 microsecond') at time zone 'America/New_York'),
           params.step
         ) as g
  ),
  pv as (
    select to_char(date_trunc(params.unit, v.created_at at time zone 'America/New_York'), params.fmt) as b,
           count(*) as views, count(distinct v.session_id) as uniques
    from page_views v, params
    where v.created_at >= p_from and v.created_at < p_to
    group by 1
  ),
  ck as (
    select to_char(date_trunc(params.unit, c.created_at at time zone 'America/New_York'), params.fmt) as b,
           count(*) as n
    from affiliate_clicks c, params
    where c.created_at >= p_from and c.created_at < p_to
    group by 1
  ),
  rv as (
    select to_char(date_trunc(params.unit, r.created_at at time zone 'America/New_York'), params.fmt) as b,
           sum(r.amount) as amt
    from revenue_entries r, params
    where r.created_at >= p_from and r.created_at < p_to
    group by 1
  )
  select
    slots.b                  as bucket,
    coalesce(pv.views, 0)    as page_views,
    coalesce(pv.uniques, 0)  as unique_visitors,
    coalesce(ck.n, 0)        as clicks,
    coalesce(rv.amt, 0)      as revenue
  from slots
  left join pv on pv.b = slots.b
  left join ck on ck.b = slots.b
  left join rv on rv.b = slots.b
  order by slots.b;
$$;

-- ---------------------------------------------------------------------------
-- admin_range_stats — everything one range selector value needs.
-- p_from null = all time.
-- ---------------------------------------------------------------------------

create or replace function public.admin_range_stats(p_from timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'pageviews', (select count(*) from page_views
                  where p_from is null or created_at >= p_from),
    'visitors',  (select count(distinct session_id) from page_views
                  where session_id is not null and (p_from is null or created_at >= p_from)),
    'clicks',    (select count(*) from affiliate_clicks
                  where p_from is null or created_at >= p_from),
    'revenue',   (select coalesce(sum(amount), 0) from revenue_entries
                  where p_from is null or created_at >= p_from),
    'clicks_by_source', (
      select coalesce(jsonb_object_agg(s.source, s.n), '{}'::jsonb)
      from (select source, count(*) as n from affiliate_clicks
            where p_from is null or created_at >= p_from
            group by source) s
    ),
    'top_pages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', t.path, 'views', t.views, 'sessions', t.sessions)
                                order by t.views desc), '[]'::jsonb)
      from (select path, count(*) as views, count(distinct session_id) as sessions
            from page_views
            where p_from is null or created_at >= p_from
            group by path order by 2 desc limit 8) t
    ),
    'top_countries', (
      select coalesce(jsonb_agg(jsonb_build_object('country', c.country, 'count', c.n)
                                order by c.n desc), '[]'::jsonb)
      from (select country, count(*) as n
            from page_views
            where country is not null and (p_from is null or created_at >= p_from)
            group by country order by 2 desc limit 8) c
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- admin_dashboard_summary — the single call /api/stats makes.
-- ---------------------------------------------------------------------------

create or replace function public.admin_dashboard_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with t as (
    select
      now()                                                                                   as now_utc,
      now() at time zone 'America/New_York'                                                   as now_local,
      -- NY midnight today / tomorrow, as instants. Built from the naive local
      -- date so a DST change never makes "tomorrow" 23 or 25 hours away.
      (date_trunc('day', now() at time zone 'America/New_York')) at time zone 'America/New_York'                    as today_start,
      (date_trunc('day', now() at time zone 'America/New_York') + interval '1 day') at time zone 'America/New_York' as tomorrow_start,
      (select min(created_at) from page_views)                                                as first_pv
  )
  select jsonb_build_object(
    'generated_at',     t.now_utc,
    'tz',               'America/New_York',
    'today_key',        to_char(t.now_local, 'YYYY-MM-DD'),
    'hour_key',         to_char(t.now_local, 'YYYY-MM-DD"T"HH24'),
    'first_pageview_at', t.first_pv,
    'ranges', jsonb_build_object(
      'today', admin_range_stats(t.today_start),
      '7d',    admin_range_stats(t.now_utc - interval '7 days'),
      '30d',   admin_range_stats(t.now_utc - interval '30 days'),
      '90d',   admin_range_stats(t.now_utc - interval '90 days'),
      'all',   admin_range_stats(null)
    ),
    'series', jsonb_build_object(
      'daily', (
        select coalesce(jsonb_agg(to_jsonb(s) order by s.bucket), '[]'::jsonb)
        from admin_traffic_series(coalesce(t.first_pv, t.today_start), t.tomorrow_start, 'day') s
      ),
      'hourly', (
        select coalesce(jsonb_agg(to_jsonb(s) order by s.bucket), '[]'::jsonb)
        from admin_traffic_series(t.today_start, t.tomorrow_start, 'hour') s
      )
    ),
    'recent_clicks', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
      from (select source, path, country, created_at
            from affiliate_clicks order by created_at desc limit 8) r
    )
  )
  from t;
$$;

-- Admin-only: called with the service role from api/stats.js. Nothing on the
-- public site needs these, so anon and authenticated get no access.
revoke execute on function public.admin_traffic_series(timestamptz, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.admin_range_stats(timestamptz)                       from public, anon, authenticated;
revoke execute on function public.admin_dashboard_summary()                            from public, anon, authenticated;
grant  execute on function public.admin_traffic_series(timestamptz, timestamptz, text) to service_role;
grant  execute on function public.admin_range_stats(timestamptz)                       to service_role;
grant  execute on function public.admin_dashboard_summary()                            to service_role;
