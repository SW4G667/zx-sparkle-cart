-- R90: owner-authorized operations. All tables are private to the Edge service.
alter table public.valtrex_workspace_state add column if not exists telemetry jsonb not null default '{}'::jsonb;
alter table public.valtrex_portal_sessions add column if not exists public_id uuid not null default gen_random_uuid();
alter table public.valtrex_portal_sessions add column if not exists device text not null default 'Navegador';
create unique index if not exists valtrex_portal_session_public_id on public.valtrex_portal_sessions(public_id);
create index if not exists valtrex_portal_session_owner on public.valtrex_portal_sessions(discord_user_id,expires_at);

create table public.valtrex_operation_config (
 tenant_id text primary key references public.valtrex_tenants(id) on delete cascade,
 revision uuid not null default gen_random_uuid(), config jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(), actor_id text not null
);
create table public.valtrex_operation_history (
 id uuid primary key default gen_random_uuid(), tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
 revision uuid not null, config jsonb not null, actor_id text not null, created_at timestamptz not null default now()
);
create index valtrex_operation_history_tenant on public.valtrex_operation_history(tenant_id,created_at desc,id);
create table public.valtrex_operation_commands (
 id uuid primary key, tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
 kind text not null check(kind in ('stock_import','wallet_withdraw')), payload_cipher text not null,
 actor_id text not null, state text not null default 'pending' check(state in ('pending','processing','applied','failed','uncertain')),
 lease uuid, detail text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index valtrex_operation_commands_queue on public.valtrex_operation_commands(tenant_id,created_at) where state='pending';
create index valtrex_operation_commands_tenant_history on public.valtrex_operation_commands(tenant_id,created_at desc);
create index valtrex_operation_commands_lease on public.valtrex_operation_commands(tenant_id,state,updated_at);
create table public.valtrex_operation_confirmations (
 id uuid primary key default gen_random_uuid(), session_hash text not null references public.valtrex_portal_sessions(session_hash) on delete cascade,
 action text not null, digest text not null, expires_at timestamptz not null default now()+interval '2 minutes'
);
create index valtrex_operation_confirmation_expiry on public.valtrex_operation_confirmations(expires_at);
create index valtrex_operation_confirmation_session on public.valtrex_operation_confirmations(session_hash);

create function public.valtrex_save_operation_config(p_tenant text,p_actor text,p_base uuid,p_config jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_row public.valtrex_operation_config; next_revision uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(hashtextextended('studio90:'||p_tenant,0));
 select * into current_row from public.valtrex_operation_config where tenant_id=p_tenant for update;
 if current_row.revision is distinct from p_base then return jsonb_build_object('conflict',true); end if;
 insert into public.valtrex_operation_config(tenant_id,revision,config,actor_id) values(p_tenant,next_revision,p_config,p_actor)
 on conflict(tenant_id) do update set revision=excluded.revision,config=excluded.config,actor_id=excluded.actor_id,updated_at=now();
 insert into public.valtrex_operation_history(tenant_id,revision,config,actor_id) values(p_tenant,next_revision,p_config,p_actor);
 delete from public.valtrex_operation_history where tenant_id=p_tenant and id in
 (select id from public.valtrex_operation_history where tenant_id=p_tenant order by created_at desc,id offset 30);
 return jsonb_build_object('revision',next_revision);
end $$;
create function public.valtrex_claim_operation_commands(p_tenant text) returns setof public.valtrex_operation_commands
language plpgsql security invoker set search_path='' as $$
begin
 update public.valtrex_operation_commands set state='uncertain',detail='Conferência necessária após interrupção.',updated_at=now()
 where tenant_id=p_tenant and state='processing' and updated_at<now()-interval '5 minutes';
 return query update public.valtrex_operation_commands set state='processing',lease=gen_random_uuid(),updated_at=now()
 where id in(select id from public.valtrex_operation_commands where tenant_id=p_tenant and state='pending' order by created_at for update skip locked limit 3)
 returning *;
end $$;

alter table public.valtrex_operation_config enable row level security;
alter table public.valtrex_operation_history enable row level security;
alter table public.valtrex_operation_commands enable row level security;
alter table public.valtrex_operation_confirmations enable row level security;
revoke all on public.valtrex_operation_config,public.valtrex_operation_history,public.valtrex_operation_commands,public.valtrex_operation_confirmations from public,anon,authenticated;
grant select,insert,update,delete on public.valtrex_operation_config,public.valtrex_operation_history,public.valtrex_operation_commands,public.valtrex_operation_confirmations to service_role;
revoke all on function public.valtrex_save_operation_config(text,text,uuid,jsonb),public.valtrex_claim_operation_commands(text) from public,anon,authenticated;
grant execute on function public.valtrex_save_operation_config(text,text,uuid,jsonb),public.valtrex_claim_operation_commands(text) to service_role;
