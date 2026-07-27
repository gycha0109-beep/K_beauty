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

## Skin availability amendment

The Skin legacy shadow adapter separates three previously conflated states.

```text
observationAvailability
→ whether a canonical visible cue was observed

quantizationResolved
→ whether the observed level has an approved legacy numeric mapping

legacySignalAvailability
→ whether a comparable legacy numeric signal exists
```

The retained `availability` map is a compatibility alias for `legacySignalAvailability`. It does not mean that the canonical observation is unavailable.

State examples:

```text
observed mild
→ observationAvailability true
→ quantizationResolved false
→ legacySignalAvailability false
→ signal 0 only as a non-authoritative compatibility placeholder

observed none
→ observationAvailability true
→ quantizationResolved true
→ legacySignalAvailability true
→ signal 0 as resolved absence

unavailable or unsupported
→ all three booleans false
→ signal 0 as a compatibility placeholder
```

Comparison is permitted only when `legacySignalAvailability` is true. An unresolved non-zero cue is therefore not compared against a direct legacy signal as if it were a predicted zero.

The authoritative clarification is recorded in:

```text
docs/domain/recommendation/recommendation-feature-v1-skin-availability-amendment.md
```

## Changed files

```text
.github/workflows/unified-vision-static-guard.yml
docs/domain/recommendation/recommendation-feature-contract-v1.md
docs/domain/recommendation/recommendation-feature-v1-implementation-record.md
docs/domain/recommendation/recommendation-feature-v1-skin-availability-amendment.md
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

## Verification at availability-amendment head

Verified implementation HEAD:

```text
59f38f60bd8e4007a106280d81845cb2d04a689a
```

GitHub Actions:

```text
Unified Vision Static Guard #86
run 30251019138
SUCCESS

Local Supabase Replay Guard #122
run 30251019089
SUCCESS after retry of the failed job
```

The first Replay Guard attempt completed all migrations but timed out while waiting for the local Supabase Storage HTTP endpoint after container restart:

```text
context deadline exceeded while awaiting headers
```

No Recommendation Feature, application build, migration SQL, or database-contract failure was present. The failed job alone was rerun. The retry completed:

- isolated Supabase startup;
- migration chain reset twice;
- local database lint;
- anonymous product boundary verification;
- cleanup.

The successful gates include:

- exact enum checks;
- ObservationField invariants;
- Skin `none`, unavailable, and unsupported separation;
- observed non-zero cue vs unresolved quantisation separation;
- observation availability vs legacy signal availability separation;
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

## Regression review

The availability amendment is exactly three commits ahead of the prior reviewed head `630111fbb6309f384e7f848c9a49a746aa49329f` and changes only:

```text
lib/recommendation-feature-adapters.js
scripts/verify-recommendation-feature-adapters.mjs
docs/domain/recommendation/recommendation-feature-v1-skin-availability-amendment.md
```

Regression findings:

- Face adapter code and scorer lifecycle were not modified.
- Existing direct Skin signals remain authoritative.
- No route, API response, Premium payload, persistence, analytics, or logging path changed.
- No Provider call was added.
- Non-zero quantisation remains unresolved and shadow-only.
- Comparison became stricter: unresolved compatibility zeros are no longer comparable.
- The compatibility alias `availability` remains available but its meaning is explicitly limited to legacy numeric signal availability.

No critical or important regression issue remains in the amendment scope.

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

This confirms repository and CI contract invariance. Runtime production activation and live-traffic parity were not performed.

## Unresolved contract

The following conversion is intentionally not implemented:

```text
mild / moderate / high
→ Skin legacy 0~5
```

Only observable absence is resolved to signal `0` with all three availability states true. Observed positive cues remain observation-available but quantisation-unresolved and legacy-signal-unavailable. Insufficient, unavailable, and unsupported inputs carry compatibility signal `0` with all three availability states false.

## Authoritative transition gate

The shadow adapter cannot replace current Skin signals until a fixed-field Provider cue contract, explicit absence, evidence-preserving normalisation, declared evaluation data, versioned quantisation candidates, concern/product/routine regression, separate approval, final Premium/Security stack integration, and explicit production activation review are complete.
