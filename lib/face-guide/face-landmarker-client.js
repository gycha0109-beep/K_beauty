"use client";

const MEDIAPIPE_VERSION = "0.10.35";
const BUNDLE_PATH = "/api/mediapipe/vision_bundle.mjs";
const MODEL_PATH = "/api/mediapipe/face_landmarker.task";
const WASM_BASE_PATH = "/api/mediapipe/wasm";

let landmarkerPromise = null;

async function createWithDelegate(FaceLandmarker, fileset, delegate) {
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      delegate,
      modelAssetPath: MODEL_PATH
    },
    minFaceDetectionConfidence: 0.62,
    minFacePresenceConfidence: 0.62,
    minTrackingConfidence: 0.62,
    numFaces: 2,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
    runningMode: "VIDEO"
  });
}

async function createFaceLandmarker() {
  if (typeof window === "undefined") {
    throw new Error("face_landmarker_browser_only");
  }

  const testFactory = window.__bejewelyFaceLandmarkerFactory;
  if (typeof testFactory === "function") {
    return testFactory();
  }

  const visionModule = await import(
    /* webpackIgnore: true */ BUNDLE_PATH
  );
  const fileset = await visionModule.FilesetResolver.forVisionTasks(WASM_BASE_PATH);

  try {
    return await createWithDelegate(visionModule.FaceLandmarker, fileset, "GPU");
  } catch (gpuError) {
    try {
      return await createWithDelegate(visionModule.FaceLandmarker, fileset, "CPU");
    } catch (cpuError) {
      throw new AggregateError(
        [gpuError, cpuError],
        "face_landmarker_initialization_failed"
      );
    }
  }
}

export function getFaceLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = createFaceLandmarker().catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }

  return landmarkerPromise;
}

export function preloadFaceLandmarker() {
  return getFaceLandmarker().then(() => undefined);
}

export const FACE_LANDMARKER_RUNTIME = Object.freeze({
  bundlePath: BUNDLE_PATH,
  modelPath: MODEL_PATH,
  version: MEDIAPIPE_VERSION,
  wasmBasePath: WASM_BASE_PATH
});
