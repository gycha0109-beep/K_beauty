"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  evaluateFaceGuide,
  FACE_GUIDE_EVALUATION_MODE,
  FACE_GUIDE_STATE
} from "@/lib/face-guide/face-guide-evaluator.mjs";
import {
  getFaceLandmarkerErrorDiagnostic,
  getFaceLandmarkerInstanceDiagnostic,
  getFaceLandmarkerRuntimeCapabilities,
  getFaceLandmarker,
  markFaceLandmarkerGpuUnhealthy,
  resetFaceLandmarker
} from "@/lib/face-guide/face-landmarker-client";
import { writeSafeLog } from "@/lib/security/error-redaction";

const INFERENCE_INTERVAL_MS = 100;
const READY_HOLD_MS = 900;
const CAPTURE_SAMPLE_MAX_AGE_MS = 350;
const MAX_CONSECUTIVE_ERRORS = 3;
const MAX_INITIALIZATION_ATTEMPTS = 2;
const MAX_RUNTIME_RECOVERIES = 1;

const INITIAL_DIAGNOSTIC = Object.freeze({
  attempt: 0,
  delegate: "unknown",
  errorCategory: "none",
  errorCode: "none",
  errorName: "none",
  recoveryAttempted: false,
  stage: "none",
  webAssemblyCapable: false,
  webGlCapable: false
});

const INITIAL_RESULT = Object.freeze({
  ...INITIAL_DIAGNOSTIC,
  autoCaptureToken: 0,
  errorStage: null,
  metrics: null,
  progress: 0,
  state: FACE_GUIDE_STATE.loading
});

