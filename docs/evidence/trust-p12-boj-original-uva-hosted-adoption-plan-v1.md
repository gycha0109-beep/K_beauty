# TRUST-P12 — Beauty of Joseon Original Relief Sun UVA Hosted Adoption Plan v1

## Status

`PHASE_A_DETERMINISTIC_PLAN_FREEZE`

This phase freezes a one-fact hosted Product Fact adoption plan for the existing Beauty of Joseon original Relief Sun subject. It performs **zero Production Product Fact writes**.

## Authority

- source main: `5fd5cbbe0274bc9b0092263afc5f51d3f42fd3f9`
- Production project: `bygrczggxfuisupcevaz`
- product: `25b2763f-529f-4b2e-a436-2e0776279c55`
- existing subject: `0865df81-9cd9-438c-8167-380b932c1dc0`
- subject semantic key: `2f5345df7de1decc70af71677652186cb9c2d61e215240a03b29f5e23d1ece44`
- existing variant: `Relief_Sun_Rice_Probiotics`
- Registry: `product-fact-registry-cross-category-v1`
- proposition serializer: `product-fact-proposition-pilot-v1`
- plan SHA-256: `c282dabe9f5c7b6572bf5f771841dd96386c0d8e8a6b01cb7fa6543b5abe9921`

## Why the existing Subject is reused

The current Beauty of Joseon first-party page now presents the product as `Relief Sun : Rice + Niacinamide (SPF50+ PA++++)`, 50 ml. Its official FAQ explicitly states that the prior `Rice + Probiotics` name was changed to `Rice + Niacinamide`, while the formula, ingredients, size, and product remain unchanged.

Therefore this is an identity-continuity update, not a reformulation event. The existing resolved/current Subject remains authoritative and **no new Subject is planned**.

## Exact fact scope

Only one missing fact is eligible:

- `fact_key = uva_label`
- value = `PA++++`
- value type = `enum`
- market = `GLOBAL`
- variant = `Relief_Sun_Rice_Probiotics`
- authority ceiling = `product_specific_primary`
- confidence = `high`

Deterministic proposition key:

`ea34c1e334b846df861b198bd658c3ce1a98d422433e66d0b3e3d7c584915f01`

Canonical evidence digest:

`95920464b02a26fa8e31ab057fbbc2157cbb761f0a7eed91d8db7df8121cdb69`

## Source observation

Canonical source:

`https://beautyofjoseon.com/products/relief-sun-rice-probiotics`

The current frozen observation records:

- current name: `Relief Sun : Rice + Niacinamide`
- prior name: `Relief Sun : Rice + Probiotics`
- size: 50 ml
- direct `SPF50+`
- direct `PA++++`
- official name-change-only identity continuity
- unchanged formula, ingredients, and size

Source observation digest:

`e09425390b1fbf0e9c4eb4c4a3d1b2854f25d6a7de82a99f57a56a575184e7c9`

A historical source row already exists for the same canonical URL. Phase B must not mutate that immutable observation. The current observation is identified by its new content digest, so the controlled ingest path is expected to materialize a new Source/Binding/Evidence lineage while reusing the existing Subject.

## Fresh hosted prestate

Readback at `2026-09-11T06:14:04.998027+09:00`:

`Subjects 20 / Sources 20 / Bindings 20 / Evidence 48 / Fact Instances 48 / Evidence Links 48 / Review Assignments 48 / Confirmations 48 / Current 48`

Target product state:

- Subject: 1
- SPF Current: 1
- UVA Current: 0
- planned proposition Current rows: 0
- planned evidence digest rows: 0
- open assignments for planned proposition: 0
- exact current-source identity rows for the new digest: 0

## Phase B contract

Only after this plan is merged, exact-head CI is green, and fresh Production prestate still matches may execution use:

`admin_ingest_product_fact_evidence_v1 → admin_prepare_product_fact_review_v1 (under_review) → admin_prepare_product_fact_review_v1 (ready_for_confirm) → admin_preflight_product_fact_confirmation_v1 → admin_confirm_product_fact_v1`

`admin_register_product_fact_subject_v1` is intentionally absent because the existing Subject is reused.

Runtime UUIDs are server-returned only. Direct Product Fact table DML is prohibited. Confirmation may occur only from a fresh `ready` preflight and its exact payload/prestate digests.

Expected Phase B delta:

- Subjects: +0
- Sources: +1
- Bindings: +1
- Evidence: +1
- Fact Instances: +1
- Evidence Links: +1
- Review Assignments: +1
- Confirmations: +1
- Current: +1

Expected target poststate is Subject 1 / SPF Current 1 / UVA Current 1.

## Closure invariants

```text
PRODUCTS = 1
PROPOSITIONS = 1
ELIGIBLE_FACT_KEYS = uva_label
EXISTING_SUBJECT_REUSED = YES
NEW_SUBJECT_FOR_RENAME = NO
PHASE_A_WRITES = 0
PHASE_B_EXECUTION_AUTHORIZED_BY_PHASE_A = NO
DIRECT_PRODUCT_FACT_DML = NO
SCHEMA_OR_RPC_CHANGE = NO
REGISTRY_CHANGE = NO
RECOMMENDATION_OR_RANKING_CHANGE = NO
```
