
-- XGameBrasil | schema v1 - executar em banco Supabase exclusivo da loja.
create extension if not exists pgcrypto;
create table if not exists public.xg_categories (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 70),
 slug text not null unique, active boolean not null default true, position int not null default 0,
 created_at timestamptz not null default now()
);
create table if not exists public.xg_products (
 id uuid primary key default gen_random_uuid(), category_id uuid references public.xg_categories(id) on delete set null,
 title text not null check(length(title) between 2 and 110), slug text not null unique,
 description text not null default '', price_cents integer not null check(price_cents > 0),
 compare_cents integer, image_url text, badge text, active boolean not null default false,
 featured boolean not null default false, delivery_mode text not null default 'code'
 check(delivery_mode in ('code','manual')),
 available_quantity integer not null default 0 check(available_quantity >= 0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.xg_orders (
 id uuid primary key default gen_random_uuid(),
 product_id uuid references public.xg_products(id) on delete set null,
 product_title text not null, amount_cents int not null check(amount_cents>0),
 method text not null check(method in ('pix','crypto')), currency text,
 provider_id text unique, provider_data jsonb not null default '{}'::jsonb,
 access_token_hash text not null unique,
 status text not null default 'pending' check (status in ('pending','paid','processing','delivered','failed','expired')),
 buyer_email text, buyer_feedback text, customer_ip_hash text,
 email_sent_at timestamptz, created_at timestamptz not null default now(), paid_at timestamptz,
 updated_at timestamptz not null default now()
);
create table if not exists public.xg_codes (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.xg_products(id) on delete cascade,
 secret_code text not null, order_id uuid unique references public.xg_orders(id) on delete set null,
 created_at timestamptz not null default now()
);
create unique index if not exists xg_codes_unique_per_product on public.xg_codes(product_id,secret_code);
create index if not exists xg_codes_product_available on public.xg_codes(product_id) where order_id is null;
create table if not exists public.xg_feedback (
 id uuid primary key default gen_random_uuid(), order_id uuid references public.xg_orders(id) on delete set null,
 name text, rating int check(rating between 1 and 5), body text not null check(length(body) between 1 and 1500),
 published boolean not null default false, is_test boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.xg_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.xg_rate_limits (id bigserial primary key, fingerprint text not null, created_at timestamptz not null default now());
create index if not exists xg_rate_limits_recent on public.xg_rate_limits(fingerprint,created_at desc);
insert into public.xg_settings(key,value) values
('store', '{"headline":"Tudo para o seu próximo nível.","subtitle":"Produtos digitais com atendimento humano, compras seguras e entrega acompanhada.","announcement":"Sua próxima conquista começa aqui.","support_email":"","theme":"azure"}'::jsonb)
on conflict (key) do nothing;

alter table public.xg_categories enable row level security;
alter table public.xg_products enable row level security;
alter table public.xg_orders enable row level security;
alter table public.xg_codes enable row level security;
alter table public.xg_feedback enable row level security;
alter table public.xg_settings enable row level security;
alter table public.xg_rate_limits enable row level security;
-- Nenhuma policy para anon/authenticated; APIs server-side usam SOMENTE service_role.
revoke all on public.xg_categories,public.xg_products,public.xg_orders,public.xg_codes,public.xg_feedback,public.xg_settings,public.xg_rate_limits from anon,authenticated;
grant all on public.xg_categories,public.xg_products,public.xg_orders,public.xg_codes,public.xg_feedback,public.xg_settings,public.xg_rate_limits to service_role;
grant usage,select on sequence public.xg_rate_limits_id_seq to service_role;

-- Transação única e idempotente; reserva código para pedido pago, sem jamais devolvê-lo ao cliente.
create or replace function public.xg_claim_code(p_order_id uuid)
returns table(secret_code text, mode text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_product uuid; v_status text; v_mode text; v_code text;
begin
 select o.product_id,o.status,p.delivery_mode into v_product,v_status,v_mode
 from public.xg_orders o left join public.xg_products p on p.id=o.product_id
 where o.id=p_order_id for update of o;
 if v_status not in ('paid','processing','delivered') then raise exception 'Pedido não confirmado'; end if;
 if v_mode='manual' then return query select null::text,'manual'::text; return; end if;
 select c.secret_code into v_code from public.xg_codes c where c.order_id=p_order_id;
 if v_code is null then
   with taken as (
     select id from public.xg_codes where product_id=v_product and order_id is null
     order by created_at,id for update skip locked limit 1
   )
   update public.xg_codes c set order_id=p_order_id from taken
   where c.id=taken.id returning c.secret_code into v_code;
 end if;
 if v_code is null then return query select null::text,'out_of_stock'::text; return; end if;
 return query select v_code,'code'::text;
end $$;
revoke all on function public.xg_claim_code(uuid) from public,anon,authenticated;
grant execute on function public.xg_claim_code(uuid) to service_role;
