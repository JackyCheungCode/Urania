# Urania Research Intelligence

## Research workflow

The research workspace uses an evidence-first workflow. Projects define the research objective, geography, horizon and approval policy. Opportunities are evaluated through discovery, standardization, demand, competition, customer, supply-chain, compliance, financial, investment and monitoring stages.

A finding is a research statement, not proof. Evidence records retain a source reference and distinguish observed transactions/behaviour, proxy indicators, model estimates, expert opinion and primary research. New evidence defaults to `unverified`. Human verification requires a note and creates an immutable status-history event.

## Financial model

`src/lib/investment-model.ts` is a deterministic calculation module, versioned as `urania-investment-v1.0`. It produces downside, base and upside cases. Model snapshots are stored in `research.financial_models` with incrementing per-opportunity versions. Inputs remain assumptions; outputs are not actual performance, a tax opinion or investment advice.

The current v1 model is a simplified annual operating cash-flow model. It does not yet include detailed monthly working-capital schedules, depreciation, debt financing, FX translation, jurisdiction-specific tax, terminal value or a fully integrated TAM/SAM/SOM-to-revenue bridge. These require explicit inputs and should not be silently inferred.

## Risk controls

Risks are recorded independently of commercial scoring. An active hard-veto risk is surfaced as a blocking warning and must not be offset by a high score or attractive NPV. The current release provides risk capture and visibility; the final investment-decision transition must enforce veto checks server-side before any approval is possible.

## Database and API boundary

Research tables are in the private `research` schema and are protected by RLS. Public PostgREST RPCs use `SECURITY INVOKER`, explicit grants and owner checks. The Cloudflare API Worker has a matching RPC allowlist restricted to administrator/researcher application roles. Provider secrets remain in Supabase Vault and must never be placed in browser code.

## Deployment checklist

1. Apply the research migrations to a disposable/staging Supabase branch.
2. Run Supabase security and performance advisors; resolve findings before promotion.
3. Test owner isolation with two authenticated accounts, including evidence source, evidence record, risk, and financial model cross-owner attempts.
4. Run `npm run typecheck`, `node --test tests/*.test.mjs`, and `npm run build`.
5. Deploy the internal worker and Cloudflare API/queue workers to a non-production environment; verify queue retries, DLQ behaviour, provider authorization and secret handling.
6. Complete authenticated browser E2E tests before merging the draft PR or deploying production.

No production migration or deployment is implied by this document.
