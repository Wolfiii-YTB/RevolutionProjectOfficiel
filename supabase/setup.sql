-- Run this once in Supabase Dashboard > SQL Editor.
-- Public visitors can read published site data. Only authenticated users can change it.
create table if not exists public.site_state (
  id integer primary key check (id = 1),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_state enable row level security;
revoke all on public.site_state from anon, authenticated;
grant select on public.site_state to anon, authenticated;
grant insert, update on public.site_state to authenticated;

drop policy if exists "Public can read site content" on public.site_state;
create policy "Public can read site content" on public.site_state
  for select to anon, authenticated using (true);

drop policy if exists "Authenticated admins can create site content" on public.site_state;
create policy "Authenticated admins can create site content" on public.site_state
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "Authenticated admins can update site content" on public.site_state;
create policy "Authenticated admins can update site content" on public.site_state
  for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);

create or replace function public.touch_site_state_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists site_state_updated_at on public.site_state;
create trigger site_state_updated_at before update on public.site_state
for each row execute function public.touch_site_state_updated_at();

-- Contact requests are private: visitors may submit, but only signed-in admins can read or delete them.
create table if not exists public.contact_requests (
  id text primary key,
  name text not null,
  email text not null,
  subject text not null default '',
  message text not null,
  source text not null default '',
  received_at timestamptz not null default now()
);
alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from anon, authenticated;
grant insert on public.contact_requests to anon, authenticated;
grant select, delete on public.contact_requests to authenticated;
drop policy if exists "Visitors can submit contact requests" on public.contact_requests;
create policy "Visitors can submit contact requests" on public.contact_requests
  for insert to anon, authenticated with check (true);
drop policy if exists "Admins can read contact requests" on public.contact_requests;
create policy "Admins can read contact requests" on public.contact_requests
  for select to authenticated using (auth.uid() is not null);
drop policy if exists "Admins can delete contact requests" on public.contact_requests;
create policy "Admins can delete contact requests" on public.contact_requests
  for delete to authenticated using (auth.uid() is not null);
