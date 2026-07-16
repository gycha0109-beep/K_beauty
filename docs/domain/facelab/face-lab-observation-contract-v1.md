# Face Lab Observation Contract v1

## Status

This contract defines the canonical, locale-neutral observation boundary used before archetype and styling decisions. `/api/face-reading` now collects this contract in shadow mode while preserving the current legacy display payload.

## Responsibility

Vision may return only image quality and visible facial-structure observations inside `observation_analysis`. It must not return archetypes, animal types, affinity scores, personality, physiognomy, celebrity similarity, hair, makeup, color palettes, clothing, or final look recommendations in that canonical section.

The same provider call may still return the existing `base_data` and `features` fields during the transition period. Those fields remain legacy display inputs only.

## Canonical analysis

`FaceLabObservationAnalysisV1` uses schema version `face-lab-observation-v1` and contains:

- model and prompt version metadata
- aggregate status: `available`, `partial`, `insufficient_evidence`, or `unavailable`
- normalized image quality
- field-level observations
- deterministic coverage
- warnings
- `privacy.sourceImagePersisted: false`

The object must never contain image bytes, data URLs, image URLs, crops, buffers, or identity claims.

## Field contract

Every observation field contains:

```js
{
  status: "available" | "insufficient_evidence" | "unavailable",
  source: "vision" | null,
  confidence: number | null,
  evidence: string[],
  unavailableReason: string | null,
  value: unknown | null
}
```

An available field requires a closed enum value, visible evidence, and deterministic confidence. Invalid enum values or missing evidence fail only that field. They are never replaced with defaults.

## Observation groups

- `outline`: face shape, forehead/cheek/jaw width relation, jaw angularity and taper, cheekbone prominence
- `vertical`: face length, forehead, midface, and lower-face length balance
- `eyes`: direction, length, and openness
- `featureLayout`: scale, concentration, and focal features
- `visualLanguage`: straight/curve balance, contour definition, and feature contrast
- `colorAppearance`: apparent temperature, brightness, and saturation

Color appearance is photo-relative and is not a personal-color season or definitive undertone diagnosis.

## Quality boundary

Quality records face visibility and scale, pose, regional occlusion, sharpness, exposure, lighting uniformity, white balance, possible editing, makeup coverage, structure suitability, and color suitability.

Color may be unavailable while structural observations remain available. Eligibility remains the preceding hard gate and requires exactly one photorealistic human face.

## Confidence

Vision does not return numeric confidence. The server derives observation availability confidence from visibility and quality suitability. This value is not a probability and is not shown as a user percentage.

## Coverage

Core group minimums are:

- outline: 3 fields
- vertical: 2 fields
- eyes: 2 fields
- feature layout: 1 field
- visual language: 2 fields

All five core groups meeting their minimum yields `available`; three or four yields `partial`; fewer yields `insufficient_evidence`. Archetype scoring will apply separate type-specific thresholds later.

## Route shadow integration

The route uses one Vision request. The provider response contains:

```text
eligibility
observation_analysis
base_data
features
```

The server normalizes only `observation_analysis` into `data.analysis`. Raw `observation_analysis`, unknown provider keys, image payloads, and provider metadata are not returned to the client.

The legacy envelope status remains authoritative during shadow mode:

- canonical success does not promote a legacy failure
- canonical insufficiency does not downgrade a legacy success
- eligibility failure returns `data: null` and skips canonical construction

For a legacy insufficient result, the response is reconstructed through an allowlisted projection instead of spreading the provider payload.

## Locale boundary

`eligibility` and `observation_analysis` use English keys, enum tokens, and short English evidence for every locale. Only the legacy `base_data` and `features` display text follows the requested Korean or English locale.

## Legacy boundary

Current `base_data`, `features`, and `structured.mood/color/style` remain legacy display inputs only. They are not canonical observations and must not be used by the future archetype engine. `presentation_hint`, embedding descriptors, tendency text, celebrity matching, and generated style recommendations are excluded from the canonical contract.

## Current implementation boundary

Implemented:

- pure observation prompt contract and rules
- quality and field normalizers
- deterministic confidence and coverage
- canonical bundle validator and image-payload rejection
- strict envelope accessor for `data.analysis`
- one-call `/api/face-reading` shadow integration
- safe allowlisted projection for legacy insufficient responses
- focused verifier

Still deferred:

- switching free or Premium displays to canonical data
- archetype scoring and styling engines
- hosted real-photo fixture calibration
- removing the legacy provider payload
