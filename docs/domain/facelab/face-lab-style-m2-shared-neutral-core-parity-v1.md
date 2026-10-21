# Face Lab Style M2 — Shared Neutral Observation Core Contract Candidate / Parity v1

- Date: 2026-10-21
- Track: face-research
- Baseline: K_beauty PR #1301 @ da8dd970bf3f4901aacdd20b6e9a156b5dae53d6
- Authority: development-only / research-only / not production activated
- Source audit: Saju main FR26/FR61/FR77/FR194/FR195/MESH5.1; MyeongHa feat/face-reading/fe041e-candidate-mapping-consumer FE029/FE030/FE031/FE033/FE037
- This branch is **not** a production Saju package import or a completed cross-repository shared SDK.

## Implemented boundaries

`shared-neutral-face-core-candidate.js` defines a deliberately narrow, synchronous, transient FaceLandmarker frame contract:
- Exactly one face and supported provider landmark count (468/478).
- Full provider array finite x/y/z validation; x/y in [0,1].
- Original unmirrored, EXIF-oriented **image** coordinates only; no CSS preview mirror, no metric 3D substitution.
- Expose only the first 468 x/y landmarks through a local synchronous callback; exclude iris 10 and depth, visibility, blendshape data.
- No anatomical left/right or provider-to-zygion assertions; indexes remain provider ordering.
- No image, crop, landmarks, skin masks, direct geometry, identity, raw provider output in its return receipt.
- Always `productionAuthorized: false` and `independentlyReviewedSkin: false`. A callback is not a persistent privacy boundary: callers must not retain/retransmit the temporary frame.

`shared-core-roi-parity.js` compares:
1. The existing 7-anchor cheek geometry proposal;
2. The same exact proposal after the above neutral full-landmark normalization;
3. Geometry masks and exclusion masks on the same bounded raster grid.

The comparison uses one already-detected MediaPipe result. No second model execution. Pixel parity (mask IoU) detects migration/normalization regressions; **the equal algorithms make this a contract parity regression, not independent algorithm validation**. No skin pixels, color measurement, or real-photo anatomical accuracy claim is made.

`mediapipe-roi-proposal.js` accepts optional `onParity` only after the existing geometry candidate is ready. The existing proposal/result remain unchanged if no callback is supplied. The development-only UI displays only match/diverge/hold, never landmarks, polygons or image data in the parity state.

## Existing authority preserved

- Current Face Lab ROI proposal remains the baseline; `cheek-landmark-proposal.js` and `cheek-mask-geometry.js` are **not replaced**.
- Existing independent skin-review boundary (`reviewed-roi-sampling.js`), Lab calculation and lighting drift holds are unchanged.
- MESH5.1 is offline region authoring, not validated 2D skin segmentation; FR195 explicitly blocks anatomical zygion claims for 234/454.
- MyeongHa FE030 JPEG re-encoding is not adopted for color measurement. Any later common image-intake must separately prove RGB/CIELAB invariance.
- Saju FE035B consumer-safe metrics deliberately omit raw geometry, so a separate ephemeral producer-side contract is needed to consume the full frame.
- Existing MediaPipe 0.10.35 pin is retained for parity with MyeongHa/Saju. Upgrading to 1.x requires separate behavioral, model, supply-chain and versioned contract review.

## Current evidence

- Deterministic synthetic full-landmark validation and same-algorithm mask parity with exclusions.
- Invalid topology, orientation, non-anchor contamination, NaN depth, wrong face count and callback failure fail closed.
- Foundation verifier imports the test and existing fake-MediaPipe detector checks callback behavior.
- Actual MediaPipe/WASM browser execution in this new comparison was **not** performed by the synthetic contract test.
- Real human annotated cheek ROI IoU/precision/recall, calibrated RGB photometry, real lighting repeatability and actual production preview remain **HOLD**.

## Next, subject to explicit separate approval

1. Extract a genuine product-neutral producer package from governed Saju/MyeongHa code; own stable export, adapter release, digest, changelog and source/version lock.
2. Characterize model/WASM network byte integrity and browser bundle size using the pinned version; compare canonical intake and color-preserving pixel intake independently.
3. Replace this Face Lab candidate frame parser with an actual released neutral core behind identical callback contract; keep old/new parallel parity until regression tests pass.
4. Conduct independent real-image mask benchmarks with authorized, non-user or explicitly consented materials; avoid adding user photos to Git or CI artifacts.
5. Production activation requires separate approval after all evidence/privacy/supply-chain gates; this stage neither merges nor deploys.
