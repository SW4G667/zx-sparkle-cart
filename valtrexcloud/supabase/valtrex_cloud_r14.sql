-- R14: separa verificação por canal de Gifts de recuperação consentida.
-- Migração aditiva: não remove Gifts, verificações ou configurações existentes.
alter table public.valtrex_tenants add column if not exists owner_user_id text;
alter table public.valtrex_tenants add column if not exists verify_channel_id text;
alter table public.valtrex_tenants add column if not exists verify_message_id text;
alter table public.valtrex_tenants add column if not exists bot_guild_ids jsonb not null default '[]'::jsonb;
alter table public.valtrex_tenants add column if not exists bot_seen_at timestamptz;
alter table public.valtrex_gifts add column if not exists kind text not null default 'verification';
alter table public.valtrex_oauth_states alter column gift_id drop not null;
alter table public.valtrex_oauth_states add column if not exists flow text not null default 'gift';
alter table public.valtrex_verifications alter column gift_id drop not null;
create unique index if not exists valtrex_verify_once on public.valtrex_verifications(tenant_id, discord_user_id) where gift_id is null;

create table if not exists public.valtrex_consents (
  tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
  discord_user_id text not null,
  access_cipher text not null,
  refresh_cipher text not null,
  expires_at timestamptz not null,
  consented_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '90 days'),
  revoked_at timestamptz,
  primary key (tenant_id, discord_user_id)
);
create index if not exists valtrex_consents_eligible on public.valtrex_consents(tenant_id, revoked_at, consented_at);

create table if not exists public.valtrex_backup_claims (
  gift_id uuid not null references public.valtrex_gifts(id) on delete cascade,
  tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
  discord_user_id text not null,
  created_at timestamptz not null default now(),
  primary key (gift_id, discord_user_id)
);
create table if not exists public.valtrex_gift_sessions (
  session_hash text primary key,
  gift_id uuid not null references public.valtrex_gifts(id) on delete cascade,
  tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
  discord_user_id text not null,
  guilds jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists valtrex_gift_sessions_expiry on public.valtrex_gift_sessions(expires_at);

create table if not exists public.valtrex_backup_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
  gift_id uuid not null references public.valtrex_gifts(id) on delete cascade,
  actor_user_id text not null,
  target_guild_id text not null,
  requested_count integer not null check (requested_count between 1 and 500),
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gift_id, actor_user_id, target_guild_id)
);
create table if not exists public.valtrex_backup_job_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
  job_id uuid not null references public.valtrex_backup_jobs(id) on delete cascade,
  discord_user_id text not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  reason text,
  updated_at timestamptz not null default now(),
  unique (job_id, discord_user_id)
);
create index if not exists valtrex_join_queue on public.valtrex_backup_job_members(tenant_id, status, updated_at);

alter table public.valtrex_consents enable row level security;
alter table public.valtrex_backup_claims enable row level security;
alter table public.valtrex_gift_sessions enable row level security;
alter table public.valtrex_backup_jobs enable row level security;
alter table public.valtrex_backup_job_members enable row level security;
revoke all on public.valtrex_consents, public.valtrex_backup_claims, public.valtrex_gift_sessions,
  public.valtrex_backup_jobs, public.valtrex_backup_job_members from anon, authenticated;
grant all on public.valtrex_consents, public.valtrex_backup_claims, public.valtrex_gift_sessions,
  public.valtrex_backup_jobs, public.valtrex_backup_job_members to service_role;

create or replace function public.valtrex_take_oauth_state_v2(p_state_hash text, p_verifier_hash text)
returns table(gift_id uuid, tenant_id text, flow text)
language sql security invoker set search_path = public as $$
  update public.valtrex_oauth_states s set used_at = now()
  where s.state_hash = p_state_hash and s.verifier_hash = p_verifier_hash
    and s.used_at is null and s.expires_at > now()
  returning s.gift_id, s.tenant_id, s.flow;
$$;
create or replace function public.valtrex_claim_backup_gift(p_gift_id uuid, p_user_id text)
returns text language plpgsql security invoker set search_path = public as $$
declare v_gift public.valtrex_gifts%rowtype;
begin
  select * into v_gift from public.valtrex_gifts where id = p_gift_id for update;
  if not found or not v_gift.active then return 'invalid'; end if;
  if v_gift.expires_at is not null and v_gift.expires_at <= now() then return 'expired'; end if;
  if exists (select 1 from public.valtrex_backup_claims where gift_id = p_gift_id and discord_user_id = p_user_id) then return 'already'; end if;
  if v_gift.max_uses is not null and v_gift.uses >= v_gift.max_uses then return 'full'; end if;
  insert into public.valtrex_backup_claims(gift_id, tenant_id, discord_user_id) values (p_gift_id, v_gift.tenant_id, p_user_id);
  update public.valtrex_gifts set uses = uses + 1 where id = p_gift_id;
  return 'ok';
end $$;
create or replace function public.valtrex_claim_verify(p_tenant_id text, p_user_id text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.valtrex_verifications
   where tenant_id = p_tenant_id and discord_user_id = p_user_id and gift_id is null;
  if v_id is not null then return v_id; end if;
  insert into public.valtrex_verifications(tenant_id, gift_id, discord_user_id)
   values (p_tenant_id, null, p_user_id) on conflict do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.valtrex_verifications
   where tenant_id = p_tenant_id and discord_user_id = p_user_id and gift_id is null; end if;
  return v_id;
end $$;
create or replace function public.valtrex_take_join_tasks(p_tenant_id text, p_max integer)
returns table(id uuid, job_id uuid, discord_user_id text, target_guild_id text)
language sql security invoker set search_path = public as $$
  with picked as (
    select m.id from public.valtrex_backup_job_members m
      join public.valtrex_backup_jobs j on j.id = m.job_id
    where m.tenant_id = p_tenant_id and j.status in ('pending', 'running')
      and (m.status = 'queued' or (m.status = 'processing' and m.updated_at < now() - interval '5 minutes' and m.attempts < 3))
    order by m.updated_at limit least(greatest(p_max, 1), 10) for update of m skip locked
  ), updated as (
    update public.valtrex_backup_job_members m set status = 'processing', attempts = attempts + 1, updated_at = now()
    from picked where m.id = picked.id returning m.id, m.job_id, m.discord_user_id
  ) select u.id, u.job_id, u.discord_user_id, j.target_guild_id
    from updated u join public.valtrex_backup_jobs j on j.id = u.job_id;
$$;
revoke all on function public.valtrex_take_oauth_state_v2(text,text), public.valtrex_claim_backup_gift(uuid,text),
  public.valtrex_claim_verify(text,text), public.valtrex_take_join_tasks(text,integer) from public, anon, authenticated;
grant execute on function public.valtrex_take_oauth_state_v2(text,text), public.valtrex_claim_backup_gift(uuid,text),
  public.valtrex_claim_verify(text,text), public.valtrex_take_join_tasks(text,integer) to service_role;