function wait(durationMs) {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

export default function useFaceLandmarkerGuide({ active, guideRef, videoRef }) {
  const [result, setResult] = useState(INITIAL_RESULT);
  const animationFrameRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const consecutiveErrorsRef = useRef(0);
  const lastInferenceAtRef = useRef(0);
  const lastDetectionTimestampRef = useRef(0);
  const lastStateRef = useRef(FACE_GUIDE_STATE.loading);
  const lastVideoTimeRef = useRef(-1);
  const latestEvaluationRef = useRef(null);
  const latestSampleAtRef = useRef(0);
  const readySinceRef = useRef(null);
  const autoCaptureIssuedRef = useRef(false);
  const autoCaptureSequenceRef = useRef(0);
  const diagnosticRef = useRef(INITIAL_DIAGNOSTIC);

  const evaluateCurrentFrame = useCallback((mode) => {
    const faceLandmarker = faceLandmarkerRef.current;
    const video = videoRef.current;
    const guide = guideRef.current;
    if (
      !faceLandmarker ||
      !video ||
      !guide ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      return null;
    }

    const now = performance.now();
    const timestamp = Math.max(now, lastDetectionTimestampRef.current + 0.01);
    lastDetectionTimestampRef.current = timestamp;
    const detection = faceLandmarker.detectForVideo(video, timestamp);
    const evaluated = evaluateFaceGuide({
      faceLandmarks: detection?.faceLandmarks,
      guideRect: guide.getBoundingClientRect(),
      mirrored: true,
      mode,
      videoHeight: video.videoHeight,
      videoRect: video.getBoundingClientRect(),
      videoWidth: video.videoWidth
    });

    latestEvaluationRef.current = evaluated;
    latestSampleAtRef.current = now;
    return evaluated;
  }, [guideRef, videoRef]);

  const confirmCurrentFrame = useCallback(() => {
    const latest = latestEvaluationRef.current;
    if (
      !active ||
      !latest ||
      latest.state !== FACE_GUIDE_STATE.ready ||
      performance.now() - latestSampleAtRef.current > CAPTURE_SAMPLE_MAX_AGE_MS
    ) {
      return false;
    }

    try {
      const confirmed = evaluateCurrentFrame(FACE_GUIDE_EVALUATION_MODE.enter);
      return confirmed?.state === FACE_GUIDE_STATE.ready;
    } catch (error) {
      writeSafeLog("warn", {
        event: "client_operation_failed",
        category: "browser_api_unavailable",
        operation: "face_guide_capture_confirmation",
        dependency: "mediapipe",
        retryable: true,
        error
      });
      return false;
    }
  }, [active, evaluateCurrentFrame]);

  const rearmAutoCapture = useCallback(() => {
    autoCaptureIssuedRef.current = false;
    readySinceRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let terminal = false;
    let runtimeRecoveries = 0;

    const publish = (nextResult) => {
      if (cancelled) return;
      const nextState = nextResult.state;
      if (
        nextState !== lastStateRef.current ||
        nextState === FACE_GUIDE_STATE.ready ||
        nextState === FACE_GUIDE_STATE.stabilizing
      ) {
        lastStateRef.current = nextState;
        setResult({
          ...diagnosticRef.current,
          ...nextResult
        });
      }
    };

    const setDiagnostic = (diagnostic) => {
      const capabilities = getFaceLandmarkerRuntimeCapabilities();
      diagnosticRef.current = {
        ...INITIAL_DIAGNOSTIC,
        ...diagnostic,
        webAssemblyCapable: capabilities.webAssembly,
        webGlCapable: capabilities.webGl
      };
    };

    const publishTerminalFailure = (error, overrides = {}) => {
      const diagnostic = getFaceLandmarkerErrorDiagnostic(error, overrides);
      setDiagnostic(diagnostic);
      console.error("[bejewely-face-guide-runtime]", {
        attempt: diagnosticRef.current.attempt,
        delegate: diagnosticRef.current.delegate,
        errorCategory: diagnosticRef.current.errorCategory,
        errorCode: diagnosticRef.current.errorCode,
        errorName: diagnosticRef.current.errorName,
        finalState: "unavailable",
        recoveryAttempted: diagnosticRef.current.recoveryAttempted,
        stage: diagnosticRef.current.stage,
        webAssemblyCapable: diagnosticRef.current.webAssemblyCapable,
        webGlCapable: diagnosticRef.current.webGlCapable
      });
      publish({
        autoCaptureToken: autoCaptureSequenceRef.current,
        errorStage: diagnosticRef.current.stage,
        metrics: null,
        progress: 0,
        state: FACE_GUIDE_STATE.unavailable
      });
    };

    const reset = () => {
      consecutiveErrorsRef.current = 0;
      lastInferenceAtRef.current = 0;
      lastDetectionTimestampRef.current = 0;
      lastVideoTimeRef.current = -1;
      latestEvaluationRef.current = null;
      latestSampleAtRef.current = 0;
      readySinceRef.current = null;
      autoCaptureIssuedRef.current = false;
      autoCaptureSequenceRef.current = 0;
      lastStateRef.current = FACE_GUIDE_STATE.loading;
      setDiagnostic(INITIAL_DIAGNOSTIC);
    };

    if (!active) {
      reset();
      faceLandmarkerRef.current = null;
      resetFaceLandmarker();
      setResult(INITIAL_RESULT);
      return undefined;
    }

    reset();
    publish(INITIAL_RESULT);

    const initialize = async ({ forceReload = false, preferCpu = false } = {}) => {
      let lastError = null;
      for (let attempt = 0; attempt < MAX_INITIALIZATION_ATTEMPTS; attempt += 1) {
        try {
          const instance = await getFaceLandmarker({
            forceReload: forceReload || attempt > 0,
            preferCpu: preferCpu || attempt > 0
          });
          setDiagnostic({
            ...getFaceLandmarkerInstanceDiagnostic(instance),
            attempt: attempt + 1
          });
          return instance;
        } catch (error) {
          lastError = error;
          if (attempt + 1 < MAX_INITIALIZATION_ATTEMPTS) {
            await wait(220);
          }
        }
      }
      throw lastError;
    };

    const run = async () => {
      try {
        faceLandmarkerRef.current = await initialize();
      } catch (error) {
        terminal = true;
        faceLandmarkerRef.current = null;
        resetFaceLandmarker();
        publishTerminalFailure(error);
        return;
      }

      const scheduleNext = (detect) => {
        if (!cancelled && !terminal) {
          animationFrameRef.current = window.requestAnimationFrame(detect);
        }
      };

      const recoverRuntime = async (detect, error) => {
        if (runtimeRecoveries >= MAX_RUNTIME_RECOVERIES) {
          terminal = true;
          faceLandmarkerRef.current = null;
          resetFaceLandmarker();
          publishTerminalFailure(error, {
            attempt: runtimeRecoveries + 1,
            delegate: diagnosticRef.current.delegate,
            recoveryAttempted: runtimeRecoveries > 0,
            stage: "inference"
          });
          return;
        }

        runtimeRecoveries += 1;
        readySinceRef.current = null;
        autoCaptureIssuedRef.current = false;
        setDiagnostic(getFaceLandmarkerErrorDiagnostic(error, {
          attempt: runtimeRecoveries,
          delegate: diagnosticRef.current.delegate,
          recoveryAttempted: true,
          stage: "inference_gpu_recovery"
        }));
        publish({
          autoCaptureToken: autoCaptureSequenceRef.current,
          errorStage: "inference_gpu_recovery",
          metrics: null,
          progress: 0,
          state: FACE_GUIDE_STATE.loading
        });
        writeSafeLog("warn", {
          event: "client_operation_failed",
          category: "browser_api_unavailable",
          operation: "face_guide_inference",
          dependency: "mediapipe",
          retryable: true,
          error
        });

        faceLandmarkerRef.current = null;
        markFaceLandmarkerGpuUnhealthy();
        try {
          faceLandmarkerRef.current = await initialize({ preferCpu: true });
          consecutiveErrorsRef.current = 0;
          lastDetectionTimestampRef.current = 0;
          lastVideoTimeRef.current = -1;
          scheduleNext(detect);
        } catch (recoveryError) {
          terminal = true;
          faceLandmarkerRef.current = null;
          resetFaceLandmarker();
          publishTerminalFailure(recoveryError, {
            attempt: runtimeRecoveries,
            delegate: "cpu",
            recoveryAttempted: true,
            stage: recoveryError?.stage || "inference_recovery"
          });
        }
      };

      const detect = (timestamp) => {
        if (cancelled || terminal) return;

        if (
          document.visibilityState === "hidden" ||
          timestamp - lastInferenceAtRef.current < INFERENCE_INTERVAL_MS
        ) {
          scheduleNext(detect);
          return;
        }

        const video = videoRef.current;
        const guide = guideRef.current;
        if (
          !video ||
          !guide ||
          video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
          !video.videoWidth ||
          !video.videoHeight ||
          video.currentTime === lastVideoTimeRef.current
        ) {
          scheduleNext(detect);
          return;
        }

        lastInferenceAtRef.current = timestamp;
        lastVideoTimeRef.current = video.currentTime;

        try {
          const previousState = latestEvaluationRef.current?.state;
          const mode =
            previousState === FACE_GUIDE_STATE.ready ||
            previousState === FACE_GUIDE_STATE.stabilizing
              ? FACE_GUIDE_EVALUATION_MODE.maintain
              : FACE_GUIDE_EVALUATION_MODE.enter;
          const evaluated = evaluateCurrentFrame(mode);
          if (!evaluated) {
            scheduleNext(detect);
            return;
          }

          consecutiveErrorsRef.current = 0;
          if (evaluated.state === FACE_GUIDE_STATE.ready) {
            const sampleAt = latestSampleAtRef.current;
            if (readySinceRef.current === null) {
              readySinceRef.current = sampleAt;
            }
            const stableDuration = sampleAt - readySinceRef.current;
            const progress = Math.min(1, stableDuration / READY_HOLD_MS);

            if (progress >= 1) {
              if (!autoCaptureIssuedRef.current) {
                autoCaptureIssuedRef.current = true;
                autoCaptureSequenceRef.current += 1;
              }
              publish({
                ...evaluated,
                autoCaptureToken: autoCaptureSequenceRef.current,
                errorStage: null,
                progress: 1
              });
            } else {
              publish({
                autoCaptureToken: autoCaptureSequenceRef.current,
                errorStage: null,
                metrics: evaluated.metrics,
                progress,
                state: FACE_GUIDE_STATE.stabilizing
              });
            }
          } else {
            readySinceRef.current = null;
            autoCaptureIssuedRef.current = false;
            publish({
              ...evaluated,
              autoCaptureToken: autoCaptureSequenceRef.current,
              errorStage: null,
              progress: 0
            });
          }
        } catch (error) {
          readySinceRef.current = null;
          autoCaptureIssuedRef.current = false;
          consecutiveErrorsRef.current += 1;
          if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
            void recoverRuntime(detect, error);
            return;
          }
        }

        scheduleNext(detect);
      };

      scheduleNext(detect);
    };

    void run();

    return () => {
      cancelled = true;
      terminal = true;
      faceLandmarkerRef.current = null;
      resetFaceLandmarker();
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [active, evaluateCurrentFrame]);

  const isCaptureReady = result.state === FACE_GUIDE_STATE.ready;
  return {
    autoCaptureToken: result.autoCaptureToken || 0,
    canCapture: isCaptureReady,
    confirmCurrentFrame,
    delegate: result.delegate,
    errorCategory: result.errorCategory,
    errorCode: result.errorCode,
    errorName: result.errorName,
    errorStage: result.errorStage || null,
    attempt: result.attempt,
    isCaptureReady,
    metrics: result.metrics,
    progress: result.progress || 0,
    rearmAutoCapture,
    recoveryAttempted: result.recoveryAttempted,
    webAssemblyCapable: result.webAssemblyCapable,
    webGlCapable: result.webGlCapable,
    state: result.state
  };
}
