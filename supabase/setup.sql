-- RV / Supabase security setup and hardening.
-- Run in Supabase Dashboard > SQL Editor as project owner.
-- After running this script, add the intended admin UUID using the instructions
-- in README.md. Until then, no authenticated account can publish or read inbox.

create table if not exists public.site_state (
  id integer primary key check (id = 1),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_state enable row level security;
revoke all on public.site_state from anon, authenticated;
grant select on public.site_state to anon, authenticated;
grant insert, update on public.site_state to authenticated;

-- A private allowlist ties administrator privileges to one exact Supabase Auth
-- user UUID. Authenticated visitors cannot read or modify this table.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists private.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.site_admins enable row level security;
revoke all on private.site_admins from public, anon, authenticated;

create or replace function private.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.site_admins
    where user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_site_admin() from public, anon;
grant execute on function private.is_site_admin() to authenticated;

drop policy if exists "Public can read site content" on public.site_state;
create policy "Public can read site content" on public.site_state
  for select to anon, authenticated using (true);

drop policy if exists "Authenticated admins can create site content" on public.site_state;
drop policy if exists "Authenticated admins can update site content" on public.site_state;
drop policy if exists "Only listed admin can create site content" on public.site_state;
create policy "Only listed admin can create site content" on public.site_state
  for insert to authenticated with check ((select private.is_site_admin()));
drop policy if exists "Only listed admin can update site content" on public.site_state;
create policy "Only listed admin can update site content" on public.site_state
  for update to authenticated using ((select private.is_site_admin()))
  with check ((select private.is_site_admin()));

create or replace function public.touch_site_state_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists site_state_updated_at on public.site_state;
create trigger site_state_updated_at before update on public.site_state
for each row execute function public.touch_site_state_updated_at();

-- Audit trail: keep actor, timestamp and changed payload keys, never old/new values.
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text not null default 'Compte admin',
  action text not null check (action in ('INSERT', 'UPDATE')),
  changed_keys text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;
drop policy if exists "Only listed admin can read audit log" on public.admin_audit_log;
create policy "Only listed admin can read audit log" on public.admin_audit_log
  for select to authenticated using ((select private.is_site_admin()));

create or replace function public.log_site_state_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare changed text[];
begin
  if tg_op = 'INSERT' then
    select coalesce(array_agg(key order by key), '{}') into changed
    from jsonb_object_keys(coalesce(new.payload, '{}'::jsonb)) as key;
  else
    select coalesce(array_agg(key order by key), '{}') into changed
    from (
      select coalesce(old_values.key, new_values.key) as key
      from jsonb_each(coalesce(old.payload, '{}'::jsonb)) as old_values
      full join jsonb_each(coalesce(new.payload, '{}'::jsonb)) as new_values using (key)
      where coalesce(old_values.key, new_values.key) <> 'content'
        and old_values.value is distinct from new_values.value
      union all
      select 'content.' || coalesce(old_fields.key, new_fields.key) as key
      from jsonb_each(coalesce(old.payload -> 'content', '{}'::jsonb)) as old_fields
      full join jsonb_each(coalesce(new.payload -> 'content', '{}'::jsonb)) as new_fields using (key)
      where old_fields.value is distinct from new_fields.value
    ) as differences;
  end if;
  insert into public.admin_audit_log (actor_id, actor_email, action, changed_keys)
  values ((select auth.uid()), coalesce((select auth.jwt() ->> 'email'), 'Compte admin'), tg_op, changed);
  return new;
end;
$$;
revoke all on function public.log_site_state_change() from public, anon, authenticated;
drop trigger if exists site_state_audit on public.site_state;
create trigger site_state_audit after insert or update on public.site_state
for each row execute function public.log_site_state_change();

-- Visitor analytics are stored only after the visitor accepts the consent banner.
-- Exact IP is kept for 90 days; the third-party GeoIP lookup is performed server-side.
create table if not exists public.analytics_events (
  id uuid primary key,
  session_id uuid not null,
  page text not null check (page in ('Accueil','Projets','Avancées','Progression','Vidéos','Contact','Soutien','Confidentialité','Conditions','Mentions légales','Page personnalisée')),
  duration_seconds integer not null check (duration_seconds between 0 and 21600),
  visitor_ip inet not null,
  country text not null default 'Inconnue' check (char_length(country) <= 80),
  region text not null default '' check (char_length(region) <= 100),
  city text not null default '' check (char_length(city) <= 100),
  device text not null default 'Inconnu' check (device in ('Mobile','Tablette','Ordinateur','Inconnu')),
  created_at timestamptz not null default now()
);
alter table public.analytics_events drop constraint if exists analytics_events_page_check;
alter table public.analytics_events add constraint analytics_events_page_check
  check (page in ('Accueil','Projets','Avancées','Progression','Vidéos','Contact','Soutien','Confidentialité','Conditions','Mentions légales','Page personnalisée'));
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;
grant select on public.analytics_events to authenticated;
grant insert on public.analytics_events to service_role;
drop policy if exists "Only listed admin can read analytics" on public.analytics_events;
create policy "Only listed admin can read analytics" on public.analytics_events
  for select to authenticated using ((select private.is_site_admin()));

create or replace function public.prune_analytics_events()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.analytics_events where created_at < now() - interval '90 days';
  return new;
end;
$$;
revoke all on function public.prune_analytics_events() from public, anon, authenticated;
drop trigger if exists analytics_events_retention on public.analytics_events;
create trigger analytics_events_retention after insert on public.analytics_events
for each row execute function public.prune_analytics_events();

create or replace function public.throttle_analytics_events()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recent_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(new.visitor_ip::text));
  select count(*) into recent_count from public.analytics_events
  where visitor_ip = new.visitor_ip and created_at > now() - interval '1 hour';
  if recent_count >= 100 then
    raise exception 'Analytics event limit reached for this IP.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.throttle_analytics_events() from public, anon, authenticated;
