# CandidatePolicy goal alignment v1

## Scope

This contract aligns CandidatePolicy runtime and shadow ranking with the
canonical Premium decision stack. It does not change FunctionalPolicy
decisions, current-product findings transport, product data, runtime flags, or
deployment behavior.

## Goal meanings

- Requested goal: normalized `SurveyInputContract.goals.primaryConcern`; used
  for explanation and preserved when it differs from the detected state.
- Detected priority: `SharedSkinDecisionContext.skinState.priorityAxis`.
- Ranking goal: the effective canonical FunctionalPolicy `priorityAxis`.
- Safety mode and recommendation guard: projected from
  `candidate-policy-runtime-safety-context-v1`, not recalculated from the
  requested goal.
- Display goal: requested goal plus the machine-readable tension state.

## Runtime call graph

1. `buildSkinMatchDecisionBundle()` normalizes survey answers, computes the
   score card and detected priority, and creates the existing recommendation
   source pool.
2. `buildCanonicalCandidatePolicyContexts()` builds a pure Premium decision
   state from that detected priority, scores, answers, and current-product
   report.
3. The Premium state supplies SharedSkinDecisionContext, raw FunctionalPolicy,
   effective FunctionalPolicy, and `effectivePolicySource`.
4. `buildCandidatePolicyRuntimeSafetyContext()` projects the existing PR #79
   safety contract from the shared context and raw FunctionalPolicy.
5. `buildCandidatePolicyGoalContext()` projects the requested goal, detected
   priority, and effective FunctionalPolicy ranking goal.
6. `resolveCandidatePolicyGoalPolicy()` preserves legacy explanation fields but
   replaces CandidatePolicy ranking and guard authority with the canonical goal
   and safety contexts.
7. Runtime and shadow receive the same survey, aligned goal policy, goal
   context, and safety context. `buildEvaluatorBoundaryPolicyExecution()` again
   validates and resolves the aligned goal policy before ranking, guard, hint,
   receiver, and safety-gate evaluation.
8. The runtime visible pool remains the only pool used by the existing
   Top Pick, alternatives, supporting, routine, and budget consumers.

`resolveFunctionalGoalPolicy()` remains unchanged for legacy and verifier-only
consumers. It is not the CandidatePolicy runtime ranking authority.

## Versioned contract

`candidate-policy-goal-context-v1` is immutable, deterministic, JSON-safe, and
contains:

- requested goal;
- detected priority;
- canonical ranking goal;
- requested/detected tension;
- shared/effective policy provenance;
- bounded reason codes.

It contains no product identity, raw survey text, user identity, URL, token, or
session data. Missing or invalid context blocks the pure runtime and shadow
execution. There is no implicit production legacy fallback.

## Divergence classification

The exact pre-change matrix is
`8 requested goals × 8 detected priorities × 2 risk states = 128`.
The historical object comparison is reproduced as `11 equivalent`,
`9 compatible independent`, and `108 divergent`.

Actual catalog replay separates the effect:

- D0: equivalent canonical ranking/guard semantics;
- D1: requested and detected goals differ by role after alignment;
- D2: naming/projection-only difference;
- D3: ranking output difference;
- D4: guard/safety allowance difference;
- D5: unreachable or invalid input;
- D6: insufficient evidence.

The aligned contract permits D1/D2 but requires D3, D4, runtime/shadow
divergence, and safety-invariant violations to be zero.

## Compatibility and observability

Legacy requested-goal policy objects remain available to non-runtime consumers.
Runtime observability records only bounded fields: context version, requested
and detected presence, tension, ranking source, legacy-fallback use, and a
bounded alignment stop reason. Goal values and user/product identity are not
logged.

## Verification

`npm run verify:candidate-policy-goal-alignment` covers 18 deterministic
scenarios, all 128 goal/risk combinations, runtime/shadow parity, ordering and
downstream pool assertions, missing/invalid fail-closed behavior, 12 negative
controls, semantic double-run equality, exact temporary artifact files, and
cleanup.

The actual 164-product replay is local ignored evidence only. Product rows,
names, brands, URLs, and real identifiers are not committed.
