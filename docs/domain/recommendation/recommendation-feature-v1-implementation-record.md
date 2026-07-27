# Recommendation Feature V1 Shadow — Implementation Record

## Repository state

```text
main observed: 3a8f113e07d2d629463af5ecf7f70624e47ce8df
implementation base: 9bcade3fd27138ec8691865bc4c462c8e3f54ac7
base branch: codex/face-eval-1-calibration-harness
implementation branch: codex/recommendation-feature-v1-shadow
Draft PR: #74
```

PR #72 and PR #73 form the unified Vision, Face scorer, and calibration stack. PR #69 remains a separate divergent Skin/Premium integration stack. It was inspected but not merged into this shadow branch because it does not contain the unified Vision observation contract required by this implementation.

## Implemented boundary

```text
Existing eligibility
→ Atomic quality, Face semantic, and visible Skin observations
→ deterministic suitability, coverage, and visible support
→ Face scorer compatibility adapter
→ Skin legacy shadow adapter
→ comparison evidence only
```

Recommendation results remain outside the canonical bundle.

## Changed files

```text
.github/workflows/unified-vision-static-guard.yml
docs/domain/recommendation/recommendation-feature-contract-v1.md
docs/domain/recommendation/recommendation-feature-v1-implementation-record.md
docs/verification/recommendation-feature-v1-shadow-evidence.json
lib/recommendation-feature-adapters.js
lib/recommendation-feature-contract.js
lib/recommendation-feature-derived.js
lib/recommendation-feature-normalizer.js
lib/recommendation-feature-shadow.js
lib/server/vision-observation-service.js
lib/vision-observation-contract.js
package.json
scripts/verify-recommendation-feature-adapters.mjs
scripts/verify-recommendation-feature-contract.mjs
scripts/verify-recommendation-feature-derived.mjs
```

The `lib/vision-observation-contract.js` change only replaces two application aliases with equivalent relative imports so the authoritative enum module can be exercised directly by pure Node verifiers. Prompt contents and runtime output are unchanged.

## Verification at implementation HEAD

Verified implementation HEAD:

```text
6cc725a5b2b0782adef38f0935a41ca8744b8e5b
```

GitHub Actions:

```text
Unified Vision Static Guard #81
run 30248889780
SUCCESS

Local Supabase Replay Guard #117
run 30248889821
SUCCESS
```

The successful gates include:

- exact enum checks;
- ObservationField invariants;
- Skin `none`, unavailable, and unsupported separation;
- combined absence requiring all relevant inputs to be observable;
- deterministic suitability and Provider disagreement retention;
- Face scorer path restoration;
- numeric-confidence and evidence gates;
- conditional cheekbone unavailability;
- archetype held lifecycle;
- unresolved non-zero Skin quantisation;
- unified Vision regression;
- Face scorer and calibration regression;
- Face evaluation and Provider E2E package checks;
- request guard, safe logging, RLS, and anonymous write boundary;
- architecture guard;
- production build;
- migration replay twice;
- database lint;
- diff hygiene.

## Production invariance

```text
Provider image call delta: 0
public API additive field: 0
Skin authoritative input changed: false
Premium payload changed: false
saved snapshot changed: false
Face Registry changed: false
Face scoring weight changed: false
Face threshold changed: false
productionEligible: false
decision: null
```

The service creates `recommendationFeatureShadow` beside the existing normalised Vision bundle. Current route consumers continue to use only the existing `bundle` and telemetry.

## Unresolved contract

The following conversion is intentionally not implemented:

```text
mild / moderate / high
→ Skin legacy 0~5
```

Only observable absence is resolved to signal `0` with availability `true`. Insufficient, unavailable, and unsupported inputs also carry signal `0` for compatibility but availability remains `false`.

## Authoritative transition gate

The shadow adapter cannot replace current Skin signals until a fixed-field Provider cue contract, explicit absence, evidence-preserving normalisation, declared evaluation data, versioned quantisation candidates, concern/product/routine regression, separate approval, final Premium/Security stack integration, and explicit production activation review are complete.
