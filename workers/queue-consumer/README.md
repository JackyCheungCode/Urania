# Urania Queue Consumer

A separate Cloudflare Queues consumer for the `urania-jobs-dev` queue. It fails closed when a provider is not marked active and authorized or when its secret is missing.

## Required bindings
- `SUPABASE_URL`: public project URL
- `SUPABASE_PUBLISHABLE_KEY`: public publishable key
- `URANIA_INTERNAL_TOKEN`: secret; same value stored in Supabase Vault under `urania_internal_token`
- `SERPAPI_API_KEY`: secret; required for live SerpApi calls

## Supported flow
- Claims the database job using an internal token-protected RPC and a short lease.
- Requires provider registry state `status=active` and `authorization_status=approved`.
- Calls SerpApi Google Search for `research.search` and `research.refresh` only.
- Stores ranked results, snippets, source metadata, latency and an explicitly unknown API cost basis.
- Retries transient errors and moves exhausted jobs to the database dead-letter state; Cloudflare Queue also uses a DLQ.

No SerpApi request is made until the API key is configured and the provider is approved.
