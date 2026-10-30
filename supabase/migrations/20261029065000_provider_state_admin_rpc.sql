create or replace function public.urania_set_provider_state(
  p_provider_key text,
  p_status text,
  p_authorization_status text,
  p_license_scope text default null,
  p_retention_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, integrations, audit
as $$
declare actor uuid;
declare previous integrations.data_sources%rowtype;
declare updated integrations.data_sources%rowtype;
begin
  actor := public.urania_require_role(array['admin']);
  if p_status not in ('planned','pending_authorization','configured','active','paused','disabled','error') then
    raise exception 'invalid provider status' using errcode='22023';
  end if;
  if p_authorization_status not in ('unknown','pending','approved','restricted','rejected') then
    raise exception 'invalid authorization status' using errcode='22023';
  end if;
  if p_status='active' and p_authorization_status <> 'approved' then
    raise exception 'active providers must be approved' using errcode='22023';
  end if;
  if p_authorization_status='approved' and (p_license_scope is null or length(btrim(p_license_scope)) < 8 or p_retention_days is null or p_retention_days < 1) then
    raise exception 'approved providers require license scope and retention days' using errcode='22023';
  end if;
  select * into previous from integrations.data_sources where provider_key=p_provider_key for update;
  if previous.id is null then raise exception 'provider not found' using errcode='P0002'; end if;
  update integrations.data_sources
  set status=p_status, authorization_status=p_authorization_status,
      license_scope=case when p_license_scope is null then license_scope else btrim(p_license_scope) end,
      retention_days=case when p_retention_days is null then retention_days else p_retention_days end,
      updated_at=now()
  where provider_key=p_provider_key
  returning * into updated;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'update_provider_state','integrations.data_source',updated.id::text,
    jsonb_build_object('provider_key',p_provider_key,'previous_status',previous.status,'new_status',updated.status,'previous_authorization',previous.authorization_status,'new_authorization',updated.authorization_status,'license_scope',updated.license_scope,'retention_days',updated.retention_days));
  return jsonb_build_object('data',jsonb_build_object('provider_key',updated.provider_key,'status',updated.status,'authorization_status',updated.authorization_status,'license_scope',updated.license_scope,'retention_days',updated.retention_days));
end;
$$;
revoke all on function public.urania_set_provider_state(text,text,text,text,integer) from public, anon;
grant execute on function public.urania_set_provider_state(text,text,text,text,integer) to authenticated;