drop trigger if exists analytics_events_throttle on public.analytics_events;
create trigger analytics_events_throttle before insert on public.analytics_events
for each row execute function public.throttle_analytics_events();

-- Consume an IP quota before calling the paid/free GeoIP endpoint, so the
-- public Edge Function cannot be used to burn the provider quota freely.
create table if not exists private.analytics_geoip_limits (
  visitor_ip inet primary key,
  window_started_at timestamptz not null,
  attempts integer not null check (attempts between 1 and 100)
);
alter table private.analytics_geoip_limits enable row level security;
revoke all on private.analytics_geoip_limits from public, anon, authenticated, service_role;

create or replace function public.consume_geoip_limit(p_ip inet)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare limit_row private.analytics_geoip_limits%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext(p_ip::text));
  select * into limit_row from private.analytics_geoip_limits where visitor_ip = p_ip for update;
  if found and limit_row.window_started_at > now() - interval '1 hour' then
    if limit_row.attempts >= 100 then return false; end if;
    update private.analytics_geoip_limits set attempts = attempts + 1 where visitor_ip = p_ip;
  else
    insert into private.analytics_geoip_limits (visitor_ip, window_started_at, attempts)
    values (p_ip, now(), 1)
    on conflict (visitor_ip) do update set window_started_at = now(), attempts = 1;
  end if;
  delete from private.analytics_geoip_limits where window_started_at < now() - interval '1 day';
  return true;
end;
$$;
revoke all on function public.consume_geoip_limit(inet) from public, anon, authenticated;
grant execute on function public.consume_geoip_limit(inet) to service_role;

-- Public visitors can submit bounded contact messages. Only the listed admin
-- can read or delete them. A per-email throttle reduces basic form abuse.
create table if not exists public.contact_requests (
  id text primary key check (char_length(id) <= 100),
  name text not null check (char_length(trim(name)) between 1 and 120),
  email text not null check (
    char_length(email) between 3 and 254
    and email ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)+$'
  ),
  subject text not null default '' check (char_length(subject) <= 160),
  message text not null check (char_length(trim(message)) between 1 and 5000),
  source text not null default '' check (char_length(source) <= 300),
  received_at timestamptz not null default now()
);

-- Add equivalent guards when upgrading a project whose table already exists.
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.contact_requests'::regclass and conname = 'contact_requests_id_length') then
    alter table public.contact_requests add constraint contact_requests_id_length check (char_length(id) <= 100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.contact_requests'::regclass and conname = 'contact_requests_name_length') then
    alter table public.contact_requests add constraint contact_requests_name_length check (char_length(trim(name)) between 1 and 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.contact_requests'::regclass and conname = 'contact_requests_email_format') then
    alter table public.contact_requests add constraint contact_requests_email_format check (char_length(email) between 3 and 254 and email ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)+$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.contact_requests'::regclass and conname = 'contact_requests_subject_length') then
    alter table public.contact_requests add constraint contact_requests_subject_length check (char_length(subject) <= 160) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.contact_requests'::regclass and conname = 'contact_requests_message_length') then
    alter table public.contact_requests add constraint contact_requests_message_length check (char_length(trim(message)) between 1 and 5000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.contact_requests'::regclass and conname = 'contact_requests_source_length') then
    alter table public.contact_requests add constraint contact_requests_source_length check (char_length(source) <= 300) not valid;
  end if;
end $$;

alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from anon, authenticated;
grant insert on public.contact_requests to anon, authenticated;
grant select, delete on public.contact_requests to authenticated;

drop policy if exists "Visitors can submit contact requests" on public.contact_requests;
create policy "Visitors can submit contact requests" on public.contact_requests
  for insert to anon, authenticated with check (true);
drop policy if exists "Admins can read contact requests" on public.contact_requests;
drop policy if exists "Only listed admin can read contact requests" on public.contact_requests;
create policy "Only listed admin can read contact requests" on public.contact_requests
  for select to authenticated using ((select private.is_site_admin()));
drop policy if exists "Admins can delete contact requests" on public.contact_requests;
drop policy if exists "Only listed admin can delete contact requests" on public.contact_requests;
create policy "Only listed admin can delete contact requests" on public.contact_requests
  for delete to authenticated using ((select private.is_site_admin()));

create or replace function public.throttle_contact_requests_by_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare recent_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(trim(new.email)), 0));
  select count(*) into recent_count
  from public.contact_requests
  where lower(email) = lower(trim(new.email))
    and received_at > now() - interval '10 minutes';
  if recent_count >= 3 then
    raise exception 'Too many contact requests. Please try again later.'
      using errcode = 'P0001';
  end if;
  new.email := lower(trim(new.email));
  return new;
end;
$$;
revoke all on function public.throttle_contact_requests_by_email() from public, anon, authenticated;
drop trigger if exists contact_requests_email_throttle on public.contact_requests;
create trigger contact_requests_email_throttle
before insert on public.contact_requests
for each row execute function public.throttle_contact_requests_by_email();
