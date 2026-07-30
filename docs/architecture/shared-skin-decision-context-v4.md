# SharedSkinDecisionContext v4 — Completeness Contract

## Status

Implementation contract for the first partial stage found after restoring the PR #88 exact-head stack.

Base:

- PR #88 exact head: `9cedef020f2b2a4fb27d787d6147c0785f4ebbeb`
- stacked branch: `codex/shared-skin-decision-context-completeness-v4`

This change does not activate CandidatePolicy runtime, change recommendation visibility, modify a database schema, write Production data, or redesign Premium storage/authentication.

## Why v4 is required

`shared-skin-decision-context-v3` is already used by the Premium decision orchestrator and the three sibling policies. It provides deterministic priority, safety, current-product rows, routine burden, environment, condition signals, and an evidence ledger.

The restored exact head still had contract gaps:

1. `skinState` did not expose the agreed skin type, sensitivity, and per-axis burden facts;
2. concern facts had no explicit known/unknown coverage model;
3. selected, unknown, unused, and unanswered product states were represented as rows and counts rather than canonical collections;
4. photo absence, photo-analysis failure, and unpersisted photo availability could collapse into `null`;
5. a recent product change or reported reaction could exist without product-specific linkage, but the unresolved relationship was not canonical;
6. uncertainty was distributed across warnings and policy confidence instead of being an explicit fact state.

These gaps do not justify rewriting the existing policies. v4 is a backward-compatible completeness projection over v3.

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

`premium-decision-state` imports v4 directly. The UI continues to render projections from the canonical bundle.

## Completed canonical states

### `skinState`

v4 preserves the existing priority and concern score fields and adds:

```ts
{
  skinType,
  sensitivity,
  drynessBurden,
  rednessBurden,
  oilinessBurden,
  acneBurden,
  barrierBurden,
  poresBurden,
  textureBurden,
  toneBurden,
  uvPriority
}
```

`drynessBurden`, `rednessBurden`, `oilinessBurden`, `acneBurden`, `barrierBurden`, `poresBurden`, `toneBurden`, and `uvPriority` preserve their corresponding canonical concern scores.

`textureBurden` remains `null` because the current survey/scoring contract has no independent texture axis. A pores score is not silently relabelled as a texture fact.

Missing or null evidence remains `null`; it is not converted to zero. `skinType = not_sure` is represented as the canonical fact `unknown`.

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

Missing concern axes remain `null` and appear in `unknownAxes`.

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

When older or current payloads do not persist a photo state, v4 keeps `unknown`. It does not silently classify the case as no-photo or successful analysis.

### `productExposureState`

v4 adds explicit canonical collections and deterministic axis aggregation:

```ts
{
  selectedProducts,
  unknownProducts,
  unusedSlots,
  unansweredSlots,
  functionalAxes,
  uncertainAxes,
  uncertainAxisReasons,
  recentExposureState:
    | "reported_unlinked"
    | "none_reported"
    | "unknown",
  recentExposures,
  reactionLinkState:
    | "unresolved"
    | "none_reported"
    | "unknown",
  reactionLinkedExposures,
  unknownExposurePresent,
  concentrationOrStrengthInferred: false
}
```

The current survey/current-product contract does not contain product-specific recent-change or reaction linkage. Therefore a reported change or reaction remains unlinked and the product arrays remain empty. Product name, brand, category, satisfaction, and ingredient count are not used to create causal attribution.

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

Reasons cover incomplete concern evidence, unknown skin facts, missing survey persistence, unavailable or unknown photo state, unknown products, unanswered usage, unlinked recent changes, unresolved reaction linkage, missing environment context, and minimal condition signals.

## Evidence ledger additions

The following stable records are appended:

- `skin_state`
- `concern_state`
- `photo_evidence_state`
- `recent_exposure_state`
- `reaction_link_state`
- `uncertainty_state`

They contain structured facts and completeness only. They do not add inferred concentrations, causal claims, secrets, product names, or raw image data.

## Determinism and revision

The v4 hash covers canonical facts and evidence, excluding task/source metadata. Identical v4 inputs preserve `contextHash` and `contextRevision`. A v3-to-v4 transition or material evidence change advances the revision once.

## Policy compatibility

The existing sibling policies continue to consume their current fields:

- FunctionalPolicy: skin, safety, exposure, and survey facts;
- RoutinePolicy: shared skin, safety, exposure, and routine-burden facts;
- ConditionPolicy: shared safety, exposure, burden, environment, and condition facts;
- CrossDomainConsistency: the three sibling outputs plus shared facts.

The v4 fields are additive. This PR does not change policy statuses, candidate visibility, recommendation scoring, route response names, DB schema, saved-report ownership, or runtime flags.

## Verification matrix

`verify-shared-skin-decision-context-v4.mjs` directly asserts:

- survey-only, explicit no-photo, unavailable photo, and unknown persisted photo state;
- complete and partial concern evidence, including null remaining null;
- skin type, sensitivity, per-axis burden facts, and the pores/texture boundary;
- selected, not-in-DB, mixed, not-using, and unanswered states;
- known functional-axis grouping and duplicate axes;
- unknown product axes remain unresolved;
- recent product change and reaction remain unlinked without product-specific evidence;
- protection invariant;
- deterministic hash/revision;
- evidence-ledger completeness;
- the actual Premium caller imports v4.

## Non-targets

- FunctionalPolicy, RoutinePolicy, ConditionPolicy, or consistency rule changes;
- CandidatePolicy runtime activation;
- recommendation scoring or UI changes;
- authentication, RLS, Storage, migration, or Production data;
- adding new product-specific reaction survey fields;
- crawler or Face Lab work.

## Completion boundary

This PR closes the context completeness gap only when the focused verifier, existing Premium decision-state verifier, relevant policy/consistency verifiers, syntax, architecture guard, build, and diff hygiene pass on the exact head.

Hosted Preview user-flow verification remains a later external check. A Vercel build alone is not route/storage/reentry or Security-suite PASS.
