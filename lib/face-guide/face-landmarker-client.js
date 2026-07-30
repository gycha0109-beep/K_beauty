"use client";

const MEDIAPIPE_VERSION = "0.10.35";
const BUNDLE_PATH = "/api/mediapipe/vision_bundle.mjs";
const MODEL_PATH = "/api/mediapipe/face_landmarker.task";
const WASM_BASE_PATH = "/api/mediapipe/wasm";

let landmarkerPromise = null;

function createInitializationError(stage, cause) {
  const error = new Error(`face_landmarker_${stage}_failed`);
  error.name = "FaceLandmarkerInitializationError";
  error.stage = stage;
  error.cause = cause;
  return error;
}

function resolveRuntimeAssetUrls() {
  const origin = window.location.origin;

  return Object.freeze({
    bundle: new URL(BUNDLE_PATH, origin).href,
    model: new URL(MODEL_PATH, origin).href,
    wasmBase: new URL(WASM_BASE_PATH, origin).href
  });
}

async function createWithDelegate(FaceLandmarker, fileset, delegate, modelAssetPath) {
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      delegate,
      modelAssetPath
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
    throw createInitializationError("browser_only", null);
  }

  const testFactory = window.__bejewelyFaceLandmarkerFactory;
  if (typeof testFactory === "function") {
    return testFactory();
  }

  const assets = resolveRuntimeAssetUrls();
  let visionModule;
  let fileset;

  try {
    visionModule = await import(
      /* webpackIgnore: true */ assets.bundle
    );
  } catch (error) {
    throw createInitializationError("bundle_import", error);
  }

  try {
    fileset = await visionModule.FilesetResolver.forVisionTasks(assets.wasmBase);
  } catch (error) {
    throw createInitializationError("wasm_fileset", error);
  }

  try {
    return await createWithDelegate(
      visionModule.FaceLandmarker,
      fileset,
      "GPU",
      assets.model
    );
  } catch (gpuError) {
    try {
      return await createWithDelegate(
        visionModule.FaceLandmarker,
        fileset,
        "CPU",
        assets.model
      );
    } catch (cpuError) {
      throw createInitializationError(
        "delegate_initialization",
        new AggregateError([gpuError, cpuError], "gpu_and_cpu_initialization_failed")
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
