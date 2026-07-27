# Recommendation Feature V1 Canonical Contract

Status: shadow integration only  
Schema: `recommendation-feature-v1`  
Shadow version: `recommendation-feature-shadow-20260727`

## 1. Verified repository baseline

The implementation branch was created from:

```text
codex/face-eval-1-calibration-harness
9bcade3fd27138ec8691865bc4c462c8e3f54ac7
```

The base was selected from the actual remote graph because it is the only reviewed stack containing all of the following at one commit:

- unified single-call Vision observation pipeline;
- Face Lab observation contract;
- Face archetype Registry, scorer, and held decision adapter from PR #72;
- governed offline calibration harness from PR #73.

The other inspected stack remains separate:

```text
PR #69
integration/premium-browser-journey-main-sec-baseline
eb041962edfbff311e938166078cbbf086cb2b5b
```

PR #69 is open and Draft, but its branch diverges from the Face stack and does not contain `lib/vision-observation-contract.js`. It was therefore not merged or copied speculatively into this shadow branch. Recommendation Feature V1 does not alter Premium, storage, Skin scoring, product scoring, or routine output. A later integration gate must reconcile the two stacks after their prerequisite PR order is resolved.

Observed main at work start:

```text
3a8f113e07d2d629463af5ecf7f70624e47ce8df
```

## 2. Product boundary

```text
Existing Image Eligibility
        ↓
Atomic Visual Observations
        ↓
Derived Recommendation Features
        ↓
Engine-specific Adapters
        ↓
Existing Recommendation Results
```

The layers are not interchangeable.

```text
Atomic Observation
≠ Derived Feature
≠ Legacy Skin Axis
≠ Archetype or recommendation result
```

This change is shadow-only.

- Existing Provider `skin.signals` remain authoritative for Skin Match.
- Existing concern weighting, product scoring, routine generation, Premium decisions, API response, and saved snapshots are unchanged.
- The Face Registry remains `rubric_ready` and `not_ready` for calibration.
- Archetype thresholds remain `null`.
- Every archetype result remains `held`, `productionEligible: false`, and `decision: null`.
- No additional Provider call is introduced.
- No image, crop, base64 value, or raw Provider response is persisted by the new path.

## 3. Observation field contract

```ts
type ObservationStatus =
  | "available"
  | "insufficient_evidence"
  | "unavailable"
  | "unsupported";

type ObservationConfidence = {
  level: "low" | "medium" | "high" | null;
  score: number | null;
};

type ObservationField<T> = {
  status: ObservationStatus;
  value: T | null;
  confidence: ObservationConfidence;
  evidence: string[];
  unavailableReason: string | null;
  source: "vision" | null;
};
```

Invariants:

| Status | Value | Confidence | Evidence | Source |
|---|---|---|---|---|
| `available` | required | required | at least one | `vision` |
| `insufficient_evidence` | `null` | optional | optional | `vision` or `null` |
| `unavailable` | `null` | null object | empty | `null` |
| `unsupported` | `null` | null object | empty | `null` |

A numeric zero or `none` is valid only when the cue was observable and absence was actually recorded. Missing, invalid, low-quality, and unsupported inputs never become zero or `none` in the canonical bundle.

## 4. Exact enum sets

### Eligibility image type

```text
photorealistic_human
non_photorealistic_human
product
animal
document
landscape
other
unknown
```

### Quality

```text
faceVisibility: clear | partial | poor
faceScale: adequate | small | too_large
yaw: frontal | slight_left | slight_right | profile_left | profile_right | unknown
pitch: level | up | down | unknown
roll: level | tilted | unknown
occlusion: none | partial | heavy
sharpness: clear | soft | blurred
exposure: balanced | underexposed | overexposed | mixed
lightingUniformity: even | uneven | harsh
whiteBalance: stable | warm_cast | cool_cast | mixed_cast | unknown
filterOrEditing: none_detected | possible | heavy | unknown
makeupCoverage: none_or_light | moderate | heavy | unknown
suitability: suitable | limited | unsuitable
```

### Skin area

```text
full_face
t_zone
forehead
nose
cheeks
chin
jawline
eye_area
unknown
```

### Face CORE

