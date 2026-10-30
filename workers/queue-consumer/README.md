# Urania Queue Consumer

A separate Cloudflare Queues consumer for the `urania-jobs-dev` queue. It fails closed when a provider is not marked active and authorized or when its secret is missing.

## Required bindings
- `SUPABASE_URL`: public project URL
- `SUPABASE_PUBLISHABLE_KEY`: public publishable key
- `URANIA_INTERNAL_TOKEN`: secret; same value stored in Supabase Vault under `urania_internal_token`
- `SERPAPI_API_KEY`: optional server-side fallback for SerpApi; preferred credential storage is the provider Vault reference in Supabase

Apollo and Hunter API keys are retrieved server-side from Supabase Vault through the internal worker RPC. They are never sent to the browser or placed in queue messages.

## Supported flows
- `research.search` / `research.refresh` + `serpapi`: Google web search results
- `crm.company_discovery` + `apollo`: organization search and normalized company evidence
- `crm.contact_enrichment` + `hunter`: domain-based professional email discovery, stored as research evidence only

## Authorization and privacy controls
- Every provider must have `status=active` and `authorization_status=approved` before a request is made.
- Contact enrichment requires a valid company domain, market country, documented purpose, and a declared lawful basis in the job payload.
- Contact enrichment fails closed if those fields are absent. It does not create CRM contacts or send emails.
- First-contact email drafts are handled separately by the CRM approval workflow; this consumer has no email-sending capability.
- Provider error payloads are sanitized before they are stored in job records.

## Job lifecycle
- Claims the database job using an internal token-protected RPC and a short lease.
- Stores ranked results, snippets, source metadata, latency and an explicitly unknown API cost basis.
- Retries transient errors and moves exhausted jobs to the database dead-letter state; Cloudflare Queue also uses a DLQ.

No third-party request is made until the provider is approved and its credential is configured.
