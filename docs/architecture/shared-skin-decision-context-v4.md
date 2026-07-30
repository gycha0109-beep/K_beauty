# SharedSkinDecisionContext v4 — Completeness Contract

## Status

Implementation contract for the first partial stage found after restoring the PR #88 exact-head stack.

Base:

- PR #88 exact head: `9cedef020f2b2a4fb27d787d6147c0785f4ebbeb`
- New stacked branch: `codex/shared-skin-decision-context-completeness-v4`

This change does not activate CandidatePolicy runtime, change recommendation visibility, modify a database schema, write Production data, or redesign Premium storage/authentication.

## Why v4 is required

`shared-skin-decision-context-v3` is already the real source used by the Premium decision orchestrator and the three sibling policies. It correctly provides deterministic skin, safety, current-product exposure, routine burden, environment, condition signals, and an evidence ledger.

The restored exact head still has four contract gaps:

1. concern facts are present only inside `skinState`, without an explicit completeness/unknown model;
2. photo absence, photo-analysis failure, and unpersisted photo availability can collapse into `null`;
3. a recent product change or reported reaction can be observed without being linked to a specific exposure, but that unresolved relationship is not represented;
4. uncertainty is distributed across warnings and policy confidence rather than exposed as a canonical state.

These gaps do not justify rewriting the existing policies. They require a backward-compatible context extension.

## Authoritative path

```text
Premium report inputs
→ shared-skin-decision-context-v3 normalization
→ shared-skin-decision-context-v4 completeness projection
→ premium-decision-state
→ FunctionalPolicy / RoutinePolicy / ConditionPolicy
→ CrossDomainConsistency
→ Canonical Premium decision bundle
```

`premium-decision-state` imports v4 directly. No UI or policy is allowed to bypass it for newly rebuilt Premium decisions.

## Added canonical states

### `concernState`

```ts
{
  priorityAxis,
  priorityScore,
  scores,
  knownAxes,
  unknownAxes,
  completeness: "complete" | "partial" | "minimal",
  surveyPhotoAlignment: "aligned" | "partial" | "conflict" | "unknown"
}
```

Missing axes remain unknown. They are not filled with zero by v4.

### `photo`

```ts
{
  status:
    | "available"
    | "not_provided"
    | "unavailable"
    | "insufficient_evidence"
    | "unknown",
  source,
  failureReason,
  observations,
  evidenceAvailable,
  factsMayBeInferred: false
}
```

A missing persisted status remains `unknown`; it is not silently classified as no-photo or successful analysis.

### `productExposureState` additions

```ts
{
  recentExposureState:
    | "linked"
    | "reported_unlinked"
    | "none_reported"
    | "unknown",
  recentExposures,
  reactionLinkState:
    | "linked"
    | "unresolved"
    | "none_reported"
    | "unknown",
  reactionLinkedExposures,
  unknownExposurePresent,
  concentrationOrStrengthInferred: false
}
```

A survey-level recent change or reaction is not assigned to a product unless an explicit link exists. Product name, brand, category, satisfaction, or ingredient count is not treated as causal evidence.

### `uncertaintyState`

```ts
{
  level: "low" | "medium" | "high",
  reasons,
  confidenceCeiling: "high" | "medium" | "low",
  unknownPreserved: true,
  factsMayBeInferred: false
}
```

This state records missing concern coverage, unavailable or unknown photo state, unknown products, unlinked recent changes, unresolved reaction linkage, missing environment context, and minimal condition signals.

## Evidence ledger additions

The following stable entries are appended:

- `concern_state`
- `photo_evidence_state`
- `recent_exposure_state`
- `reaction_link_state`
- `uncertainty_state`

They contain only structured status and completeness data. They do not add product names, inferred concentrations, causal claims, secrets, or raw image data.

## Determinism and revision

The v4 context hash covers the canonical facts and evidence ledger but excludes task/source metadata. Identical v4 inputs preserve `contextHash` and `contextRevision`. A v3-to-v4 transition or material evidence change advances the revision once.

## Policy compatibility

The existing policies continue to read their current fields:

- FunctionalPolicy: `skinState`, `safetyState`, `productExposureState`, survey
- RoutinePolicy: shared skin/safety/exposure/burden facts
- ConditionPolicy: shared safety/exposure/burden/environment/condition facts
- CrossDomainConsistency: the three sibling outputs plus shared facts

The new fields are additive. No policy status, recommendation score, visibility rule, route response field, DB schema, or saved-report ownership rule is changed in this PR.

## Verification matrix

`verify-shared-skin-decision-context-v4.mjs` asserts:

- survey-only and explicit no-photo;
- explicit photo-analysis unavailable;
- unpersisted photo state remains unknown;
- selected product;
- not-in-DB only;
- selected plus not-in-DB;
- not-using;
- unanswered;
- duplicate functional axis;
- partial concern coverage;
- recent product change without a link;
- reported reaction without a link;
- explicit reaction link;
- explicit recent exposure link;
- protection invariant;
- deterministic hash/revision;
- evidence-ledger completeness;
- actual Premium caller imports v4.

## Non-targets

- FunctionalPolicy rule changes
- RoutinePolicy rule changes
- ConditionPolicy rule changes
- Cross-domain fallback changes
- CandidatePolicy runtime activation
- recommendation scoring changes
- UI copy or layout
- authentication, RLS, Storage, migration, or Production data
- new current-product survey fields
- causal attribution from satisfaction or product metadata
- crawler work
- Face Lab

## Completion boundary

This PR closes the canonical context completeness gap only when the focused verifier, existing Premium decision-state verifier, relevant policy/consistency verifiers, syntax, architecture guard, build, and diff hygiene pass on the exact head.

Hosted Preview user-flow verification remains a later external check; a Vercel build alone is not equivalent to route/storage/reentry or Security-suite PASS.
