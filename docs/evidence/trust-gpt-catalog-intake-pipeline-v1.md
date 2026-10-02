# TRUST GPT Catalog Intake Pipeline v1

## Purpose

This pipeline turns a structured product research result produced by ChatGPT into a governed BEJEWELY catalog/TRUST work item with one operational goal:

```text
GPT research
-> crawler-equivalent validation
-> catalog-only Product promotion
-> TRUST intake
-> exact Product Fact Subject resolution
-> official-source research tasks
-> Evidence Candidate
-> explicit human TRUST approval
```

The pipeline intentionally stops before Product Fact confirmation.

## Authority boundary

The GPT payload is discovery input, not Product Fact evidence.

Before catalog admission the runtime must:

1. require two distinct identity providers,
2. require one official provider,
3. require converged canonical brand/product identity,
4. reject duplicate normalized Product identity,
5. require an active governed catalog taxonomy source rule,
6. re-fetch the official HTTPS URL through the existing SSRF-safe TRUST fetcher,
7. bind the Product to that fetched official URL,
8. allow the existing TRUST research worker to fetch the official page again for Fact extraction.

No value claimed by ChatGPT becomes Product Fact Current merely because it was present in the input.

## Supported categories

Automatic admission is currently limited to Product Fact policy-backed skincare categories:

- `cleanser`
- `toner_essence`
- `toner_pad`
- `treatment`
- `moisturizer`
- `moisturizer_lotion_emulsion`
- `moisturizer_gel`
- `moisturizer_cream`
- `moisturizer_balm`
- `sunscreen`

A category outside this set is persisted as:

`BLOCKED_UNSUPPORTED_CATEGORY / UNSUPPORTED_TRUST_CATEGORY`

It is not coerced into a nearby skincare category.

In particular, the existing shadow taxonomy vocabulary for `makeup -> complexion -> foundation -> cushion` remains reserved. This change does not activate makeup, foundation, cushion, or Recommendation authority.

## Input contract

`gpt-catalog-research-v1`

Required logical fields:

```json
{
  "request_id": "operator-supplied-idempotency-key",
  "brand": "Brand",
  "product_name": "Product",
  "category": "sunscreen",
  "market": "KR",
  "locale": "ko-KR",
  "official_url": "https://brand.example/product",
  "identity_evidence": {
    "providers": [
      {
        "provider": "brand_official",
        "locator": "https://brand.example/product",
        "canonical_brand": "Brand",
        "canonical_name": "Product"
      },
      {
        "provider": "independent_reference",
        "locator": "https://reference.example/product",
        "canonical_brand": "Brand",
        "canonical_name": "Product"
      }
    ]
  }
}
```

The Node orchestrator adds `official_fetch` only after the existing TRUST safe fetcher succeeds and observes the expected Product identity on the fetched page.

## Catalog validation

The database entry point is service-role-only:

`ingest_gpt_catalog_product_v1(request_id, payload)`

It does not give the GPT payload direct table authority.

The RPC:

- validates bounded payload shape,
- validates the fresh official fetch receipt,
- requires converged provider identity,
- checks normalized Product duplicates,
- requires an active `gpt_research` taxonomy source rule,
- writes a Product Candidate,
- records the candidate as machine-reviewed only after the above gates,
- invokes the existing catalog-only transactional promotion path,
- preserves `recommendation_admission_allowed = false`.

The existing promotion trigger then creates `catalog_trust_intake`.

## Initial Subject automation

A new Product commonly has no Product Fact Subject.

The pipeline may create exactly one initial Product-scoped Subject only when all of these are true:

- the candidate was promoted through this GPT contract,
- Product identity is resolved,
- the intake has exact market scope,
- Phase 2 reports `SUBJECT_CREATION_REQUIRED`,
- the reason is `no_product_fact_subject_exists`,
- Product total Subject count is zero,
- no competing Product Subject exists,
- `variant_key = null`,
- no predecessor or supersession is introduced.

The formulation revision identity is anchored to the first verified official-page content digest.

If any competing identity exists, machine Subject creation fails closed.

## Official source and research

The promoted Product receives one resolved `gpt_official` Product source binding.

The source binding itself is not Fact evidence.

The Product-scoped claim RPC:

`claim_gpt_catalog_research_tasks_v1(product_id, limit, lease_seconds)`

can claim only TRUST research tasks belonging to that Product.

The existing `processClaimedTask` implementation then performs the normal official-source fetch and strict Fact extractor.

## Final state

Typical successful automation:

```text
TRUST_RESEARCH_READY
-> EVIDENCE_CANDIDATE
-> AWAITING_TRUST_APPROVAL
```

The pipeline does not call Product Fact confirmation.

Existing governed Phase 4/admin confirmation remains the only path from an Evidence Candidate to Product Fact Current.

## Explicit non-authority

This pipeline must never automatically:

- confirm Product Facts,
- write Product Fact Current,
- activate Recommendation,
- change Recommendation scorer/runtime authority,
- infer semantic SAME/CHANGED,
- activate reserved taxonomy such as makeup/foundation/cushion,
- trust a GPT-provided official URL without re-fetching it.

## Idempotency

`gpt_catalog_intake_runs.request_id` is the operation idempotency key.

- exact request ID + exact payload: same result, zero second mutation,
- same request ID + different payload: conflict,
- unsupported category: blocker is persisted,
- duplicate Product: blocker is persisted.

## Production rollout compatibility

Production preflight on 2026-10-02 found a newer governed TRUST processor than the original isolated baseline:

- Production exposes `process_catalog_trust_product_v3(product_id, registry_version)`.
- V3 preserves controlled identity authority and delegates to the registry-pinned V2 processor.
- Product Fact Registry v2 has definitions for the GPT-required facts but does not authorize new lineage for those facts.
- Product Fact Registry v1 authorizes new lineage for all 13 distinct required Fact keys used across the 10 supported skincare categories.

GPT intake therefore pins `product-fact-registry-cross-category-v1` and dispatches to the newest governed TRUST processor available:

`v3 -> v2 -> historical v1 fallback`

The historical v1 fallback exists only for older isolated replay baselines where V2/V3 are absent. The internal dispatch helper is not executable by `anon`, `authenticated`, or `service_role` directly.

This preserves current Production registry/write-policy governance without broadening Registry v2 admission.

## Verification

Static verification:

`node scripts/verify-trust-gpt-catalog-intake.mjs`

Isolated Supabase E2E:

`node scripts/run-trust-gpt-catalog-intake-e2e.mjs`

The isolated E2E proves:

- anon cannot call the ingest RPC,
- supported sunscreen intake reaches `TRUST_RESEARCH_READY`,
- Product, intake, initial Subject, and official binding are created,
- scoped TRUST tasks are claimable only for that Product,
- exact replay is idempotent,
- request ID reuse with changed payload is rejected,
- `foundation` / cushion-class intake fails closed,
- automatic Product Fact confirmation remains false,
- the internal registry-pinned helper is not directly executable by service role,
- generated TRUST research tasks remain pinned to Product Fact Registry v1.

Watchtower-Track: `pipeline-reliability`.
