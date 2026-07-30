"use client";

const MEDIAPIPE_VERSION = "0.10.35";
const MODEL_PATH = "/api/mediapipe/face_landmarker.task";
const WASM_BASE_PATH = "/api/mediapipe/wasm";

let mediapipeModulePromise = null;
let landmarkerPromise = null;
let landmarkerInstance = null;
let landmarkerGeneration = 0;
let preferCpuForSession = false;

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

async function createBundledFaceLandmarker({ preferCpu = false } = {}) {
  assertBrowserRuntime();

  const { FaceLandmarker, FilesetResolver } = await loadMediaPipeModule();
  let fileset;

  try {
    fileset = await FilesetResolver.forVisionTasks(resolveSameOriginAsset(WASM_BASE_PATH));
  } catch (error) {
    throw createInitializationError("wasm_fileset", error);
  }

  if (preferCpu) {
    try {
      return await createTask(FaceLandmarker, fileset);
    } catch (error) {
      throw createInitializationError("cpu_delegate_initialization", error);
    }
  }

  let gpuError;
  try {
    return await createTask(FaceLandmarker, fileset, "GPU");
  } catch (error) {
    gpuError = error;
  }

  try {
    return await createTask(FaceLandmarker, fileset);
  } catch (cpuError) {
    throw createInitializationError(
      "delegate_initialization",
      new AggregateError([gpuError, cpuError], "gpu_and_cpu_initialization_failed")
    );
  }
}

async function createFaceLandmarker({ preferCpu = false } = {}) {
  assertBrowserRuntime();

  const testFactory = window.__bejewelyFaceLandmarkerFactory;
  if (typeof testFactory === "function") {
    return testFactory({ preferCpu });
  }

  return createBundledFaceLandmarker({ preferCpu });
}

function closeLandmarker(instance) {
  try {
    instance?.close?.();
  } catch {
    // Best-effort cleanup. A new instance will be created on the next request.
  }
}

export function resetFaceLandmarker() {
  landmarkerGeneration += 1;
  landmarkerPromise = null;

  const current = landmarkerInstance;
  landmarkerInstance = null;
  closeLandmarker(current);
}

export function markFaceLandmarkerGpuUnhealthy() {
  preferCpuForSession = true;
  resetFaceLandmarker();
}

export function getFaceLandmarker({ forceReload = false, preferCpu = false } = {}) {
  if (forceReload) {
    resetFaceLandmarker();
  }

  if (!landmarkerPromise) {
    const generation = landmarkerGeneration;
    const effectivePreferCpu = preferCpu || preferCpuForSession;
    let request;

    request = createFaceLandmarker({ preferCpu: effectivePreferCpu })
      .then((instance) => {
        if (generation !== landmarkerGeneration) {
          closeLandmarker(instance);
          throw createInitializationError("stale_initialization", new Error("generation_changed"));
        }

        landmarkerInstance = instance;
        return instance;
      })
      .catch((error) => {
        if (landmarkerPromise === request) {
          landmarkerPromise = null;
        }
        if (generation === landmarkerGeneration) {
          landmarkerInstance = null;
        }
        throw error;
      });

    landmarkerPromise = request;
  }

  return landmarkerPromise;
}

export function preloadFaceLandmarker() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  return loadMediaPipeModule().then(() => undefined);
}

export const FACE_LANDMARKER_RUNTIME = Object.freeze({
  modelPath: MODEL_PATH,
  moduleSource: "application_bundle_lazy",
  runtimeRecovery: "gpu_to_session_cpu",
  version: MEDIAPIPE_VERSION,
  wasmBasePath: WASM_BASE_PATH
});
