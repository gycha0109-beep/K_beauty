# TRUST zero-AI product research v2: P0 baseline and staged delivery

Date: 2026-10-12. Owner: TRUST / taxonomy-ai. This document records a read-only operational baseline and a finite implementation plan. It does not grant automatic Subject or Fact creation.

## Verified production baseline

- 176 products, 175 catalog TRUST intakes, 454 Product Fact research tasks.
- 129 intakes are SUBJECT_CREATION_REQUIRED, with 318 blocked research tasks.
- All 129 lack a Product Fact Subject; existing Subject reuse cannot resolve this cohort.
- 128 of 129 intakes have no specified market. Only 1 has a linked catalog source candidate.
- 92 of 129 have a resolved source binding, and all 92 are Hwahae bindings, not governed manufacturer sources.
- Official or brand-authoritative source bindings in this cohort: 0.
- Current TRUST observations: 31 records for 17 distinct products; evidence candidates: 32.

A resolved third-party binding must never be promoted to official source or assigned KR market solely because it is linked to Hwahae.

## Ownership: reuse, do not duplicate

| Capability | Existing authority |
| --- | --- |
| Catalog candidates and products | crawler/, product_candidates, products |
| Subject resolution | catalog_trust_intake, resolve_catalog_trust_subject_v1 |
| Subject registration | admin_register_product_fact_subject_v1; lib/admin/trust-subject-identity.js |
| Research queue | product_fact_research_tasks and TRUST Worker |
| Official source discovery | lib/trust/official-source-fetch.mjs, official-source-rediscovery.mjs |
| Research observations | trust_source_observations and trust_evidence_candidates |
| Fact authority | existing Product Fact registry and controlled confirmation |
| Evidence evaluation | lib/product-intelligence/automatic-product-evidence-*.mjs |
| Operations | existing run/evaluation histories and admin exceptions |

## P0 deliverable

A tested, read-only identity-readiness classifier and admin inventory. It never mutates Subject, Facts, recommendations or catalog data. It rejects missing or cross-product relationships, distinguishes missing market, missing authoritative catalog identity, missing manufacturer evidence, and missing formulation evidence. A seemingly complete diagnosis still requires separate governed Subject registration preflight.

## Finite implementation stages

P1 — Identity: resolve market and authoritative product/formulation provenance, then design narrow audited Machine Actor Subject registration. No direct worker INSERT and no inferred market.

P2 — Research: connect the existing safe official fetcher, sitemap discovery, scope matching, digests and retries to pending tasks. Third-party citations are discovery only. Record inaccessible sources without guessing.

P3 — Extraction: deterministic official-source parsing for sunscreen SPF, PA, and UV-filter-type direct statements. INCI dictionary remains an inference, not a verified Fact. Test negation, revisions, mismatch and contradictory sources.

P4 — Guarded confirmation: controlled machine identity, explicit fact allowlist, authority checks, audit/correction, shadow comparison and kill switch. Must never impersonate admin credentials or automatically alter recommendation admission.

P5 — E2E acceptance: measure unattended rate and official-source coverage on predefined gold-set products, verify zero serious wrong confirmations, duplicates, retries, outages, and AI API requests. Publish runbook and declare v2 feature development closed after recorded acceptance.

## Excluded from P0/P1 read-only delivery

Automated Subject creation, Product Fact confirmation, recommendation/ranking mutation, paid AI API calls, arbitrary new source crawlers, production backfills and schema changes.

Exit gate: current blocked cohort is characterized, the existing responsibility map is preserved, and diagnostic output is explicitly **not** treated as authority for a DB mutation.

## P1 follow-up — same-brand governed official-source discovery frontier (2026-10-12)

Production evidence audit:
- Backlog products: 129, no Subject for any.
- All resolved pre-existing source bindings on the blocked products (92 products) are `hwahae`, never first-party.
- `product_evidence_sources`: 82 official-designated source rows, with 82 product/Subject lineage bindings. Binding states are `exact_subject_match` or `equivalent_presentation_match`; the governed exact/equivalent rows can be used for **same-brand origin discovery**, not copied as target product evidence.
- SQL with `known.normalized_brand=blocked.normalized_brand`, a distinct existing Product, `binding_state='exact_subject_match'`, `scope_relation='equivalent'`, and a narrow official source_kind allowlist finds **25 blocked products with a reusable first-party discovery origin**. This is a count of possible BRAND discovery origins, **not** actual matching official product URLs or Fact/Subject verification.

