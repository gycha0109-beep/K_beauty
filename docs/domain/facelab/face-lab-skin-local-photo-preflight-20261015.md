# [Face Lab / Skin] S1-D private local photo intake header preflight (2026-10-15)

> Evaluation-only. This is a **local input integrity gate**, not Vision Provider output, image-quality certification, or skin accuracy evidence. Existing S0–S5 roadmap, skin-cue evaluator #1310, S1-A/B and recommendation remain authoritative. No deploy, photo upload, retention policy, new API, or Provider invocation.

## Why this exists

Five example photos were supplied for Skin Track S1-D exploratory assessment: relatively even visible skin, visible spots/red marks, redness, pores in a side crop, and strong asymmetric darkness. Their public/reuse/AI transfer permissions have **not been verified**; their visible cues are **preliminary, non-diagnostic single-view observations**, not blind independent Human reference labels.

Previously the S1-D evaluator #1310 accepts only metadata. This preflight fills the separate **local image header/size/provenance boundary** needed before a future private approved annotation/evaluation step. It does not integrate with production or reuse a Vision call. It never emits filenames or source paths/EXIF, calculates skin scores, or promotes manual hints to truth.

## Commands (private operator workstation only)

```sh
node scripts/facelab/skin/verify-skin-local-photo-preflight.mjs
node scripts/facelab/skin/run-skin-local-photo-preflight.mjs /private/manifest.json /private/photo-directory
```

The private manifest shape is:

```json
{
  "schemaVersion": "skin-local-photo-preflight-v1",
  "datasetId": "private_run_id",
  "cases": [
    {
      "caseId": "TC-01",
      "fileName": "local_image.jpg",
      "captureTags": ["baseline"],
      "rightsStatus": "unverified"
    }
  ]
}
```

Allowed capture tags mirror #1310 (`baseline`, `low_light`, `strong_glare`, `white_balance_shift`, `angle_change`, `makeup_present`, `filter_suspected`, `skin_occluded`, `low_resolution`, `different_device`, `controlled_repeat`). Tags are **operator-assigned hypotheses**: the tool does not verify lighting, face count, image focus, EXIF orientation, skin, identity, or ownership. `rightsStatus="operator_claimed_documented"` is not evidence that a release/Provider transfer has been authorized, and the output permanently marks external transfer `false`. File names and directory must remain **private**. Symlinks, path escapes, unsupported file types, irregular fields, huge inputs, unexpected rights values and duplicate IDs are rejected. JPEG/PNG header dimensions only: no complete decode or photo quality certification. Short-side `<320px` is a **manual detail review hint**, not a production threshold.

The tool writes only the JSON summary to stdout. Treat even aggregate case metadata as internal research unless separately reviewed; never copy private manifest/photographs, local filenames, raw EXIF, biometric identifiers, Provider raw outputs or reviewer personal data into GitHub or CI. Existing #1310 metadata-only evaluator and Human agreement check remain independent; missing reference or Provider predictions must remain unscored/unverified.

## Actual operator-local exploratory run (not reproduced in CI)

For the five user-supplied files, local JPEG header checks matched a separately performed full decode with Pillow:

| Local case | Header resolution (width × height) | Short-side below 320px | Operator tag, not verified truth |
| --- | --- | --- | --- |
| TC-01 | 582 × 894 | no | `baseline` |
| TC-02 | 539 × 371 | no | `baseline` |
| TC-03 | 273 × 366 | yes | `low_resolution` |
| TC-04 | 484 × 413 | no | `angle_change` |
| TC-05 | 452 × 678 | no | `low_light` |

Additionally, an **offline, whole-frame** grayscale pixel check found ~86.8% of TC-05 pixels under gray value 45/255. The measured percentage includes hair/background/shadow, **not a skin mask** and not the Provider's assessment. It is a strong exploratory retake/abstain scenario, not medical or individual diagnosis.

## Verification and explicit blockers

- CI exercises only generated synthetic PNG/JPEG headers and negative cases; **no real photo enters the repository or GitHub Actions**.
- Local S1-D test set: 5/5 readable image headers, 1/5 short-side review hint. Actual Vision Provider: 0/5. Independent blinded Human labels: 0/5. Face/Skin compatibility under 2,200-token limit and billed latency/cost: unverified.
- Cannot conclude skin concern accuracy, calibrated confidence, production eligibility, consent, Face Lab readiness, Product Ready or Release Ready from this result.
- Do not send images to external Provider, persist biometrics, or run Human review without the approved photo authority, private retention/deletion and access controls, shared-Vision owner review and actual evaluation protocol. SCA #1208 independently blocks release. Preserve the S0–S5 roadmap and all existing recommendations/Top Pick/Style.

Watchtower-Track: face-lab-skin
