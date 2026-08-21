# V2.1-9Q ENFORCE Reassessment Calibration Protocol Completion & Prospective Registration Governance Freeze

## 1. Stage boundary

V2.1-9Q does not calibrate parameter values, authorize ENFORCE, activate ENFORCE, generate Production traffic, run a controlled Production probe, mutate Product Fact, or change Recommendation/CandidatePolicy/runtime semantics.

It combines the already frozen authorities:

- 9N — `enforce-reassessment-sufficiency-calibration-contract-v1`: what must be calibrated;
- 9O — `enforce-reassessment-sufficiency-calibration-methodology-v1`: how calibration, validation, and holdout work;
- 9P — `enforce-reassessment-normative-acceptance-objectives-v1`: what counts as acceptable and how promotion is governed.

9P remains STRICT SUCCESS / CLOSED and is not reopened.

## 2. Starting authority

9Q starts from exact authoritative main:

`6a18af5a992eb6a70e2006361e99456e3b491ed2`

This is the V2.1-9P merge from PR #279. No intervening drift existed at 9Q branch creation.

## 3. Primary outcome

`ENFORCE_REASSESSMENT_CALIBRATION_PROTOCOL_FROZEN_AND_PROSPECTIVELY_REGISTERED`

Protocol version:

`enforce-reassessment-calibration-protocol-v1`

Protocol status:

`PROTOCOL_FROZEN_AND_PROSPECTIVELY_REGISTERED_VALUES_UNCALIBRATED`

The protocol is complete without assigning any numeric calibration value.

## 4. Why prospective registration is possible with organic evidence absent

The protocol does not need a future calendar duration or execution count to define evidence authority.

Its registration event is publication of this protocol version on authoritative main.

Evidence before registration remains valid historical diagnostic evidence, but it cannot be adopted retrospectively as the canonical v1 calibration set.

Because durable SHADOW evidence is stored as privacy-safe UTC daily aggregates, the canonical v1 calibration stream begins only with the first complete UTC daily aggregate bucket whose start is strictly after authoritative protocol registration. The registration-day partial bucket is ineligible for canonical v1 calibration. This prevents a single daily row from mixing unknown pre-registration exposure with post-registration exposure.

No future date is hard-coded by 9Q.

## 5. Registered calibration regime

Canonical v1 calibration evidence must match the regime registered at protocol freeze:

- activation version: `exfoliation-non-numeric-pda-normative-production-policy-activation-v1`
- policy contract version: `exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1`
- runtime version: `exfoliation-non-numeric-pda-normative-production-policy-shadow-v1`
- evidence schema: `exfoliation-normative-organic-shadow-evidence-daily-v1`
- context bucket version: `privacy-safe-recommendation-context-bucket-v1`
- activation scope: `POST_SCORE_POST_SORT_ELIGIBILITY_OVERLAY_BEFORE_RESULT_ASSEMBLY`

Incompatible later regimes must not be silently pooled. A regime change requires a separate registered successor protocol or explicit compatibility governance.

A favorable regime may not be chosen after its outcomes are observed.

## 6. Evidence eligibility

Canonical calibration maturity authority:

`POST_REGISTRATION_ORGANIC_PRODUCTION_DURABLE_SHADOW_DAILY_AGGREGATES_MATCHING_REGISTERED_REGIME`

Controlled Production remains limited to wiring, provenance, instrumentation, and explicit reachability.

Synthetic/Persona evidence remains limited to contract, edge-case, stress, reachability, and regression testing.

UNKNOWN remains a separately characterized risk descriptor and never becomes organic maturity evidence.

External references may support methodology or risk framing but cannot directly create BEJEWELY numeric tolerance authority.

## 7. Calibration role registration

The calibration role is prospectively assigned by lifecycle state, not by observed favorability.

The start is the first eligible full UTC daily bucket after protocol registration in the registered version regime.

The derivation input is the complete eligible evidence prefix. Backdating, cherry-picking, and selective omission of unfavorable evidence are forbidden.

All nine 9N parameters retain the exact 9O method families.

