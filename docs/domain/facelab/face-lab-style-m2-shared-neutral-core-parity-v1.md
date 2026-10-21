# Face Lab Style M2 — Saju Neutral Core Package A/B Migration (research v2)

- Date: 2026-10-21
- Track: face-research
- Source/producer: Saju Draft PR #2617, commit `a00c3e2e1c3be1711068e5d35e696a6c9c7d0b8a`
- Downstream: K_beauty stacked on Draft PR #1380 (stacked on #1301)
- Authority: **research/development only**; no merge, deployment, user-facing scoring, or provider activation
- Distinguish **neutral image geometry** from **cheek/skin-color interpretation**. These are different domains.

## Real package boundary

Saju now owns `packages/neutral-face-observation`:
- npm package name: `@myeongha/neutral-face-observation`, version `0.1.0-research.0`, `private: true`
- ESM `exports`, explicit contract, standalone `node --test` tests and `npm pack --dry-run` CI
- Handles **already obtained** one-face MediaPipe 468/478 observations; validates all provider points and original-image orientation.
- Emits an ephemeral, frozen 468-point x/y frame plus image-space eye/mouth/face-span anchor geometry **only** inside a synchronous callback; return receipt contains no geometry. Provider z/visibility, iris ten points, blendshapes and source images do not leave it.
- `outerImageLeft/Right` are image pixel-order proxies, not anatomical left/right, verified zygion or cutaneous region masks. Saju FR195 and MESH5.1 research cannot justify automatic bare-skin approval.
- No MediaPipe model/WASM loader, dermatology inference, pose-normalized metric 3D, morphological or face-reading classification in this package.

Because the upstream package is still in a **draft feature branch** and has not been published, K_beauty consumes an **exact vendored copy as a local npm workspace**. The upstream source snapshot is pinned by the Saju commit and verified using Git blob SHA-1 for `index.js`, `package.json`, `README.md` in `verify-face-lab-v2-saju-neutral-core-upstream.mjs`. npm lockfile records the workspace link. Runtime source is locally bundled; it does not fetch Saju files or user images from the network. This is real package code reuse in a pinned vendored mode, **not an npm registry release or automated cross-repository dependency update**.

## Two genuinely different ROI paths

1. Legacy `proposePersonalColorCheekRegions` (seven direct MediaPipe anchors): 12-vertex ellipses with parameters y=0.55, x-radius=0.075 face-width, y-radius=0.180 eye-to-mouth span, outer-anchor weight 0.46.
2. Saju product-neutral `consumeNeutralFaceObservation` -> `anchorGeometry` -> Face Lab-only `proposeSajuNeutralCheekResearchRegions`: independent 16-vertex ellipses with y=0.52, x-radius=0.070, y-radius=0.160, outer weight 0.43. These are **ad hoc research configurations**, not reviewed anatomical presets or a predicted improvement.

Both paths use the **same one** MediaPipe detection result from `mediapipe-roi-proposal.js` and the same raster-grid mask builder for fair geometric comparison. They calculate per cheek and exclusion: overlap, union, effective sample count, IoU, and exact equality. **Differences are expected**, not a failure by themselves; they demonstrate two implementations differ. Neither path proves which masks are correct, which pixels are bare skin, or that color measurements are stable. A/B output is aggregate-only.

The development-only UI gives matched/diverged/held. Existing independent-skin-review gate, photo-quality eligibility, CIELAB calculations, API and persisted reports remain unchanged.

## Evidence gates

- **Synthetic test**: full 478-point provider frame, no second detector call, independent proposals overlap but differ; fail-closed multi-face/invalid geometry/unverified orientation/NaN and producer callback exceptions.
- **Source provenance**: Saju commit and three upstream Git blobs pinned, npm workspace lock asserted.
- **CI**: Saju standalone tests/lint/pack, K_beauty Foundation + Next build + Playwright dev UI.
- **NOT YET**: controlled real-browser MediaPipe model/WASM parity on consented images, manual independent cheek segmentation benchmark IoU/precision/recall, device/lighting/EXIF mirror calibration, producer release integrity proof. All remain **HOLD** until separately verified.
- FE030 canonical JPEG encoding from MyeongHa is **not** adopted for colour photometry; RGB roundtrip/invariance would need independent validation.

## Future release policy

Only after Saju PR review/merge/release governance may the consuming vendored source become a separately distributed immutable package (registry or signed artifact). This migration explicitly does not publish, merge or activate the Saju code, nor does it upgrade MediaPipe `0.10.35`.


## Optional independent-mask benchmark (research protocol only)

`benchmarkCheekRoiCandidatesAgainstReview` in
`independent-cheek-roi-benchmark.js` compares **both** ROI proposals
against the **same independently annotated** image-left/right binary
reference masks (caller-provided). It reuses the existing
`compareCheekRoiProposalToReview` validator for each algorithm and
returns each cheek's IoU, precision, recall, pixel counts and signed
candidate-minus-legacy differences.

- Human `independent_manual_review` provenance is **declared** by the
  caller; the code cannot independently attest reviewer independence,
  skin eligibility or reference correctness.
- Missing provenance, unsupported orientation/topology, invalid masks,
  overlapping reference cheeks and inadequate pixels **fail closed**.
- The synthetic test fixture uses hand-authored rectangular masks, **not**
  face photos or human review. It is a software protocol/quality test
  and does **not** validate either algorithm's anatomical accuracy.
- Output is redacted aggregate statistics only, with
  `roiAccuracyApproved: false`,
  `referenceIndependenceExternallyAudited: false` and
  `productionAuthorized: false`. It is not wired to the consumer
  score/palette path.
- Real-image use requires explicitly authorized non-user or consented
  photographs and reference masks outside Git, CI logs, and public
  build artifacts. Independent reviewer records and controlled capture
  conditions must be collected before interpreting any performance result.
