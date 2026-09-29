# Face Lab V2 — End-to-End Completion Audit v1

> Track: face-research
> Scope: deterministic completion audit only
> Production semantics: unchanged

## 1. Goal

Verify that the current Face Lab V2 product flow is connected end to end after Target Intent authority, explicit Route choice, Route Choice Evidence, and Route Comparator work.

The audit does not judge whether a style is aesthetically correct.

It verifies that the product authority chain behaves consistently.

## 2. Cohort

The audit reuses the frozen target-sweep cohort:

~~~text
8 structured faces
× 12 targets
= 96 base cases
~~~

Every base case runs under both:

~~~text
face_harmony
target_forward
~~~

for 192 preview flows.

Every emitted Route in every preview flow is then explicitly selected and round-tripped through the persistence normalizer.

## 3. Flow under test

~~~text
structured face analysis
→ survey / Target
→ recommendationPriority
→ canonical Style Delta
→ emitted Routes
→ uncommitted preview
→ Route comparison presentation
→ explicit Route selection
→ domain execution
→ Look Composer
→ Route Choice Evidence
→ persistence normalization
→ canonical rehydration
~~~

## 4. Required preview behavior

When multiple Routes exist:

- selectionState is `default_preview`;
- presentation exposes no selected Route;
- execution UI is empty;
- composed Look is hidden;
- route-specific product guidance is hidden;
- Route comparator is available;
- Route Choice Evidence is null.

The system may still compute an internal deterministic preview Route for backward-compatible canonical execution, but that internal preview must not leak into user-choice authority.

## 5. Required explicit-choice behavior

For every emitted Route:

- selectionState becomes `user_selected`;
- canonical and presentation selectedRouteId equal the requested Route;
- exactly one Route card is selected;
- execution resolves to that Route;
- at least one executable domain is visible;
- composed Look is available;
- Route Choice Evidence references the same Route;
- explicit choices are preference-eligible.

## 6. Persistence round trip

The audit normalizes:

~~~text
surveyAnswers
targetFinderResult
selectedRouteId
~~~

through the Production persistence normalizer and rebuilds the canonical result.

The reconstructed result must preserve:

- explicit Route selection;
- recommendationPriority;
- preference-eligible Route Choice Evidence.

## 7. Completion signals

The audit records:

- preview case count;
- explicit Route choice case count;
- Route Choice Evidence count;
- persistence round-trip count;
- preview execution leaks;
- preview Look leaks;
- preview product-guidance leaks;
- route selection mismatches;
- execution lineage mismatches;
- evidence lineage mismatches;
- persistence round-trip mismatches;
- hard failure count.

## 8. Boundary

This audit does not:

- add recommendation rules;
- alter Route Generator ranking or candidate generation;
- activate vCandidate;
- add Preference Fit;
- learn from Route Choice Evidence;
- claim any Route is aesthetically superior;
- test camera/network/browser rendering;
- replace real-device user acceptance testing.

A zero-failure result means the deterministic Face Lab V2 decision/presentation/persistence chain is internally complete for the audited cohort. It does not mean aesthetic recommendation quality has been proven.
