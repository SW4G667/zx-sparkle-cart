-- Session and tenant ownership are checked by the Edge Function. No browser role
-- can read these tables or the private image bucket directly.
create table if not exists public.valtrex_assistant_chats (
 id uuid primary key default gen_random_uuid(),
 tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
 owner_id text not null,
 title text not null default 'Nova conversa' check (char_length(title) between 1 and 80),
 messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages)='array' and jsonb_array_length(messages)<=300),
 revision uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists assistant_chats_owner_updated95 on public.valtrex_assistant_chats(tenant_id,owner_id,updated_at desc);
create table if not exists public.valtrex_assistant_actions (
 id uuid primary key default gen_random_uuid(),
 chat_id uuid not null references public.valtrex_assistant_chats(id) on delete cascade,
 tenant_id text not null references public.valtrex_tenants(id) on delete cascade,
 owner_id text not null,
 kind text not null check (kind in ('product','theme','restock','image_edit')),
 payload jsonb not null,
 state text not null default 'pending' check (state in ('pending','executing','done','cancelled','failed','uncertain')),
 result jsonb,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '30 minutes')
);
create index if not exists assistant_actions_chat95 on public.valtrex_assistant_actions(chat_id,created_at);
alter table public.valtrex_assistant_chats enable row level security;
alter table public.valtrex_assistant_actions enable row level security;
revoke all on public.valtrex_assistant_chats,public.valtrex_assistant_actions from public,anon,authenticated;
grant all on public.valtrex_assistant_chats,public.valtrex_assistant_actions to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('assistant-private95','assistant-private95',false,3145728,array['image/png','image/jpeg','image/webp'])
 on conflict(id) do nothing;
