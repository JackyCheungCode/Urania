# Urania API Worker

This is a separate development Worker. It does not replace the existing `urania` Worker or any B2B/Sophrosyne resource.

## Routes
- `GET /health`: liveness only; reports whether public Supabase configuration is present.
- `GET /api/v1/status`: API capabilities and explicit data-provider status.
- `POST /api/v1/rpc/:function`: authenticated, allowlisted Supabase RPC proxy.
- `POST /api/v1/jobs`: validates a researcher/admin session, creates an idempotent database job and publishes it to Cloudflare Queues.

## Supported collection jobs
- `research.search` / `research.refresh` with `serpapi`
- `crm.company_discovery` with `apollo`
- `crm.contact_enrichment` with `hunter`

The API Worker only creates the job and publishes its message. Provider credentials are retrieved by the separate Queue Consumer from Supabase Vault; they are never accepted in browser payloads.

## Security model
- Only allowlisted RPC names and job types are forwarded.
- Browser origins must match `ALLOWED_ORIGINS` or the configured Urania Pages preview domain.
- User access tokens are validated through Supabase Auth before forwarding.
- The server-managed `app_metadata.urania_role` is checked in the Worker and again in database functions.
- Supabase service-role keys are not used by this Worker and must never be shipped to browsers.
- The database remains the final authorization boundary.
- Request payload is limited to 16 KiB; responses are not cached.
- Contact enrichment requires a market, purpose and declared lawful basis and fails closed if these are missing.

## Deployment configuration
Set Worker vars `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `ALLOWED_ORIGINS`, plus the `URANIA_JOBS` queue binding. Publishable keys are public client identifiers, not service-role secrets.

Provider activation and credentials are separate admin-controlled steps. A provider must be active and explicitly approved before the consumer makes any third-party request.
