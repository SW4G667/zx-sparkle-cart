-- Catálogo público administrado pelo Manager autenticado.
-- Não contém tokens, credenciais de aplicações nem dados de compradores.
create table if not exists public.valtrex_public_catalog (
  id integer primary key default 1 check (id = 1),
  official_invite text,
  plans jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.valtrex_public_catalog enable row level security;
revoke all on public.valtrex_public_catalog from public, anon, authenticated;
grant all on public.valtrex_public_catalog to service_role;
