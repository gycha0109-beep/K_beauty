# Face Lab Photo Geometry Measurement Bridge v0

> Track: FACE LAB / R-F Face Representation + R-3D Parametric Lab  
> Status: research contract / no Production authority  
> Scope: photo-side metric landmarks → backend-independent structural measurement

## 1. Purpose

Face Lab의 사진측 구조와 3D backend 구조를 **같은 의미의 measurement layer**에서 만나게 한다.

```text
photo
→ landmark / geometry provider
→ pose-normalized metric geometry
→ Photo Geometry Measurement Bridge
→ raw structural measurement
→ future normalization
→ Normalized Face Representation / Face Space

Face Space target
→ GNM / other 3D adapter
→ mesh
→ structural measurement
→ round-trip
```

이 bridge는 Archetype classifier가 아니며 Face Space calibration도 아니다.

## 2. Why a measurement bridge

다음 두 가지를 직접 연결하지 않는다.

```text
MediaPipe landmark index
≠ GNM sparse-68 landmark index

GNM latent coefficient
≠ Face Space semantic axis
```

Provider마다 topology와 native parameter가 다르기 때문에 내부 authority는 provider index나 latent coefficient가 아니라 **versioned structural measurement semantics**에 둔다.

## 3. MediaPipe geometry boundary

Reviewed upstream:

```text
google-ai-edge/mediapipe@20e8f2ae3365d46fa02037b54911b72e13494809
```

Pinned canonical model blob:

```text
mediapipe/modules/face_geometry/data/canonical_face_model.obj
blob 0e666d1c4e75949d1639c2bcf347a38da4834164
```

Upstream Face Geometry contract establishes:

- a 468-landmark topology;
- a right-handed metric 3D space;
- a canonical face model whose default metric unit is centimeter;
- a rigid pose transform between canonical and runtime geometry;
- a pipeline that converts screen landmarks to metric landmarks and then applies the inverse pose transform to align runtime geometry to canonical metric space.

Therefore v0 accepts only:

```text
pose_normalized_metric_3d
```

It explicitly rejects raw Face Landmarker screen-normalized XYZ. The upstream Face Mesh contract documents screen X/Y as normalized coordinates and Z as relative under a weak-perspective camera model, so those values are not treated as backend-independent metric structure.

## 4. v0 MediaPipe anchor map

The adapter uses selected vertices from the official 468 topology.

```text
face_left_lateral   234
face_right_lateral  454

lower_face_left     172
lower_face_right    397
chin                152
nose_base_center     94

right_eye_outer      33
right_eye_inner     133
left_eye_inner      362
left_eye_outer      263

nose_left_alar       98
nose_right_alar     327
```

These IDs are a **Face Lab adapter choice over official topology**, not an official MediaPipe ↔ GNM correspondence.

Any change to the anchor map creates a new adapter/mapping version and must not rewrite prior evidence.

## 5. v0 structural measurements

Normalizer:

```text
face_width_reference
= 3D distance(234, 454)
```

Measurements:

```text
lower_face_width_ratio
= distance(172, 397) / face_width_reference

chin_height_ratio
= distance(94, 152) / face_width_reference

eye_spacing_ratio
= distance(133, 362) / face_width_reference

eye_width_ratio
= mean(distance(33,133), distance(362,263)) / face_width_reference

eye_tilt
= bilateral mean outer→inner eye angle
  in pose-normalized metric XY

nose_width_ratio
= distance(98,327) / face_width_reference
```

The output unit is raw `ratio` or `degree`.

This is deliberately **not** `normalized_ratio_v0`. Population/reference normalization is a later versioned transformation and cannot be invented from one canonical model or one 3D backend.

## 6. Contract files

```text
lib/face-lab-photo-geometry-research.js

evidence/facelab/photo-geometry/v0/
  mediapipe-face-geometry.manifest.json
  mediapipe-canonical-landmarks.fixture.json

scripts/verify-face-lab-photo-geometry-bridge.mjs
```

The canonical landmark fixture contains only selected public model vertices. It is not a person photo or evaluation subject.

## 7. Fail-closed rules

The bridge rejects:

- anything other than exactly one face;
- raw screen-normalized landmark packets;
- packets not marked pose-normalized metric geometry;
- missing required structural anchors;
- unpinned provider version;
- source image bytes / base64 / crop payloads;
- identity embeddings;
- silent provider-version mismatch.

No missing structural dimension is filled by Vision prose or a default value.

## 8. Relationship to current Vision observation

Current `FaceLabObservationAnalysis` remains a qualitative observation contract.

Examples:

```text
eyeDirection = upturned | level | downturned | mixed
faceLengthBalance = short | balanced | long
jawlineAngularity = soft | moderate | angular
```

The photo geometry bridge is a separate quantitative research channel.

It does not overwrite current Vision observations and does not automatically convert a numeric ratio into an existing enum. Numeric→enum boundaries require independent calibration.

Future evidence can compare:

```text
quantitative geometry measurement
vs
blind Vision observation
vs
Human cue judgment
```

without making any one source the automatic truth.

## 9. Current fixture result

The official MediaPipe canonical face fixture currently measures approximately:

```text
lower_face_width_ratio  0.775102
chin_height_ratio       0.386024
eye_spacing_ratio       0.242222
eye_width_ratio         0.173257
eye_tilt                 0.000000°
nose_width_ratio        0.183402
```

These numbers validate deterministic measurement behavior only. They are not population means, ideal-face values, Archetype centers, or recommendation thresholds.

## 10. Next executable gate

The next photo-side gate is not “feed raw 478 landmarks into GNM.”

It is:

```text
real/synthetic image
→ MediaPipe Face Landmarker
→ metric Face Geometry reconstruction
→ inverse-pose-aligned 468 geometry
→ this measurement bridge
→ nuisance/stability tests
```

Required diagnostics before any Production consideration:

- repeated-run determinism;
- resize/compression stability;
- small crop/translation stability;
- camera/perspective sensitivity;
- yaw/pitch/roll residual sensitivity after pose normalization;
- expression sensitivity;
- missing/occluded landmark behavior;
- cross-provider or 3D-backend comparison.

## 11. Production boundary

v0 does not authorize:

- user-photo persistence;
- Production photo geometry;
- identity recognition;
- identity embedding;
- Archetype activation;
- Face Space calibration;
- style recommendation;
- demographic inference;
- direct MediaPipe-index → GNM-index correspondence.

The bridge is research infrastructure for making photo-side and 3D-side structural claims testable.
