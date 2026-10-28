-- Keys are encrypted by the Edge Function; clients only receive configured flags.
create table public.valtrex_workspace_config (
 tenant_id text primary key references public.valtrex_tenants(id) on delete cascade,
 revision uuid not null default gen_random_uuid(), ai_managed boolean not null default false, ai jsonb not null default '{}'::jsonb,
 key_cipher jsonb not null default '{}'::jsonb, delivery jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create table public.valtrex_workspace_state (
 tenant_id text primary key references public.valtrex_tenants(id) on delete cascade,
 bridge_version integer not null default 1, seen_at timestamptz not null default now(),
 applied_revision uuid, runtime text not null check(runtime in ('python','javascript'))
);
create table public.valtrex_ticket_threads (
 tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
 channel_id text not null check(channel_id ~ '^[0-9]{15,22}$'),
 guild_id text not null check(guild_id ~ '^[0-9]{15,22}$'),
 title text not null check(length(title) between 1 and 100), customer text not null default '' check(length(customer)<=100),
 status text not null default 'open' check(status in ('open','closed')),
 priority text not null default 'normal' check(priority in ('low','normal','high')),
 notes text not null default '' check(length(notes)<=2000),
 synced_at timestamptz not null default now(), primary key(tenant_id,channel_id)
);
create index valtrex_ticket_threads_updated on public.valtrex_ticket_threads(tenant_id,synced_at desc,channel_id);
create table public.valtrex_ticket_messages (
 tenant_id text not null, channel_id text not null, message_id text not null check(message_id ~ '^[0-9]{15,22}$'),
 sort_id numeric(22,0) generated always as (message_id::numeric) stored,
 author text not null check(length(author) between 1 and 100), bot boolean not null default false,
 content text not null check(length(content)<=4000), attachments jsonb not null default '[]'::jsonb,
 created_at timestamptz not null, primary key(tenant_id,channel_id,message_id),
 foreign key(tenant_id,channel_id) references public.valtrex_ticket_threads(tenant_id,channel_id) on delete cascade
);
create index valtrex_ticket_messages_page on public.valtrex_ticket_messages(tenant_id,channel_id,sort_id desc);
create table public.valtrex_ticket_outbox (
 id uuid primary key, tenant_id text not null, channel_id text not null,
 actor_id text not null check(actor_id ~ '^[0-9]{15,22}$'), content text not null check(length(content) between 1 and 1800),
 delivery jsonb not null, state text not null default 'pending' check(state in ('pending','sending','sent','failed','uncertain','cancelled')),
 claim_token uuid, attempts integer not null default 0 check(attempts between 0 and 3),
 message_id text check(message_id is null or message_id ~ '^[0-9]{15,22}$'),
 detail text not null default '' check(length(detail)<=160), created_at timestamptz not null default now(), started_at timestamptz,
 updated_at timestamptz not null default now(),
 foreign key(tenant_id,channel_id) references public.valtrex_ticket_threads(tenant_id,channel_id) on delete cascade
);
create index valtrex_ticket_outbox_queue on public.valtrex_ticket_outbox(tenant_id,created_at) where state='pending';
create index valtrex_ticket_outbox_channel on public.valtrex_ticket_outbox(tenant_id,channel_id,created_at desc);
create index valtrex_ticket_outbox_sending on public.valtrex_ticket_outbox(tenant_id,started_at) where state='sending';
create function public.valtrex_claim_ticket_replies(p_tenant text) returns setof public.valtrex_ticket_outbox
language plpgsql security invoker set search_path='' as $$
begin
 -- A lost response is ambiguous. Never resend a possibly delivered message automatically.
 update public.valtrex_ticket_outbox set state='uncertain',detail='Confirmação pendente. Confira o canal antes de reenviar.',updated_at=now()
 where tenant_id=p_tenant and state='sending' and started_at<now()-interval '5 minutes';
 return query update public.valtrex_ticket_outbox set state='sending',claim_token=gen_random_uuid(),attempts=attempts+1,started_at=now(),updated_at=now()
 where id in (select id from public.valtrex_ticket_outbox where tenant_id=p_tenant and state='pending' and attempts<3 order by created_at for update skip locked limit 5)
 returning *;
end $$;
revoke all on function public.valtrex_claim_ticket_replies(text) from public,anon,authenticated;
grant execute on function public.valtrex_claim_ticket_replies(text) to service_role;
alter table public.valtrex_workspace_config enable row level security;
alter table public.valtrex_workspace_state enable row level security;
alter table public.valtrex_ticket_threads enable row level security;
alter table public.valtrex_ticket_messages enable row level security;
alter table public.valtrex_ticket_outbox enable row level security;
revoke all on public.valtrex_workspace_config,public.valtrex_workspace_state,public.valtrex_ticket_threads,public.valtrex_ticket_messages,public.valtrex_ticket_outbox from public,anon,authenticated;
grant select,insert,update,delete on public.valtrex_workspace_config,public.valtrex_workspace_state,public.valtrex_ticket_threads,public.valtrex_ticket_messages,public.valtrex_ticket_outbox to service_role;
