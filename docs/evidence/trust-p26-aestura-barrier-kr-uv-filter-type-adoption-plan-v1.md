# TRUST-P26 — AESTURA Barrier Hydro KR UV Filter Type Adoption Plan v1

## Result

`TRUST_P26_PHASE_A_DETERMINISTIC_PLAN_FROZEN`

This phase freezes a **zero-write** Product Fact adoption plan for the active Recommendation product AESTURA `더마UV365 장벽수분 무기자차 선크림` (`2d3591f2-2216-4043-8493-a9492806ef8b`), KR.

## Why this frontier

`uv_filter_type` is not display-only metadata in the current Recommendation path.

- `lib/recommendation-scoring.ts` gives an exact sunscreen filter-type match **+12 points**.
- The same field is used to select an alternative sunscreen with a different filter system.
- The legacy Product row currently says `mineral`, but there is no governed `uv_filter_type` Current Product Fact for this exact Subject.

TRUST-P26 therefore closes the evidence-authority gap **without changing runtime scoring authority**.

## Exact subject / source authority

- Subject: `a340d9dc-a742-4ca3-9951-3bc7e6ec7655`
- Subject semantic key: `d166f4c1336cf52b3025111be6cbcc836756f5017772400f3a5054745b742160`
- Variant: `DERMA_UV365_BARRIER_HYDRO_MINERAL_40ML_KR`
- Formulation revision: `trust-p7-aestura-barrier-hydro-mineral-current`
- Market: `KR`
- Existing Source: `cdfc7792-cf0b-402e-a407-50a0bd9ba71b`
- Existing Binding: `ab398c78-5932-4952-b2b3-d57074da56a5`
- Existing Source digest: `6bda698640f4c0cae2f7dbdf6a9da72980cab1f39ae972e8e7488351775bb3ab`

The frozen TRUST-P7 first-party research already records:

- KR identity claim: `더마UV365 장벽수분 무기자차 선크림`
- International first-party claim: `DERMA UV365 Barrier Hydro Mineral Sunscreen`

The current first-party pages were rechecked on 2026-09-14 only as corroboration. The deterministic input remains the frozen TRUST-P7 source observation.

## Frozen Product Fact

- Registry: `product-fact-registry-cross-category-v1`
- Fact: `uv_filter_type`
- Value: `mineral`
- Evidence class: `product_claim`
- Authority: `product_specific_primary`
- Confidence: `high`
- Proposition: `996c2b99f4519323d3f6a144395ae09da861419ec38559bf6f9c67a9ad88f004`
- Canonical evidence digest: `0fe3f0338e4b2c8177be762122e06e7925f8e8c9d8f58e99eb54bf56a326b74b`

No cross-product transfer, ingredient-class inference, third-party positive support, or formulation transfer is used.

## Production prestate

Fresh read at `2026-09-14T02:59:57.517121+09:00`:

`Subjects 25 / Sources 26 / Bindings 26 / Evidence 58 / Fact Instances 58 / Evidence Links 58 / Review Assignments 58 / Confirmations 58 / Current 58`

Target:

- existing Current: `2` (`spf_value`, `uva_label`)
- `uv_filter_type` Current: `0`
- `uv_filter_type` Evidence: `0`
- evidence digest collision: `0`
- open assignment: `0`
- request-ID collision: `0`

## Phase A safety boundary

Production Product Fact writes in this phase: **0**.

Phase B is not authorized until:

1. exact-head CI passes,
2. fresh-main preflight passes,
3. expected-head merge completes,
4. merged-main CI passes,
5. fresh Production prestate still matches the frozen collision boundary.

## Planned Phase B delta

The existing Subject / Source / Binding must be reused.

`+0 Subject / +0 Source / +0 Binding / +1 Evidence / +1 Fact Instance / +1 Evidence Link / +1 Review Assignment / +1 Confirmation / +1 Current`

Controlled RPC sequence only:

`ingest evidence → review under_review → ready_for_confirm → preflight → confirm`

Direct Product Fact table DML is forbidden.

## Recommendation / admission invariants

This Product Fact adoption does **not**:

- mutate `products.uv_filter_type`,
- cut Recommendation runtime over to Product Fact,
- change Recommendation scores or ranks,
- change the frozen 164 legacy Recommendation corpus,
- grant new sunscreen admission,
- change `initial-admission-grant-policy-v1`,
- authorize taxonomy authority cutover.

Fresh admission policy still classifies `sunscreen` as:

`INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT`

Plan content SHA-256: `a6307b1f84b9391970f99902933af84a7275a42645f7d91ac9737e6943069c06`
