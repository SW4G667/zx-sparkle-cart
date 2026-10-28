create table public.valtrex_manager_web (
 id integer primary key check(id=1), administrator_ids jsonb not null default '[]'::jsonb,
 status jsonb not null default '{}'::jsonb, seen_at timestamptz not null default now()
);
create table public.valtrex_manager_commands (
 id uuid primary key, actor_id text not null check(actor_id ~ '^[0-9]{15,22}$'),
 kind text not null check(kind in ('update_bot','host_test','site_url','gateway_save')),
 payload_cipher text not null, state text not null default 'pending' check(state in ('pending','processing','done','failed','uncertain')),
 lease uuid, created_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz,
 result jsonb not null default '{}'::jsonb
);
create index valtrex_manager_commands_pending on public.valtrex_manager_commands(created_at) where state='pending';
create index valtrex_manager_commands_recent on public.valtrex_manager_commands(created_at desc);
create function public.valtrex_claim_manager_commands() returns setof public.valtrex_manager_commands
language plpgsql security invoker set search_path='' as $$ begin
 update public.valtrex_manager_commands set state='uncertain',result='{"message":"Confirmação pendente. Confira a operação antes de repetir."}'::jsonb
 where state='processing' and started_at<now()-interval '10 minutes';
 return query update public.valtrex_manager_commands set state='processing',lease=gen_random_uuid(),started_at=now()
 where id in(select id from public.valtrex_manager_commands where state='pending' order by created_at for update skip locked limit 3) returning *;
end $$;
alter table public.valtrex_manager_web enable row level security;
alter table public.valtrex_manager_commands enable row level security;
revoke all on public.valtrex_manager_web,public.valtrex_manager_commands from public,anon,authenticated;
grant select,insert,update,delete on public.valtrex_manager_web,public.valtrex_manager_commands to service_role;
revoke all on function public.valtrex_claim_manager_commands() from public,anon,authenticated;
grant execute on function public.valtrex_claim_manager_commands() to service_role;
