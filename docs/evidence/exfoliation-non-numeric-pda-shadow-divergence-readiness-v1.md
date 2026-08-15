# V2.1-8T — Exfoliation Non-Numeric PDA Shadow Decision Divergence Taxonomy & Production-Consumption Readiness

## Result

`PRODUCTION_CONSUMPTION_CONTRACT_DESIGN_READY`

This result authorizes **future contract design only**. It does not authorize production Recommendation activation, CandidateExposurePolicy mutation, scorer/ranking changes, or translation of `CLEAR`/`RESTRICT` into production allow/block decisions.

## Execution authority

- Repository: `gycha0109-beep/K_beauty`
- V2.1-8S merged main: `c3a844ff3aec6a89456aeba9e86a3479239f2974`
- V2.1-8S consumer: `exfoliation-non-numeric-pda-shadow-decision-consumer-v1`
- Frozen 8P snapshot: `31311c223cfc1084e02e226e36b60b6052884f16c52cdc3f5308b786641a9fea`

## Comparison boundary

The comparison is deliberately multi-surface:

- V2.1-8S shadow consumer: categorical caution/coverage projection.
- CandidateExposurePolicy: canonical candidate exposure/eligibility coordination.
- ProductFunctionalProfile: legacy functional axis and count-derived strength.
- FunctionalRankingContract: legacy strength/confidence-weighted ranking.
- RoutinePolicy: routine burden and treatment-window coordination.
- RecentInstabilityGuardPolicy: recent-instability/sensitivity guard.

These surfaces are compared only where semantics overlap. `primary/contextual/collapsed/hidden/insufficient_evidence` is not treated as an alias set for `CLEAR/CAUTION/RESTRICT/UNKNOWN/NOT_APPLICABLE`.

## Frozen taxonomy

- `EXACT_AGREEMENT`
- `SHADOW_MORE_CAUTIOUS`
- `LEGACY_MORE_CAUTIOUS`
- `SHADOW_UNKNOWN_LEGACY_DECIDED`
- `SHADOW_DECIDED_LEGACY_UNKNOWN`
- `LEGACY_HEURISTIC_DEPENDENCY`
- `AUTHORITY_COVERAGE_GAP`
- `ROUTINE_USER_CONTEXT_DIVERGENCE`
- `INCOMPARABLE_SEMANTICS`

Each corpus row has exactly one primary class and may carry supporting classes. Divergence is not an error or a superiority claim. Agreement is not production readiness.

## Bounded corpus

The frozen comparison corpus contains 17 rows:

- 13 V2.1-8S semantic replay cases.
- 4 actual governed PDA products from the V2.1-8P authority:
  - `0b88019a-9eb2-4be9-842d-f1e60e42cf51`
  - `c4a5f510-8d9e-46bd-a31c-3c0a34fee331`
  - `230f1c9c-cbf8-4458-aaac-ea1010a21e8c`
  - `24a339bf-f380-493f-88b5-68e6be887c30`

For those four governed products, only the bounded Hosted fields required to reproduce the existing `ProductFunctionalProfile` comparison were read and frozen: category, `ingredient_signals.functional`, `irritation_risk`, and `sensitivity_safe`. Hosted access was read-only.

## Key findings

### 1. Semantic domains are not directly interchangeable

`CLEAR` is not canonical allow and `RESTRICT` is not canonical block. CandidateExposurePolicy exposure values have their own canonical contract and provenance.

### 2. Legacy heuristic dependency is concrete

`ProductFunctionalProfile` converts `ingredient_signals.functional.count` into `low/medium/high` strength. `FunctionalRankingContract` then assigns numeric weights to those legacy strength values. This is existing production/legacy behavior and is not governed PDA potency.

The future production-consumption contract must isolate this dependency. It must not convert identity count, multi-active status, or concentration into a governed potency order.

### 3. Governed authority can be stricter about uncertainty

The governed products show the boundary clearly:

- `0b88019a...`: governed mandelic-acid identity with complete relevant context projects to `CLEAR`; its bounded legacy functional snapshot contains no exfoliation functional label.
- `c4a5f510...`: governed mandelic-acid identity exists, but concentration/frequency/wipe-off context is incomplete, so the consumer projects `UNKNOWN`; legacy functional signals still yield an exfoliation axis from count `2`.
- `230f1c9c...`: governed unordered `{lactic_acid, salicylic_acid}` identity set has missing concentration/frequency context, so the consumer projects `UNKNOWN`; legacy functional signals yield a single count-derived exfoliation strength.
- `24a339bf...`: governed exfoliation signal is not established but missing concentration context keeps the consumer projection `UNKNOWN`; the bounded legacy profile has no exfoliation axis.

These are authority/representation differences, not evidence that either surface is automatically superior.

### 4. Routine/user context is an independent source of divergence

Shadow overlap, stacking, same-window, sensitivity, reaction, and recent-change handling uses external context. RoutinePolicy and RecentInstabilityGuardPolicy have overlapping but non-identical fields. In particular, the existing recent-instability guard does not directly consume a `productReaction` field.

## Readiness judgment

Contract design is ready because the evidence now identifies:

1. semantic domains that must remain distinct;
2. authority precedence requirements;
3. explicit UNKNOWN/missing behavior;
4. legacy count/strength migration boundaries;
5. routine/user/reaction context boundaries;
6. provenance/reason requirements;
7. continued shadow-only validation requirements.

No irreducible semantic incompatibility was found. Production activation remains explicitly unauthorized.

## Validation

The dedicated verifier checks:

- exact taxonomy and principles;
- all 13 frozen V2.1-8S semantic decisions;
- 4 governed product projections through the actual 8R adapter and 8S consumer;
- actual legacy `strengthFromCount` and numeric ranking-weight dependency;
- RoutinePolicy duplicate/stack behavior;
- RecentInstabilityGuardPolicy sensitivity/conflict behavior;
- absence of a direct `productReaction` input in the existing guard;
- CandidateExposurePolicy semantic separation from the 8S consumer;
- deterministic canonical JSON bytes.

Dedicated CI additionally replays V2.1-8J through V2.1-8S and the canonical `164 × 12 = 1968` production invariance suite.

## Explicit non-activation boundary

- `DECISION_AXIS_PRODUCTION_CONSUMPTION = NO`
- `RECOMMENDATION_SCORER_CHANGED = NO`
- `RECOMMENDATION_ACTIVATED = NO`
- `CANDIDATE_POLICY_PRODUCTION_CHANGED = NO`
- `LEGACY_HEURISTIC_REPLACED = NO`
- `SHADOW_CLEAR_PROMOTED_TO_ALLOW = NO`
- `SHADOW_RESTRICT_PROMOTED_TO_BLOCK = NO`
- `NUMERIC_FITTING = 0`
- `POTENCY_ORDERING_CREATED = NO`
- `HOSTED_PRODUCT_FACT_WRITES = 0`
- `REGISTRY_DEFINITION_DELTA = 0`
- `MIGRATION_DELTA = 0`
