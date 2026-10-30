-- Evidence capture RPCs. All writes remain SECURITY INVOKER and owner-scoped.
create or replace function public.urania_research_create_evidence_source(
  p_publisher text,
  p_source_type text,
  p_source_url text default null,
  p_title text default null,
  p_license_name text default null,
  p_license_scope text default null,
  p_retention_days integer default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_row research.evidence_sources;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if length(trim(coalesce(p_publisher,''))) < 2 then raise exception 'publisher_required' using errcode='22023'; end if;
  if p_source_url is not null and p_source_url !~* '^https?://' then
    raise exception 'source_url_must_be_http' using errcode='22023';
  end if;
  insert into research.evidence_sources(publisher,source_type,source_url,title,license_name,license_scope,retention_days,created_by)
  values(trim(p_publisher),p_source_type,nullif(trim(coalesce(p_source_url,'')),''),nullif(trim(coalesce(p_title,'')),''),nullif(trim(coalesce(p_license_name,'')),''),nullif(trim(coalesce(p_license_scope,'')),''),p_retention_days,auth.uid())
  returning * into v_row;
  return jsonb_build_object('id',v_row.id,'publisher',v_row.publisher,'source_type',v_row.source_type,'source_url',v_row.source_url,'title',v_row.title,'license_name',v_row.license_name,'license_scope',v_row.license_scope,'created_at',v_row.created_at);
end $$;

create or replace function public.urania_research_create_evidence_record(
  p_opportunity_id uuid,
  p_evidence_source_id uuid,
  p_evidence_class text,
  p_claim_supported text,
  p_finding_id uuid default null,
  p_metric_name text default null,
  p_metric_value numeric default null,
  p_metric_unit text default null,
  p_geography text default null,
  p_published_at timestamptz default null,
  p_observed_at timestamptz default null,
  p_methodology text default null,
  p_raw_excerpt text default null,
  p_confidence numeric default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_row research.evidence_records;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if length(trim(coalesce(p_claim_supported,''))) < 5 then raise exception 'evidence_claim_required' using errcode='22023'; end if;
  if not exists (
    select 1 from research.opportunities o
    join research.research_projects p on p.id=o.project_id
    join research.evidence_sources s on s.id=p_evidence_source_id
    where o.id=p_opportunity_id and p.created_by=auth.uid() and s.created_by=auth.uid()
  ) then raise exception 'opportunity_or_source_not_found' using errcode='P0002'; end if;
  if p_finding_id is not null and not exists (
    select 1 from research.research_findings f
    where f.id=p_finding_id and f.opportunity_id=p_opportunity_id and f.created_by=auth.uid()
  ) then raise exception 'finding_not_found' using errcode='P0002'; end if;
  if p_raw_excerpt is not null and length(p_raw_excerpt)>12000 then raise exception 'excerpt_too_long' using errcode='22023'; end if;
  insert into research.evidence_records(finding_id,opportunity_id,evidence_source_id,evidence_class,claim_supported,metric_name,metric_value,metric_unit,geography,published_at,observed_at,methodology,raw_excerpt,confidence,created_by)
  values(p_finding_id,p_opportunity_id,p_evidence_source_id,p_evidence_class,trim(p_claim_supported),nullif(trim(coalesce(p_metric_name,'')),''),p_metric_value,nullif(trim(coalesce(p_metric_unit,'')),''),nullif(trim(coalesce(p_geography,'')),''),p_published_at,p_observed_at,nullif(trim(coalesce(p_methodology,'')),''),p_raw_excerpt,p_confidence,auth.uid())
  returning * into v_row;
  return jsonb_build_object('id',v_row.id,'opportunity_id',v_row.opportunity_id,'finding_id',v_row.finding_id,'evidence_source_id',v_row.evidence_source_id,'evidence_class',v_row.evidence_class,'claim_supported',v_row.claim_supported,'verification_status',v_row.verification_status,'confidence',v_row.confidence,'collected_at',v_row.collected_at);
end $$;

create or replace function public.urania_research_list_evidence(p_opportunity_id uuid)
returns setof jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'id',e.id,'finding_id',e.finding_id,'opportunity_id',e.opportunity_id,
    'evidence_source_id',e.evidence_source_id,'publisher',s.publisher,
    'source_type',s.source_type,'source_url',s.source_url,'source_title',s.title,
    'evidence_class',e.evidence_class,'claim_supported',e.claim_supported,
    'metric_name',e.metric_name,'metric_value',e.metric_value,'metric_unit',e.metric_unit,
    'geography',e.geography,'published_at',e.published_at,'observed_at',e.observed_at,
    'collected_at',e.collected_at,'methodology',e.methodology,
    'verification_status',e.verification_status,'confidence',e.confidence
  )
  from research.evidence_records e
  join research.evidence_sources s on s.id=e.evidence_source_id
  join research.opportunities o on o.id=e.opportunity_id
  join research.research_projects p on p.id=o.project_id
  where e.opportunity_id=p_opportunity_id and p.created_by=auth.uid()
  order by e.collected_at desc
$$;

revoke all on function public.urania_research_create_evidence_source(text,text,text,text,text,text,integer) from public, anon;
revoke all on function public.urania_research_create_evidence_record(uuid,uuid,text,text,uuid,text,numeric,text,text,timestamptz,timestamptz,text,text,numeric) from public, anon;
revoke all on function public.urania_research_list_evidence(uuid) from public, anon;
grant execute on function public.urania_research_create_evidence_source(text,text,text,text,text,text,integer) to authenticated;
grant execute on function public.urania_research_create_evidence_record(uuid,uuid,text,text,uuid,text,numeric,text,text,timestamptz,timestamptz,text,text,numeric) to authenticated;
grant execute on function public.urania_research_list_evidence(uuid) to authenticated;
