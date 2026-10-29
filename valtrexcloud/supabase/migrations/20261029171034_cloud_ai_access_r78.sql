-- Only the authenticated Manager grants access. The browser cannot read these
-- tables through the Data API; the Edge Function validates every tenant request.
begin;
create table if not exists public.valtrex_ai_access (
  tenant_id text primary key references public.valtrex_tenants(id) on delete cascade,
  owner_user_id text not null check (owner_user_id ~ '^[0-9]{15,22}$'),
  enabled boolean not null default false,
  tickets boolean not null default false,
  community boolean not null default false,
  granted_by text not null check (granted_by ~ '^[0-9]{15,22}$'),
  updated_at timestamptz not null default now()
);
create table if not exists public.valtrex_ai_service (
  id integer primary key check (id=1),
  enabled boolean not null default true,
  private_key_cipher text not null,
  public_jwk jsonb not null,
  kid text not null,
  updated_at timestamptz not null default now()
);
alter table public.valtrex_ai_access enable row level security;
alter table public.valtrex_ai_service enable row level security;
revoke all on public.valtrex_ai_access,public.valtrex_ai_service from public,anon,authenticated;
grant select,insert,update,delete on public.valtrex_ai_access,public.valtrex_ai_service to service_role;
comment on table public.valtrex_ai_access is 'Manager-only grants for the hosted Cloud assistant; ownership and subscription are checked at use time.';
comment on table public.valtrex_ai_service is 'Encrypted ES256 signing key; only the public JWK is exposed through the dedicated route.';
commit;
