-- Isolado das tabelas existentes da loja. Todas as leituras passam pelo backend.
create extension if not exists pgcrypto;

create table if not exists public.valtrex_tenants (
  id text primary key,
  label text not null default 'Valtrex',
  bot_key_hash text not null,
  client_id text,
  client_secret_cipher text,
  guild_id text,
  backup_guild_id text,
  role_id text,
  log_channel_id text,
  theme jsonb not null default '{}'::jsonb,
  messages jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.valtrex_gifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
  token_hash text not null unique,
  token_cipher text not null,
  internal_name text not null,
  title text not null,
  description text not null default '',
  banner_url text,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  active boolean not null default true,
  theme jsonb,
  success_message text,
  created_at timestamptz not null default now()
);
create index if not exists valtrex_gifts_tenant_idx on public.valtrex_gifts(tenant_id, created_at desc);

create table if not exists public.valtrex_oauth_states (
  state_hash text primary key,
  verifier_hash text not null,
  gift_id uuid not null references public.valtrex_gifts(id) on delete cascade,
  tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists valtrex_states_expiry_idx on public.valtrex_oauth_states(expires_at);

create table if not exists public.valtrex_verifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
  gift_id uuid not null references public.valtrex_gifts(id) on delete cascade,
  discord_user_id text not null,
  role_status text not null default 'pending',
  role_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gift_id, discord_user_id)
);
create index if not exists valtrex_verifications_pending_idx on public.valtrex_verifications(tenant_id, role_status, created_at);

create table if not exists public.valtrex_logs (
  id bigint generated always as identity primary key,
  tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
  event text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists valtrex_logs_tenant_idx on public.valtrex_logs(tenant_id, created_at desc);

create table if not exists public.valtrex_rate_limits (
  key_hash text not null,
  window_at timestamptz not null,
  count integer not null default 1,
  primary key(key_hash, window_at)
);

alter table public.valtrex_tenants enable row level security;
alter table public.valtrex_gifts enable row level security;
alter table public.valtrex_oauth_states enable row level security;
alter table public.valtrex_verifications enable row level security;
alter table public.valtrex_logs enable row level security;
alter table public.valtrex_rate_limits enable row level security;
revoke all on public.valtrex_tenants, public.valtrex_gifts, public.valtrex_oauth_states,
  public.valtrex_verifications, public.valtrex_logs, public.valtrex_rate_limits from anon, authenticated;
grant all on public.valtrex_tenants, public.valtrex_gifts, public.valtrex_oauth_states,
  public.valtrex_verifications, public.valtrex_logs, public.valtrex_rate_limits to service_role;
grant usage, select on sequence public.valtrex_logs_id_seq to service_role;

create or replace function public.valtrex_take_oauth_state(p_state_hash text, p_verifier_hash text)
returns table(gift_id uuid, tenant_id text)
language sql security invoker set search_path = public as $$
  update public.valtrex_oauth_states s
     set used_at = now()
   where s.state_hash = p_state_hash and s.verifier_hash = p_verifier_hash
     and s.used_at is null and s.expires_at > now()
  returning s.gift_id, s.tenant_id;
$$;

create or replace function public.valtrex_claim_gift(p_gift_id uuid, p_user_id text)
returns table(verification_id uuid, claim_status text)
language plpgsql security invoker set search_path = public as $$
declare v_gift public.valtrex_gifts%rowtype; v_id uuid;
begin
  select * into v_gift from public.valtrex_gifts where id = p_gift_id for update;
  if not found or not v_gift.active then return query select null::uuid, 'invalid'::text; return; end if;
  if v_gift.expires_at is not null and v_gift.expires_at <= now() then
    return query select null::uuid, 'expired'::text; return;
  end if;
  select id into v_id from public.valtrex_verifications
    where gift_id = p_gift_id and discord_user_id = p_user_id;
  if found then return query select v_id, 'already'::text; return; end if;
  if v_gift.max_uses is not null and v_gift.uses >= v_gift.max_uses then
    return query select null::uuid, 'full'::text; return;
  end if;
  insert into public.valtrex_verifications(tenant_id, gift_id, discord_user_id)
    values(v_gift.tenant_id, p_gift_id, p_user_id) returning id into v_id;
  update public.valtrex_gifts set uses = uses + 1 where id = p_gift_id;
  return query select v_id, 'ok'::text;
end $$;

create or replace function public.valtrex_rate_limit(p_key_hash text, p_max integer)
returns boolean language plpgsql security invoker set search_path = public as $$
declare v_count integer; v_window timestamptz := date_trunc('minute', now());
begin
  insert into public.valtrex_rate_limits(key_hash, window_at, count)
    values(p_key_hash, v_window, 1)
    on conflict(key_hash, window_at) do update set count = public.valtrex_rate_limits.count + 1
    returning count into v_count;
  return v_count <= p_max;
end $$;

revoke all on function public.valtrex_take_oauth_state(text,text),
  public.valtrex_claim_gift(uuid,text), public.valtrex_rate_limit(text,integer) from public, anon, authenticated;
grant execute on function public.valtrex_take_oauth_state(text,text),
  public.valtrex_claim_gift(uuid,text), public.valtrex_rate_limit(text,integer) to service_role;
