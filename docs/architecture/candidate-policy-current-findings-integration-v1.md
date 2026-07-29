# CandidatePolicy current findings integration v1

## Scope

This contract connects canonical current-product findings to CandidatePolicy
runtime and shadow evaluation. It does not activate the runtime, change product
data, redesign FunctionalPolicy, or promote the legacy
`functional-candidate-policy.js` helper into production authority.

## Authoritative source

The source is `SharedSkinDecisionContext.productExposureState`, created by the
existing Premium decision stack from current-product selections and snapshots.
The CandidatePolicy projection combines that exposure state with the effective
canonical FunctionalPolicy `priorityAxis`.

The projection does not re-read raw survey values, perform catalog lookups, or
infer product purpose from names. It uses the same structured functional profile
already resolved by the shared context.

## Versioned contract

`candidate-policy-current-findings-context-v1` is immutable, deterministic, and
JSON-safe. It records only the minimum policy boundary data:

- canonical source and policy versions;
- canonical ranking goal;
- explicit exposure state;
- bounded product findings with internal IDs, category, evaluability,
  functional relation, matched axes, active axes, and reason codes;
- aggregate counts for selected, evaluable, unknown, not-in-DB, not-using,
  unanswered, supporting, duplicate-axis, and different-goal states.

It excludes product names, brands, URLs, prices, raw survey text, user identity,
session data, and credentials.

## State semantics

- `valid_empty`: there are no current-product rows. This is a valid state and is
  not treated as a missing contract.
- `not_using`: all supplied rows explicitly state that the relevant category is
  not used.
- `unanswered`: at least one category usage answer is unavailable.
- `partial_unknown`: a selected product is not evaluable or a used product is
  not present in the catalog.
- `populated`: findings are available without unanswered or unknown rows.

Missing, malformed, version-invalid, source-invalid, duplicate-ID, or
aggregate-inconsistent contexts invalidate the enclosing canonical goal context.
Runtime and shadow then fail closed through the existing goal-context gate.

## Goal relation

Current products are compared with the canonical CandidatePolicy ranking goal,
not with the requested concern used for explanation.

Relations are:

- `supports_goal`;
- `different_goal`;
- `duplicate_axis`;
- `not_evaluable`;
- `empty_slot`;
- `unknown_usage`.

A sunscreen can support the UV goal only when its structured protection profile
is evaluable. The PR #79 safety gate remains the authority for actual candidate
exposure and continues to fail closed for incomplete SPF/UVA/filter evidence.

## Runtime integration

`buildCandidatePolicyGoalContext()` builds and freezes the current-findings
context alongside the existing goal context. This is a transport envelope, not
a claim that current-product semantics are goal semantics.

`resolveCandidatePolicyGoalPolicy()` exposes the validated findings context to
the evaluator. Runtime and shadow both resolve the same frozen goal context, so
they consume the same current-product findings without independent
recalculation.

The existing loose `currentProductFindings` argument remains available for
isolated legacy verifier compatibility. Production callers do not supply that
argument; the canonical nested context is authoritative.

## Current policy effect

The current integration is deliberately conservative:

- current products affect `currentRoutineRelation` and routine-fit scoring;
- the same already-selected product receives a stronger penalty;
- existing goal support or duplicate-axis context receives a bounded penalty;
- not-in-DB context remains neutral rather than being treated as an empty slot;
- current findings do not override canonical goal, stabilization, protection,
  or hard-safety gates;
- current findings do not introduce a new visibility policy.

Consequently, CandidatePolicy exposure may remain unchanged even when ranking
context becomes current-product-aware. That no-op is explicit and verified; a
future exposure-policy change requires a separate policy review.

`functional-candidate-policy.js` remains a verifier-only semantic reference. It
is not imported by the production runtime.

## Compatibility

Existing goal-context builders automatically receive a valid empty findings
context when there are no current products. Existing runtime and shadow callers
continue to pass the same goal/safety context objects. No persistence version,
product snapshot version, database schema, or environment flag changes.

## Verification

`npm run verify:candidate-policy-current-findings` verifies deterministic
anonymous scenarios for valid empty, not-using, unanswered, supports-goal,
requested-only support, different-goal, duplicate-axis, not-in-DB, missing
snapshot, mixed findings, complete and incomplete sunscreen, stabilization,
runtime/shadow parity, contracted exposure no-op with ranking awareness,
malformed nested context, duplicate IDs, source immutability, and deterministic
output.

The verifier uses no database, network, Production data, runtime activation, or
ignored prerequisite artifact. It is included in the exact security closeout
manifest and CandidatePolicy baseline script.
