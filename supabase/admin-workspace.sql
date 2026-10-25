-- RV / Private admin workspace for tasks, objectives and reports.
-- Run once in Supabase SQL Editor after supabase/setup.sql has created
-- private.is_site_admin() and populated private.site_admins.

create table if not exists public.admin_workspace (
  id smallint primary key check (id = 1),
  payload jsonb not null default '{"objectives":[],"tasks":[],"reports":[]}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint admin_workspace_payload_shape check (
    jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 500000
  )
);

alter table public.admin_workspace enable row level security;
revoke all on public.admin_workspace from public, anon, authenticated;
grant select, insert, update on public.admin_workspace to authenticated;

drop policy if exists "Only listed admins can read private workspace" on public.admin_workspace;
create policy "Only listed admins can read private workspace"
  on public.admin_workspace for select to authenticated
  using ((select private.is_site_admin()));

drop policy if exists "Only listed admins can create private workspace" on public.admin_workspace;
create policy "Only listed admins can create private workspace"
  on public.admin_workspace for insert to authenticated
  with check ((select private.is_site_admin()));

drop policy if exists "Only listed admins can update private workspace" on public.admin_workspace;
create policy "Only listed admins can update private workspace"
  on public.admin_workspace for update to authenticated
  using ((select private.is_site_admin()))
  with check ((select private.is_site_admin()));

create or replace function public.touch_admin_workspace_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;
revoke all on function public.touch_admin_workspace_updated_at() from public, anon, authenticated;
drop trigger if exists admin_workspace_updated_at on public.admin_workspace;
create trigger admin_workspace_updated_at
  before update on public.admin_workspace
  for each row execute function public.touch_admin_workspace_updated_at();

insert into public.admin_workspace (id, payload)
values (1, '{"objectives":[],"tasks":[],"reports":[]}'::jsonb)
on conflict (id) do nothing;
