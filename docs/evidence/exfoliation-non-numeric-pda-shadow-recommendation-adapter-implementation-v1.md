# V2.1-8R — Exfoliation Non-Numeric PDA Shadow Recommendation Adapter

## Result

`SHADOW_RECOMMENDATION_ADAPTER_IMPLEMENTATION_VALIDATED`

## Authority

- Base main: `e812ee6a7eae6b98940adfe7b10471687e5cad1a`
- Frozen V2.1-8Q head: `9c8d387e9698a8c8ad2d11697e488a79862f9e65`
- Frozen adapter contract: `exfoliation-non-numeric-pda-shadow-consumption-adapter-contract-v1`
- Frozen V2.1-8P output SHA-256: `03d4446fd7ea1ce8dd23c44bb6c641804bd3394b4aab39db9ee0d7e021029624`

## Implementation

The adapter is implemented in `lib/exfoliation-non-numeric-pda-shadow-adapter.js` and is invoked only by `runCandidateExposurePolicyShadow`. It derives shadow decision inputs from the frozen structured-categorical exfoliation PDA plus separately authoritative routine/user context. The existing CandidateExposurePolicy evaluator input and result are not replaced or enriched with the PDA output.

The shadow return object exposes the adapter result for comparison/replay only. Existing aggregate telemetry remains unchanged. Adapter failure is fail-isolated from the pre-existing candidate-exposure shadow evaluator.

## Semantic boundary

- Identity overlap is derived only by governed active-identity intersection.
- Missing and unknown are preserved as distinct states.
- Multi-active cardinality has no magnitude implication.
- Product-specific concentration remains context and is never converted into cross-active magnitude.
- Legacy strength/count heuristics remain unchanged and are not treated as governed PDA authority.

## Validation

The deterministic replay covers 13 required semantic cases, including single/multi active, no established relevant active, unknown authority, missing concentration, overlap present/absent, duplicate exfoliation, routine stacking, same-window conflict, sensitivity, reaction/instability, and not-applicable products. Canonical V2.1-8P examples are replayed by the focused verifier to preserve Product Fact provenance lineage.

Production invariance remains 164 × 12 = 1968 expected zero-delta evaluations. Dedicated CI also executes the existing recommendation invariance verifier and historical V2.1-8J through V2.1-8Q replay.

## Artifact hashes

- implementation: `c22d0d6ba03685b6dca855b3df48d103b1878d1c98768cdff268178634587b3f`
- replay: `0981dd4897dbfe3a1203ffe7f689729bfa77f3fd7e4950925ecdbcfca0050caa`

## Explicit NO

- DECISION_AXIS_PRODUCTION_CONSUMPTION = NO
- RECOMMENDATION_SCORER_CHANGED = NO
- RECOMMENDATION_ACTIVATED = NO
- CANDIDATE_POLICY_PRODUCTION_CHANGED = NO
- LEGACY_HEURISTIC_REPLACED = NO
- NUMERIC_FITTING = 0
- POTENCY_ORDERING_CREATED = NO
- HOSTED_PRODUCT_FACT_WRITES = 0
- REGISTRY_DEFINITION_DELTA = 0
- MIGRATION_DELTA = 0
