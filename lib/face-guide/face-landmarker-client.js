"use client";

const MEDIAPIPE_VERSION = "0.10.35";
const MODEL_PATH = "/api/mediapipe/face_landmarker.task";
const WASM_BASE_PATH = "/api/mediapipe/wasm";

let mediapipeModulePromise = null;
let landmarkerPromise = null;
let landmarkerInstance = null;
let landmarkerGeneration = 0;
let preferCpuForSession = false;
const instanceDiagnostics = new WeakMap();

const ERROR_DIAGNOSTICS = Object.freeze({
  AggregateError: Object.freeze({
    category: "delegate_initialization",
    code: "delegate_initialization_failed"
  }),
  CompileError: Object.freeze({
    category: "wasm_compile",
    code: "wasm_compile_failed"
  }),
  LinkError: Object.freeze({
    category: "wasm_link",
    code: "wasm_link_failed"
  }),
  NotSupportedError: Object.freeze({
    category: "browser_unsupported",
    code: "browser_feature_unsupported"
  }),
  RuntimeError: Object.freeze({
    category: "wasm_runtime",
    code: "wasm_runtime_failed"
  }),
  SyntaxError: Object.freeze({
    category: "asset_script_parse",
    code: "asset_script_parse_failed"
  }),
  TypeError: Object.freeze({
    category: "runtime_type",
    code: "runtime_type_error"
  })
});
const BROWSER_RUNTIME_ERROR_NAMES = new Set([
  "CompileError",
  "LinkError",
  "RuntimeError",
  "SyntaxError"
]);

const EMPTY_RUNTIME_DIAGNOSTIC = Object.freeze({
  attempt: 0,
  delegate: "unknown",
  errorCategory: "none",
  errorCode: "none",
  errorName: "none",
  recoveryAttempted: false,
  stage: "none"
});

function findDiagnosticCause(error, depth = 0) {
  if (!error || depth >= 6) {
    return null;
  }

  const cause = findDiagnosticCause(error.cause, depth + 1);
  if (cause) {
    return cause;
  }

  if (Array.isArray(error.errors)) {
    for (const nestedError of error.errors) {
      const nestedCause = findDiagnosticCause(nestedError, depth + 1);
      if (nestedCause) {
        return nestedCause;
      }
    }
  }

  return ERROR_DIAGNOSTICS[error.name] ? error : null;
}

export function getFaceLandmarkerErrorDiagnostic(error, overrides = {}) {
  const diagnosticCause = findDiagnosticCause(error);
  const errorName = diagnosticCause?.name || "Error";
  const mapped = ERROR_DIAGNOSTICS[errorName] || {
    category: "runtime_error",
    code: "runtime_error"
  };

  return Object.freeze({
    attempt: Number.isInteger(overrides.attempt)
      ? overrides.attempt
      : Number.isInteger(error?.attempt)
        ? error.attempt
        : 0,
    delegate: overrides.delegate || error?.delegate || "unknown",
    errorCategory: mapped.category,
    errorCode: mapped.code,
    errorName,
    recoveryAttempted:
      overrides.recoveryAttempted === true || error?.recoveryAttempted === true,
    stage: overrides.stage || error?.stage || "initialization"
  });
}

function createInitializationError(stage, cause, details = {}) {
  const error = new Error(`face_landmarker_${stage}_failed`);
  error.name = "FaceLandmarkerInitializationError";
  error.stage = stage;
  error.cause = cause;
  error.delegate = details.delegate || "unknown";
  error.attempt = Number.isInteger(details.attempt) ? details.attempt : 0;
  error.recoveryAttempted = details.recoveryAttempted === true;
  return error;
}

function registerInstanceDiagnostic(instance, diagnostic) {
  if (
    instance &&
    (typeof instance === "object" || typeof instance === "function")
  ) {
    instanceDiagnostics.set(instance, Object.freeze({
      ...EMPTY_RUNTIME_DIAGNOSTIC,
      ...diagnostic
    }));
  }
  return instance;
}

export function getFaceLandmarkerInstanceDiagnostic(instance) {
  return instanceDiagnostics.get(instance) || EMPTY_RUNTIME_DIAGNOSTIC;
}

export function getFaceLandmarkerRuntimeCapabilities() {
  return Object.freeze({
    webAssembly: typeof globalThis.WebAssembly === "object",
    webGl:
      typeof globalThis.WebGLRenderingContext === "function" ||
      typeof globalThis.WebGL2RenderingContext === "function"
  });
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

async function captureBrowserRuntimeError(operation) {
  let browserError = null;
  const handleError = (event) => {
    if (BROWSER_RUNTIME_ERROR_NAMES.has(event?.error?.name)) {
      browserError = event.error;
    }
  };

  window.addEventListener("error", handleError);
  try {
    return await operation();
  } catch (error) {
    if (browserError && browserError !== error) {
      throw new AggregateError([browserError, error], "browser_runtime_operation_failed");
    }
    throw error;
  } finally {
    window.removeEventListener("error", handleError);
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

  return captureBrowserRuntimeError(() =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      numFaces: 2,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
      runningMode: "VIDEO"
    })
  );
}

async function createBundledFaceLandmarker({ preferCpu = false } = {}) {
  assertBrowserRuntime();

  const { FaceLandmarker, FilesetResolver } = await loadMediaPipeModule();
  let fileset;

  try {
    fileset = await captureBrowserRuntimeError(() =>
      FilesetResolver.forVisionTasks(resolveSameOriginAsset(WASM_BASE_PATH))
    );
  } catch (error) {
    throw createInitializationError("wasm_fileset", error);
  }

  if (preferCpu) {
    try {
      const instance = await createTask(FaceLandmarker, fileset);
      return registerInstanceDiagnostic(instance, {
        attempt: 1,
        delegate: "cpu",
        recoveryAttempted: true
      });
    } catch (error) {
      throw createInitializationError("cpu_delegate_initialization", error, {
        attempt: 1,
        delegate: "cpu",
        recoveryAttempted: true
      });
    }
  }

  let gpuError;
  try {
    const instance = await createTask(FaceLandmarker, fileset, "GPU");
    return registerInstanceDiagnostic(instance, {
      attempt: 1,
      delegate: "gpu"
    });
  } catch (error) {
    gpuError = error;
  }

  try {
    const instance = await createTask(FaceLandmarker, fileset);
    return registerInstanceDiagnostic(instance, {
      attempt: 2,
      delegate: "cpu",
      recoveryAttempted: true
    });
  } catch (cpuError) {
    throw createInitializationError(
      "delegate_initialization",
      new AggregateError([gpuError, cpuError], "gpu_and_cpu_initialization_failed"),
      {
        attempt: 2,
        delegate: "cpu",
        recoveryAttempted: true
      }
    );
  }
}

async function createFaceLandmarker({ preferCpu = false } = {}) {
  assertBrowserRuntime();

  const testFactory = window.__bejewelyFaceLandmarkerFactory;
  if (typeof testFactory === "function") {
    const instance = await testFactory({ preferCpu });
    return registerInstanceDiagnostic(instance, {
      attempt: 1,
      delegate: preferCpu ? "cpu" : "gpu",
      recoveryAttempted: preferCpu
    });
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
