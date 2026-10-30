-- Persist AI-assisted research as explicitly unverified findings.
create or replace function public.urania_worker_save_ai_research(
 p_internal_token text,p_opportunity_id uuid,p_requested_by uuid,
 p_provider_key text,p_model_name text,p_prompt_version text,
 p_input_scope jsonb,p_output_summary jsonb,p_findings jsonb
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,vault,research
as $$
declare expected text; v_run research.research_runs; item jsonb; inserted integer:=0;
begin
 select decrypted_secret into expected from vault.decrypted_secrets where name='urania_internal_token' limit 1;
 if expected is null or p_internal_token is null or expected<>p_internal_token then raise exception 'forbidden' using errcode='42501'; end if;
 if jsonb_typeof(coalesce(p_findings,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_findings,'[]'::jsonb))>20 then
  raise exception 'invalid_findings_array' using errcode='22023';
 end if;
 if not exists(select 1 from research.opportunities o join research.research_projects p on p.id=o.project_id
   where o.id=p_opportunity_id and p.created_by=p_requested_by) then
  raise exception 'opportunity_not_found' using errcode='P0002';
 end if;
 insert into research.research_runs(project_id,opportunity_id,run_type,status,model_provider,model_name,prompt_version,
   input_scope,output_summary,started_at,finished_at,created_by)
 select o.project_id,o.id,'ai_research_analysis','succeeded',p_provider_key,p_model_name,p_prompt_version,
   coalesce(p_input_scope,'{}'::jsonb),coalesce(p_output_summary,'{}'::jsonb),now(),now(),p_requested_by
 from research.opportunities o where o.id=p_opportunity_id returning * into v_run;
 for item in select value from jsonb_array_elements(coalesce(p_findings,'[]'::jsonb)) as x(value) loop
  if item->>'stage' not in ('discovery','standardization','demand','competition','customer','supply_chain','compliance','financial','investment','monitoring')
   or item->>'finding_type' not in ('claim','observation','estimate','contradiction','gap')
   or length(trim(coalesce(item->>'claim','')))<5 then
   raise exception 'invalid_ai_finding' using errcode='22023';
  end if;
  insert into research.research_findings(opportunity_id,stage,finding_type,claim,explanation,evidence_status,confidence,
    freshness_status,model_generated,research_run_id,created_by)
  values(p_opportunity_id,item->>'stage',item->>'finding_type',left(trim(item->>'claim'),2000),
    nullif(left(trim(coalesce(item->>'explanation','')),4000),''),'insufficient',
    case when jsonb_typeof(item->'confidence')='number' then (item->>'confidence')::numeric else null end,
    'unknown',true,v_run.id,p_requested_by);
  inserted:=inserted+1;
 end loop;
 return jsonb_build_object('research_run_id',v_run.id,'status',v_run.status,'finding_count',inserted,
  'evidence_status','insufficient','model_provider',p_provider_key,'model_name',p_model_name);
end $$;
revoke all on function public.urania_worker_save_ai_research(text,uuid,uuid,text,text,text,jsonb,jsonb,jsonb) from public,authenticated;
grant execute on function public.urania_worker_save_ai_research(text,uuid,uuid,text,text,text,jsonb,jsonb,jsonb) to anon, service_role;