Candidate derivation closure must emit versioned parameter-derivation artifacts and a locked calibrated-candidate artifact before validation evidence becomes eligible.

9Q does not assign candidate values.

## 8. Validation role registration

The concrete validation role boundary is registered only after a candidate is locked and governance-adopted, but before the first validation evidence becomes eligible.

This is prospective because the ordering and registration requirement are already frozen by 9Q; the future date itself is not invented now.

Validation:

- is strictly later than calibration;
- cannot overlap calibration;
- cannot retune the candidate;
- cannot be used to create a retroactive candidate adoption.

## 9. Holdout role registration

The holdout role registration must be committed as part of candidate governance adoption before validation outcomes are observed.

Holdout evidence:

- is strictly later than validation evidence;
- cannot overlap calibration or validation;
- remains sequestered until validation passes;
- cannot be reused for a revised candidate after failed validation.

A failed validation requires a fresh candidate version and fresh future role registration under the protocol.

## 10. Artifact chain

The protocol freezes schemas for:

1. `enforce-reassessment-parameter-derivation-artifact-v1`
2. `enforce-reassessment-calibrated-candidate-artifact-v1`
3. `enforce-reassessment-candidate-governance-adoption-artifact-v1`
4. `enforce-reassessment-validation-result-artifact-v1`
5. `enforce-reassessment-holdout-result-artifact-v1`
6. `enforce-reassessment-successor-sufficiency-policy-artifact-v1`

Every artifact must retain exact protocol, regime, method, normative-objective, and evidence-role lineage.

The calibrated candidate must include all nine frozen 9N parameters before validation.

Candidate governance adoption must precede validation evidence and must prospectively register validation and holdout roles.

## 11. Anti-retrofit contract

9Q forbids:

- pre-registration evidence as the canonical v1 calibration set;
- outcome-based calibration-window selection;
- favorable version-regime selection after outcomes;
- calibration/validation/holdout overlap;
- candidate retuning on validation or holdout;
- holdout reuse after failed validation;
- candidate governance adoption after seeing a validation result;
- direct external-number import as an internal tolerance;
- operator-created threshold chosen solely to pass current evidence;
- synthetic/controlled substitution for organic maturity;
- cross-joining privacy-safe marginals or reconstructing pseudo-users.

## 12. Promotion semantics

The 9P non-compensatory promotion rule remains authoritative.

The 9Q artifact chain does not weaken or replace it.

Future READY requires, among the existing frozen gates:

- exact protocol and normative lineage;
- versioned calibrated candidate values;
- governance adoption before validation;
- independent validation without retuning;
- sequestered holdout without retuning/reuse;
- all mandatory normative objectives passing;
- no hard blocker;
- frozen successor sufficiency policy.

`READY_FOR_SEPARATE_ENFORCE_REASSESSMENT` remains only an entry state for a separate reassessment.

It never means ENFORCE authorization or activation.

## 13. Current evidence state

At 9Q entry, fresh Hosted readback over `[2026-08-20, 2026-08-22)` returned:

- durable rows: zero;
- observed days: zero;
- ORGANIC_PRODUCTION: zero;
- CONTROLLED_PRODUCTION_PROBE: zero;
- UNKNOWN_PRODUCTION_SOURCE: zero;
- actual exclusion: zero;
- context marginals: empty;
- version groups: empty.

Therefore current execution state remains:

`CALIBRATION_EXECUTABLE_NOW = NO`

`CALIBRATED_PARAMETER_VALUES = NONE`

`CURRENT_TRIGGER = NOT_READY / organic_traffic_absent`

The absence of organic evidence does not prevent prospective protocol registration.

## 14. Production and mutation boundary

9Q is additive repository-only governance work.

Expected and verified mutation boundary:

- Recommendation delta: zero;
- CandidatePolicy delta: zero;
- Product Fact delta: zero;
- PDA delta: zero;
- runtime-control delta: zero;
- Production API delta: zero;
- Supabase migration delta: zero;
- Hosted evidence write: zero;
- ENFORCE activation: zero.

Production remains SHADOW with ENFORCE unauthorized and inactive.
