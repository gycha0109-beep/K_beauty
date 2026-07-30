"use client";

const MEDIAPIPE_VERSION = "0.10.35";
const BUNDLE_PATH = "/api/mediapipe/vision_bundle.mjs";
const MODEL_PATH = "/api/mediapipe/face_landmarker.task";
const WASM_BASE_PATH = "/api/mediapipe/wasm";
const CDN_BUNDLE_PATH = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`;
const CDN_WASM_BASE_PATH = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const CDN_MODEL_PATH = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const MIN_MODEL_BYTES = 100 * 1024;
const MAX_MODEL_BYTES = 40 * 1024 * 1024;

let landmarkerPromise = null;
let landmarkerInstance = null;
let runtimeAttempt = 0;

function createInitializationError(stage, cause) {
  const error = new Error(`face_landmarker_${stage}_failed`);
  error.name = "FaceLandmarkerInitializationError";
  error.stage = stage;
  error.cause = cause;
  return error;
}

function resolveRuntimeCandidates() {
  const origin = window.location.origin;
  const cacheKey = `${MEDIAPIPE_VERSION}-${runtimeAttempt}`;

  return [
    Object.freeze({
      bundle: `${new URL(BUNDLE_PATH, origin).href}?v=${cacheKey}`,
      model: new URL(MODEL_PATH, origin).href,
      source: "same_origin",
      wasmBase: new URL(WASM_BASE_PATH, origin).href
    }),
    Object.freeze({
      bundle: `${CDN_BUNDLE_PATH}?v=${cacheKey}`,
      model: CDN_MODEL_PATH,
      source: "official_cdn",
      wasmBase: CDN_WASM_BASE_PATH
    })
  ];
}

async function loadModelAsset(modelUrl) {
  let response;
  try {
    response = await fetch(modelUrl, {
      cache: "force-cache",
      credentials: "omit"
    });
  } catch (error) {
    throw createInitializationError("model_fetch", error);
  }

  if (!response.ok) {
    throw createInitializationError("model_fetch", new Error(`status_${response.status}`));
  }

  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_MODEL_BYTES) {
    throw createInitializationError("model_too_large", new Error("declared_size_exceeded"));
  }

  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.byteLength < MIN_MODEL_BYTES || buffer.byteLength > MAX_MODEL_BYTES) {
    throw createInitializationError("model_invalid", new Error(`bytes_${buffer.byteLength}`));
  }

  return buffer;
}

async function createWithDelegate(FaceLandmarker, fileset, delegate, modelAssetBuffer) {
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      delegate,
      modelAssetBuffer: modelAssetBuffer.slice()
    },
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    numFaces: 2,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
    runningMode: "VIDEO"
  });
}

async function createForRuntime(runtime) {
  let visionModule;
  let fileset;
  let modelAssetBuffer;

  try {
    visionModule = await import(
      /* webpackIgnore: true */ runtime.bundle
    );
  } catch (error) {
    throw createInitializationError(`${runtime.source}_bundle_import`, error);
  }

  if (!visionModule?.FilesetResolver || !visionModule?.FaceLandmarker) {
    throw createInitializationError(`${runtime.source}_bundle_exports`, null);
  }

  try {
    fileset = await visionModule.FilesetResolver.forVisionTasks(runtime.wasmBase);
  } catch (error) {
    throw createInitializationError(`${runtime.source}_wasm_fileset`, error);
  }

  modelAssetBuffer = await loadModelAsset(runtime.model);

  try {
    return await createWithDelegate(
      visionModule.FaceLandmarker,
      fileset,
      "GPU",
      modelAssetBuffer
    );
  } catch (gpuError) {
    try {
      return await createWithDelegate(
        visionModule.FaceLandmarker,
        fileset,
        "CPU",
        modelAssetBuffer
      );
    } catch (cpuError) {
      throw createInitializationError(
        `${runtime.source}_delegate_initialization`,
        new AggregateError([gpuError, cpuError], "gpu_and_cpu_initialization_failed")
      );
    }
  }
}

async function createFaceLandmarker() {
  if (typeof window === "undefined") {
    throw createInitializationError("browser_only", null);
  }

  const testFactory = window.__bejewelyFaceLandmarkerFactory;
  if (typeof testFactory === "function") {
    return testFactory();
  }

  const errors = [];
  for (const runtime of resolveRuntimeCandidates()) {
    try {
      return await createForRuntime(runtime);
    } catch (error) {
      errors.push(error);
    }
  }

  throw createInitializationError(
    "runtime_candidates",
    new AggregateError(errors, "all_runtime_candidates_failed")
  );
}

export function resetFaceLandmarker() {
  runtimeAttempt += 1;
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
  bundlePath: BUNDLE_PATH,
  modelPath: MODEL_PATH,
  version: MEDIAPIPE_VERSION,
  wasmBasePath: WASM_BASE_PATH
});
