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
