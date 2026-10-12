-- Catálogo enviado pelo Manager autenticado. Nenhum token ou arquivo de bot
-- fica nesta tabela; cada consulta web filtra pelo dono Discord autenticado.
create table if not exists public.valtrex_managed_apps (
  manager_app_id text not null,
  owner_user_id text not null,
  bot_id text,
  label text not null,
  profile text not null default 'other',
  status text not null default 'unknown',
  expires_at timestamptz,
  synced_at timestamptz not null default now(),
  primary key (manager_app_id, owner_user_id),
  check (length(manager_app_id) between 1 and 120),
  check (owner_user_id ~ '^[0-9]{15,22}$'),
  check (bot_id is null or bot_id ~ '^[0-9]{15,22}$'),
  check (profile in ('sales','robux','other')),
  check (status in ('active','suspended','expired','unknown'))
);
create index if not exists valtrex_managed_apps_owner_idx
  on public.valtrex_managed_apps(owner_user_id, synced_at desc);
alter table public.valtrex_managed_apps enable row level security;
revoke all on public.valtrex_managed_apps from public, anon, authenticated;
grant all on public.valtrex_managed_apps to service_role;
