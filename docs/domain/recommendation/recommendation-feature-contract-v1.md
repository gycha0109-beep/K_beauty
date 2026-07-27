# Recommendation Feature V1 Canonical Contract

- Status: shadow integration only
- Schema: `recommendation-feature-v1`
- Shadow version: `recommendation-feature-shadow-20260727`

## 1. Verified baseline

Implementation base:

```text
codex/face-eval-1-calibration-harness
9bcade3fd27138ec8691865bc4c462c8e3f54ac7
PR #73 stacked on PR #72
```

Observed `main` at work start:

```text
3a8f113e07d2d629463af5ecf7f70624e47ce8df
```

The separate Skin/Premium stack was inspected at:

```text
PR #69
integration/premium-browser-journey-main-sec-baseline
eb041962edfbff311e938166078cbbf086cb2b5b
```

PR #69 diverges from the unified Vision/Face stack and does not contain `lib/vision-observation-contract.js`. It was not merged or copied speculatively. This shadow branch changes no Premium, storage, Skin scoring, product scoring, or routine result.

## 2. Layer boundary

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

```text
Atomic Observation
≠ Derived Feature
≠ Legacy Skin Axis
≠ Recommendation Result
```

Existing Provider `skin.signals` remain authoritative. Face Registry lifecycle, scoring weights, taxonomy, thresholds, and calibration governance remain unchanged. Every archetype decision remains `held`, `productionEligible: false`, and `decision: null`.

## 3. ObservationField

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

| Status | Value | Confidence | Evidence | Source |
|---|---|---|---|---|
| `available` | required | required | non-empty | `vision` |
| `insufficient_evidence` | `null` | optional | optional | `vision` or `null` |
| `unavailable` | `null` | null object | empty | `null` |
| `unsupported` | `null` | null object | empty | `null` |

Zero or `none` is valid only after observable absence. Missing, invalid, low-quality, and unsupported input never becomes absence.

## 4. Exact enums

### Image type

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
full_face | t_zone | forehead | nose | cheeks | chin | jawline | eye_area | unknown
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

Face CONDITIONAL:

```text
observedCheekboneProminence:
  subtle | moderate | prominent
```

The conditional field remains because the current Registry consumes it. It may remain unavailable.

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
→ observedAreas contains inspected regions

level !== none
→ affectedAreas is non-empty
→ affectedAreas is a subset of observedAreas
```

The current Provider returns a sparse list with `low | mild | moderate | high` and no explicit absence. Shadow normalisation therefore maps reported `low` to the lowest positive canonical level `mild`, never treats omission as absence, and keeps omitted cues `insufficient_evidence`. Structural evidence keys are derived from the normalised tuple because the current Skin normaliser does not preserve evidence text.

No Provider prompt change and no extra Provider call are introduced.

## 6. Derived suitability

Provider suitability remains comparison-only. Canonical suitability is deterministic.

### Face structure

`unsuitable` when face visibility is poor, yaw is profile, eye or jawline occlusion is heavy, or sharpness is blurred.

`limited` when no unsuitable condition applies and visibility is partial, scale is not adequate, pose is not frontal/level/level, eye or jawline occlusion is partial, or sharpness is soft.

Otherwise `suitable`.

### Skin texture

`unsuitable` when blurred, heavily filtered, heavily made up, or cheeks are heavily occluded.

`limited` when no unsuitable condition applies and sharpness is soft, lighting is harsh, filtering is possible or unknown, makeup is moderate or unknown, or cheeks are partially occluded.

Otherwise `suitable`.

### Skin colour

`unsuitable` when exposure is not balanced, lighting is harsh, white balance is mixed, filtering is heavy, or makeup is heavy.

`limited` when no unsuitable condition applies and lighting is uneven, white balance has a warm or cool cast, filtering is possible or unknown, or makeup is moderate or unknown.

Otherwise `suitable`.

Comparison evidence preserves Provider value, derived value, agreement, and `productionAffecting: false`.

## 7. Face adapter

Canonical fields are restored to existing scorer paths without reinterpretation. An existing field becomes available only with:

```text
canonical available
+ valid enum
+ numeric confidence score
+ non-empty evidence
```

All other fields become the semantically correct existing `insufficient_evidence` or `unavailable`. Canonical `unsupported` maps to existing `unavailable`, while canonical status remains in shadow metadata.

The adapter preserves numeric confidence, quality multiplier, evidence requirement, partial analysis, coverage, and held lifecycle.

## 8. Skin legacy shadow adapter

| Legacy axis | Shadow meaning only |
|---|---|
| `oiliness` | visible surface shine support |
| `dehydration` | visible dry-texture and flaking support |
| `redness` | visible red-appearance support |
| `acne` | visible localised-spot support |
| `pores` | visible pore-visibility support |
| `uneven_tone` | visible tone-variation support |
| `barrier` | conservative visible surface-stress support |
| `uv` | unsupported from a single photo |

These names are not diagnoses of skin type, dehydration, barrier damage, acne disease, sebum production, pore size, UV exposure, or UV damage.

Resolved mapping:

```text
available + none
→ signal 0
→ availability true
→ resolved_absence

insufficient_evidence / unavailable / unsupported
→ signal 0
→ availability false

available + mild / moderate / high
→ signal 0
→ availability false
→ unresolved_non_zero
```

Non-zero `0~5` quantisation remains unresolved. Existing direct signals remain authoritative.

## 9. Runtime integration

`analyzeVisionObservation()` performs the same single Provider image call and returns the same authoritative `bundle` and telemetry. It additionally computes `recommendationFeatureShadow` in memory.

Current routes continue reading only `observationResult.bundle`; the shadow object is not added to public responses, Premium payloads, saved reports, analytics, or logs. Shadow build failure returns a bounded non-authoritative descriptor and does not block existing Vision output.

## 10. Files

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

Unified Vision Static Guard runs these checks for the Draft PR.

## 12. Authoritative transition gate

Skin shadow output cannot become authoritative before:

1. fixed Provider cue fields with explicit `none`;
2. evidence-preserving Skin normalisation;
3. declared evaluation protocol;
4. versioned `mild / moderate / high → 0~5` policy candidates;
5. shadow comparison over a declared dataset;
6. concern, product, and routine regression review;
7. mapping approval in a separate PR;
8. final Premium/Security stack integration;
9. explicit production activation review.

## 13. Remaining risks

- Sparse Skin observations cannot prove absence for omitted cues.
- Skin evidence is currently a structural tuple rather than Provider evidence text.
- `low → mild` is compatibility normalisation, not severity calibration.
- Provider and deterministic suitability may disagree until evaluated.
- This branch is stacked on PR #73 while PR #69 remains a divergent stack.
- Real-photo stability and non-zero quantisation remain uncalibrated.
