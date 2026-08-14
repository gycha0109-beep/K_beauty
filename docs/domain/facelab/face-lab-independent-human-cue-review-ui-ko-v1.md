# Face Lab Independent Human Cue Review UI — Korean Offline v1

## Purpose

This gate adds a reviewer-friendly Korean UI over the already sealed D2D-P packets. It does not execute Human review, bind reviewer identities, reveal generation intent, compute consensus, change scoring, call a Provider, or unlock W2.

Generation intent, generated visible fact, Vision observation, Human cue judgment, Archetype score, Human consensus, calibration truth, and production activation remain separate authorities.

## Authority and Source Boundary

- UI version: `face-lab-independent-human-cue-review-ui-ko-20260814-v1`
- Source main: `61d9d40db0f7fdac9aa2db1b68cad259f11e6ec0`
- Source protocol: `face-lab-independent-human-cue-audit-20260814-v1`
- Source packet authority digest: `1f344a9d1cbd8e8ac6076b06da7780d213ff6ff71df80ea7a9f818617965339c`
- Definition contract digest: `8e630605ece0629da6a51e30829297688c27f10a3a92be6a3c8e3413f546bb46`

The source `cx1g-d2d-p` root is read-only. The builder snapshots every source file by relative path, SHA-256, and byte length before work and asserts the same snapshot after work. Reviewer order, review item identifiers, packet digests, and definition projection digests are copied exactly into a new ignored `cx1g-d2d-ui1` distribution root.

## Reviewer Experience

The file `review.html` runs directly under `file://` without a server. All reviewer-visible UI copy, cue labels, response labels, confidence labels, reasons, and detailed operational definitions are Korean. Canonical English enum values remain internal machine values.

Each reviewer sees one image at a time:

- first evaluation: 14 images with the exact eight Part A axes;
- second evaluation: 14 images with the exact two Part B axes;
- `featureContrast` is absent.

The image remains visible beside the cue cards on laptop and desktop layouts. Detailed definitions are collapsed by default. The UI has no timer, external font, remote asset, remote script, analytics, browser permission, or network transport.

## Independence and Progress

All eight frozen protocol attestation fields must be acknowledged before starting. The screen collects no real name. The acknowledgment means every corresponding `*Known` or `*Seen` field remains `false` in the candidate response.

Progress is automatically stored in `localStorage`. The key binds protocol version, reviewer slot, Part A packet digest, and Part B packet digest so different reviewer packets cannot collide. A page cannot advance until every current cue is structurally valid:

- concrete response: `low`, `medium`, or `high` confidence;
- `uncertain`: `low` or `medium` confidence only;
- `not_assessable`: `not_applicable` confidence plus at least one canonical reason code.

Evidence tags remain optional and are omitted from the v1 interaction surface. Exported judgments retain an empty canonical `evidenceTags` array.

## Export Boundary

The neutral download name is `review-response-R0N.json`. The exported object binds protocol and UI versions, reviewer slot, both source packet digests, a browser-local review session identifier, the exact independence attestation fields, canonical-token judgments, and a completion timestamp.

The merged protocol does not freeze a combined top-level A+B submitted-response seal. Therefore the UI exports `execution_candidate_response` under `face-lab-independent-human-cue-execution-candidate-response-v1`. It is not permanent Human authority. Future D2D-X logic must validate, canonicalize, digest, identity-bind, and seal it before any Human evidence or aggregation claim exists.

## Build and Verify

Generate into a new local-only root:

```powershell
npm run build:face-lab-independent-human-cue-review-ui-ko -- --source-root "D:\Ji_hwan\K_Beauti AI\.synthetic-local\face-eval-c-w1m\cx1g-d2d-p" --output "D:\Ji_hwan\K_Beauti AI\.synthetic-local\face-eval-c-w1m\cx1g-d2d-ui1" --source-main-sha 61d9d40db0f7fdac9aa2db1b68cad259f11e6ec0
```

Verify tracked semantics without private assets:

```powershell
npm run verify:face-lab-independent-human-cue-review-ui-ko
```

Verify the generated distribution and source bindings:

```powershell
npm run verify:face-lab-independent-human-cue-review-ui-ko -- --source-root "D:\Ji_hwan\K_Beauti AI\.synthetic-local\face-eval-c-w1m\cx1g-d2d-p" --distribution-root "D:\Ji_hwan\K_Beauti AI\.synthetic-local\face-eval-c-w1m\cx1g-d2d-ui1"
```

The generated reviewer HTML and images remain local-only and must not be committed. D2D-X authorization is separately required before anyone receives or completes a reviewer packet.

## Production Isolation

Provider calls, observation calls, generation calls, Human judgments, consensus operations, hosted writes, and production changes are all zero in this gate. Scoring, observation, generation, API response fields, storage structures, and deployment settings are unchanged. `W2_REMAINS_LOCKED`.
