"use client";

const MEDIAPIPE_VERSION = "0.10.35";
const MODEL_PATH = "/api/mediapipe/face_landmarker.task";
const WASM_BASE_PATH = "/api/mediapipe/wasm";

let mediapipeModulePromise = null;
let landmarkerPromise = null;
let landmarkerInstance = null;

function createInitializationError(stage, cause) {
  const error = new Error(`face_landmarker_${stage}_failed`);
  error.name = "FaceLandmarkerInitializationError";
  error.stage = stage;
  error.cause = cause;
  return error;
}

function resolveSameOriginAsset(path) {
  return new URL(path, window.location.origin).href;
}

function assertBrowserRuntime() {
  if (typeof window === "undefined") {
    throw createInitializationError("browser_runtime", new Error("window_unavailable"));
  }

  if (typeof globalThis.WebAssembly !== "object") {
    throw createInitializationError("wasm_unsupported", new Error("webassembly_unavailable"));
  }
}

async function loadMediaPipeModule() {
  if (!mediapipeModulePromise) {
    mediapipeModulePromise = import("@mediapipe/tasks-vision")
      .then((module) => {
        if (
          typeof module?.FilesetResolver?.forVisionTasks !== "function" ||
          typeof module?.FaceLandmarker?.createFromOptions !== "function"
        ) {
          throw createInitializationError("module_exports", new Error("invalid_mediapipe_exports"));
        }

        return {
          FaceLandmarker: module.FaceLandmarker,
          FilesetResolver: module.FilesetResolver
        };
      })
      .catch((error) => {
        mediapipeModulePromise = null;
        if (error?.name === "FaceLandmarkerInitializationError") {
          throw error;
        }
        throw createInitializationError("module_import", error);
      });
  }

  return mediapipeModulePromise;
}

async function createTask(FaceLandmarker, fileset, delegate) {
  const baseOptions = {
    modelAssetPath: resolveSameOriginAsset(MODEL_PATH)
  };

  if (delegate) {
    baseOptions.delegate = delegate;
  }

  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    numFaces: 2,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
    runningMode: "VIDEO"
  });
}

async function createBundledFaceLandmarker() {
  assertBrowserRuntime();

  const { FaceLandmarker, FilesetResolver } = await loadMediaPipeModule();
  let fileset;

  try {
    fileset = await FilesetResolver.forVisionTasks(resolveSameOriginAsset(WASM_BASE_PATH));
  } catch (error) {
    throw createInitializationError("wasm_fileset", error);
  }

  let gpuError;
  try {
    return await createTask(FaceLandmarker, fileset, "GPU");
  } catch (error) {
    gpuError = error;
  }

  try {
    // Omitting the delegate selects MediaPipe's default CPU path. This is more
    // broadly compatible than forcing an explicit CPU delegate in mobile browsers.
    return await createTask(FaceLandmarker, fileset);
  } catch (cpuError) {
    throw createInitializationError(
      "delegate_initialization",
      new AggregateError([gpuError, cpuError], "gpu_and_cpu_initialization_failed")
    );
  }
}

async function createFaceLandmarker() {
  assertBrowserRuntime();

  const testFactory = window.__bejewelyFaceLandmarkerFactory;
  if (typeof testFactory === "function") {
    return testFactory();
  }

  return createBundledFaceLandmarker();
}

export function resetFaceLandmarker() {
  landmarkerPromise = null;

  const current = landmarkerInstance;
  landmarkerInstance = null;
  try {
    current?.close?.();
  } catch {
    // Best-effort cleanup. A new instance will be created on the next request.
  }
}

export function getFaceLandmarker({ forceReload = false } = {}) {
  if (forceReload) {
    resetFaceLandmarker();
  }

  if (!landmarkerPromise) {
    landmarkerPromise = createFaceLandmarker()
      .then((instance) => {
        landmarkerInstance = instance;
        return instance;
      })
      .catch((error) => {
        landmarkerPromise = null;
        landmarkerInstance = null;
        throw error;
      });
  }

  return landmarkerPromise;
}

export function preloadFaceLandmarker() {
  return getFaceLandmarker().then(() => undefined);
}

export const FACE_LANDMARKER_RUNTIME = Object.freeze({
  modelPath: MODEL_PATH,
  moduleSource: "application_bundle_lazy",
  version: MEDIAPIPE_VERSION,
  wasmBasePath: WASM_BASE_PATH
});
