-- Internal worker RPCs are only callable with the Supabase service role.
-- Cloudflare queue consumers call the custom-auth Edge Function; no anon RPC access remains.
revoke all on function public.urania_worker_claim_job(text,uuid) from public, anon, authenticated;
revoke all on function public.urania_worker_get_provider(text,text) from public, anon, authenticated;
revoke all on function public.urania_worker_update_job(text,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.urania_worker_store_search_results(text,uuid,text,text,text,jsonb,integer) from public, anon, authenticated;
grant execute on function public.urania_worker_claim_job(text,uuid) to service_role;
grant execute on function public.urania_worker_get_provider(text,text) to service_role;
grant execute on function public.urania_worker_update_job(text,uuid,text,text,text) to service_role;
grant execute on function public.urania_worker_store_search_results(text,uuid,text,text,text,jsonb,integer) to service_role;
