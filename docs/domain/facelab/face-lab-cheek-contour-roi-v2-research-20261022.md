# Face Lab ROI v2 — root-cause analysis and contour-based research redesign

Date: 2026-10-22 · Track: face-research · **RESEARCH ONLY**

## Root cause and ownership

The screenshot showed two tiny nasolabial-adjacent circles and ~70% algorithm-to-algorithm overlap. That is *not* human-annotated skin correctness.

1. The Saju shared neutral package `consumeNeutralFaceObservation` validates the complete 468/478 MediaPipe frame and exposes an ephemeral 468-frame plus seven face anchors. It does **not** identify cheek skin or define the ROI. No evidence here establishes a fault in its original physiognomy analysis.
2. Both Face Lab ROI paths were **Face Lab-owned** 7-anchor ellipses: legacy [12 vertices, x=0.075 face width, y=0.180 eye–mouth span] and proposed Saju-anchor consumer [16, 0.070, 0.160]. In the existing photo both generate small near-nose patches. Saju does not own those numbers.
3. The Saju `packages/face-geometry` MESH4/5 research uses a more extensive GNM-based 22-region ontology and offline MediaPipe adapter, but the projection policy explicitly has `productionDistanceThreshold: null` and `productionMetricAuthorized: false`. A completed, human-QA-accepted cheek mask was **not** shipped to Face Lab. Do not treat projected region membership as an independently reviewed photograph mask.

**Decision: change Face Lab postprocessing only, keep the Saju validated producer unchanged.**

## Research candidate v2 (separate from the 7-anchor baseline)

- Reuse Saju's **full transient 468-frame** from the already implemented `onFrame({frame,anchorGeometry})` callback, without persisting landmarks, images or masks.
- Read the 36-index official `FACE_LANDMARKS_FACE_OVAL` contour from MediaPipe `face_landmarks_connections.ts`.
- At five y rows between eye center and mouth center, derive bilateral silhouette intersections. Reject malformed or multiply-intersecting contours (do not fabricate a missing face outline).
- Make **10-vertex bilateral cheek search bands** that follow the face outline and keep margins from the outer face border and central nose, instead of tiny circles centred by 7 anchors.
- Keep gross exclusion boxes for the eye and lip regions; pixel rasterization remains the existing validated `buildPersonalColorCheekMasks`.
- Keep the original seven-anchor ellipses as *baseline* for A/B. Count valid areas and mask IoU in the same raster resolution.
- All thresholds and bands are hypotheses requiring facial review and may include cosmetic coverage, shadows, hair, occlusion or non-skin. Fail closed on side/pose/shape ambiguity.

This is **an anatomical search zone for independent inspection**, not an epidermis segmentation, device-calibrated photo colour estimator, or automatic production input. It MUST NOT feed consumer skin RGB/Lab/CIELAB/palette decisions.

## Acceptance gates

1. [software] Node/synthetic tests: one shared model observation, realistic complete oval; both cheek masks rasterize; new candidate noticeably broader than legacy; tiny seven-anchor-only fixture fails closed; no client-side upload and no consent checkbox; original Saju Git source blob unchanged.
2. [build] Canonical Face Lab foundation + current-main/security/supply-chain CI all succeed on exact candidate head. A Next production build is necessary but not sufficient.
3. [real-world HOLD] Controlled, permissioned photograph collection: frontal/yaw/roll/zoom/EXIF/mirror/device/lighting/makeup/occlusion strata. **Independent human** left/right skin reference masks and inter-reviewer agreement. Compare candidate vs legacy IoU, precision/recall, valid pixels, exclusion errors, invalid/hold frequency, stability within matched captures. Predetermine thresholds with reviewer signoff before promoting.
4. [deployment HOLD] Do not deploy, merge into main, or change user-facing scoring until an explicit release decision after evidence review.

## Sources

- Saju `packages/neutral-face-observation/index.js`, producer commit `a00c3e2e1c3be1711068e5d35e696a6c9c7d0b8a`
- Saju `packages/face-geometry/README.md`, `assets/bridge/gnm-to-mediapipe468-region-projection-v1.json`
- Official MediaPipe `mediapipe/tasks/web/vision/face_landmarker/face_landmarks_connections.ts`, `FACE_LANDMARKS_FACE_OVAL`
- Existing Face Lab `cheek-landmark-proposal.js` and `saju-neutral-cheek-research-proposal.js`

**Ownership:** Saju validates neutral observation and shared region ontology; Face Lab selects, reviews and interprets skin search zones. Neither owns independent photo skin ground truth.
