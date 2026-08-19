# V2.1-9I Score-Scale Semantic Adjudication v1

## Primary semantic outcome

`RAW_SKIN_MATCH_SCALE_IS_AUTHORITATIVE`

This outcome is scoped to the Production Exfoliation Normative Policy observer input received directly from the current Skin Match decision engine. It does not replace the generic shared-context or RoutinePolicy dynamic-scale compatibility behavior.

## Repository authority

Original semantic-remediation starting main: `7a8e964a833e08047b3fda02ebef40b6f19e5979`

Source-contract cleanup base: `3fdbd70095258684bda7a2450a8448fd648f07b2`

## Findings

1. Skin Match concern scores are additive raw point totals. The current decision engine repeatedly uses `>= 18` against the same score-card totals for operational concern decisions. There is no final normalization step that converts these totals into a distinct 0-100 scale before the observer receives them.
2. Values greater than 40 are valid raw Skin Match totals. Therefore `max(scoreCard) > 40` is not sufficient evidence that the input changed scale.
3. Generic shared context and Routine Policy historically include dynamic compatibility heuristics that select higher thresholds when the maximum score exceeds 40.
4. Routine Policy has an explicit `scale100` verifier case using values such as barrier 82 / redness 74 / dehydration 70. This is evidence that generic premium policy code intentionally retained compatibility with a high-valued score representation.
5. Therefore globally removing the dynamic path would create an unrelated premium-policy blast radius.
6. The Production Exfoliation Normative Policy observer receives the current Skin Match raw score card directly, so its source-scale identity must not be inferred from the maximum value.
7. `shared-skin-decision-context` already has an options boundary and v4 already forwards that boundary to v3. Therefore the smallest justified safety architecture is to make the existing shared safety computation source-scale aware rather than duplicating safety semantics in a domain adapter.
8. The observer also composes `RoutinePolicy` from the same context. RoutinePolicy independently contains dynamic high/elevated thresholds, so it must consume the same explicit source identity. Otherwise the observer would mix raw safety semantics with dynamic routine semantics.

## Architecture decision

Use a source-aware shared-context and RoutinePolicy contract with a domain-scoped Skin Match boundary.

`shared-skin-decision-context`:
- preserves the existing default dynamic compatibility rule when no source scale is supplied;
- accepts explicit `concernScoreScale: "skin_match_raw"` through its existing options boundary;
- selects the established raw Skin Match high-concern boundary of 18 only for that explicit source identity;
- remains the single implementation of `highSensitiveAxes`, `sensitiveBurden`, `activeBurden`, `stabilize_first`, expansion flags, safety reason codes, and the safety evidence ledger.

`RoutinePolicy`:
- preserves its historical dynamic high/elevated thresholds when no explicit source metadata is present;
- reads `context.metadata.concernScoreScale`;
- uses its existing raw-scale thresholds (`high: 18`, `elevated: 14`) only when the context is explicitly `skin_match_raw`;
- keeps the generic `scale100` path unchanged.

The exfoliation domain boundary:
- delegates context and safety construction to `shared-skin-decision-context-v4`;
- supplies `concernScoreScale: "skin_match_raw"` and its domain source identifier;
- does not recompute or fork safety semantics;
- adds explicit scale/authority metadata only.

The observer continues to consume only that domain boundary. Generic premium consumers that omit `concernScoreScale` retain the historical dynamic compatibility behavior.

## Rejected alternatives

### Global fixed threshold 18
Rejected. Generic premium Routine Policy has repository tests for a high-valued `scale100` representation, so removing dynamic compatibility globally is not justified by V2.1-9I evidence.

### Shared/Routine dynamic threshold as authoritative for the observer
Rejected. The observer receives raw additive Skin Match scores; values above 40 occur without a source-scale transition. A high unrelated axis therefore cannot authoritatively change another raw concern axis from an 18 boundary to a 70 boundary, nor change RoutinePolicy from its raw high/elevated thresholds to the generic high-valued compatibility thresholds.

### Domain adapter that reconstructs safety state
Rejected after implementation self-audit. It can produce the correct runtime result, but it duplicates shared safety semantics and creates avoidable maintenance/fork risk. The existing shared options boundary supports a smaller source-aware contract.

### Existing `fix/v21-9i-shared-context-score-scale` branch wholesale
Rejected as an integration source. Its final scope includes production observer rewiring, a context adapter that reconstructs safety state, verifier changes, and CI changes. It is diagnostic lineage only and was not used as the implementation base or cherry-picked.

## Existing branch final-diff classification

Because the GitHub connector does not expose the four unmerged slash-ref commits individually, no per-commit SHA/message is invented. The authoritative final changed lines were inspected and classified as follows:

- `.github/workflows/v21-9e-normative-policy-production-shadow.yml`: `TEST_ONLY`
- `scripts/product-evidence/verify-v21-9i-shared-context-score-scale-v1.mjs`: `TEST_ONLY` + `DIAGNOSTIC_ONLY`
- `lib/exfoliation-normative-policy-production-shadow-observer.js`: `SEMANTIC_RUNTIME_CHANGE`
- `lib/exfoliation-normative-policy-skin-match-context-adapter.js` metadata: `SCALE_METADATA`
- adapter threshold/safety recomputation: `SEMANTIC_RUNTIME_CHANGE`
- adapter duplicated active-burden/reason-code reconstruction: `OVERREACH` / maintenance-fork risk relative to the source-aware shared-context architecture
- adapter evidence-ledger rewrite: unnecessary once the shared safety implementation itself receives the explicit source scale

## Validation contract

The semantic-remediation verifier must establish all of the following:

- raw Skin Match boundary 17 / 18 / 19;
- the nine original blocker contexts;
- domain boundary safety state exactly equals direct shared v4 safety state with `concernScoreScale: "skin_match_raw"`;
- RoutinePolicy distinguishes an explicit raw source from the unchanged generic dynamic default on a cross-axis boundary case;
- generic default dynamic behavior remains unchanged;
- generic Routine Policy `scale100` regression remains valid;
- exact 28 × 164 observer replay has zero semantic mismatches, zero fallback, and zero actual normative exclusion;
- canonical OFF and SHADOW Recommendation invariance remains zero-delta.

## Frozen non-goals

- No Product Fact or Registry mutation.
- No numeric/ordinal/potency change to `exfoliation_load`.
- No direct score or rank mutation.
- No ENFORCE authorization or activation.
- No canonical RESTRICT exclusion activation.
- V2.1-9I remains NOT CLOSED after this semantic-remediation sub-lifecycle.
