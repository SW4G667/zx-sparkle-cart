create table public.valtrex_assistant_preferences (
 tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
 owner_id text not null,
 revision uuid not null default gen_random_uuid(),
 config jsonb not null default '{}'::jsonb check (jsonb_typeof(config)='object'),
 memories jsonb not null default '[]'::jsonb check (jsonb_typeof(memories)='array' and jsonb_array_length(memories)<=20),
 updated_at timestamptz not null default now(),
 primary key(tenant_id,owner_id)
);
alter table public.valtrex_assistant_preferences enable row level security;
revoke all on public.valtrex_assistant_preferences from public,anon,authenticated;
grant all on public.valtrex_assistant_preferences to service_role;
