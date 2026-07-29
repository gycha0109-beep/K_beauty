"use client";

import { useEffect, useRef, useState } from "react";
import {
  evaluateFaceGuide,
  FACE_GUIDE_STATE
} from "@/lib/face-guide/face-guide-evaluator.mjs";
import { getFaceLandmarker } from "@/lib/face-guide/face-landmarker-client";

const INFERENCE_INTERVAL_MS = 110;
const READY_STABLE_FRAMES = 6;
const MAX_CONSECUTIVE_ERRORS = 3;

const INITIAL_RESULT = Object.freeze({
  metrics: null,
  state: FACE_GUIDE_STATE.loading
});

export default function useFaceLandmarkerGuide({
  active,
  guideRef,
  videoRef
}) {
  const [result, setResult] = useState(INITIAL_RESULT);
  const animationFrameRef = useRef(null);
  const consecutiveErrorsRef = useRef(0);
  const lastInferenceAtRef = useRef(0);
  const lastStateRef = useRef(FACE_GUIDE_STATE.loading);
  const lastVideoTimeRef = useRef(-1);
  const stableFramesRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const publish = (nextResult) => {
      if (cancelled) {
        return;
      }

      const nextState = nextResult.state;
      if (
        nextState !== lastStateRef.current ||
        nextState === FACE_GUIDE_STATE.ready ||
        nextState === FACE_GUIDE_STATE.stabilizing
      ) {
        lastStateRef.current = nextState;
        setResult(nextResult);
      }
    };

    if (!active) {
      stableFramesRef.current = 0;
      consecutiveErrorsRef.current = 0;
      lastInferenceAtRef.current = 0;
      lastVideoTimeRef.current = -1;
      lastStateRef.current = FACE_GUIDE_STATE.loading;
      setResult(INITIAL_RESULT);
      return undefined;
    }

    publish(INITIAL_RESULT);

    const run = async () => {
      let faceLandmarker;

      try {
        faceLandmarker = await getFaceLandmarker();
      } catch {
        publish({ metrics: null, state: FACE_GUIDE_STATE.unavailable });
        return;
      }

      const detect = (timestamp) => {
        if (cancelled) {
          return;
        }

        animationFrameRef.current = window.requestAnimationFrame(detect);

        if (
          document.visibilityState === "hidden" ||
          timestamp - lastInferenceAtRef.current < INFERENCE_INTERVAL_MS
        ) {
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
          return;
        }

        lastInferenceAtRef.current = timestamp;
        lastVideoTimeRef.current = video.currentTime;

        try {
          const detection = faceLandmarker.detectForVideo(video, timestamp);
          const evaluated = evaluateFaceGuide({
            faceLandmarks: detection?.faceLandmarks,
            guideRect: guide.getBoundingClientRect(),
            mirrored: true,
            videoHeight: video.videoHeight,
            videoRect: video.getBoundingClientRect(),
            videoWidth: video.videoWidth
          });

          consecutiveErrorsRef.current = 0;

          if (evaluated.state === FACE_GUIDE_STATE.ready) {
            stableFramesRef.current += 1;
            if (stableFramesRef.current >= READY_STABLE_FRAMES) {
              publish(evaluated);
            } else {
              publish({
                metrics: evaluated.metrics,
                progress: stableFramesRef.current / READY_STABLE_FRAMES,
                state: FACE_GUIDE_STATE.stabilizing
              });
            }
            return;
          }

          stableFramesRef.current = 0;
          publish(evaluated);
        } catch {
          stableFramesRef.current = 0;
          consecutiveErrorsRef.current += 1;
          if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
            publish({ metrics: null, state: FACE_GUIDE_STATE.unavailable });
          }
        }
      };

      animationFrameRef.current = window.requestAnimationFrame(detect);
    };

    run();

    return () => {
      cancelled = true;
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [active, guideRef, videoRef]);

  return {
    isCaptureReady: result.state === FACE_GUIDE_STATE.ready,
    metrics: result.metrics,
    progress: result.progress || 0,
    state: result.state
  };
}
