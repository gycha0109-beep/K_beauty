# Product Decision Axis Mapper Contract v1

> V2.1-8J authoritative contract completion. Structural/offline eligibility only; no numeric calibration or production Recommendation consumption.

## FACT — Authority

- execution main: `6f573b632824be13dfe208f29c796aa3306b4984`
- Hosted: `bygrczggxfuisupcevaz` (read-only)
- Registry: `product-fact-registry-cross-category-v1` / `79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575`
- V2.1-8I audit SHA256: `589dafe9ab4db7849676aef69d26e5122b4c64aea7bd548a497e60b6a21d5057`
- V2.1-8I snapshot SHA256: `fde7b6fd9902ff965424be43d3c5e5bc1845f5e0a2fa97d3860376859636f05b`

## EXISTING CONTRACT — Pipeline invariants

- Product != Product Fact Subject
- Evidence != Fact
- Fact Instance != Current
- Product Fact != Product Decision Axis
- Product Decision Axis != User Concern axis
- missing/reviewed_not_established/evidence_insufficient/not_reviewed/conflict/source_blocked/registry_gap != false
- official claim or ingredient identity != proven effect magnitude
- coverage pressure never lowers evidence authority
- mapper authority never exceeds Product Fact authority
- Product Fact Current != numeric calibration
- shadow computation != production consumption != Recommendation activation

## NEW 8J CONTRACT DECISION — Vocabulary

- **mapper_signal_eligibility**: Whether governed Product Fact Current may legitimately contribute semantic signal or context to one Product Decision Axis. It does not authorize magnitude.
- **calibration_cohort_eligibility**: Whether one resolved product has the minimum governed signal state, semantic status, authority, identity, and scope needed to enter a bounded offline/shadow calibration cohort.
- **axis_cohort_readiness**: Whether individually eligible distinct products satisfy the v1 structural floor and mapper-topology coverage needed to start a bounded offline/shadow calibration experiment.
- **numeric_calibration**: A separate future policy that may define numeric estimates, weights, priors, scales, or uncertainty. V2.1-8J does none of these.
- **production_consumption**: A separately authorized future runtime path from Product Decision Axis output into production Recommendation. V2.1-8J leaves it disabled.

## NEW 8J CONTRACT DECISION — Representative coverage

- prior proposal: `catalog-expansion-selection-policy-v1`, category adopted floor = 3
- disposition: **REFINED**
- authoritative structural floor: >= 3 calibration-cohort-eligible distinct products per axis
- topology rule: every declared mapper-distinct category topology group has >= 1 eligible product
- partial/context-only rows do not count toward the floor
- statistical power claimed: **NO**
- rationale: V2.1-8F's count of 3 is retained only as a smoke/structural floor, but 'adopted' is replaced by 'calibration-cohort eligible' and mapper-topology coverage is added. This prevents raw adoption from masquerading as usable axis input and makes no statistical-power or efficacy-validity claim.

## NEW 8J CONTRACT DECISION — Seven axes

| axis | SIGNAL_REQUIRED | SIGNAL_OPTIONAL | CONTEXT_ONLY | CALIBRATION_REQUIRED | topology groups | numeric | production |
|---|---|---|---|---|---|---|---|
| cleansing_burden | `deep_cleansing` | — | — | `deep_cleansing` | cleanser | NO | NO |
| hydration_preservation | `low_ph` | — | — | `low_ph` | cleanser | NO | NO |
| irritation_burden | — | — | — | — | cleanser | NO | NO |
| sebum_pore_control | `deep_cleansing` | — | — | `deep_cleansing` | cleanser | NO | NO |
| photo_protection | — | `spf_value`, `uva_label`, `uv_filter_type`, `water_resistance_duration` | — | `spf_value`, `uva_label` | sunscreen | NO | NO |
| barrier_support | `barrier_support_claim` | — | `primary_use_role` | `barrier_support_claim` | shared_moisturizer_barrier_claim_topology | NO | NO |
| exfoliation_load | `contains_active{lactic_acid|mandelic_acid|salicylic_acid}` | — | `active_concentration`, `recommended_use_frequency`, `product_format`, `wipe_off_use`, `pad_surface_texture` | `contains_active{lactic_acid|mandelic_acid|salicylic_acid}` | treatment, toner_essence, toner_pad | NO | NO |

## NEW 8J CONTRACT DECISION — irritation_burden

- decision: `KEEP_NOT_CONSUMED_REQUIRE_GOVERNED_CLEANSER_IRRITATION_SIGNAL_EXTENSION`
- `eye_sting_observed`: **NOT_CONSUMED** for cleanser `irritation_burden` v1
- rationale: Registry scope is sunscreen and semantic meaning is narrow observed eye sting, so it cannot be silently generalized to cleanser irritation burden.
- remaining limitation: current Registry/mapper authority has no cleanser-compatible governed irritation observation/measurement signal family

## NEW 8J CONTRACT DECISION — photo_protection

- core structural pair: `spf_value` + `uva_label`
- `uv_filter_type` and `water_resistance_duration`: mapper signal/context, but not substitutes for the core calibration pair
- SPF-only or UVA-only: partial structural coverage, not cohort-eligible
- no SPF/PA normalization or arbitrary generic score

## FACT — V2.1-8I snapshot replay under 8J

| axis | catalog | adopted | signal eligible | cohort eligible | partial | blocked | readiness |
|---|---:|---:|---:|---:|---:|---:|---|
| barrier_support | 61 | 4 | 2 | 2 | 2 | 59 | TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED |
| cleansing_burden | 26 | 2 | 1 | 1 | 0 | 25 | TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED |
| exfoliation_load | 66 | 7 | 3 | 3 | 4 | 63 | STRUCTURALLY_READY_FOR_BOUNDED_OFFLINE_CALIBRATION |
| hydration_preservation | 26 | 2 | 1 | 1 | 0 | 25 | TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED |
| irritation_burden | 26 | 2 | 0 | 0 | 0 | 26 | REGISTRY_OR_MAPPER_EXTENSION_REQUIRED |
| photo_protection | 11 | 3 | 3 | 2 | 1 | 9 | TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED |
| sebum_pore_control | 26 | 2 | 1 | 1 | 0 | 25 | TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED |

Structurally ready axes: `exfoliation_load`.
All axes retain `NO_NUMERIC_ANCHOR_AVAILABLE` as a separate secondary state; structural readiness is not numeric/clinical validity.

## DEFERRED CALIBRATION POLICY

- numeric estimates remain `null`
- no weights, priors, scale, or numeric uncertainty are selected
- no statistical-power claim is made
- production Decision Axis consumption remains disabled
- Recommendation activation remains disabled

## ROADMAP RECOMMENDATION — Exactly one, not executed

**Product Decision Axis Offline/Shadow Calibration Wave 1 — `exfoliation_load` only**

Reason: it is the sole axis that satisfies the v1 structural floor and all three mapper-distinct category topology groups in the frozen 8I corpus. The next stage must not fabricate a numeric anchor or activate production consumption.
