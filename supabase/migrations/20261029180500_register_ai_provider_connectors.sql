insert into integrations.data_sources
  (provider_key, display_name, category, status, authorization_status, regions, capabilities, public_config)
values
  ('anthropic_api', 'Anthropic API', 'ai', 'planned', 'unknown', array['global']::text[], array['chat_completions','structured_output','research_summaries']::text[], '{}'::jsonb),
  ('google_gemini_api', 'Google Gemini API', 'ai', 'planned', 'unknown', array['global']::text[], array['chat_completions','structured_output','research_summaries']::text[], '{}'::jsonb),
  ('cloudflare_workers_ai', 'Cloudflare Workers AI', 'ai', 'planned', 'unknown', array['global']::text[], array['model_inference','embeddings','classification']::text[], '{}'::jsonb)
on conflict (provider_key) do update
set display_name = excluded.display_name,
    category = excluded.category,
    regions = excluded.regions,
    capabilities = excluded.capabilities,
    updated_at = now();
