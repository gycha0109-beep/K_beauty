# Face Lab ROI v3 – geometry and photo evidence review (research only)

## Observed failure in v2
In the user's two test screenshots (one compressed backlit outdoor portrait, one clearer portrait), the candidate ROI consistently renders as rectangular panels over both cheeks. This is not caused *solely* by image resolution. The v2 implementation uses five identical-y horizontal scanlines plus near-constant nose-relative medial x endpoints. It ignores the MediaPipe **interior cheek mesh perimeter**, so the geometry structurally tends toward a block. The prior 25–26% IoU with the legacy circular ROI measures model-to-model overlap, **not dermatological accuracy**.

## Review of upstream
- The pinned Saju neutral producer consumes a 468/478 MediaPipe frame, validates coordinates, and delivers an ephemeral 468-point frame / seven-anchor observations. It performs no skin segmentation or color classification.
- The Face Lab v2 and v3 polygon constructors are Face Lab responsibilities, not evidence of a fault in the Saju face-reading interpretation engine.
- Public reference: google-ai-edge/mediapipe FACE_LANDMARKS_TESSELATION + pinned canonical face OBJ. The 11-vertex bilateral perimeter rings v3 uses are the named inner cheek surface neighbors. These are **geometric heuristic search areas**, not an annotated bare-skin boundary.

## Implementation v3
- Replace experimental v2 face-oval scanline strips with 11-point side-specific polygons joining inner-cheek MediaPipe vertices: image-left [118,117,123,147,187,207,206,205,36,100,101], image-right [347,346,352,376,411,427,426,425,266,329,330].
- Inset each loop toward its centroid by 10% to avoid outer boundaries.
- Observe mouth corners, lower eyelids and nasal alae; hold on boundary intrusion, unsuitable head geometry, degenerate areas, misordered sides, invalid points or out-of-frame exclusions.
- Retain 7-anchor legacy ROI as research control; run a **single** MediaPipe detector and same Saju neutral producer.
- UI is read-only research comparison. Show v3 inward surface contours and model-to-model IoU. Separate scalar local photo diagnostic signals from ROI geometry: mean luminance, fraction of near-clipped RGB, local high-frequency Laplacian signal. No automatic camera-focus judgment, makeup/shadow detection, CIELAB, skin type, shade or product recommendation.
- The image and raster pixel masks never leave browser/UI callback boundaries. Scalar diagnostics do not persist.

## Tests and HOLD
- Synthetic *selected* canonical-model vertices (not a real-world photo or labeled dermatological ground truth), geometrical separation, polygon curvature, raster overlap, multiple-face guard, mirror/image-side contract, incomplete-mesh fail-closed, unchanged Saju source hash and local redaction tests.
- Synthetic flat and high-frequency checkerboard patches establish the pixel diagnostic contract without claiming blur classification.
- **HOLD**: independent hand-labeled cheek/skin masks, real-photo and device testing, effects of expressions, hair/occlusions/makeup/backlighting, intra-subject stability, thresholds for photometry or automatic ROI approval. Test route is for developer observation only; v3 may still fail closed under real photos.
- The model captures only geometry, not skin pixels. A real pixel-level skin segmentation model + independent validated labels are prerequisites to any confident skin-color pipeline.
- No production skin analysis wiring, Saju code changes, monetization or user-report changes; require review and CI before publishing test route.

## Provenance
MediaPipe official source:
- https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/face_landmarker/face_landmarks_connections.ts
- https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj
