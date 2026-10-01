# Face Lab V2 Simulation Evaluation Contract v1

> Track: Face Lab / Gate G-A
> Status: deterministic evaluation foundation
> Authority ceiling: evidence adjudication only; no automatic visual-quality authority

## 1. Question

Gate G asks whether a generated Face Lab simulation faithfully executes an already-authorized styling intent without changing the user's identity or editing unrelated regions.

This contract does **not** decide whether an image is attractive. It decides whether supplied evaluation evidence is internally consistent and whether that evidence implies PASS, REVIEW, FAIL, or NOT_EVALUATED.

The required checks are:

1. `identity_preservation`
2. `route_adherence`
3. `color_fidelity`
4. `edit_scope`

## 2. Authority boundary

v1 deliberately separates **evidence production** from **verdict adjudication**.

CI may:

- validate evidence structure,
- bind evidence to the exact Render Spec route/look/version,
- validate failure taxonomy,
- apply deterministic hard-gate rules,
- replay synthetic fixtures.

CI may not:

- call an image provider,
- inspect or store real face photos,
- claim visual identity preservation from synthetic metadata,
- infer aesthetic quality,
- promote `not_evaluated` to PASS without evidence.

Real-image evaluation is a later UAT/calibration surface.

## 3. Evidence packet

Repository-safe evidence contains hashes and structured observations only.

~~~text
caseId
simulationVersion
sourceImageSha256
outputImageSha256
renderSpecVersion
routeId
lookId
checks
~~~

Raw source or generated face images are not part of the repository contract.

Every packet must bind to the exact simulation version and Render Spec used to generate the simulation.

A simulation-version, route, look, or Render Spec version mismatch invalidates the packet instead of producing a quality verdict. SHA-256 values must be exact 64-hex digests; overlong values are rejected rather than truncated.

## 4. Check states

Each check uses one of:

- `pass`
- `review`
- `fail`
- `not_evaluated`
- `not_applicable`

`not_applicable` is allowed only for `color_fidelity`, and only when the Render Spec contains no color authority or color-semantic intent.

PASS, NOT_EVALUATED, and NOT_APPLICABLE cannot carry failure findings.

REVIEW and FAIL must contain at least one taxonomy-backed finding.

## 5. Failure taxonomy

### Identity

- `IDENTITY_MAJOR_DRIFT` — hard
- `IDENTITY_MINOR_DRIFT` — review

### Route execution

- `ROUTE_OPERATION_MISSED` — review
- `ROUTE_OPERATION_CONTRADICTED` — review
- `UNDER_EDITED` — review

### Color

- `COLOR_OFF_TARGET` — review

### Edit scope

- `SCOPE_FACE_STRUCTURE` — hard
- `SCOPE_BACKGROUND` — hard
- `SCOPE_CLOTHING` — hard
- `SCOPE_BODY` — hard
- `SCOPE_HEAD_POSE` — hard
- `SCOPE_CAMERA_PERSPECTIVE` — hard
- `SCOPE_EXPRESSION` — hard
- `SCOPE_LIGHTING_DIRECTION` — hard
- `SCOPE_UNREQUESTED_BEAUTIFICATION` — review
- `OVER_EDITED` — review
- `PROVIDER_ARTIFACT` — review
- `IMAGE_QUALITY` — review

A finding may only appear under its registered check.

Every finding also carries one failure-source classification:

- `render_spec`
- `instruction_builder`
- `provider`
- `evaluation_uncertain`

When the evaluator cannot support a causal attribution, it must use `evaluation_uncertain` rather than assigning blame to the provider. Provider-specific artifact/quality findings may default to `provider`.

Hard findings require that check to be FAIL.

Conversely, Identity Preservation or Edit Scope cannot be marked FAIL using review-only findings. A hard-gate FAIL must be backed by at least one hard-taxonomy finding.

## 6. Hard gates

The first hard gates are intentionally narrow.

Overall FAIL occurs when:

- `identity_preservation = fail`, or
- `edit_scope = fail`, or
- any hard-taxonomy finding is present.

This prevents strong route/color performance from averaging away an identity or major scope failure.

Route or color failures do not become hard failures in v1. They produce REVIEW unless a separately versioned contract later promotes a threshold.

## 7. Overall verdict

After evidence validation:

~~~text
identity/edit-scope hard failure
  -> FAIL

otherwise any required check not evaluated
  -> NOT_EVALUATED

otherwise any REVIEW or non-hard FAIL
  -> REVIEW

otherwise
  -> PASS
~~~

No numeric average is used.

## 8. Color applicability

Color evaluation is required only when at least one Render Spec operation contains color authority or color-semantic intent.

Examples include:

- semantic palette direction,
- product/shade color authority,
- swatch or applied-reference authority.

A hair-shape-only simulation may therefore mark color as NOT_APPLICABLE.

## 9. Calibration boundary

This contract does not establish real-world thresholds.

Gate G-B/G-C/G-D must later provide real-image evidence for:

- structural identity drift,
- operation execution,
- color adherence,
- unrequested edit scope.

Only after calibration may deterministic thresholds be promoted into a new version.

## 10. Privacy and repository policy

Real face images must not be committed as evaluation fixtures.

Persistent repository evidence should use:

- case ID,
- source image SHA-256,
- output image SHA-256,
- route/look identity,
- structured findings,
- evaluator/version metadata added by later gates.

This permits replayable accounting without treating the repository as a face-image store.

## 11. CI contract

The verifier must prove at minimum:

- all four checks are required,
- PASS fixture resolves to PASS,
- identity hard failure resolves to FAIL,
- major edit-scope failure resolves to FAIL,
- route/color quality failures resolve to REVIEW in v1,
- incomplete evidence remains NOT_EVALUATED,
- color NOT_APPLICABLE is rejected when color intent exists,
- unknown or cross-dimension failure codes are rejected,
- unknown failure-source classifications are rejected,
- supported failure-source attribution is preserved,
- simulation-version drift and malformed/overlong image hashes are rejected,
- hard-gate FAIL cannot be created from review-only findings,
- evidence cannot silently target a different route/look/Render Spec,
- evaluation output contains no raw image bytes or provider payload.

## 12. Next gate

Gate G-B adds an evidence runner and packet serialization.

Gate G-C adds Identity Preservation and Edit Scope evidence production.

Gate G-D adds Route Adherence and Color Fidelity evidence production.

The `fidelity: not_evaluated` simulation state must not be promoted before those evidence-producing gates are calibrated.
