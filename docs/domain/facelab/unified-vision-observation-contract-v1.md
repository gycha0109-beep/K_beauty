# Unified Vision observation contract v1

## Purpose

The application performs one image-bearing Provider request per analysis. That request returns a canonical Vision observation bundle; skin analysis and Face Lab are deterministic projections of the same validated bundle.

## Runtime boundary

- `lib/server/vision-observation-service.js` is the only production module that constructs an image-bearing Provider request.
- The request is bounded by timeout, redirect rejection, and response-size limits, and has no automatic retry.
- Provider failures fail closed. They may preserve survey-only recommendations, but must not create canonical image evidence.
- Provider responses are normalized before projection. Raw Provider responses and source images are not persistence inputs.

## Canonical projection

- `projectSkinObservation` adds survey alignment after Provider observation; survey answers are not part of the image prompt.
- `projectFaceLabResult` exposes evidence-backed observations only when image and structural eligibility pass.
- Face Lab observation is not a physiognomy, celebrity-similarity, archetype, recommendation-shadow, calibration, or skin-quantization contract.
- Free and Premium paths consume the same canonical Face Lab envelope. Premium presentation may add diagnostics, but cannot replace the canonical result.

## Privacy and persistence

- General analysis does not persist the source image or raw Provider response.
- Anonymous persistence stores only the bounded image-eligibility decision alongside the existing canonical result fields.
- Face Lab stays outside the anonymous result fingerprint and snapshot persistence unless a separately reviewed storage contract is introduced.
- Logs and CI artifacts contain only bounded, sanitized metadata.

## Verification boundary

- Unified Vision Static Guard checks single-call ownership, schema normalization, projection, eligibility, logging, architecture, and production build without a Provider call.
- Local Supabase Replay Guard checks the current migration chain and anonymous database boundary against an isolated local project.
- Mobile analyze coverage mocks `/api/analyze` and blocks external network access.
- Face Lab Provider E2E is the only durable live-Provider path. It is manual or restricted to `provider-validation/face-lab` trigger-file pushes.
