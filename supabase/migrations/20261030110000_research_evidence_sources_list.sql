create or replace function public.urania_research_list_evidence_sources()
returns setof jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object('id',s.id,'publisher',s.publisher,'source_type',s.source_type,'source_url',s.source_url,'title',s.title,'license_name',s.license_name,'license_scope',s.license_scope,'created_at',s.created_at)
  from research.evidence_sources s
  where s.created_by=auth.uid()
  order by s.created_at desc
$$;
revoke all on function public.urania_research_list_evidence_sources() from public, anon;
grant execute on function public.urania_research_list_evidence_sources() to authenticated;
