# Urania API Worker

This is a separate development Worker. It does not replace the existing `urania` Worker or any B2B/Sophrosyne resource.

## Routes
- `GET /health`: liveness only; reports whether public Supabase configuration is present.
- `GET /api/v1/status`: API capabilities and explicit data-provider status.
- `POST /api/v1/rpc/:function`: authenticated, allowlisted Supabase RPC proxy.

## Security model
- Only allowlisted RPC names are forwarded.
- Browser origins must match `ALLOWED_ORIGINS` exactly.
- User access tokens are validated through Supabase Auth before forwarding.
- The server-managed `app_metadata.urania_role` is checked in the Worker and again in database functions.
- Supabase service-role keys are not used by this Worker and must never be shipped to browsers.
- The database remains the final authorization boundary.
- Request payload is limited to 16 KiB; responses are not cached.

## Deployment configuration
Set Worker vars `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `ALLOWED_ORIGINS`. Publishable keys are public client identifiers, not service-role secrets. Add the final Pages domain to the origin allowlist after frontend deployment.

## Current limits
This API does not yet invoke SerpApi or any other third-party provider. Those adapters must be added behind provider-specific permission, cost, rate-limit, timeout and retention controls.
