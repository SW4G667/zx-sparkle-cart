-- Limite por Gift e no máximo duas recuperações consentidas, com 24h de intervalo.
alter table public.valtrex_gifts add column if not exists member_limit integer not null default 500;
alter table public.valtrex_gifts add constraint valtrex_gifts_member_limit_valid check (member_limit between 1 and 500);
alter table public.valtrex_backup_jobs drop constraint if exists valtrex_backup_jobs_gift_id_actor_user_id_target_guild_id_key;
alter table public.valtrex_backup_jobs add column if not exists pull_index smallint not null default 0;
alter table public.valtrex_backup_jobs add constraint valtrex_backup_jobs_pull_index_valid check (pull_index in (0, 1));
create unique index if not exists valtrex_backup_jobs_gift_pull on public.valtrex_backup_jobs(gift_id, pull_index);

create or replace function public.valtrex_start_backup_pull(
  p_tenant_id text, p_gift_id uuid, p_actor_user_id text,
  p_target_guild_id text, p_count integer
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_gift public.valtrex_gifts%rowtype;
  v_first public.valtrex_backup_jobs%rowtype;
  v_job_id uuid;
  v_existing integer;
  v_eligible integer;
  v_added integer;
  v_index smallint;
begin
  select * into v_gift from public.valtrex_gifts
    where id = p_gift_id and tenant_id = p_tenant_id for update;
  if not found or v_gift.kind <> 'backup' or not v_gift.active
     or (v_gift.expires_at is not null and v_gift.expires_at <= now()) then
    return jsonb_build_object('error', 'Gift indisponível.');
  end if;
  if p_count is null or p_count < 1 or p_count > v_gift.member_limit or p_count > 500 then
    return jsonb_build_object('error', 'Quantidade acima do limite definido para este Gift.');
  end if;
  select count(*) into v_existing from public.valtrex_backup_jobs where gift_id = p_gift_id;
  if v_existing >= 2 then
    return jsonb_build_object('error', 'Este Gift já realizou as duas puxadas permitidas.', 'remainingPulls', 0);
  end if;
  v_index := v_existing::smallint;
  if v_existing = 1 then
    select * into v_first from public.valtrex_backup_jobs where gift_id = p_gift_id and pull_index = 0;
    if v_first.actor_user_id <> p_actor_user_id or v_first.target_guild_id <> p_target_guild_id then
      return jsonb_build_object('error', 'A segunda puxada deve usar o mesmo proprietário e servidor.');
    end if;
    if v_first.status not in ('completed', 'partial', 'failed') then
      return jsonb_build_object('error', 'A primeira puxada ainda está em andamento.');
    end if;
    if v_first.created_at + interval '24 hours' > now() then
      return jsonb_build_object('error', 'A segunda puxada libera 24 horas após a primeira.',
        'nextPullAt', v_first.created_at + interval '24 hours');
    end if;
  end if;
  select count(*) into v_eligible from public.valtrex_consents
    where tenant_id = p_tenant_id and revoked_at is null and retention_until > now();
  if v_eligible < p_count then
    return jsonb_build_object('error', 'Não há membros suficientes com autorização válida.');
  end if;
  insert into public.valtrex_backup_jobs(tenant_id, gift_id, actor_user_id, target_guild_id, requested_count, pull_index)
    values (p_tenant_id, p_gift_id, p_actor_user_id, p_target_guild_id, p_count, v_index)
    returning id into v_job_id;
  insert into public.valtrex_backup_job_members(tenant_id, job_id, discord_user_id)
    select p_tenant_id, v_job_id, c.discord_user_id from public.valtrex_consents c
    where c.tenant_id = p_tenant_id and c.revoked_at is null and c.retention_until > now()
    order by exists (
      select 1 from public.valtrex_backup_job_members prior
      join public.valtrex_backup_jobs j on j.id = prior.job_id
      where j.gift_id = p_gift_id and prior.discord_user_id = c.discord_user_id and prior.status = 'joined'
    ), c.consented_at
    limit p_count;
  get diagnostics v_added = row_count;
  if v_added <> p_count then raise exception 'Consent count changed during recovery preparation'; end if;
  return jsonb_build_object('jobId', v_job_id, 'requested', p_count, 'pullIndex', v_index,
    'remainingPulls', 1 - v_index, 'nextPullAt', case when v_index = 0 then now() + interval '24 hours' else null end);
end $$;
revoke all on function public.valtrex_start_backup_pull(text,uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.valtrex_start_backup_pull(text,uuid,text,text,integer) to service_role;
