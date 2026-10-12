-- Sessões do portal do proprietário. Nenhuma tabela antiga é alterada.
-- O navegador recebe somente um identificador aleatório; o banco guarda seu hash.
create table if not exists public.valtrex_portal_sessions (
  session_hash text primary key,
  login_tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
  discord_user_id text not null,
  username text not null,
  avatar_hash text,
  csrf_cipher text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists valtrex_portal_sessions_user_idx
  on public.valtrex_portal_sessions(discord_user_id, expires_at);
create index if not exists valtrex_portal_sessions_expiry_idx
  on public.valtrex_portal_sessions(expires_at);
alter table public.valtrex_portal_sessions enable row level security;
revoke all on public.valtrex_portal_sessions from public, anon, authenticated;
grant all on public.valtrex_portal_sessions to service_role;
