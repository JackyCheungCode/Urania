# Urania Development Operations

## Current isolated resources
- Git branch: `feat/urania-foundation` (draft PR #1; not merged to `main`).
- Cloudflare Pages: `urania-preview` (separate project).
- Cloudflare API Worker: `urania-api-dev`.
- Cloudflare Queue producer/consumer: `urania-jobs-dev` → `urania-queue-consumer-dev`; DLQ: `urania-dlq-dev`.
- Supabase: project `ipdfojcphsqnokajpzch`; schemas `research`, `crm`, `integrations`, `automation`, `audit`.
- The existing `urania` Worker and unrelated Sophrosyne/B2B resources are not replaced.

## Bootstrap the first workspace administrator
1. In Supabase Auth, create an account with a work email and a strong password.
2. After confirming the account identity, use the SQL editor to assign the server-managed role. Replace the email with the exact account email:
   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('urania_role', 'admin')
   where lower(email) = lower('admin@example.com');
   ```
3. Verify exactly one row was updated. Never put `urania_role` in `raw_user_meta_data` / user-editable metadata.
4. Sign in at the Pages site. Users without `app_metadata.urania_role` are blocked before the business UI loads.

## Enable SerpApi only after permission review
1. Obtain a SerpApi account/API key and review commercial use, quota, pricing, permitted storage, and retention.
2. In Cloudflare, open Worker `urania-queue-consumer-dev` → Settings → Variables and Secrets. Add `SERPAPI_API_KEY` as a **Secret** (never as plain text and never in GitHub or a Vite environment variable).
3. In Urania → Integrations, as an administrator, select SerpApi → Configure authorization. Enter the documented use scope and retention days, then attest that the secret and terms were checked.
4. Only then will the consumer accept SerpApi jobs. If the provider is not active/approved or the secret is absent, the consumer fails closed and records the reason; it does not call SerpApi.

## Queue behavior
- API jobs are persisted in `automation.collection_jobs` with an idempotency key before they are published.
- Queue messages use schema version 1 and contain only job metadata/query inputs; no API key or user access token is placed in the message.
- Consumer claims jobs with a short lease, stores SerpApi organic results in `research.search_results`, records provider usage with unknown cost basis until billing data is available, and writes an audit event.
- Transient errors retry. Exhausted jobs are marked dead-letter and sent to `urania-dlq-dev`.
- Current consumer implements SerpApi Google Search only. Other registered providers are catalog entries, not live adapters.

## Security notes
- `SUPABASE_PUBLISHABLE_KEY` is a public client identifier; it is not a service-role key.
- The queue consumer's internal capability token is generated separately, stored encrypted in Supabase Vault under `urania_internal_token`, and bound as a Cloudflare secret. Do not query or print its decrypted value.
- All business tables have RLS enabled and no direct client table grants. Browser operations use role-gated RPCs; worker-only RPCs are capability-token protected.
- First-touch outreach is not sent by the current release. Human approval remains mandatory.
- Do not merge or change production resources until build, API, authorization, and queue failure tests pass.
