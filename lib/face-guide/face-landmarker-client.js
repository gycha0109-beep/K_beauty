"use client";

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const MEDIAPIPE_VERSION = "0.10.35";
const MODEL_PATH = "/api/mediapipe/face_landmarker.task";
const WASM_BASE_PATH = "/api/mediapipe/wasm";
const MIN_MODEL_BYTES = 100 * 1024;
const MAX_MODEL_BYTES = 40 * 1024 * 1024;

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

async function loadModelAsset(modelUrl) {
  let response;
  try {
    response = await fetch(modelUrl, {
      cache: "force-cache",
      credentials: "same-origin"
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

async function createWithDelegate(fileset, delegate, modelAssetBuffer) {
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

async function createBundledFaceLandmarker() {
  let fileset;
  let modelAssetBuffer;

  try {
    fileset = await FilesetResolver.forVisionTasks(resolveSameOriginAsset(WASM_BASE_PATH));
  } catch (error) {
    throw createInitializationError("wasm_fileset", error);
  }

  modelAssetBuffer = await loadModelAsset(resolveSameOriginAsset(MODEL_PATH));

  try {
    return await createWithDelegate(fileset, "GPU", modelAssetBuffer);
  } catch (gpuError) {
    try {
      return await createWithDelegate(fileset, "CPU", modelAssetBuffer);
    } catch (cpuError) {
      throw createInitializationError(
        "delegate_initialization",
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
  moduleSource: "application_bundle",
  version: MEDIAPIPE_VERSION,
  wasmBasePath: WASM_BASE_PATH
});
