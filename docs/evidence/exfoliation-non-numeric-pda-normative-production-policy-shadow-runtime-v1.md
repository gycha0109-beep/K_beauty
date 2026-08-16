# V2.1-8Y Exfoliation Normative Production Policy Shadow Runtime v1

## Terminal target

`NORMATIVE_PRODUCTION_POLICY_SHADOW_RUNTIME_VALIDATED`

This stage materializes the frozen V2.1-8X policy contract as deterministic runtime-callable **shadow-only** logic. It does not authorize or activate production consumption.

## Frozen authority

- Repository base: `7dd6f3566ca3a680627eb64430ca8d34178b53bd`
- 8X contract: `exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1`
- Normative classification: `POLICY_DECISION`
- Vocabulary: `ALLOW`, `CAUTION`, `RESTRICT`, `DEFER`, `NOT_APPLICABLE`

The implementation does not reopen 8X mappings. Product Facts, PDA facts, efficacy facts, and potency facts are not created by this runtime.

## Runtime modules

`lib/exfoliation-non-numeric-pda-normative-production-policy-shadow.js` is a pure deterministic evaluator. It consumes the 8V neutral envelope, already-resolved external policy context, governed context, uncertainty, and provenance. It returns policy action, independently specified eligibility/ranking/score/Top-K/warning effects, rule IDs, reason codes, authority sources, uncertainty, and provenance.

`lib/exfoliation-non-numeric-pda-normative-production-policy-dual-run.js` evaluates the new policy side by side with current CandidateExposurePolicy and legacy functional/routine/safety surfaces. It reuses the V2.1-8T divergence taxonomy and preserves before/after canonical production, response, snapshot, and candidate-order fingerprints.

## Observation-only wiring

The only existing runtime file modified by 8Y is:

`lib/exfoliation-non-numeric-pda-production-consumption-dual-run.js`

The change is an additive re-export of the 8Y dual-run function through the already-established `SHADOW_OBSERVATION_ONLY` boundary. Existing 8V behavior is otherwise unchanged. No canonical recommendation consumer imports the 8Y runtime.

## RESTRICT guard

8Y may compute `RESTRICT` and materializes the frozen future effect `EXCLUDE_WHEN_POLICY_ENFORCED`, but:

- `restrict_enforced = false`
- canonical eligibility is not changed
- score is not changed
- rank is not changed
- Top-K is not changed
- public response is not changed
- persistence is not changed

`RESTRICT` is an observed policy decision, not an active production block.

## ALLOW guard

`ALLOW` means only that this policy adds no restriction under the frozen 8X rules. It is not a claim of scientific safety, universal suitability, eligibility, recommendation, ranking quality, or absence of irritation risk. `ALLOW_PROMOTED_TO_CANONICAL_APPROVAL = NO`.

## External context

The runtime consumes resolved RoutinePolicy and RecentInstabilityGuardPolicy states where available. User/routine/safety context remains external; it is never promoted to an intrinsic Product Fact or PDA fact. Duplicate exfoliation is not fabricated at the dual-run boundary when no governed/current-product relation has been resolved.

## Divergence

V2.1-8T taxonomy is reused exactly:

- `AUTHORITY_COVERAGE_GAP`
- `EXACT_AGREEMENT`
- `INCOMPARABLE_SEMANTICS`
- `LEGACY_HEURISTIC_DEPENDENCY`
- `LEGACY_MORE_CAUTIOUS`
- `ROUTINE_USER_CONTEXT_DIVERGENCE`
- `SHADOW_DECIDED_LEGACY_UNKNOWN`
- `SHADOW_MORE_CAUTIOUS`
- `SHADOW_UNKNOWN_LEGACY_DECIDED`

Divergence is not a defect or superiority claim. Agreement is not activation readiness.

## Deterministic evidence

The builder emits four recursively canonicalized JSON artifacts:

1. shadow runtime implementation evidence
2. 17-case frozen 8X canonical runtime replay
3. four governed-product runtime replay
4. dual-run comparison/divergence evidence

CI requires Build A bytes = Build B bytes = checked-in bytes.

## Required validation

- 17/17 frozen 8X cases reproduce policy action, effects, rule IDs, reasons, and authority sources
- governed cohort 4/4 runtime replay
- dual-run invariance
- V2.1-8J through V2.1-8X historical replay with 8Q–8X at their frozen exact authorities
- canonical 164 × 12 = 1968 production invariance
- exact 8Y scope and frozen 8X non-mutation
- Hosted Product Fact / Registry / migration delta 0

## Explicit invariants

- `DECISION_AXIS_PRODUCTION_CONSUMPTION = NO`
- `NORMATIVE_POLICY_SHADOW_RUNTIME_IMPLEMENTED = YES` only after terminal A validates
- `NORMATIVE_POLICY_CANONICAL_RUNTIME_IMPLEMENTED = NO`
- `NORMATIVE_POLICY_RUNTIME_ACTIVE = NO`
- `PRODUCTION_POLICY_ACTIVATED = NO`
- `PRODUCTION_ACTIVATION_AUTHORIZED = NO`
- `RESTRICT_ENFORCEMENT_IMPLEMENTED = NO`
- `RESTRICT_CANONICAL_EXCLUSION_ACTIVE = NO`
- `ALLOW_PROMOTED_TO_CANONICAL_APPROVAL = NO`
- `RECOMMENDATION_SCORER_CHANGED = NO`
- `RECOMMENDATION_RANKER_CHANGED = NO`
- `RECOMMENDATION_ACTIVATED = NO`
- `CANDIDATE_POLICY_PRODUCTION_CHANGED = NO`
- `LEGACY_HEURISTIC_REPLACED = NO`
- `NUMERIC_FITTING = 0`
- `POTENCY_ORDERING_CREATED = NO`
- `HOSTED_PRODUCT_FACT_WRITES = 0`
- `REGISTRY_DEFINITION_DELTA = 0`
- `MIGRATION_DELTA = 0`
