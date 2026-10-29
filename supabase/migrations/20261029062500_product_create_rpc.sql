create or replace function public.urania_create_product(
  p_canonical_name text,
  p_description text default null,
  p_category_path text[] default '{}',
  p_brand text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, research, audit
as $$
declare actor uuid;
declare created research.products%rowtype;
begin
  actor := public.urania_require_role(array['admin','researcher']);
  if p_canonical_name is null or length(btrim(p_canonical_name)) < 2 or length(p_canonical_name) > 240 then
    raise exception 'canonical_name must be between 2 and 240 characters' using errcode = '22023';
  end if;
  if p_description is not null and length(p_description) > 8000 then
    raise exception 'description is too long' using errcode = '22023';
  end if;
  if coalesce(array_length(p_category_path,1),0) > 8 then
    raise exception 'category_path can contain at most 8 levels' using errcode = '22023';
  end if;
  insert into research.products(canonical_name, description, category_path, brand, created_by)
  values (btrim(p_canonical_name), nullif(btrim(p_description),''), coalesce(p_category_path,'{}'), nullif(btrim(p_brand),''), actor)
  returning * into created;
  insert into audit.audit_events(actor_id, action, resource_type, resource_id, details)
  values (actor, 'create', 'research.product', created.id::text, jsonb_build_object('canonical_name',created.canonical_name));
  return jsonb_build_object('data',jsonb_build_object('id',created.id,'canonical_name',created.canonical_name,'description',created.description,'category_path',created.category_path,'brand',created.brand,'status',created.status,'created_at',created.created_at,'updated_at',created.updated_at));
end;
$$;

revoke all on function public.urania_create_product(text,text,text[],text) from public, anon;
grant execute on function public.urania_create_product(text,text,text[],text) to authenticated;
