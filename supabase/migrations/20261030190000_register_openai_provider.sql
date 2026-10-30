insert into integrations.data_sources
 (provider_key,display_name,category,status,authorization_status,regions,capabilities,public_config)
values
 ('openai_api','OpenAI API','ai','planned','unknown',array['global']::text[],array['chat_completions','structured_output','research_analysis']::text[],'{}'::jsonb)
on conflict(provider_key) do update set
 display_name=excluded.display_name,category=excluded.category,
 capabilities=excluded.capabilities,updated_at=now();
