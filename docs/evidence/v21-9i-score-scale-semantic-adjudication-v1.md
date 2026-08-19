# V2.1-9I Score-Scale Semantic Adjudication v1

## Primary semantic outcome

`RAW_SKIN_MATCH_SCALE_IS_AUTHORITATIVE`

This outcome is scoped to the Production Exfoliation Normative Policy observer input received directly from the current Skin Match decision engine. It does not replace the generic shared-context dynamic-scale compatibility behavior.

## Repository authority

Starting main: `7a8e964a833e08047b3fda02ebef40b6f19e5979`

## Findings

1. Skin Match concern scores are additive raw point totals. The current decision engine repeatedly uses `>= 18` against the same score-card totals for operational concern decisions. There is no final normalization step that converts these totals into a distinct 0-100 scale before the observer receives them.
2. Values greater than 40 are valid raw Skin Match totals. Therefore `max(scoreCard) > 40` is not sufficient evidence that the input changed scale.
3. Generic shared context and Routine Policy historically include dynamic compatibility heuristics that select a higher threshold when the maximum score exceeds 40.
4. Routine Policy has an explicit `scale100` verifier case using values such as barrier 82 / redness 74 / dehydration 70. This is evidence that generic premium policy code intentionally retained compatibility with a high-valued score representation.
5. Therefore globally removing the dynamic path would create an unrelated premium-policy blast radius.
6. The Production Exfoliation Normative Policy observer receives the current Skin Match raw score card directly, so its source-scale identity must not be inferred from the maximum value.

## Architecture decision

Use a domain-scoped Skin Match context boundary for the exfoliation normative-policy observer.

The adapter:
- delegates generic context construction to `shared-skin-decision-context-v4`;
- preserves generic modules unchanged;
- applies the established raw Skin Match high-concern boundary of 18 only at this domain boundary;
- keeps current exposure/recent-change safety semantics aligned with the existing shared-context state shape;
- marks the resulting context with explicit `skin_match_raw` metadata.

The observer is the only production consumer changed to use this boundary.

## Rejected alternatives

### Global fixed threshold 18
Rejected. Generic premium Routine Policy has repository tests for a high-valued `scale100` representation, so removing dynamic compatibility globally is not justified by V2.1-9I evidence.

### Shared dynamic threshold as authoritative for the observer
Rejected. The observer receives raw additive Skin Match scores; values above 40 occur without a source-scale transition. A high unrelated axis therefore cannot authoritatively change another raw concern axis from an 18 boundary to a 70 boundary.

### Existing `fix/v21-9i-shared-context-score-scale` branch wholesale
Rejected as an integration source. Its final scope includes production observer rewiring, a context adapter that reconstructs safety state, verifier changes, and CI changes. It is diagnostic lineage only and is not used as the implementation base or cherry-picked.

## Existing branch final-diff classification

Because the GitHub connector does not expose the four unmerged slash-ref commits individually, no per-commit SHA/message is invented. The authoritative final changed lines were inspected and classified as follows:

- `.github/workflows/v21-9e-normative-policy-production-shadow.yml`: `TEST_ONLY`
- `scripts/product-evidence/verify-v21-9i-shared-context-score-scale-v1.mjs`: `TEST_ONLY` + `DIAGNOSTIC_ONLY`
- `lib/exfoliation-normative-policy-production-shadow-observer.js`: `SEMANTIC_RUNTIME_CHANGE`
- `lib/exfoliation-normative-policy-skin-match-context-adapter.js` metadata: `SCALE_METADATA`
- adapter threshold/safety recomputation: `SEMANTIC_RUNTIME_CHANGE`
- adapter duplicated active-burden/reason-code reconstruction: `OVERREACH` relative to a generic global change, and a maintenance risk if treated as a replacement for shared semantics
- adapter evidence-ledger rewrite: required only insofar as the domain-scoped safety state changes; it is not authority for changing generic shared behavior

## Frozen non-goals

- No Product Fact or Registry mutation.
- No numeric/ordinal/potency change to `exfoliation_load`.
- No direct score or rank mutation.
- No ENFORCE authorization or activation.
- No canonical RESTRICT exclusion activation.
- V2.1-9I remains NOT CLOSED after this semantic-remediation sub-lifecycle.
