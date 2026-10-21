import { proposePersonalColorCheekRegions } from "./cheek-landmark-proposal.js";
import { buildPersonalColorCheekMasks } from "./cheek-mask-geometry.js";
import { compareSharedNeutralFaceCoreRoiParity } from "./shared-core-roi-parity.js";

// Research-only browser adapter. Assets are fetched only after an explicit
// developer UI action. Face image inference runs in the local browser.
// Public model/WASM URLs are pinned; user images never enter a fetch call.
export const PERSONAL_COLOR_MEDIAPIPE_ROI_VERSION =
  "face-lab-personal-color-mediapipe-roi-proposal-v1";
export const PERSONAL_COLOR_MEDIAPIPE_WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
export const PERSONAL_COLOR_MEDIAPIPE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const MAX_MASK_PIXELS = 1024 * 1024;
const MAX_SOURCE_PIXELS = 32 * 1024 * 1024;

function hold(reason) {
  return {
    schemaVersion: PERSONAL_COLOR_MEDIAPIPE_ROI_VERSION,
    status: "insufficient_evidence",
    reason,
    faceCount: null,
    candidatePixels: null,
    independentlyReviewedSkin: false,
    skinMeasurement: null,
    faceLandmarksPersisted: false,
    sourceImagePersisted: false
  };
}

function finiteSize(n) {
  return Number.isSafeInteger(n) && n > 0 && n <= 8192;
}

function maskSize(width, height) {
  const scale = Math.min(1, Math.sqrt(MAX_MASK_PIXELS / (width * height)));
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale))
  };
}

/**
 * Run actual MediaPipe FaceLandmarker.detect(image) locally in IMAGE mode.
 * loadVisionTasks is dependency-injected for offline deterministic tests;
 * the default dynamically loads the project's tasks-vision module.
 *
 * onProposal is a synchronous, in-memory callback for a developer-only
 * overlay; it is the only place polygons leave this function. The returned
 * contract never includes face landmarks, crop coordinates or pixel arrays.
 *
 * A geometric cheek proposal is never a verified bare-skin mask. No Lab or
 * palette computation is made here.
 */
export async function detectMediaPipeCheekRoiProposal({
  image,
  width,
  height,
  originalImageOrientationVerified = false,
  onProposal,
  onParity,
  loadVisionTasks = () => import("@mediapipe/tasks-vision")
} = {}) {
  if (!originalImageOrientationVerified) return hold("original_image_orientation_unverified");
  if (!image || !finiteSize(width) || !finiteSize(height) ||
      width * height > MAX_SOURCE_PIXELS) {
    return hold("source_image_dimensions_invalid");
  }
  if (typeof loadVisionTasks !== "function") return hold("vision_runtime_unavailable");

  let landmarker;
  try {
    const tasks = await loadVisionTasks();
    if (typeof tasks?.FilesetResolver?.forVisionTasks !== "function" ||
        typeof tasks?.FaceLandmarker?.createFromOptions !== "function") {
      return hold("vision_runtime_unavailable");
    }
    const wasm = await tasks.FilesetResolver.forVisionTasks(PERSONAL_COLOR_MEDIAPIPE_WASM_ROOT);
    landmarker = await tasks.FaceLandmarker.createFromOptions(wasm, {
      baseOptions: { modelAssetPath: PERSONAL_COLOR_MEDIAPIPE_MODEL },
      runningMode: "IMAGE",
      numFaces: 2,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false
    });
    if (typeof landmarker?.detect !== "function") return hold("vision_runtime_unavailable");
    const detection = landmarker.detect(image);
    const faces = detection?.faceLandmarks;
    if (!Array.isArray(faces) || faces.length === 0) return hold("single_face_not_detected");
    if (faces.length !== 1) return hold("multiple_faces_detected");

    const proposal = proposePersonalColorCheekRegions({
      faceLandmarks: faces[0],
      faceCount: faces.length,
      coordinateSpace: "original_image"
    });
    if (proposal.status !== "proposal_only" ||
        proposal.requiresIndependentRoiReview !== true ||
        proposal.mayMeasureSkin !== false) {
      return hold(proposal.reason || "cheek_geometry_unreliable");
    }
    const dimensions = maskSize(width, height);
    const geometry = buildPersonalColorCheekMasks({
      ...dimensions,
      cheekPolygons: proposal.cheekPolygons,
      exclusionPolygons: proposal.exclusionPolygons
    });
    if (geometry.status !== "masks_ready") {
      return hold(geometry.reason || "cheek_masks_not_ready");
    }

    // Opt-in, research-only parity: reuse the SAME detected landmarks.
    // No second detector invocation, photo pixel read, storage or production
    // output. Never expose the transient neutral frame through UI callbacks.
    if (typeof onParity === "function") {
      try {
        onParity(compareSharedNeutralFaceCoreRoiParity({
          faceLandmarks: faces[0], faceCount: faces.length,
          coordinateSpace: "original_image", width, height
        }));
      } catch {
        // Comparison diagnostics must not alter the existing ROI result.
      }
    }

    if (typeof onProposal === "function") {
      onProposal({
        cheekPolygons: proposal.cheekPolygons,
        exclusionPolygons: proposal.exclusionPolygons,
        coordinateSpace: "original_image"
      });
    }
    return {
      schemaVersion: PERSONAL_COLOR_MEDIAPIPE_ROI_VERSION,
      status: "proposal_only",
      reason: null,
      faceCount: 1,
      candidatePixels: {
        leftCheek: geometry.sampleCount.leftCheek,
        rightCheek: geometry.sampleCount.rightCheek
      },
      independentlyReviewedSkin: false,
      skinMeasurement: null,
      faceLandmarksPersisted: false,
      sourceImagePersisted: false
    };
  } catch {
    return hold("vision_runtime_or_model_failed");
  } finally {
    try { landmarker?.close?.(); } catch { /* best-effort disposal */ }
  }
}
