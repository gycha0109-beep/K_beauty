# Premium Integrated Decision Evaluation Pack v2

## Status

Design for implementation and exact-head verification.

## Purpose

Validate the actual canonical Premium decision bundle and its pure downstream representations from one deterministic fixture manifest.

The pack must prove input-to-decision-to-output behavior. Source-string existence checks are not sufficient evidence.

## Authoritative entrypoint

Every scenario starts from `buildPremiumDecisionState()` and therefore uses:

1. `SharedSkinDecisionContext v4`;
2. FunctionalPolicy;
3. RoutinePolicy;
4. ConditionPolicy;
5. CrossDomainConsistency;
6. effective policy selection;
7. canonical Premium projections and `premium-decision-bundle-v5`.

No fixture may directly fabricate a canonical policy result.

## Required logical scenarios

The manifest must contain exactly these 21 logical scenario IDs. A logical scenario may have multiple explicit variants.

1. `S01_NO_ACTIVE_PRODUCTS`
2. `S02_DUPLICATE_ACTIVE_AXIS`
3. `S03_BARRIER_AGGRESSIVE_ACTIVE`
4. `S04_BREAKOUT_EXFOLIATION_OVERLAP`
5. `S05_SENSITIVE_HIGH_IRRITATION`
6. `S06_NOT_IN_DB_ONLY`
7. `S07_SELECTED_AND_NOT_IN_DB`
8. `S08_NO_PHOTO`
9. `S09_PHOTO_UNAVAILABLE`
10. `S10_NON_PHOTO_FALLBACK`
11. `S11_SURVEY_PHOTO_CONFLICT`
12. `S12_INSUFFICIENT_INFORMATION`
13. `S13_REPEAT_STABILITY`
14. `S14_LOCALE_PARITY`
15. `S15_EXISTING_SAVED_REPORT`
16. `S16_NEW_SNAPSHOT`
17. `S17_HISTORICAL_SNAPSHOT_IMMUTABLE`
18. `S18_CROSS_DOMAIN_NEGATIVE_FIXTURES`
19. `S19_SUNSCREEN_PROTECTION_COMPLETENESS`
20. `S20_CURRENT_FINDINGS_POPULATED_VS_VALID_EMPTY`
21. `S21_RUNTIME_SHADOW_PARITY`

## Evaluation layers

### 1. Product evidence lane

Where catalog fixtures are present, execute `buildProductDataSufficiencyAudit()` and compare audit capabilities with the decision context.

### 2. Shared context lane

Assert explicit photo state, concern completeness, uncertainty reasons, selected/unknown/unused/unanswered exposure collections, duplicate axes, recent-change linkage state, and evidence-ledger keys.

### 3. Canonical bundle lane

Assert raw-policy lineage, consistency verdict, effective policy source, policy versions, and Premium projections.

### 4. Snapshot lane

Build a canonical report snapshot with `buildPremiumReportSnapshot()`.

Assert:

- deterministic fingerprint for identical canonical reports;
- a changed report produces a new fingerprint;
- the previous snapshot object and fingerprint remain unchanged;
- context hash and revision are retained;
- transient identifiers do not alter the canonical fingerprint.

### 5. Saved reentry lane

Use `buildRotatedPremiumReportPayload()` for a new-report rotation fixture and verify that current-product state is removed before the canonical state is rebuilt.

Saved-report reopen is represented by the stored canonical snapshot itself and must not be recomputed into a different historical snapshot.

This pack does not access Supabase or an authenticated route. Live storage and ownership remain Stage 9 and Hosted Preview responsibilities.

### 6. Display lane

Use `resolvePremiumFunctionalDisplayModel()` with the actual decision state.

Assert that canonical reports return `source: canonical` and retain object identity for `functionalPlan` and `functionalRoutineAudit`. Legacy fixtures must use `legacy_adapter` without calculating a new policy in the display model.

### 7. Candidate runtime/shadow lane

Build CandidatePolicy safety and goal contexts from the scenario's actual SharedSkinDecisionContext and effective FunctionalPolicy.

Execute runtime and shadow from the same products and contexts. Compare semantic outputs after excluding transport-only fields such as `runtimeConnected` and `evidenceType`.

Required parity fields include:

- receivers;
- boundary hints;
- violation counts;
- safety and goal context versions;
- current-findings exposure state and counts;
- safety block reason/category/axis counts;
- alignment stop reason.

Runtime remains disabled. This lane is a pure deterministic comparison and does not activate a flag or canary.

## Cross-domain negative fixtures

`S18_CROSS_DOMAIN_NEGATIVE_FIXTURES` must use explicit variants covering at least:

- functional hold with routine active frequency;
- protection required with missing AM sunscreen;
- unknown product with definitive stop or replacement;
- duplicate axis with same-axis expansion;
- stabilization with increased active frequency;
- low intensity converted to daily use.

The fixture may call the consistency checker with intentionally conflicting policy objects, but the actual canonical scenario must still originate from `buildPremiumDecisionState()`.

## Manifest contract

The v2 manifest version is `premium-integrated-evaluation-fixtures-v2`.

Allowed scenario extensions:

- `candidateProducts`: products used only by the runtime/shadow parity lane;
- `lifecycle`: snapshot, reentry, display, and parity operations requested for the scenario;
- `negativeConsistencyCases`: explicit conflicting policy fixtures for the consistency checker.

All paths continue to use safe dot notation. Prototype-sensitive segments, wildcards, and bracket syntax remain forbidden.

## Invariants

Every canonical scenario retains:

- bundle version and lineage;
- raw/effective policy separation;
- no redundant effective-policy container;
- protection continuity;
- deterministic output;
- input immutability;
- no causal action for unknown products without reaction evidence.

Additional v2 invariants:

- context version equals the exported authoritative SharedSkinDecisionContext version;
- snapshot immutability;
- canonical display identity;
- runtime/shadow semantic parity;
- sunscreen protection remains fail-closed when SPF, UVA, or filter metadata is incomplete;
- valid-empty current findings remain distinct from populated and partial-unknown findings.

## Non-targets

- no recommendation scoring rewrite;
- no policy threshold changes unless a verifier exposes an existing integration defect;
- no route authentication simulation;
- no Supabase read or write;
- no migration;
- no runtime flag or canary activation;
- no Production deployment;
- no UI copy expansion.

## Verification gate

The exact-head gate must execute:

1. v2 fixture schema validation;
2. all 21 logical scenarios and all variants;
3. lifecycle and negative consistency assertions;
4. CandidatePolicy runtime/shadow parity;
5. existing SharedSkinDecisionContext verifier;
6. existing Functional, Routine, Condition, consistency, Premium decision-state, snapshot, reentry, and current-findings verifiers;
7. syntax checks;
8. architecture guard;
9. optimized Next.js build;
10. diff hygiene and temporary-hook cleanup.

The final branch must not retain a temporary workflow, gate runner, or `postbuild` hook.
