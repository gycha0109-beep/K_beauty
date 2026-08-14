# Product Decision Axis Input Coverage & Calibration Readiness Audit v1

> V2.1-8I deterministic read-only audit. No Hosted writes, numeric calibration, production Decision Axis consumption, or Recommendation activation.

## FACT — Authority

- repository: `gycha0109-beep/K_beauty`
- execution main: `e34e7e9f731de1018fc2fd70e5462d69f919869d`
- Hosted project: `bygrczggxfuisupcevaz`
- Registry: `product-fact-registry-cross-category-v1` (20 definitions)
- Subject serializer: `product-fact-subject-identity-v1`
- proposition serializer lineage: `product-fact-proposition-pilot-v1`

## FACT — Hosted baseline

Catalog 164; Subjects 16; Evidence 41; Current 41; adopted distinct products 16.

Current rows are propositions, not products. Multi-valued facts such as `contains_active` therefore use distinct product identity for coverage.

## FACT — Actual mapper locations

- `scripts/product-evidence/product-fact-current-resolver-v1.mjs`
- `scripts/product-evidence/product-fact-current-group-resolver-v1.mjs`
- `scripts/product-evidence/product-decision-axis-cleanser-v1.mjs`
- `scripts/product-evidence/product-decision-axis-cross-category-v1.mjs`
- `scripts/product-evidence/product-decision-axis-shadow-recommendation-v1.mjs`

## FACT — Category coverage

| category | catalog | adopted | unadopted | ratio |
|---|---:|---:|---:|---:|
| cleanser | 26 | 2 | 24 | 0.076923 |
| moisturizer_balm | 20 | 1 | 19 | 0.050000 |
| moisturizer_cream | 10 | 1 | 9 | 0.100000 |
| moisturizer_gel | 10 | 1 | 9 | 0.100000 |
| moisturizer_lotion_emulsion | 21 | 1 | 20 | 0.047619 |
| sunscreen | 11 | 3 | 8 | 0.272727 |
| toner_essence | 24 | 2 | 22 | 0.083333 |
| toner_pad | 24 | 2 | 22 | 0.083333 |
| treatment | 18 | 3 | 15 | 0.166667 |

## FACT — Current Fact coverage

| fact_key | Current propositions | distinct products |
|---|---:|---:|
| active_concentration | 3 | 3 |
| barrier_support_claim | 2 | 2 |
| contains_active | 17 | 10 |
| deep_cleansing | 1 | 1 |
| eye_sting_observed | 0 | 0 |
| fragrance_declared | 0 | 0 |
| hydration_change | 0 | 0 |
| low_ph | 1 | 1 |
| pad_surface_texture | 1 | 1 |
| primary_use_role | 4 | 4 |
| product_format | 3 | 3 |
| recommended_use_frequency | 2 | 2 |
| spf_value | 3 | 3 |
| tewl_change | 0 | 0 |
| treatment_claim | 0 | 0 |
| uv_filter_type | 0 | 0 |
| uva_label | 2 | 2 |
| water_resistance_duration | 0 | 0 |
| white_cast_observed | 0 | 0 |
| wipe_off_use | 2 | 2 |

All 41 Current propositions in the frozen snapshot are `supported` and have `product_specific_primary` authority; observed Current inputs therefore have no authority-quality blocker.

## FACT — Axis dependency matrix

| axis | mapper | categories | REQUIRED | OPTIONAL | CONTEXT_ONLY | input CONTRACT_UNSPECIFIED | calibration-readiness gate | production consumed |
|---|---|---|---|---|---|---|---|---|
| cleansing_burden | product-decision-axis-cleanser-v1 | cleanser | deep_cleansing | — | — | — | CONTRACT_UNSPECIFIED | NO |
| hydration_preservation | product-decision-axis-cleanser-v1 | cleanser | low_ph | — | — | — | CONTRACT_UNSPECIFIED | NO |
| irritation_burden | product-decision-axis-cleanser-v1 | cleanser | — | — | — | current Registry eye_sting_observed relationship to irritation_burden | CONTRACT_UNSPECIFIED | NO |
| sebum_pore_control | product-decision-axis-cleanser-v1 | cleanser | deep_cleansing | — | — | — | CONTRACT_UNSPECIFIED | NO |
| photo_protection | product-decision-axis-cross-category-v1 | sunscreen | — | spf_value, uva_label, uv_filter_type, water_resistance_duration | — | minimum/calibration-required protection input set | CONTRACT_UNSPECIFIED | NO |
| barrier_support | product-decision-axis-cross-category-v1 | moisturizer_balm, moisturizer_cream, moisturizer_gel, moisturizer_lotion_emulsion | barrier_support_claim | — | primary_use_role | — | CONTRACT_UNSPECIFIED | NO |
| exfoliation_load | product-decision-axis-cross-category-v1 | treatment, toner_pad, toner_essence | contains_active{mandelic_acid|lactic_acid|salicylic_acid} | — | active_concentration, recommended_use_frequency, product_format, wipe_off_use, pad_surface_texture | — | CONTRACT_UNSPECIFIED | NO |

### cleansing_burden
- null contract: missing/non-supported deep_cleansing remains null; supported false is explicit_negative_fact; no magnitude inferred
- multi-value contract: not applicable: scalar deep_cleansing resolver input
- authority contract: axis authority cannot exceed Product Fact authority; non-primary input becomes authority_limited
- numeric calibration defined: NO
- production consumed: NO

### hydration_preservation
- null contract: missing/non-supported low_ph remains null; supported false is explicit_negative_fact; low_ph is indirect relevance only
- multi-value contract: not applicable: scalar low_ph resolver input
- authority contract: axis authority cannot exceed Product Fact authority; non-primary input becomes authority_limited
- numeric calibration defined: NO
- production consumed: NO

