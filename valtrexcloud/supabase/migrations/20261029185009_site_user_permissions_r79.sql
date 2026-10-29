-- Separate the environment owners, delegated administration and per-user AI.
alter table public.valtrex_manager_web add column if not exists site_owner_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(site_owner_ids) = 'array');
create table if not exists public.valtrex_site_user_access (
  user_id text primary key check (user_id ~ '^[0-9]{15,22}$'),
  admin_enabled boolean not null default false,
  ai_managed boolean not null default false,
  ai_enabled boolean not null default false,
  ai_tickets boolean not null default false,
  ai_community boolean not null default false,
  granted_by text not null check (granted_by ~ '^[0-9]{15,22}$'),
  updated_at timestamptz not null default now(),
  check (ai_enabled or not (ai_tickets or ai_community))
);
alter table public.valtrex_site_user_access enable row level security;
revoke all on table public.valtrex_site_user_access from public, anon, authenticated;
grant all on table public.valtrex_site_user_access to service_role;
comment on table public.valtrex_site_user_access is 'Manager-only user grants; AI permission does not grant platform administration.';
