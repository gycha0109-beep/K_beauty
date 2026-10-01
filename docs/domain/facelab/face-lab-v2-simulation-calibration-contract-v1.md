# Face Lab V2 Simulation Calibration Campaign Contract v1

> Track: Face Lab / Gate G-E0
> Status: calibration campaign foundation
> Provider invocation: none
> Production fidelity promotion: prohibited

## Purpose

Gate G-E0 converts completed Gate G evidence into privacy-reduced calibration records and aggregate statistics.

It does not generate images and it does not define campaign-level quality thresholds.

## Required evidence chain

One admitted calibration case requires all three artifacts:

1. a ready Gate G-B simulation evidence packet,
2. a ready Gate G-C Identity / Edit Scope review,
3. a ready Gate G-D Route / Color review.

The Gate G-B packet must already be fully evaluated. No required check may remain NOT_EVALUATED.

The packet must reference the exact G-C and G-D response digests for their contributed check IDs.

## Privacy reduction

A persistent calibration case must not retain:

- raw source image bytes,
- raw generated image bytes,
- source image SHA-256,
- output image SHA-256,
- analysis SHA-256,
- Face Lab state SHA-256,
- reviewerRef,
- local filesystem paths.

The case retains a one-way intentBindingDigest computed from source-image SHA-256 plus Render Spec SHA-256. This permits repeat-group consistency checks without storing either raw hash independently.

## Repeat generation binding

intentGroupId identifies repeated generations intended to share the same source image and Render Spec.

generationIndex starts at 1 and must be unique inside an intent group.

Campaign aggregation rejects a repeat group if its intentBindingDigest or Render Spec digest changes between generations.

This prevents unrelated outputs from being counted as same-intent variance.

## Cohort metadata

Each case records:

- changeIntensity: minimal / light / moderate / high,
- routeSelectionState: user_selected / single_route_auto,
- whether color intent exists,
- Render Spec operation count.

These are cohort labels, not quality scores.

## Calibration case observations

The privacy-reduced case may retain categorical Human review observations needed for campaign aggregation:

- Identity dimension responses,
- Edit Scope dimension responses,
- Route operation responses,
- Color target responses.

Reviewer identity and raw image material are omitted.

## Calibration case evaluation

The case retains:

- final verdict,
- four check statuses,
- bounded failure findings containing check ID, taxonomy code, target reference, severity, and failure source.

Free-text finding notes and raw finding evidence references are not retained.

## Campaign aggregate

The aggregate reports:

- case count,
- intent-group count,
- repeat-group count,
- PASS / REVIEW / FAIL counts,
- per-check status counts,
- hard-failure case count,
- failure taxonomy counts,
- failure-source counts,
- cohort counts,
- Identity / Edit Scope distributions,
- Route operation distributions,
- Color operation distributions.

Color denominators naturally exclude no-color cases because those cases have no color-target response entries.

## Repeat variance

For groups with at least two generations, the aggregate reports disagreement counts for:

- final verdict,
- the four-check status vector,
- Route operation responses,
- Color target responses.

Disagreement under the same intent binding is a variance signal only. It must not automatically be attributed to the provider.

## Local case-builder manifest

A private manifest supplies:

- campaignId,
- intentGroupId,
- generationIndex,
- changeIntensity,
- routeSelectionState,
- evidencePacketPath,
- identityScopeReviewPath,
- routeColorReviewPath.

Run:

    node scripts/build-face-lab-v2-simulation-calibration-case.mjs ./private/case-manifest.json

The command writes JSON to stdout only.

## Aggregate manifest

A private campaign manifest supplies campaignId and a list of local casePaths.

Run:

    node scripts/aggregate-face-lab-v2-simulation-calibration.mjs ./private/campaign.json

The command writes the aggregate JSON to stdout only.

## Repository boundary

The repository already ignores the root private directory.

Actual face images, generated images, private manifests, completed Human review artifacts, and per-user UAT material belong under that ignored local boundary.

Only explicitly reviewed privacy-reduced calibration cases or aggregate reports may be considered for durable storage.

## No threshold invention

Gate G-E0 defines no campaign-level quality threshold.

Identity major drift and major Edit Scope leak remain case-level hard failures only because Gate G-A already established those semantics.

Campaign promotion thresholds require real pilot and calibration evidence.

## Next phase

Gate G-E1 should add a test-only UAT review panel that emits G-C/G-D-compatible review JSON without turning the browser into Render Spec or evaluation authority.

Gate G-E2 then runs the first 6-8 output pilot through this campaign pipeline.
