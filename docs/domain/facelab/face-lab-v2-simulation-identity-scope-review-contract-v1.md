# Face Lab V2 Identity & Edit Scope Human Review Contract v1

> Track: Face Lab / Gate G-C
> Status: calibration evidence producer
> Visual authority: Human review only
> Automated identity recognition: none
> Production authority: none

## 1. Purpose

Gate G-C produces the first real visual evidence for two hard-safety dimensions:

1. Identity Preservation
2. Edit Scope

The reviewer compares the existing Before / Simulation images in the Face Lab UAT surface.

This contract deliberately does not use an automated face-recognition score as authority. Early calibration must not convert an uncalibrated similarity model into a PASS/FAIL decision.

## 2. Identity dimensions

Every review must classify all five protected structural dimensions:

- `facial_geometry`
- `eye_anatomy`
- `nose_geometry`
- `jaw_chin_geometry`
- `ear_geometry`

Allowed values:

- `stable`
- `minor_drift`
- `major_drift`
- `not_assessable`

Any `major_drift` produces Identity FAIL with `IDENTITY_MAJOR_DRIFT`.

If no major drift exists but any dimension is `not_assessable`, Identity remains NOT_EVALUATED.

If every dimension is assessable and one or more is `minor_drift`, Identity is REVIEW with `IDENTITY_MINOR_DRIFT`.

All stable produces PASS.

## 3. Protected edit-scope dimensions

Every review must classify:

- `face_structure`
- `background`
- `clothing`
- `body`
- `head_pose`
- `camera_perspective`
- `expression`
- `lighting_direction`
- `unrequested_beautification`

Allowed values:

- `unchanged`
- `minor_change`
- `major_change`
- `not_assessable`

## 4. Edit-scope mapping

Major changes to face structure, background, clothing, body, head pose, camera perspective, expression, or lighting direction are hard failures and map to the corresponding Gate G-A `SCOPE_*` taxonomy code.

Minor protected changes map to `OVER_EDITED` and produce REVIEW.

Unrequested beautification is not a hard failure in v1. Minor or major observed beautification maps to `SCOPE_UNREQUESTED_BEAUTIFICATION` and produces REVIEW.

If any required scope dimension is `not_assessable` and no hard major change is already visible, Edit Scope remains NOT_EVALUATED.

## 5. Causal attribution

Human visual review observes the output difference, not its root cause.

Gate G-C findings therefore use:

~~~text
failureSource = evaluation_uncertain
~~~

They must not automatically blame the Render Spec, instruction builder, or provider.

## 6. Complete-response requirement

All dimensions must be present.

Unknown dimensions or unknown enum values invalidate the review.

This prevents a partial form from silently becoming a PASS.

## 7. Reviewer reference

`reviewerRef` is required but should be pseudonymous.

Examples:

~~~text
operator-01
human-calibration-a
self-review-01
~~~

Do not put a real name, email address, or account identifier into repository evidence.

## 8. Response sealing

The normalized response receives a deterministic SHA-256 `responseDigest`.

The digest covers contract version, case ID, reviewer reference, all Identity responses, and all Edit Scope responses.

It does not contain image bytes.

## 9. Local CLI

A private review JSON can be transformed with:

~~~bash
node scripts/build-face-lab-v2-simulation-identity-scope-review.mjs ./private/G-001.identity-scope.json
~~~

The output contains normalized responses, diagnostics, and only the two Gate G checks produced by this gate.

## 10. Gate G-B integration

The simulation evidence runner accepts local `checkEvidencePaths`.

Each file may contain either a `checks` object or a direct object keyed by Gate G check ID.

The runner merges supplied check fragments over its pending defaults.

Gate G-C can therefore provide Identity/Edit Scope while Route/Color remain NOT_EVALUATED until Gate G-D.

Local paths never enter the evidence packet.

## 11. Interpretation boundary

Gate G-C measures visible preservation and forbidden-scope changes on the reviewed image pair.

It does not establish biometric identity certainty, user attractiveness, demographic fairness, provider root cause, or real-world outcome prediction.

## 12. Next gate

Gate G-D adds Route Adherence and Color Fidelity evidence.

Only once all applicable checks are evaluated can a simulation packet resolve to PASS or REVIEW instead of NOT_EVALUATED.