Implementation:
- `lib/trust/brand-official-frontier-v1.mjs` is a deterministic planner, using already-governed official source bindings for other products at the same canonical brand. It rejects untrusted third-party stores, missing lineage, wrong/non-equivalent scope, non-HTTPS, private/localhost addresses, and cross-brand sources. No external requests or writes.
- `buildTrustOfficialDiscoveryRequests` turns verified brand discovery origins into bounded sitemap candidates for **future P2 fetch**, using the existing `official-source-rediscovery.mjs` contract. Constructed requests are not executed in P1 because a domain's robots/rate and product identity policies must be checked before scanning.
- The existing admin identity-readiness page surfaces a discovery origin count per blocked product. Domains are **discovery surfaces**, not verified official pages for the new SKU. All such targets keep `subjectCreationAuthorized=false`, `marketVerified=false`; production Fact and recommendation authority unchanged.
- Canonical TRUST CI validates fake marketplace sources, wrong brand, stale/unreviewed scope, duplicate identities, malformed URLs, no mutating RPC/DB access, and no AI models.

Next gated implementation:
1. Controlled P2 site robots/terms-aware sitemap fetch and product-level URL candidate matching; use the existing SSRF-safe fetcher with bounded budget. No source binding until exact target identity and market/formulation checks.
2. P1 brand/market identity authority from verified content; do NOT infer market=KR from catalog language or a Hwahae URL.
3. Any system Subject-creation authorizer must undergo its own Shadow→Canary authority and audit gate. It is **not** enabled by this PR.

## P2-A policy-gated official sitemap discovery (2026-10-12)

P2-A is a **bounded, read-only operational pilot** on top of the 25-product P1 same-brand discovery frontier. It is not the P2 final product-source admission, full catalog scheduler, or automated Subject registration.

- Code: `lib/trust/official-product-discovery-p2-v1.mjs` uses the existing `official-source-rediscovery.mjs`, `official-source-fetch.mjs` SSRF-safe HTTP transport, source HTML semantics adapter, and P1 same-brand frontier.
- CLI: `scripts/trust-p2-official-discovery.mjs` reads only existing exact/equivalent official lineage of **another product** at the same canonical brand. Running without `--execute` makes no external network requests; `--execute` additionally requires `TRUST_P2_LIVE_DISCOVERY_ENABLED=true`.
- Per selected product: maximum 2 first-party origins, at most 2 requested sitemaps and 2 candidate product pages per origin. The sitemap worker may process up to 2 nested sitemap URLs within the same 2-fetch budget. HTTP transport has a per-request timeout, 2 MiB body cap, DNS/private-IP guard, same-origin request enforcement and no redirect following.
- Site policy: `robots.txt` is fetched before either sitemap or product page; missing/unreadable robots blocks the site. A matching positive crawl-delay blocks the site until a pacing scheduler is implemented. Allow/Disallow wildcards, user-agent specificity and longest path are checked; disallowed pages are never fetched. Site-specific terms/licensing require operations review before real scanning.
- Findings: candidate URL, SHA-256 of fetched bytes, extracted product JSON-LD name or page-title match, and explicit `marketVerified=false`, `formulationVerified=false`, `subjectCreationAuthorized=false`. A matching name is **not** a verified formulation; no Candidate is promoted, no source binding/Subject/Fact/recommendation writes and no AI API calls.
- Do not falsely claim production collection: P2-A ships a callable, gated CLI plus deterministic fixture tests. Automatic scheduling, durable persisted discovery snapshots with provenance and repeat deduplication, validated exact-SKU/market/formulation binding, and administrator exception workflows remain further P2/P1 work.

Manual operator usage (one product only, intentionally no credential values in output):

```bash
node scripts/trust-p2-official-discovery.mjs --product-id=<uuid>
TRUST_P2_LIVE_DISCOVERY_ENABLED=true node scripts/trust-p2-official-discovery.mjs --product-id=<uuid> --execute
```

Never set the live flag on scheduled public endpoints or the default production environment without an approved source/robots/terms review. Output is read-only JSON and is not a governed Product Fact candidate.

**Acceptance remaining:** Per-brand permitted-site policy + robots/terms review, a repeatable read-only live pilot, exact market/formulation identity adjudication, and provenance-preserving durable observation storage under a governed writer. Do not auto-approve a Source Binding or Subject.