```text
observedFaceShape:
  oval | round | square | oblong | heart | diamond | triangle | mixed

observedFaceLengthBalance:
  short | balanced | long

observedEyeDirection:
  upturned | level | downturned | mixed

observedEyeLength:
  short | medium | long

observedEyeOpenness:
  narrow | medium | wide

observedJawlineAngularity:
  soft | moderate | angular

observedJawTaper:
  tapered | balanced | broad

observedFeatureScale:
  small | medium | large | mixed

observedFeatureConcentration:
  spread | balanced | centered

observedStraightCurveBalance:
  curved | balanced | straight

observedContourDefinition:
  soft | moderate | defined

observedFeatureContrast:
  low | medium | high
```

### Face CONDITIONAL

```text
observedCheekboneProminence:
  subtle | moderate | prominent
```

The conditional field remains in the schema because the current Registry consumes it. It may remain unavailable when pose, lighting, or visibility is insufficient.

## 5. Visible Skin cues

CORE:

```text
visibleSurfaceShine
visibleDryTexture
visibleRedness
visibleToneVariation
```

CONDITIONAL:

```text
visibleFlaking
visibleLocalizedSpots
visiblePores
```

Value:

```ts
type VisibleSkinCueValue = {
  level: "none" | "mild" | "moderate" | "high";
  observedAreas: SkinArea[];
  affectedAreas: SkinArea[];
};
```

Invariants:

```text
level === none
→ affectedAreas is empty
→ observedAreas contains the inspected regions

level !== none
→ affectedAreas has at least one item
→ affectedAreas is a subset of observedAreas
```

The current Provider contract has no explicit `none`; it returns `low | mild | moderate | high` in a sparse list. The shadow normalizer therefore:

- maps reported `low` to canonical `mild` as the lowest reported positive cue;
- never treats an omitted cue as absence;
- records omitted cues as `insufficient_evidence`;
- derives privacy-safe structural evidence keys from the normalized tuple because the current Skin normalizer does not preserve free-text evidence.

No Provider prompt change was made in this phase. This avoids changing the existing direct legacy output or increasing image-call cost and latency. A future Provider contract change must add fixed cue fields and explicit `none` before authoritative transition.

## 6. Deterministic derived suitability

Provider suitability is retained only as compatibility comparison input. Canonical derived suitability is computed from Atomic quality observations.

### Face structure

`unsuitable` when any applies:

- face visibility is poor;
- yaw is profile-left or profile-right;
- eye or jawline occlusion is heavy;
- sharpness is blurred.

`limited` when no unsuitable condition applies and any applies:

- face visibility is partial;
- face scale is not adequate;
- pose is not frontal/level/level;
- eye or jawline occlusion is partial;
- sharpness is soft.

Otherwise `suitable`.

### Skin texture

`unsuitable` when any applies:

- blurred;
- heavy filter/editing;
- heavy makeup coverage;
- heavy cheek occlusion.

`limited` when no unsuitable condition applies and any applies:

- soft sharpness;
- harsh lighting;
- possible or unknown filtering;
- moderate or unknown makeup;
- partial cheek occlusion.

Otherwise `suitable`.

### Skin colour

`unsuitable` when any applies:

- exposure is not balanced;
- lighting is harsh;
- white balance is mixed;
- filter/editing is heavy;
- makeup is heavy.

`limited` when no unsuitable condition applies and any applies:

- lighting is uneven;
- white balance has a warm or cool cast;
- filtering is possible or unknown;
- makeup is moderate or unknown.

Otherwise `suitable`.

Shadow comparison preserves:

- Provider value;
- derived value;
- agreement or disagreement;
- production-affecting flag fixed to `false`.

## 7. Face adapter

The adapter restores canonical fields to the existing scorer paths without changing value meaning, Registry weights, taxonomy, or thresholds.

An existing field becomes `available` only when:

```text
canonical status available
+ enum value valid
+ numeric confidence score present
+ evidence non-empty
```

Otherwise it becomes the semantically matching existing `insufficient_evidence` or `unavailable` field. Canonical `unsupported` maps to existing `unavailable`, while the original canonical status remains in shadow metadata.

The adapter preserves:

