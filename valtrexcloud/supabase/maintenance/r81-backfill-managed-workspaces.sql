-- Backfill de dados, idempotente. Não altera chaves, dono ou aparência de um
-- workspace existente. Um bot com proprietários conflitantes é ignorado.
-- As chaves provisórias nunca são entregues ao navegador; o bootstrap do bot
-- as substitui após validar o token da aplicação diretamente no Discord.
with canonical as (
  select bot_id as id, min(owner_user_id) as owner_user_id, max(label) as label
  from public.valtrex_managed_apps
  where bot_id ~ '^[0-9]{15,22}$' and owner_user_id ~ '^[0-9]{15,22}$'
  group by bot_id
  having count(distinct owner_user_id) = 1
), created as (
  insert into public.valtrex_tenants (id, owner_user_id, label, bot_key_hash)
  select c.id, c.owner_user_id, coalesce(nullif(c.label, ''), 'Aplicação'),
    encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex')
  from canonical c
  where not exists (select 1 from public.valtrex_tenants t where t.id = c.id)
  on conflict (id) do nothing
  returning id
)
select count(*) as created_workspaces from created;
