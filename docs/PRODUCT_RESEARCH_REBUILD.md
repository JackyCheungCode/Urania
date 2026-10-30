# Urania Product Research Rebuild

Status: design baseline (M1). This rebuild replaces the current single-page product research experience with a stage-gated global product investment research workspace.

## Product contract

- Scope: global markets; hybrid research (automated collection and analysis, human verification of material claims); broad product investment and commercial opportunity assessment.
- Every material claim must link to evidence. Preserve publisher, URL, source type, publication/observation/collection timestamps, geography, metric, unit, methodology, license/use scope, confidence, freshness and verification status.
- Separate observed facts, proxy indicators, model estimates, assumptions, AI interpretation and human-verified conclusions.
- AI extracts, classifies, compares and explains. Deterministic code calculates TAM/SAM/SOM scenarios, unit economics, cash flow, ROI/NPV/IRR and weighted scores.
- Missing or stale evidence is a visible gap, never a zero or fabricated positive score.
- Hard-stop risks cannot be offset by a high commercial score. AI cannot approve investment.
- Preserve existing CRM, auth, provider vault, queue, product, score and profit RPCs. No destructive migration or production data rewrite.

## Research journey (nine gated stages)

1. Opportunity discovery: collect candidate signals from search, trend, marketplace, public statistics and industry sources; label each signal observed/proxy/estimated.
2. Opportunity normalization: canonical product/market identity, taxonomy, geography, deduplication and entity-match confidence; uncertain matches require review.
3. Demand validation: transaction/behavior evidence, search/social/review proxies, market size top-down and bottom-up, explicit TAM/SAM/SOM assumptions.
4. Competition and customer: competitor set, prices, positioning, reviews, pain points, buying criteria, willingness-to-pay and customer validation; stated intent is not purchase behavior.
5. Supply chain and operations: supplier identity, manufacturer/trader distinction, capacity, MOQ, dated quotes, currency, Incoterms, lead time, quality, certifications, payment and concentration.
6. Legal, compliance and risk: product safety, market access, IP, sanctions/trade restrictions, privacy, environmental/labor and business-integrity risks; mandatory human review for critical risks.
7. Financial model: B2C/B2B unit economics, landed cost, channel fees, returns, warranty, CAC, working capital, tax and operating costs; downside/base/upside plus sensitivity; versioned inputs.
8. Investment assessment: deterministic weighted score, evidence coverage/quality/freshness/confidence shown separately, hard-stop gate, scenario outcomes and recommendation rationale.
9. Human decision and monitoring: approve/reject/defer with decision owner, rationale, conditions and immutable audit history; schedule refreshes and compare forecast with actuals.

Each stage has: required inputs, tasks, outputs, evidence requirements, owner/agent, status, blockers, gate criteria, retry/return path and version. A stage cannot pass solely because an AI job completed.

## Information architecture

Research workspace navigation:
- Research overview (portfolio pipeline, bottlenecks, stale evidence, pending human reviews)
- Opportunity discovery (signal inbox, filters, saved searches, candidate queue)
- Opportunity dossier (single canonical record and nine-stage progress)
- Demand & market
- Competition & customer
- Supply chain
- Compliance & risk
- Financial model
- Investment assessment & approvals
- Reports & audit history
- Research data sources (reuse API integration center; show capability, authorization, license, freshness, cost and health)

Opportunity dossier tabs are stage-oriented, not a wall of unrelated cards. Desktop uses persistent research navigation and a readable content canvas; tablet collapses secondary navigation; mobile uses a compact header, one-column forms, horizontal stage stepper and full-width actions. Long tables become labeled stacked rows on narrow screens.

## Layout and design system

Use IBM Carbon React components and Carbon tokens as the source of truth. Follow IBM Carbon 2x Grid: 16 columns at large breakpoints, 8 at medium, 4 at small; 8px mini-unit rhythm; consistent gutters and content hierarchy. Use Carbon UI Shell, SideNav, Breadcrumb, Content, Grid/Column, Tabs, DataTable, StructuredList, Tile, InlineNotification, ProgressIndicator, Modal and form components where appropriate. Avoid bespoke CSS overriding Carbon geometry, global blanket radius overrides, nested grids with conflicting widths, or fixed-width toolbars.

