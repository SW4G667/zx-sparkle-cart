-- Owner authorization is performed by the authenticated Edge Function. These tables are service-only.
create table public.valtrex_product_catalogs (
 tenant_id text primary key references public.valtrex_tenants(id) on delete cascade,
 products jsonb not null default '[]'::jsonb check (jsonb_typeof(products) = 'array' and jsonb_array_length(products) <= 500),
 seen_at timestamptz not null default now(), bridge_version integer not null default 1
);
create table public.valtrex_product_commands (
 id uuid primary key default gen_random_uuid(), tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
 product_id text not null check (length(product_id) between 1 and 150),
 action text not null check (action in ('create','edit')), payload jsonb not null,
 base_revision text, state text not null default 'pending' check (state in ('pending','applied','conflict','failed','cancelled')),
 detail text, created_at timestamptz not null default now(), completed_at timestamptz
);
create unique index valtrex_one_product_pending on public.valtrex_product_commands(tenant_id,product_id) where state = 'pending';
create index valtrex_commands_tenant_created on public.valtrex_product_commands(tenant_id,created_at desc);
create table public.valtrex_site_notices (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 100),
 message text not null check(length(message) between 1 and 1500), link text,
 target_user_id text check(target_user_id is null or target_user_id ~ '^[0-9]{15,22}$'),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '30 days',
 archived boolean not null default false
);
create index valtrex_notices_expiry on public.valtrex_site_notices(expires_at desc) where not archived;
create table public.valtrex_notice_reads (
 notice_id uuid not null references public.valtrex_site_notices(id) on delete cascade,
 user_id text not null check(user_id ~ '^[0-9]{15,22}$'), read_at timestamptz not null default now(), primary key(notice_id,user_id)
);
alter table public.valtrex_product_catalogs enable row level security;
alter table public.valtrex_product_commands enable row level security;
alter table public.valtrex_site_notices enable row level security;
alter table public.valtrex_notice_reads enable row level security;
revoke all on public.valtrex_product_catalogs, public.valtrex_product_commands, public.valtrex_site_notices, public.valtrex_notice_reads from public,anon,authenticated;
grant all on public.valtrex_product_catalogs, public.valtrex_product_commands, public.valtrex_site_notices, public.valtrex_notice_reads to service_role;
