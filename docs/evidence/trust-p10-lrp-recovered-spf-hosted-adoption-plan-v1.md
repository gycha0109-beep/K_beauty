# TRUST-P10 — La Roche-Posay Recovered SPF Hosted Adoption Plan v1

## Status

`PHASE_A_DETERMINISTIC_PLAN_FREEZE`

This phase freezes a one-fact hosted Product Fact adoption plan for La Roche-Posay Anthelios Sun Fluid. It performs **zero Production Product Fact writes**.

## Authority

- source main / upstream TRUST-P9 merge: `7bc1f1afaff626087498d843d4676c202ffdae10`
- upstream P9 artifact: `evidence/product-fact-subject-coverage-v1/trust-p9-lrp-first-party-fact-source-recovery-v1.json`
- upstream P9 blob: `1b245e26ac1e598a13474723a56909021b5425b9`
- upstream P7 identity artifact: `evidence/product-fact-subject-coverage-v1/trust-p7-sunscreen-stage-b-identity-source-research-v1.json`
- Product: `9983f167-24e7-4223-bd86-446ce6ced31b`
- Production project: `bygrczggxfuisupcevaz`
- Plan SHA-256: `ea9e640baf878c0f2fa8298c01a251dd0d240105f6958e567a389ffeba48d8d5`

## Fresh hosted prestate

At plan freeze the target remains Subject 0 / Current 0 and the Slovenia fact-source locator is not registered. Global counts remain:

`Subjects 19 / Sources 19 / Bindings 19 / Evidence 47 / Fact Instances 47 / Review Assignments 47 / Confirmations 47 / Current 47`

## Exact scope

Only one existing fact kind is eligible:

- `spf_value = 50`
- qualifier: `{"plus_modifier":"plus"}`
- market: `KR`
- authority ceiling: `product_specific_primary`

`uva_label` is explicitly excluded from this plan and remains `FACT_SOURCE_RECOVERY_REQUIRED`. `UVA-PF 46` must not be converted to or used as evidence for `PA++++`.

## Deterministic identity

Subject identity is inherited from the previously frozen P7 identity authority:

- variant: `ANTHELIOS_SUN_FLUID_KR_50ML`
- formulation revision: `trust-p7-lrp-4833-current`
- market: `KR`
- subject semantic key: `75f3d410ae03c5ffef800fedb28f706741fe59f3490e6155e396d6151b5ce527`

The planned proposition key is:

`9be0d8a4cc57d8738b45955565fc7023761087ee7f50b55e7ea0d2223cdbf515`

The canonical evidence digest is:

`96786c34454fef1ddfc70e741c964a9934d722ea35ecace55a808cf6b38baebf`

## Source binding

Fact-bearing first-party source:

`https://www.laroche-posay.si/anthelios/anthelios-nevidni-fluid-spf50-brez-vonja`

Companion KR identity source:

`https://www.larocheposay.co.kr/product/view/4833.do`

The P9 source observation digest is:

`e935ea69040aab9ffd1bb62472555c5188a9b5e1810e2dd358d750d9325abeb3`

The Slovenia source is broader than the KR subject, so the hosted binding follows the already proven P8 AESTURA precedent: the binding is `narrower` to the exact KR subject. This does not promote the recovered SPF claim to a global fact.

## Phase B contract

If and only if this plan is merged and fresh Production prestate still matches, execution may use the existing controlled lifecycle:

`admin_register_product_fact_subject_v1 → admin_ingest_product_fact_evidence_v1 → admin_prepare_product_fact_review_v1 → admin_preflight_product_fact_confirmation_v1 → admin_confirm_product_fact_v1`

Runtime UUIDs are server-returned only. Direct table DML is prohibited. Confirmation may occur only from a fresh `ready` preflight and its exact payload/prestate digests.

Expected Phase B delta is exactly +1 Subject / +1 Source / +1 Binding / +1 Evidence / +1 Fact Instance / +1 Evidence Link / +1 Review Assignment / +1 Confirmation / +1 Current.

## Closure invariants

```text
PRODUCTS = 1
PROPOSITIONS = 1
ELIGIBLE_FACT_KEYS = spf_value
BLOCKED_FACT_KEYS = uva_label
PHASE_A_WRITES = 0
PHASE_B_EXECUTION_AUTHORIZED_BY_PHASE_A = NO
DIRECT_PRODUCT_FACT_DML = NO
UVA_PF_TO_PA_CONVERSION = NO
NEW_FACT_KIND = NO
REGISTRY_CHANGE = NO
SCHEMA_OR_RPC_CHANGE = NO
RECOMMENDATION_OR_RANKING_CHANGE = NO
```
