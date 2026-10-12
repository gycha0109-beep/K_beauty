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

## P2-B: numeric official paths and append-only non-authoritative observations (2026-10-12)

P2-A was intentionally opt-in and read-only. P2-B addresses a real observed production gap: Torriden's governed official source locators are `https://www.torriden.com/goods/goods_view.php?goodsNo=...`, not `/products/`, and the numeric URL cannot be identified from a Korean product name in a sitemap path.

Implementation:
- Existing `exact_subject_match` + `equivalent` official PEER source bindings provide at most one same-brand, same-origin official peer page as a link discovery surface. Never copy its verified identity or formulation authority to the target.
- `official-peer-index-links-v1.mjs` accepts only a bounded, visible anchor label equal to/containing the complete target name; only HTTPS same-origin catalog routes, including `/goods/goods_view.php`, can be candidates. Other domains, mismatched anchors and unrelated paths are rejected.
- P2 execution checks robots before fetching the peer page and enforces the existing SSRF-safe transport, time/byte bounds and no redirect. Still no API LLM calls.
- `trust_official_discovery_observations_v1` is **a new pre-Subject, pre-Fact unverified evidence queue/ledger**, not a duplicate of `trust_source_observations`, which requires existing research task, Subject and source binding. Its immutable row has product/intake, origin, optional candidate locator/content digest, site/page status, semantic identity surface, observation fingerprint, and contract version. It stores *no* positive Product Fact assertion or market/formulation authorization.
- Forced RLS, only service_role SELECT/INSERT, no UPDATE/DELETE, globally unique SHA-256 fingerprint. Re-run duplicate fingerprints are accepted as idempotent duplicates, and digest collisions fail closed. No history overwrites.
- CLI is **disabled for live fetch by default**, and database observation persistence has an **independent** off-by-default switch. Both `--execute` and `--persist` and `TRUST_P2_LIVE_DISCOVERY_ENABLED=true` and `TRUST_P2_PERSIST_ENABLED=true` are mandatory to write discovery observations.
- Existing TRUST static CI validates deterministic P2B candidate filtering and fingerprint replays. The existing DB integration PostgreSQL 17 job exercises ACL, replay uniqueness, invalid status constraints, and transactional rollback in a disposable database.
- Source-policy acceptance remains a separate live operations gate: network access to `https://www.torriden.com/robots.txt` and `/sitemap.xml` could not be established in this execution environment. **Do not report actual product URLs discovered or production live success unless an execution log proves it.**
- On P2-B deployment, no live scans are enabled and no approved Subject or Fact is created.

Operator-only command contract (requires existing service role env and reviewed source policy; no public endpoint):
```bash
node scripts/trust-p2-official-discovery.mjs --product-id=<uuid>
TRUST_P2_LIVE_DISCOVERY_ENABLED=true \\
TRUST_P2_PERSIST_ENABLED=true \\
node scripts/trust-p2-official-discovery.mjs --product-id=<uuid> --execute --persist
```

**P2 remaining:** Record genuine live site/robots success under permitted policies; improve catalog-index coverage (many official pages render navigation only in JavaScript); add independent exact SKU, market and formulation attestation and guard source admission through the existing governed workflow, then schedule bounded operations. P1 machine Subject creation remains DISABLED pending a separate authorization review and canary.

## P2-C initial live site policy measurement (2026-10-12)

Production seed selected: Torriden's governed brand URL `https://www.torriden.com/goods/goods_view.php?goodsNo=136`. External web page lookup showed a historic public product page, **not** proof the current TRUST HTTP runner could access it. Direct container DNS attempts and web lookup of `/robots.txt` and `/sitemap.xml` were unsuccessful. The site terms include restrictions on commercial reproduction of protected content; do not copy proprietary page materials.

This task introduces a **single origin, single request** GitHub Actions live smoke probe for `https://www.torriden.com/robots.txt`, triggered by main push of its own files or manually. It requires no Supabase or commercial APIs, does not fetch a sitemap or product page, and cannot create or update Subject / Fact / product source evidence. `scripts/trust-p2c-robots-smoke.mjs` uses the existing SSRF-safe, 10-second HTTP transport and same-origin redirect rejection; it records robots policy access, crawl-delay hold and whether the sitemap and numeric product paths would be allowed *if later approved*. Read failures become explicit HOLD states, never permission to crawl.

This is **only the P2-C policy and connectivity gate**, not proof of actual target product collection. A subsequent guarded pilot may retrieve one official product page only if site policies, current robots response and operational authorization permit; capture objective metadata and a hash only, not long copyrighted content. Measure completed sample coverage separately.

Exit conditions for full P2-C remain: at least one permitted real product page fetched with exact origin and target SKU identity, explicit robots/terms record, provenance digest, and zero unapproved authority writes. If the site is unavailable, record the block and evaluate another official brand without bypassing robots.

## P2-C: official visible identity signals (2026-10-12)

Live known Torriden sunscreen pilot (PR #1247/#1248) fetched 176,341 bytes from the pre-governed exact official URL. Existing Product JSON-LD/title matcher reported `IDENTITY_UNRESOLVED`, but the target name appeared in non-script body text. Such occurrence alone is not evidence of exact SKU identity, market or formulation.

The new read-only extraction path `official-visible-identity-v1.mjs` checks a bounded product H1/product-name-class heading separately from a generic body mention. It excludes script/template/style content and unrelated links before testing. The decision outputs `SCOPED_HEADING_CANDIDATE` (scoped element) or `BODY_NAME_MENTION_ONLY` (incidental diagnostic). Both have `identityAuthority=NONE`, subject/Fact confirmation disabled and market/formulation verification false. Original JSON-LD and page-title signals retain their priority.

The existing pre-Subject unverified observation ledger, not Product Fact Current or the governed TRUST observations, now permits these explicitly typed candidate dispositions through a limited migration. PostgreSQL 17 checks enforce surface-to-disposition mapping and unchanged append-only RLS rights. A matching body mention is NOT a positive source authorization and must never create a Product Fact Subject.

Next gate: live P2-C recheck on same previously governed known product (two GET requests, robots first), then test separate unknown SKUs with independent official product/market/formulation evidence before source binding or Subject creation. No automatic admission.

### Canonical CI ownership note
The historical one-off `trust-p2c-known-product-live.yml` and
`trust-p2c-official-robots-live.yml` workflows have been **retired** after
their measured real-site smoke runs. The repository's CI trigger topology
requires all `trust-pN` historical workflows to remain absent. Offline
contract verification now runs through the existing TRUST 5B-7D static
suite; PostgreSQL identity observation constraints run through the existing
Database Integration Authority job. The bounded manual CLI remains
available for authorized subsequent source-policy measurements. No live
cron or unattended URL probe was introduced in this phase.
