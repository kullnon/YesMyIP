-- 002_newsletter.sql — server-side newsletter signups (2026-11-02).
-- Until now /newsletter/ only wrote the address to the visitor's localStorage, so every
-- signup was lost. api/subscribe.js inserts here with the service-role key; RLS is on
-- with no policies, so the anon key can neither read nor write the list.
create table if not exists public.newsletter_subscribers (
  id          bigint generated always as identity primary key,
  email       text not null,
  source      text,
  locale      text,
  country     text,
  is_test     boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index if not exists newsletter_subscribers_email_lower
  on public.newsletter_subscribers (lower(email));
alter table public.newsletter_subscribers enable row level security;