Page composition:
1. UI Shell/header and research SideNav.
2. Breadcrumb and page leadspace (title, purpose, one primary action).
3. Stage progress with clear current stage and blockers.
4. Main work area: primary research content (8–12 columns) plus contextual evidence/decision rail (4–8 columns) on wide screens; stack on smaller screens.
5. Evidence and activity timeline.
6. Persistent stage actions at the end of the task, not scattered across cards.

Acceptance viewports: 360, 390, 672, 1024, 1312 and 1584px. No horizontal page overflow. Avoid tiny text and cramped controls.

## API and AI orchestration

Use a provider-neutral adapter contract:
- Search/discovery: SerpApi, DataForSEO, licensed search/news providers.
- Market/commerce signals: official statistics and trade data, marketplace APIs where licensed (eBay Browse, Amazon SP-API where eligible, Keepa as a paid proxy source), trend sources with documented access.
- Company/supplier/contact: Apollo, Hunter and business registries; contact enrichment is optional and must obey lawful basis, market law and do-not-contact controls.
- AI: OpenAI, Anthropic, Gemini and Workers AI behind a server-side model router. Provider credentials remain in Vault/Workers Secrets, never browser bundles.
- Workers/Queues execute long-running collection and agent tasks with idempotency, retry, rate limits, dead-letter handling, budget limits and run logs.
- Every provider adapter declares supported stages, geographies, metrics, license constraints, price/quota, freshness, rate limits and required secret names.
- Every AI run records model/provider, prompt/schema version, input evidence IDs, output, token/cost usage, latency, errors and human edits.
- AI output must be structured, evidence-linked and marked as unverified until human review where required.

Agent roles: Market Research, Competitor, Customer Research, Supply Chain, Risk & Compliance, Investment Analyst. Agents may not fabricate unavailable facts, silently resolve ambiguous entities, verify suppliers without proof, change financial assumptions without provenance, or approve investment.

## Existing data reuse and schema audit

Existing Supabase research schema includes products, product identifiers, product offers, observations, search results, suppliers, supplier quotes, profit scenarios, product scores and AI reports. Existing automation schema includes collection jobs/task runs; integrations schema includes data sources and usage events; audit schema includes audit events.

Before adding tables, inspect full columns, constraints, indexes, RLS, grants, RPCs and worker contracts. Map existing records to this target model. Add only missing entities and relationships in additive migrations, preferably research projects/opportunities, research stage runs/tasks, evidence sources/claims, assumptions, risk register, financial model versions and investment decisions/audit links. Never rename/drop existing tables or repurpose CRM entities.

## Build milestones

M1: repository/schema audit, product requirements, workflow state machine, data dictionary, authorization matrix, Carbon page skeleton and responsive layout.
M2: opportunity dossier, nine stage navigation, tasks/findings/evidence and human verification.
M3: provider adapters, collection orchestration, entity resolution and source/license/freshness metadata.
M4: deterministic market sizing, risk gates, B2B/B2C financial scenarios and versioned scoring.
M5: investment report, approvals, decision audit and monitoring.
M6: end-to-end tests, security/RLS review, failure recovery, performance and viewport QA.

## Definition of done

- Create a research project and opportunity, then generate the nine-stage task plan.
- Duplicate products from two sources are linked with confidence and review state.
- Every key conclusion opens its evidence and shows source/time/market/license.
- Missing, stale, low-confidence or single-source claims are visibly flagged.
- Editing assumptions recalculates financials and score deterministically and preserves versions.
- Hard-stop risk prevents investment approval.
- Approval records a human actor, timestamp, rationale and model/data snapshot.
- Tenant/RLS isolation and role permissions are tested.
- Queue retries are idempotent; failures reach a visible dead-letter state.
- UI passes 360/390/672/1024/1312/1584px visual and interaction checks.
- No secret is exposed to browser code or committed to Git.