- numeric field confidence;
- quality multiplier;
- evidence requirement;
- partial analysis;
- coverage;
- hold behaviour;
- `productionEligible: false`;
- `decision: null`.

## 8. Skin legacy shadow adapter

Meaning mapping:

| Legacy axis | Canonical support meaning |
|---|---|
| `oiliness` | visible surface shine support |
| `dehydration` | visible dry-texture/flaking support |
| `redness` | visible red-appearance support |
| `acne` | visible localised-spot support |
| `pores` | visible pore-visibility support |
| `uneven_tone` | visible tone-variation support |
| `barrier` | conservative visible surface-stress support |
| `uv` | unsupported from a single photo |

These names must not be interpreted as skin type, actual dehydration, barrier damage, acne disease, sebum production, actual pore size, UV exposure, or UV damage.

Resolved mapping in this phase:

```text
available + level none
→ signal 0
→ availability true
→ quantizationStatus resolved_absence

insufficient_evidence / unavailable / unsupported
→ signal 0
→ availability false

available + mild / moderate / high
→ signal 0
→ availability false
→ quantizationStatus unresolved_non_zero
```

The non-zero `0~5` quantisation is intentionally unresolved. Existing direct Provider signals remain authoritative. The shadow adapter records direct-vs-shadow comparison evidence but does not enter Skin concern scoring.

## 9. Runtime integration

`analyzeVisionObservation()` still performs one Provider image call and returns the same authoritative `bundle` and telemetry. It additionally computes `recommendationFeatureShadow` in memory.

The `/api/analyze` and `/api/face-reading` consumers continue reading only `observationResult.bundle`; the shadow object is not added to public API responses, Premium payloads, saved reports, analytics, or logs.

Shadow failure is fail-open relative to existing production behaviour: it returns a bounded invalid shadow descriptor and never blocks the current Vision bundle.

## 10. Changed files

```text
lib/recommendation-feature-contract.js
lib/recommendation-feature-normalizer.js
lib/recommendation-feature-derived.js
lib/recommendation-feature-adapters.js
lib/recommendation-feature-shadow.js
lib/server/vision-observation-service.js
scripts/verify-recommendation-feature-contract.mjs
scripts/verify-recommendation-feature-adapters.mjs
package.json
.github/workflows/unified-vision-static-guard.yml
docs/domain/recommendation/recommendation-feature-contract-v1.md
docs/verification/recommendation-feature-v1-shadow-evidence.json
```

## 11. Verification

Required commands:

```text
npm run verify:recommendation-feature-shadow
npm run verify:unified-vision-pipeline
npm run verify:face-lab-archetype-scoring
npm run verify:face-lab-archetype-calibration
npm run face-lab:eval:verify
npm run face-lab:e2e:verify
node scripts/verify-analysis-request-guard.mjs
node scripts/verify-provider-runtime-log-sanitization.mjs
node scripts/verify-anonymous-write-grant-v2.mjs
node scripts/verify-analysis-rls-contract.mjs
npm run architecture:guard
npm run build
git diff --check
```

The Unified Vision Static Guard runs these checks for the Draft PR.

## 12. Authoritative transition gate

The Skin shadow adapter must not become authoritative until all are complete:

1. fixed-field Provider cue contract with explicit `none`;
2. evidence-preserving Skin normalisation;
3. consented or synthetic evaluation protocol appropriate to each cue;
4. versioned `mild / moderate / high → 0~5` policy candidates;
5. shadow comparison over a declared dataset;
6. concern-priority and product/routine regression review;
7. threshold and mapping approval in a separate PR;
8. integration with the final Premium/Security stack;
9. explicit production activation review.

## 13. Remaining risks

- The current sparse Skin observation list cannot prove absence for omitted cues.
- Current Skin evidence is a structural tuple, not Provider free-text evidence.
- `low → mild` is a compatibility normalisation for a reported positive cue, not severity calibration.
- Provider and deterministic suitability may disagree until evaluated.
- The Recommendation Feature branch is stacked on PR #73, while PR #69 remains a separate divergent stack.
- Real-photo stability, Skin cue reliability, and non-zero quantisation remain uncalibrated.
