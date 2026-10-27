create table public.valtrex_finance_entries (
 tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
 entry_id text not null check(length(entry_id) between 1 and 128), order_ref text not null check(length(order_ref) between 1 and 128),
 product_id text not null check(length(product_id)<=150), product_name text not null check(length(product_name) between 1 and 100),
 quantity integer not null check(quantity between 1 and 1000000), amount_cents bigint not null check(amount_cents between 0 and 1000000000),
 discount_cents bigint not null default 0 check(discount_cents between 0 and 1000000000),
 state text not null check(state in ('confirmed','manual','unclassified','refunded','cancelled')),
 delivery text not null check(delivery in ('delivered','pending','unknown')),
 payment_method text not null check(length(payment_method)<=40), occurred_at timestamptz not null,
 synced_at timestamptz not null default now(), primary key(tenant_id,entry_id)
);
create index valtrex_finance_tenant_date on public.valtrex_finance_entries(tenant_id,occurred_at desc);
create table public.valtrex_finance_sync (
 tenant_id text primary key references public.valtrex_tenants(id) on delete cascade,
 seen_at timestamptz not null default now(), source_count integer not null check(source_count>=0),
 remaining integer not null check(remaining>=0), skipped integer not null default 0 check(skipped>=0), version integer not null default 1
);
create function public.valtrex_finance_report(p_tenant text,p_from timestamptz,p_until timestamptz,p_zone text default 'America/Sao_Paulo') returns jsonb
language sql stable security invoker set search_path='' as $$
with records as (select * from public.valtrex_finance_entries where tenant_id=p_tenant and occurred_at>=p_from and occurred_at<p_until),
summary as (select coalesce(sum(amount_cents) filter(where state='confirmed'),0) as confirmed_cents,
 coalesce(sum(amount_cents) filter(where state='manual'),0) as manual_cents,
 coalesce(sum(amount_cents) filter(where state='unclassified'),0) as unclassified_cents,
 coalesce(sum(amount_cents) filter(where state='refunded'),0) as refunded_cents,
 coalesce(sum(discount_cents) filter(where state='confirmed'),0) as discount_cents,
 count(distinct order_ref) filter(where state='confirmed') as confirmed_orders,
 count(distinct order_ref) filter(where state='manual') as manual_orders,
 count(distinct order_ref) filter(where state='unclassified') as unclassified_orders,
 count(distinct order_ref) as total_orders,
 coalesce(sum(quantity) filter(where state='confirmed'),0) as units,
 count(distinct order_ref) filter(where state='confirmed' and delivery='pending') as pending_delivery_orders from records),
days as (select to_char(occurred_at at time zone p_zone,'YYYY-MM-DD') as day,
 coalesce(sum(amount_cents) filter(where state='confirmed'),0) as confirmed_cents,
 coalesce(sum(amount_cents) filter(where state='manual'),0) as manual_cents,
 count(distinct order_ref) filter(where state='confirmed') as orders from records group by 1 order by 1),
products as (select product_id,max(product_name) as name,sum(amount_cents) as amount_cents,sum(quantity) as units,count(distinct order_ref) as orders from records where state='confirmed' group by product_id order by amount_cents desc limit 12),
methods as (select payment_method as method,sum(amount_cents) as amount_cents,count(distinct order_ref) as orders from records where state='confirmed' group by payment_method order by amount_cents desc),
recent as (select entry_id,order_ref,product_name,quantity,amount_cents,discount_cents,state,delivery,payment_method,occurred_at from records order by occurred_at desc,entry_id limit 100)
select jsonb_build_object('summary',(select to_jsonb(s) from summary s),'days',coalesce((select jsonb_agg(to_jsonb(d)) from days d),'[]'::jsonb),'products',coalesce((select jsonb_agg(to_jsonb(p)) from products p),'[]'::jsonb),'methods',coalesce((select jsonb_agg(to_jsonb(m)) from methods m),'[]'::jsonb),'recent',coalesce((select jsonb_agg(to_jsonb(r)) from recent r),'[]'::jsonb));
$$;
revoke all on function public.valtrex_finance_report(text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.valtrex_finance_report(text,timestamptz,timestamptz,text) to service_role;
create table public.valtrex_support_threads (
 id uuid primary key default gen_random_uuid(), tenant_id text not null unique references public.valtrex_tenants(id) on delete cascade,
 owner_id text not null check(owner_id ~ '^[0-9]{15,22}$'), topic text not null default 'general' check(topic in ('general','billing','technical')),
 status text not null default 'open' check(status in ('open','waiting','closed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 owner_sent_at timestamptz, support_sent_at timestamptz, owner_read_at timestamptz, support_read_at timestamptz
);
create index valtrex_support_status_updated on public.valtrex_support_threads(status,updated_at desc);
create table public.valtrex_support_messages (
 id bigint generated always as identity primary key, thread_id uuid not null references public.valtrex_support_threads(id) on delete cascade,
 client_id uuid not null, author_role text not null check(author_role in ('owner','support')),
 actor_id text not null check(actor_id ~ '^[0-9]{15,22}$'), message text not null check(length(message) between 1 and 2000),
 created_at timestamptz not null default now(), unique(thread_id,client_id)
);
create index valtrex_support_messages_thread_id on public.valtrex_support_messages(thread_id,id desc);
create function public.valtrex_support_send(p_tenant text,p_owner text,p_actor text,p_role text,p_message text,p_client uuid,p_topic text default 'general') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.valtrex_support_threads; m public.valtrex_support_messages;
begin
 if p_role not in ('owner','support') or (p_role='owner' and p_actor<>p_owner) then raise exception 'Invalid actor'; end if;
 insert into public.valtrex_support_threads(tenant_id,owner_id,topic) values(p_tenant,p_owner,p_topic) on conflict(tenant_id) do nothing;
 select * into t from public.valtrex_support_threads where tenant_id=p_tenant for update;
 if t.owner_id<>p_owner then raise exception 'Owner changed'; end if;
 select * into m from public.valtrex_support_messages where thread_id=t.id and client_id=p_client;
 if found then return jsonb_build_object('id',m.id,'threadId',t.id,'repeated',true); end if;
 insert into public.valtrex_support_messages(thread_id,client_id,author_role,actor_id,message) values(t.id,p_client,p_role,p_actor,p_message) returning * into m;
 update public.valtrex_support_threads set status=case when p_role='owner' then 'open' else 'waiting' end,
 topic=case when p_role='owner' then p_topic else topic end,updated_at=m.created_at,owner_sent_at=case when p_role='owner' then m.created_at else owner_sent_at end,
 support_sent_at=case when p_role='support' then m.created_at else support_sent_at end where id=t.id;
 return jsonb_build_object('id',m.id,'threadId',t.id,'repeated',false);
end $$;
revoke all on function public.valtrex_support_send(text,text,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.valtrex_support_send(text,text,text,text,text,uuid,text) to service_role;
alter table public.valtrex_finance_entries enable row level security;
alter table public.valtrex_finance_sync enable row level security;
alter table public.valtrex_support_threads enable row level security;
alter table public.valtrex_support_messages enable row level security;
revoke all on public.valtrex_finance_entries,public.valtrex_finance_sync,public.valtrex_support_threads,public.valtrex_support_messages from public,anon,authenticated;
grant all on public.valtrex_finance_entries,public.valtrex_finance_sync,public.valtrex_support_threads,public.valtrex_support_messages to service_role;
revoke all on sequence public.valtrex_support_messages_id_seq from public,anon,authenticated;
grant usage,select on sequence public.valtrex_support_messages_id_seq to service_role;
