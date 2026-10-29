create or replace function public.urania_set_provider_credential(
  p_provider_key text,
  p_api_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, vault, integrations, audit
as $$
declare
  actor uuid;
  source integrations.data_sources%rowtype;
  secret_id uuid;
begin
  actor := public.urania_require_role(array['admin']);

  if p_provider_key is null or p_provider_key !~ '^[a-z][a-z0-9_]{1,79}$' then
    raise exception 'invalid provider key' using errcode = '22023';
  end if;
  if p_api_key is null or length(btrim(p_api_key)) < 8 or length(p_api_key) > 4096 then
    raise exception 'API credential must be between 8 and 4096 characters' using errcode = '22023';
  end if;

  select * into source
  from integrations.data_sources
  where provider_key = p_provider_key
  for update;

  if source.id is null then
    raise exception 'provider not found' using errcode = 'P0002';
  end if;

  if source.secret_reference is not null and source.secret_reference ~* '^[0-9a-f-]{36}$' then
    secret_id := source.secret_reference::uuid;
  end if;

  if secret_id is not null and exists (select 1 from vault.secrets where id = secret_id) then
    perform vault.update_secret(
      secret_id,
      p_api_key,
      'urania_provider_' || p_provider_key,
      'Urania provider credential; admin-managed; do not expose to clients',
      null
    );
  else
    secret_id := vault.create_secret(
      p_api_key,
      'urania_provider_' || p_provider_key,
      'Urania provider credential; admin-managed; do not expose to clients',
      null
    );
  end if;

  update integrations.data_sources
  set secret_reference = secret_id::text,
      status = case when status in ('planned','error') then 'configured' else status end,
      updated_at = now()
  where id = source.id;

  insert into audit.audit_events(actor_id, action, resource_type, resource_id, details)
  values (actor, 'configure_credential', 'integration.provider', p_provider_key,
          jsonb_build_object('credential_saved', true, 'secret_value_returned', false));

  return jsonb_build_object('data', jsonb_build_object(
    'provider_key', p_provider_key,
    'credential_configured', true,
    'status', case when source.status in ('planned','error') then 'configured' else source.status end
  ));
end;
$$;

revoke all on function public.urania_set_provider_credential(text,text) from public, anon;
grant execute on function public.urania_set_provider_credential(text,text) to authenticated;

create or replace function public.urania_worker_get_provider(p_internal_token text, p_provider_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'vault', 'integrations'
as $function$
declare
  expected text;
  result jsonb;
begin
  select decrypted_secret into expected
  from vault.decrypted_secrets
  where name='urania_internal_token'
  limit 1;

  if expected is null or p_internal_token is null or expected <> p_internal_token then
    raise exception 'forbidden' using errcode='42501';
  end if;

  select jsonb_build_object(
    'provider_key', ds.provider_key,
    'display_name', ds.display_name,
    'status', ds.status,
    'authorization_status', ds.authorization_status,
    'license_scope', ds.license_scope,
    'retention_days', ds.retention_days,
    'credential_configured', (ds.secret_reference is not null and v.decrypted_secret is not null),
    'api_key', v.decrypted_secret
  )
  into result
  from integrations.data_sources ds
  left join vault.decrypted_secrets v on v.id = case
    when ds.secret_reference ~* '^[0-9a-f-]{36}$' then ds.secret_reference::uuid
    else null
  end
  where ds.provider_key=p_provider_key;

  return coalesce(result, jsonb_build_object('error','provider_not_found'));
end;
$function$;

revoke all on function public.urania_worker_get_provider(text,text) from public, anon, authenticated;
grant execute on function public.urania_worker_get_provider(text,text) to service_role;
