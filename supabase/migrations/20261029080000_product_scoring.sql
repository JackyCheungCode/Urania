alter table research.product_scores add column if not exists notes text;

create or replace function public.urania_create_product_score(
  p_product_id uuid,
  p_component_scores jsonb,
  p_risk_flags text[] default '{}',
  p_confidence numeric default null,
  p_score_version text default 'v1.0',
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, auth, research, audit
as $$
declare actor uuid;
declare entry record;
declare weight numeric;
declare value numeric;
declare weighted_score numeric:=0;
declare coverage numeric:=0;
declare components_count integer:=0;
declare hard_stop boolean:=false;
declare final_score numeric;
declare flags text[]:=coalesce(p_risk_flags,'{}'::text[]);
declare created research.product_scores%rowtype;
begin
  actor:=public.urania_require_role(array['admin','researcher']);
  if p_product_id is null or not exists(select 1 from research.products where id=p_product_id and deleted_at is null) then raise exception 'product not found' using errcode='22023'; end if;
  if p_component_scores is null or jsonb_typeof(p_component_scores)<>'object' or p_component_scores='{}'::jsonb then raise exception 'component_scores must be a non-empty object' using errcode='22023'; end if;
  if p_confidence is not null and (p_confidence<0 or p_confidence>1) then raise exception 'confidence must be between 0 and 1' using errcode='22023'; end if;
  if p_score_version is null or length(btrim(p_score_version))<1 or length(p_score_version)>40 then raise exception 'score_version is required' using errcode='22023'; end if;
  if p_notes is not null and length(p_notes)>4000 then raise exception 'notes too long' using errcode='22023'; end if;
  if cardinality(flags)>20 then raise exception 'too many risk flags' using errcode='22023'; end if;
  if exists(select 1 from unnest(flags) f where f not in ('regulatory_prohibition','product_safety_block','ip_infringement','sanctions_block','high_return_rate','seasonality_risk','supplier_concentration','data_quality_low','margin_risk','other')) then
    raise exception 'unknown risk flag' using errcode='22023';
  end if;
  for entry in select key,value from jsonb_each(p_component_scores) loop
    weight:=case entry.key
      when 'demand_growth' then 0.20
      when 'market_size' then 0.15
      when 'competition' then 0.15
      when 'profit_potential' then 0.20
      when 'supply_chain' then 0.10
      when 'durability' then 0.10
      when 'differentiation' then 0.10
      else null end;
    if weight is null then raise exception 'unknown score component: %',entry.key using errcode='22023'; end if;
    if jsonb_typeof(entry.value)<>'number' then raise exception 'score components must be numeric' using errcode='22023'; end if;
    value:=(entry.value #>> '{}')::numeric;
    if value<0 or value>100 then raise exception 'component scores must be between 0 and 100' using errcode='22023'; end if;
    weighted_score:=weighted_score+value*weight;
    coverage:=coverage+weight;
    components_count:=components_count+1;
  end loop;
  hard_stop:=flags && array['regulatory_prohibition','product_safety_block','ip_infringement','sanctions_block']::text[];
  final_score:=case when hard_stop then 0 else round(weighted_score,2) end;
  insert into research.product_scores(product_id,score,score_version,component_scores,risk_flags,confidence,evidence_count,scored_by,notes)
  values(p_product_id,final_score,p_score_version,p_component_scores,flags,p_confidence,components_count,actor,nullif(btrim(p_notes),'')) returning * into created;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'score','research.product',p_product_id::text,jsonb_build_object('score_id',created.id,'score',final_score,'coverage_weight',round(coverage,4),'hard_stop',hard_stop,'score_version',p_score_version,'risk_flags',flags));
  return jsonb_build_object('data',jsonb_build_object('id',created.id,'product_id',created.product_id,'score',created.score,'score_version',created.score_version,'component_scores',created.component_scores,'risk_flags',created.risk_flags,'confidence',created.confidence,'evidence_count',created.evidence_count,'notes',created.notes,'coverage_weight',round(coverage,4),'hard_stop',hard_stop,'scored_at',created.scored_at));
end;
$$;
revoke all on function public.urania_create_product_score(uuid,jsonb,text[],numeric,text,text) from public,anon;
grant execute on function public.urania_create_product_score(uuid,jsonb,text[],numeric,text,text) to authenticated;