### irritation_burden
- null contract: mapper always returns no_relevant_fact with null estimate and authority none
- multi-value contract: not defined because no irritation Product Fact is consumed
- authority contract: authority remains none because mapper consumes no authoritative irritation input
- numeric calibration defined: NO
- production consumed: NO

### sebum_pore_control
- null contract: missing/non-supported deep_cleansing remains null; supported false is explicit_negative_fact; no sebum/pore magnitude inferred
- multi-value contract: not applicable: scalar deep_cleansing resolver input
- authority contract: axis authority cannot exceed Product Fact authority; non-primary input becomes authority_limited
- numeric calibration defined: NO
- production consumed: NO

### photo_protection
- null contract: no supported protection facts => missing/insufficient/conflict state; missing water resistance does not negate UV protection
- multi-value contract: group resolver preserves cardinality-many facts; families dedupe contribution by proposition lineage
- authority contract: weakest consumed Product Fact authority is preserved; mapper does not raise authority
- numeric calibration defined: NO
- production consumed: NO

### barrier_support
- null contract: no supported barrier_support_claim => missing/insufficient state; primary_use_role is explicitly excluded from efficacy contribution
- multi-value contract: barrier_support_claim is consumed as claim evidence; usage role does not become efficacy
- authority contract: product-specific primary claim => claim_only; weaker authority => authority_limited
- numeric calibration defined: NO
- production consumed: NO

### exfoliation_load
- null contract: no supported relevant exfoliating active identity => no_relevant_fact/missing; concentration absence is not zero
- multi-value contract: all contains_active propositions are preserved; only the explicit exfoliating identity set is selected, never one arbitrary proposition
- authority contract: weakest consumed Product Fact authority is preserved; concentration/use context does not increase effect authority
- numeric calibration defined: NO
- production consumed: NO

## INFERENCE — Calibration readiness

No current repository authority defines a minimum sample-size, representative-coverage percentage, or other calibration-readiness gate. V2.1-8I therefore does not invent one.

| axis | verdict | evaluable | partial | blocked | primary reason |
|---|---|---:|---:|---:|---|
| cleansing_burden | MAPPER_CONTRACT_GAP | 1 | 0 | 25 | CALIBRATION_READINESS_GATE_IS_NOT_DEFINED_BY_CURRENT_REPOSITORY_AUTHORITY |
| hydration_preservation | MAPPER_CONTRACT_GAP | 1 | 0 | 25 | CALIBRATION_READINESS_GATE_IS_NOT_DEFINED_BY_CURRENT_REPOSITORY_AUTHORITY |
| irritation_burden | MAPPER_CONTRACT_GAP | 0 | 0 | 26 | CURRENT_MAPPER_HAS_NO_IRRITATION_FACT_DEPENDENCY_AND_CALIBRATION_READINESS_GATE_IS_UNSPECIFIED |
| sebum_pore_control | MAPPER_CONTRACT_GAP | 1 | 0 | 25 | CALIBRATION_READINESS_GATE_IS_NOT_DEFINED_BY_CURRENT_REPOSITORY_AUTHORITY |
| photo_protection | MAPPER_CONTRACT_GAP | 3 | 1 | 8 | CALIBRATION_READINESS_GATE_IS_NOT_DEFINED_BY_CURRENT_REPOSITORY_AUTHORITY |
| barrier_support | MAPPER_CONTRACT_GAP | 2 | 2 | 59 | CALIBRATION_READINESS_GATE_IS_NOT_DEFINED_BY_CURRENT_REPOSITORY_AUTHORITY |
| exfoliation_load | MAPPER_CONTRACT_GAP | 3 | 4 | 63 | CALIBRATION_READINESS_GATE_IS_NOT_DEFINED_BY_CURRENT_REPOSITORY_AUTHORITY |

The verdict is not `COVERAGE_INPUT_GAP` merely because the raw ratios are small: declaring any observed sample "too small" would itself require an ungoverned threshold. Coverage remains secondary evidence under the root mapper/readiness-contract gap.

## FACT — Null / unknown discipline

- missing Current is not false.
- `reviewed_not_established` is not false.
- `evidence_insufficient` is not false.
- missing concentration is not zero.
- multi-valued `contains_active` propositions are retained and filtered only by the mapper's explicit exfoliating-active set.
- no legacy value is used to backfill governed Product Fact input.

## FACT — No-write / production invariance contract

- Hosted Product Fact writes: 0
- migrations: 0
- numeric calibration: 0
- production Decision Axis consumption: 0
- Recommendation behavior delta required: 0
- canonical invariance verifier: `scripts/verify-skin-decision-recommendation-invariance.mjs`
- canonical scenario authority: 164 products × 12 scenarios
- prior frozen reference authority: `e6a116afec9a99d40b59ade0e38d3a451cf456e1`; V2.1-8I CI replays rather than assumes it.

## FACT — Explicit lifecycle NO flags

- `CATALOG_FULLY_ADOPTED = NO`
- `PRODUCT_DECISION_AXIS_PRODUCTION_CALIBRATED = NO`
- `DECISION_AXIS_PRODUCTION_CONSUMPTION = NO`
- `RECOMMENDATION_SCORER_CHANGED = NO`
- `RECOMMENDATION_ACTIVATED = NO`
- `ADMIN_PRODUCT_FACT_UI_OPERATIONAL = NOT_ESTABLISHED`

## ROADMAP RECOMMENDATION — Exactly one next stage

**Product Decision Axis Mapper Contract Completion**

Define the exact calibration-readiness gate and formal input-role semantics for the seven current axes; resolve the `irritation_burden` relationship to current Registry irritation evidence. Do not perform evidence research, numeric calibration, production consumption, or Recommendation activation.
