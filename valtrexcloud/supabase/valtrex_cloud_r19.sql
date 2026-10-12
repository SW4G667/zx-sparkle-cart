-- Troca atômica do catálogo do Manager. A troca remove vínculos antigos
-- quando uma aplicação muda de dono ou é excluída no Manager.
create or replace function public.valtrex_replace_managed_apps(p_apps jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare v_count integer;
begin
  if jsonb_typeof(p_apps) <> 'array' or jsonb_array_length(p_apps) > 500 then
    raise exception 'Catálogo inválido';
  end if;
  v_count := jsonb_array_length(p_apps);
  insert into public.valtrex_managed_apps
    (manager_app_id, owner_user_id, bot_id, label, profile, status, expires_at, synced_at)
  select x.manager_app_id, x.owner_user_id, x.bot_id, x.label, x.profile, x.status,
    x.expires_at, now()
  from jsonb_to_recordset(p_apps) as x(manager_app_id text, owner_user_id text,
    bot_id text, label text, profile text, status text, expires_at timestamptz)
  on conflict (manager_app_id, owner_user_id) do update set
    bot_id = excluded.bot_id, label = excluded.label, profile = excluded.profile,
    status = excluded.status, expires_at = excluded.expires_at, synced_at = now();
  delete from public.valtrex_managed_apps old
  where not exists (
    select 1 from jsonb_to_recordset(p_apps) as x(manager_app_id text, owner_user_id text)
    where x.manager_app_id = old.manager_app_id and x.owner_user_id = old.owner_user_id
  );
  return v_count;
end $$;
revoke all on function public.valtrex_replace_managed_apps(jsonb) from public, anon, authenticated;
grant execute on function public.valtrex_replace_managed_apps(jsonb) to service_role;
