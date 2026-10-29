# Urania Architecture — Foundation

## Product boundaries

Urania has three connected business surfaces:

1. Product Research: discovery, demand signals, competition, supplier feasibility, deterministic profit calculations and versioned reports.
2. CRM: accounts, contacts, leads, opportunities, activities, approvals, quotes and orders.
3. Intelligence: provider connectors, entity resolution, evidence lineage, data quality, licensing and cost observability.

The UI is organized by user workflows rather than provider names. SerpApi, DataForSEO and other vendors are adapters behind a stable connector contract.

## Proposed deployment topology

- Frontend: React + TypeScript + Vite, static output in `dist/`.
- Application API: dedicated Urania Worker, separate from existing unrelated Workers.
- Async work: Urania-specific Cloudflare Queues and a dead-letter queue, created only after existing resource audit and explicit implementation of queue consumers.
- Data: existing Urania Supabase project, using a dedicated application schema and migrations after RLS and access boundaries are reviewed.
- Secrets: server-side only; no provider credentials in browser bundles, GitHub or SQL seed data.

## Evidence model

Every observation should retain:
- provider and provider record identifier;
- source URL or source reference;
- observed and fetched timestamps;
- market, locale, currency and unit;
- evidence class (T1 transaction/observed, T2 proxy, T3 estimate);
- license scope and retention deadline;
- normalization and estimation method version;
- confidence and optional estimate interval.

AI can explain evidence and form hypotheses. It must not invent metrics or silently convert proxy indicators into actual sales.

## CRM invariants

- One account can have many contacts, leads, opportunities, activities and quotes.
- Product identity is separate from product offers on individual platforms.
- Contact and company fields must retain source provenance and human-verification state.
- External enrichment must not silently overwrite manually verified values.
- First-touch outreach requires human approval, opt-out checks and an audit trail.

## Integration lifecycle

1. Register provider and capability.
2. Verify account access, API permissions, terms, region coverage and retention limits.
3. Store credentials in server-side secret storage.
4. Map provider responses to canonical entities and observations.
5. Apply dedupe, rate limits, caching, cost limits, retry policy and dead-letter handling.
6. Monitor accuracy, freshness, latency, error rate and cost per validated opportunity.

## Current milestone status

- [x] Initial responsive navigation and page shell.
- [x] Interactive dashboard and sample tables.
- [x] Product research and CRM prototype screens.
- [x] Connector directory and automation/approval prototype.
- [ ] Authentication and role-based authorization.
- [ ] Database migrations, RLS and automated tests.
- [ ] Real connector adapters and provider credentials.
- [ ] Queue consumers, retry/DLQ and observability.
- [ ] Production deployment and smoke tests.
