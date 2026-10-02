"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PremiumFaceLabSection from "@/components/full-report/PremiumFaceLabSection";
import FaceLabSimulationReviewPanel from "@/components/face-lab-test/FaceLabSimulationReviewPanel";
import {
  getFaceLabObservationAnalysis,
  isFaceLabResultEnvelope
} from "@/lib/face-lab-result-envelope";
import {
  buildPremiumFaceLabSummary,
  buildUnavailablePremiumFaceLab
} from "@/lib/premium-face-lab";
import { FACE_LAB_PRODUCTION_DAILY_LIMIT } from "@/lib/face-lab-usage-policy";
import { buildFaceLabSimulationPilotCapture } from "@/lib/face-lab-v2/evaluation/simulation-pilot-capture";

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

function simulationErrorMessage(code) {
  if (code === "simulation_authority_expired") {
    return "시뮬레이션 권한이 만료되었습니다. 사진 분석을 다시 실행해 주세요.";
  }
  if (code === "simulation_authority_invalid" || code === "simulation_authority_mismatch") {
    return "분석한 사진 또는 Face Lab 분석 정보가 변경되었습니다. 사진 분석을 다시 실행해 주세요.";
  }
  if (code === "target_style_not_confirmed" || code === "route_not_committed") {
    return "스타일 방향을 확정한 뒤 AI 시뮬레이션을 생성해 주세요.";
  }
  if (code === "canonical_look_unavailable" || code === "render_spec_unavailable") {
    return "선택한 스타일 경로는 아직 AI 시뮬레이션으로 변환할 수 없습니다.";
  }
  if (code === "analysis_rate_limited") {
    return "테스트 시뮬레이션 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (code === "analysis_request_in_progress") {
    return "같은 시뮬레이션 요청이 이미 처리 중입니다.";
  }
  if (code === "analysis_request_already_completed") {
    return "이 요청은 이미 처리되었습니다. 결과를 받지 못했다면 새 시뮬레이션을 실행해 주세요.";
  }
  if (code === "analysis_idempotency_conflict") {
    return "요청 상태가 변경되었습니다. 다시 생성해 주세요.";
  }
  if (code === "simulation_unavailable") {
    return "AI 시뮬레이션 서비스를 현재 사용할 수 없습니다.";
  }
  if (code === "simulation_failed" || code === "analysis_request_failed") {
    return "AI 시뮬레이션 생성에 실패했습니다. 다시 시도해 주세요.";
  }
  return "AI 시뮬레이션을 생성하지 못했습니다.";
}

function reviewErrorMessage(code) {
  if (code === "simulation_review_ticket_expired") {
    return "이 시뮬레이션의 검토 권한이 만료되었습니다. 새 시뮬레이션을 생성해 주세요.";
  }
  if (
    code === "simulation_review_ticket_invalid" ||
    code === "simulation_review_ticket_mismatch"
  ) {
    return "현재 시뮬레이션과 검토 정보가 일치하지 않습니다. 새 시뮬레이션을 생성해 주세요.";
  }
  if (
    code === "route_not_committed" ||
    code === "canonical_look_unavailable" ||
    code === "render_spec_unavailable"
  ) {
    return "현재 스타일 경로의 검토 기준을 다시 만들 수 없습니다. 스타일 경로를 다시 확정해 주세요.";
  }
  if (code === "analysis_rate_limited") {
    return "테스트 검토 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (code === "simulation_review_unavailable") {
    return "시뮬레이션 검토 기능을 현재 사용할 수 없습니다.";
  }
  return "시뮬레이션 검토 정보를 처리하지 못했습니다.";
}

function jsonFileBlob(value) {
  return new Blob(
    [`${JSON.stringify(value, null, 2)}\n`],
    {
      type:
        "application/json"
    }
  );
}

async function writeDirectoryFile(
  directory,
  name,
  data
) {
  const handle =
    await directory.getFileHandle(
      name,
      {
        create: true
      }
    );
  const writable =
    await handle.createWritable();

  try {
    await writable.write(data);
    await writable.close();
  } catch (error) {
    try {
      await writable.abort();
    } catch {
      // Best-effort cleanup only.
    }
    throw error;
  }
}

function cleanError(payload) {
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  if (payload?.error === "analysis_rate_limited") {
    return "테스트 분석 요청이 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (
    typeof payload?.error === "string" &&
    payload.error.trim() &&
    !payload.error.startsWith("analysis_")
  ) {
    return payload.error.trim();
  }

  return "Face Lab 분석을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function FaceLabTestClient() {
  const inputRef = useRef(null);
  const simulationRequestSequenceRef = useRef(0);
  const reviewRequestSequenceRef = useRef(0);
  const [photoUrl, setPhotoUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [faceLabSummary, setFaceLabSummary] = useState(
    buildUnavailablePremiumFaceLab()
  );
  const [faceLabAnalysis, setFaceLabAnalysis] = useState(null);
  const [resultKey, setResultKey] = useState("face-lab-test-empty");
  const [sourceImageFile, setSourceImageFile] = useState(null);
  const [simulationAuthority, setSimulationAuthority] = useState(null);
  const [simulationState, setSimulationState] = useState(null);
  const [simulationStatus, setSimulationStatus] = useState("idle");
  const [simulationError, setSimulationError] = useState("");
  const [simulationImageUrl, setSimulationImageUrl] = useState("");
  const [simulationImageBlob, setSimulationImageBlob] = useState(null);
  const [simulationMeta, setSimulationMeta] = useState(null);
  const [reviewAuthority, setReviewAuthority] = useState(null);
  const [reviewTemplate, setReviewTemplate] = useState(null);
  const [reviewStatus, setReviewStatus] = useState("idle");
  const [reviewError, setReviewError] = useState("");
  const [reviewResult, setReviewResult] = useState(null);
  const [pilotCaptureStatus, setPilotCaptureStatus] = useState("idle");
  const [pilotCaptureError, setPilotCaptureError] = useState("");

  useEffect(() => {
    return () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [photoUrl]);

  useEffect(() => {
    return () => {
      if (simulationImageUrl) {
        URL.revokeObjectURL(simulationImageUrl);
      }
    };
  }, [simulationImageUrl]);

  const resetReview = useCallback(() => {
    reviewRequestSequenceRef.current += 1;
    setReviewAuthority(null);
    setReviewTemplate(null);
    setReviewStatus("idle");
    setReviewError("");
    setReviewResult(null);
    setPilotCaptureStatus("idle");
    setPilotCaptureError("");
  }, []);

  const resetSimulation = useCallback(() => {
    simulationRequestSequenceRef.current += 1;
    resetReview();
    setSimulationStatus("idle");
    setSimulationError("");
    setSimulationMeta(null);
    setSimulationImageBlob(null);
    setSimulationImageUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return "";
    });
  }, [resetReview]);

  const handleSimulationStateChange = useCallback((value) => {
    setSimulationState(value?.selectedRouteId ? value : null);
    resetSimulation();
  }, [resetSimulation]);

  const resetAnalysis = () => {
    setStatus("idle");
    setError("");
    setFaceLabSummary(buildUnavailablePremiumFaceLab());
    setFaceLabAnalysis(null);
    setSourceImageFile(null);
    setSimulationAuthority(null);
    setSimulationState(null);
    resetSimulation();
    setResultKey(`face-lab-test-empty-${Date.now()}`);
  };

  const analyze = async (file) => {
    if (!file) return;

    if (!ACCEPTED_TYPES.has(file.type)) {
      setError("JPEG, PNG, WEBP 이미지만 사용할 수 있습니다.");
      return;
    }

    const nextPhotoUrl = URL.createObjectURL(file);
    setPhotoUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return nextPhotoUrl;
    });
    resetAnalysis();
    setSourceImageFile(file);
    setStatus("analyzing");

    const formData = new FormData();
    formData.append("image", file);
    formData.append("locale", "ko");

    try {
      const response = await fetch("/api/face-reading-test", {
        method: "POST",
        body: formData
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(cleanError(payload));
        setStatus("error");
        return;
      }

      if (!isFaceLabResultEnvelope(payload)) {
        setError("Face Lab 응답 형식이 올바르지 않습니다.");
        setStatus("error");
        return;
      }

      const analysis = getFaceLabObservationAnalysis(payload);
      const summary = buildPremiumFaceLabSummary(payload, { locale: "ko" });

      if (!analysis) {
        const reason =
          payload?.failureReason === "multiple_faces"
            ? "한 장에 한 명만 나오도록 다시 촬영해 주세요."
            : payload?.failureReason === "face_not_detected"
              ? "얼굴을 찾지 못했습니다. 정면에 가까운 밝은 사진으로 다시 시도해 주세요."
              : payload?.failureReason === "vision_request_failed" ||
                  payload?.failureReason === "api_key_missing"
                ? "Face Lab 분석 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
                : "현재 사진에서는 Face Lab 판단에 필요한 얼굴 근거가 충분하지 않습니다.";

        setError(reason);
        setFaceLabSummary(summary);
        setStatus("error");
        return;
      }

      const authority =
        typeof payload?.simulationAuthority?.token === "string" &&
        payload.simulationAuthority.token.trim()
          ? payload.simulationAuthority
          : null;

      setFaceLabSummary(summary);
      setFaceLabAnalysis(analysis);
      setSimulationAuthority(authority);
      if (!authority) {
        setSimulationError(
          "AI 시뮬레이션 권한을 발급받지 못했습니다. 사진 분석을 다시 실행해 주세요."
        );
      }
      setResultKey(
        `face-lab-test-${payload.analyzedAt || Date.now()}`
      );
      setStatus("ready");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("네트워크 오류로 Face Lab 분석을 완료하지 못했습니다.");
      setStatus("error");
    }
  };

  const loadReviewTemplate = useCallback(
    async (authority, stateValue) => {
      if (
        !authority?.token ||
        !authority?.caseId ||
        !faceLabAnalysis ||
        !stateValue?.selectedRouteId
      ) {
        setReviewStatus("error");
        setReviewError("시뮬레이션 검토 권한을 확인할 수 없습니다.");
        return;
      }

      const requestSequence =
        reviewRequestSequenceRef.current;

      setReviewStatus("loading");
      setReviewError("");
      setReviewResult(null);

      try {
        const response = await fetch("/api/face-lab-simulation-review-test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mode: "template",
            reviewTicket: authority.token,
            analysis: faceLabAnalysis,
            faceLabV2State: stateValue,
            locale: "ko"
          })
        });
        const payload = await response.json().catch(() => null);

        if (
          requestSequence !==
          reviewRequestSequenceRef.current
        ) {
          return;
        }

        if (!response.ok || payload?.success !== true || payload?.mode !== "template") {
          setReviewStatus("error");
          setReviewError(reviewErrorMessage(payload?.error));
          return;
        }

        if (
          payload.caseId !== authority.caseId ||
          payload?.trace?.renderSpecSha256 !== authority.renderSpecSha256 ||
          payload?.trace?.providerConfigVersion !== authority.providerConfigVersion ||
          payload?.trace?.providerConfigFingerprint !== authority.providerConfigFingerprint
        ) {
          setReviewStatus("error");
          setReviewError("시뮬레이션 검토 기준이 현재 생성 결과와 일치하지 않습니다.");
          return;
        }

        setReviewTemplate(payload);
        setReviewStatus("ready");
      } catch {
        setReviewStatus("error");
        setReviewError("네트워크 오류로 시뮬레이션 검토 기준을 불러오지 못했습니다.");
      }
    },
    [faceLabAnalysis]
  );

  const submitReview = useCallback(
    async (responses) => {
      if (
        !reviewAuthority?.token ||
        !reviewAuthority?.caseId ||
        !faceLabAnalysis ||
        !simulationState?.selectedRouteId ||
        reviewStatus === "submitting"
      ) {
        return;
      }

      const requestSequence =
        reviewRequestSequenceRef.current;

      setReviewStatus("submitting");
      setReviewError("");

      try {
        const response = await fetch("/api/face-lab-simulation-review-test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            mode: "submit",
            reviewTicket: reviewAuthority.token,
            analysis: faceLabAnalysis,
            faceLabV2State: simulationState,
            locale: "ko",
            reviewerRef: responses.reviewerRef,
            identity: responses.identity,
            editScope: responses.editScope,
            routeOperations: responses.routeOperations,
            colorTargets: responses.colorTargets
          })
        });
        const payload = await response.json().catch(() => null);

        if (
          requestSequence !==
          reviewRequestSequenceRef.current
        ) {
          return;
        }

        if (
          !response.ok ||
          payload?.success !== true ||
          payload?.mode !== "submit" ||
          payload?.caseId !== reviewAuthority.caseId ||
          payload?.trace?.providerConfigVersion !== reviewAuthority.providerConfigVersion ||
          payload?.trace?.providerConfigFingerprint !== reviewAuthority.providerConfigFingerprint
        ) {
          setReviewStatus("error");
          setReviewError(reviewErrorMessage(payload?.error));
          return;
        }

        setReviewResult({
          caseId: payload.caseId,
          identityScopeReview: payload.identityScopeReview,
          routeColorReview: payload.routeColorReview,
          summary: payload.summary
        });
        setReviewStatus("submitted");
      } catch {
        setReviewStatus("error");
        setReviewError("네트워크 오류로 시뮬레이션 평가를 확정하지 못했습니다.");
      }
    },
    [
      faceLabAnalysis,
      reviewAuthority,
      reviewStatus,
      simulationState
    ]
  );

  const resetReviewResult = useCallback(() => {
    setReviewResult(null);
    setReviewStatus(reviewTemplate ? "ready" : "idle");
    setReviewError("");
    setPilotCaptureStatus("idle");
    setPilotCaptureError("");
  }, [reviewTemplate]);

  const savePilotCapture = useCallback(async () => {
    if (
      !sourceImageFile ||
      !simulationImageBlob ||
      !simulationMeta ||
      !faceLabAnalysis ||
      !simulationState?.selectedRouteId ||
      !reviewResult ||
      reviewStatus !== "submitted" ||
      pilotCaptureStatus === "saving"
    ) {
      return;
    }

    if (
      simulationMeta.reviewCaseId !==
      reviewResult.caseId
    ) {
      setPilotCaptureStatus("error");
      setPilotCaptureError(
        "현재 리뷰와 시뮬레이션 Case ID가 일치하지 않습니다."
      );
      return;
    }

    const capture =
      buildFaceLabSimulationPilotCapture({
        caseId:
          reviewResult.caseId,
        locale: "ko",
        sourceMimeType:
          sourceImageFile.type,
        outputMimeType:
          simulationImageBlob.type,
        analysis:
          faceLabAnalysis,
        faceLabV2State:
          simulationState,
        responseMeta:
          simulationMeta,
        identityScopeReview:
          reviewResult
            .identityScopeReview,
        routeColorReview:
          reviewResult
            .routeColorReview
      });

    if (capture.status !== "ready") {
      setPilotCaptureStatus("error");
      setPilotCaptureError(
        `Pilot Capture를 만들 수 없습니다: ${capture.reason || "invalid_capture"}`
      );
      return;
    }

    if (
      typeof window.showDirectoryPicker !==
      "function"
    ) {
      setPilotCaptureStatus("error");
      setPilotCaptureError(
        "이 브라우저에서는 로컬 private/ 저장을 지원하지 않습니다. 데스크톱 Chrome 또는 Edge에서 다시 시도해 주세요."
      );
      return;
    }

    setPilotCaptureStatus("saving");
    setPilotCaptureError("");

    try {
      let directory = null;

      try {
        directory =
          await window.showDirectoryPicker({
            mode: "readwrite"
          });
      } catch (error) {
        if (
          error?.name === "AbortError"
        ) {
          setPilotCaptureStatus("idle");
          return;
        }
        throw error;
      }

      if (
        directory.name !== "private"
      ) {
        setPilotCaptureStatus("error");
        setPilotCaptureError(
          "저장소의 private/ 폴더를 선택해 주세요. 다른 폴더에는 Pilot Capture를 저장하지 않습니다."
        );
        return;
      }

      await writeDirectoryFile(
        directory,
        capture.fileNames.sourceImage,
        sourceImageFile
      );
      await writeDirectoryFile(
        directory,
        capture.fileNames.outputImage,
        simulationImageBlob
      );
      await writeDirectoryFile(
        directory,
        capture.fileNames.identityScopeReview,
        jsonFileBlob(
          capture.reviews
            .identityScopeReview
        )
      );
      await writeDirectoryFile(
        directory,
        capture.fileNames.routeColorReview,
        jsonFileBlob(
          capture.reviews
            .routeColorReview
        )
      );
      await writeDirectoryFile(
        directory,
        capture.fileNames.manifest,
        jsonFileBlob(
          capture.manifest
        )
      );

      setPilotCaptureStatus("saved");
    } catch {
      setPilotCaptureStatus("error");
      setPilotCaptureError(
        "Pilot Capture 파일을 private/에 저장하지 못했습니다."
      );
    }
  }, [
    faceLabAnalysis,
    pilotCaptureStatus,
    reviewResult,
    reviewStatus,
    simulationImageBlob,
    simulationMeta,
    simulationState,
    sourceImageFile
  ]);

  const generateSimulation = async () => {
    if (
      !sourceImageFile ||
      !simulationAuthority?.token ||
      !faceLabAnalysis ||
      !simulationState?.selectedRouteId ||
      simulationStatus === "generating"
    ) {
      return;
    }

    if (!globalThis.crypto?.randomUUID) {
      setSimulationStatus("error");
      setSimulationError("이 브라우저에서는 안전한 시뮬레이션 요청 키를 만들 수 없습니다.");
      return;
    }

    resetSimulation();
    const requestSequence =
      simulationRequestSequenceRef.current;
    setSimulationStatus("generating");

    const formData = new FormData();
    formData.append("image", sourceImageFile);
    formData.append("locale", "ko");
    formData.append("simulationAuthority", simulationAuthority.token);
    formData.append("analysis", JSON.stringify(faceLabAnalysis));
    formData.append("faceLabV2State", JSON.stringify(simulationState));

    try {
      const response = await fetch("/api/face-lab-simulation-test", {
        method: "POST",
        headers: {
          "Idempotency-Key": globalThis.crypto.randomUUID()
        },
        body: formData
      });

      if (
        requestSequence !==
        simulationRequestSequenceRef.current
      ) {
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setSimulationStatus("error");
        setSimulationError(simulationErrorMessage(payload?.error));
        return;
      }

      const reviewCaseId =
        response.headers.get("X-Face-Lab-Review-Case-Id");
      const reviewTicket =
        response.headers.get("X-Face-Lab-Review-Ticket");
      const reviewExpiresAt =
        response.headers.get("X-Face-Lab-Review-Expires-At");
      const renderSpecSha256 =
        response.headers.get("X-Face-Lab-Render-Spec-SHA256");
      const providerConfigVersion =
        response.headers.get("X-Face-Lab-Provider-Config-Version");
      const providerConfigFingerprint =
        response.headers.get("X-Face-Lab-Provider-Config-Fingerprint");

      if (
        !reviewCaseId ||
        !reviewTicket ||
        !reviewExpiresAt ||
        !renderSpecSha256 ||
        !providerConfigVersion ||
        !providerConfigFingerprint
      ) {
        setSimulationStatus("error");
        setSimulationError(
          "시뮬레이션은 생성되었지만 검토 권한을 확인할 수 없습니다. 새 시뮬레이션을 생성해 주세요."
        );
        return;
      }

      const blob = await response.blob();

      if (
        requestSequence !==
        simulationRequestSequenceRef.current
      ) {
        return;
      }

      if (!blob.type.startsWith("image/")) {
        setSimulationStatus("error");
        setSimulationError("AI 시뮬레이션 응답 이미지 형식이 올바르지 않습니다.");
        return;
      }

      setSimulationImageBlob(blob);
      const nextImageUrl = URL.createObjectURL(blob);
      setSimulationImageUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return nextImageUrl;
      });
      setSimulationMeta({
        routeId: response.headers.get("X-Face-Lab-Route-Id") || simulationState.selectedRouteId,
        lookId: response.headers.get("X-Face-Lab-Look-Id") || null,
        renderSpecSha256,
        instructionVersion:
          response.headers.get("X-Face-Lab-Instruction-Version") || null,
        simulationVersion:
          response.headers.get("X-Face-Lab-Simulation-Version") || null,
        fidelity: response.headers.get("X-Face-Lab-Fidelity") || "not_evaluated",
        providerConfigVersion,
        providerConfigFingerprint,
        reviewCaseId
      });

      const nextReviewAuthority = {
        caseId: reviewCaseId,
        token: reviewTicket,
        expiresAt: reviewExpiresAt,
        renderSpecSha256,
        providerConfigVersion,
        providerConfigFingerprint
      };
      setReviewAuthority(nextReviewAuthority);
      setSimulationStatus("ready");
      void loadReviewTemplate(nextReviewAuthority, simulationState);
    } catch {
      setSimulationStatus("error");
      setSimulationError("네트워크 오류로 AI 시뮬레이션을 생성하지 못했습니다.");
    }
  };

  const canGenerateSimulation = Boolean(
    sourceImageFile &&
    simulationAuthority?.token &&
    faceLabAnalysis &&
    simulationState?.selectedRouteId &&
    simulationStatus !== "generating"
  );

  const onImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    void analyze(file);
  };

  return (
    <main className="ui-page ui-page-shell min-h-screen">
      <div className="mx-auto w-full max-w-[980px] px-4 pb-24 pt-5 sm:px-6 sm:pt-8">
        <header className="mb-4 rounded-[1.35rem] border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="ui-kicker">TEMPORARY TEST ROUTE</p>
              <h1 className="ui-title mt-1.5 text-2xl">Face Lab V2</h1>
              <p className="ui-text-secondary mt-2 max-w-2xl text-sm leading-6">
                풀리포트 결제 흐름을 거치지 않고 Face Lab만 직접 테스트하는 임시 화면입니다.
                사진은 테스트 전용 분석 경로로 처리되며 이 페이지는 테스트 후 제거할 수 있습니다.
              </p>
              <div className="mt-3 inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 rounded-full border border-emerald-300/60 bg-emerald-50/80 px-3 py-1.5 text-xs font-semibold text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100">
                <span>TEST MODE</span>
                <span aria-hidden="true">·</span>
                <span>
                  일반 Face Lab 이용 횟수(운영 기준 하루 최대 {FACE_LAB_PRODUCTION_DAILY_LIMIT}회)에 포함되지 않습니다.
                </span>
              </div>
              <p className="ui-text-secondary mt-2 text-xs leading-5">
                테스트 경로에는 비용 보호를 위한 별도 개발 한도만 적용됩니다.
              </p>
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={status === "analyzing"}
              className="ui-button-primary min-h-11 px-4 text-sm font-semibold disabled:cursor-wait disabled:opacity-60"
            >
              {status === "analyzing"
                ? "분석 중..."
                : status === "ready"
                  ? "다른 사진 테스트"
                  : "사진 선택"}
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onImageChange}
          />

          {photoUrl ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <img
                src={photoUrl}
                alt="Face Lab 테스트 사진 미리보기"
                className="h-28 w-24 shrink-0 rounded-xl border border-zinc-200 object-cover object-center dark:border-zinc-800 sm:h-32 sm:w-28"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {status === "analyzing"
                    ? "얼굴 특징을 분석하고 있습니다."
                    : status === "ready"
                      ? "분석 완료 · 아래에서 Face Lab을 테스트하세요."
                      : "다른 사진으로 다시 시도할 수 있습니다."}
                </p>
                <p className="ui-text-secondary mt-1 text-xs leading-5">
                  정면에 가깝고 밝으며 얼굴을 가리는 요소가 적은 사진이 가장 안정적입니다.
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
              {error}
            </div>
          ) : null}
        </header>

        {status === "idle" ? (
          <section className="ui-card p-6 text-center sm:p-8">
            <p className="ui-kicker">FACE LAB TEST</p>
            <h2 className="ui-title mt-2 text-xl">
              사진 한 장으로 바로 시작합니다.
            </h2>
            <p className="ui-text-secondary mx-auto mt-2 max-w-xl text-sm leading-6">
              이 URL에서는 Skin Match 설문이나 유료 리포트 진입 없이 Face Lab V2만 확인할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="ui-button-primary mt-5 min-h-11 px-5 text-sm font-semibold"
            >
              얼굴 사진 업로드
            </button>
          </section>
        ) : null}

        {status === "analyzing" ? (
          <section className="ui-card p-6 text-center sm:p-8">
            <p className="ui-kicker">ANALYZING</p>
            <h2 className="ui-title mt-2 text-xl">Face Lab 분석 중</h2>
            <p className="ui-text-secondary mt-2 text-sm leading-6">
              얼굴 관찰값을 만든 뒤 현재 Face Lab V2 엔진으로 연결하고 있습니다.
            </p>
          </section>
        ) : null}

        {status === "ready" && faceLabAnalysis ? (
          <div className="space-y-4">
            <PremiumFaceLabSection
              key={resultKey}
              faceLabSummary={faceLabSummary}
              faceLabAnalysis={faceLabAnalysis}
              photoUrl={photoUrl}
              locale="ko"
              resultKey={resultKey}
              savedReportId={null}
              onSimulationStateChange={handleSimulationStateChange}
            />

            <section className="ui-card p-5 sm:p-6" data-face-lab-simulation-uat>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="ui-kicker">AI VISUAL SIMULATION · UAT</p>
                  <h2 className="ui-title mt-2 text-xl">선택한 스타일 방향 시뮬레이션</h2>
                  <p className="ui-text-secondary mt-2 max-w-2xl text-sm leading-6">
                    Face Lab에서 확정한 경로만 서버에서 다시 검증해 이미지로 시뮬레이션합니다.
                    현재 단계에서는 실제 결과나 동일 제품 재현을 보장하지 않습니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void generateSimulation()}
                  disabled={!canGenerateSimulation}
                  className="ui-button-primary min-h-11 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {simulationStatus === "generating"
                    ? "시뮬레이션 생성 중..."
                    : simulationImageUrl
                      ? "새 시뮬레이션 생성"
                      : "AI 시뮬레이션 생성"}
                </button>
              </div>

              {!simulationState?.selectedRouteId ? (
                <p className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-sm leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/35 dark:text-zinc-300">
                  위 Face Lab에서 스타일 경로를 먼저 확정해 주세요.
                </p>
              ) : null}

              {simulationError ? (
                <p className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
                  {simulationError}
                </p>
              ) : null}

              {simulationStatus === "generating" ? (
                <div className="ui-card-subtle mt-4 p-4 text-sm leading-6">
                  선택한 스타일 방향과 허용된 변경 범위를 서버에서 다시 확인한 뒤 이미지를 생성하고 있습니다.
                </div>
              ) : null}

              {simulationImageUrl ? (
                <div className="mt-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <figure className="ui-card-subtle overflow-hidden p-3">
                      <figcaption className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        Before
                      </figcaption>
                      <img
                        src={photoUrl}
                        alt="AI 시뮬레이션 원본"
                        className="aspect-[4/5] w-full rounded-xl object-cover object-center"
                      />
                    </figure>
                    <figure className="ui-card-subtle overflow-hidden p-3">
                      <figcaption className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        Simulation
                      </figcaption>
                      <img
                        src={simulationImageUrl}
                        alt="Face Lab AI 시뮬레이션"
                        className="aspect-[4/5] w-full rounded-xl object-cover object-center"
                      />
                    </figure>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="ui-chip-compact px-3 py-1.5">
                      Route: {simulationMeta?.routeId || simulationState.selectedRouteId}
                    </span>
                    {simulationMeta?.lookId ? (
                      <span className="ui-chip-compact px-3 py-1.5">
                        Look: {simulationMeta.lookId}
                      </span>
                    ) : null}
                    <span className="ui-chip-compact px-3 py-1.5">
                      Fidelity: {simulationMeta?.fidelity || "not_evaluated"}
                    </span>
                    {simulationMeta?.renderSpecSha256 ? (
                      <span
                        className="ui-chip-compact px-3 py-1.5"
                        title={simulationMeta.renderSpecSha256}
                      >
                        Trace: {simulationMeta.renderSpecSha256.slice(0, 12)}
                      </span>
                    ) : null}
                  </div>
                  <p className="ui-text-secondary mt-3 text-xs leading-5">
                    Fidelity는 아직 평가되지 않았습니다. Gate G에서 정체성 보존, 경로 준수, 색상 충실도, 편집 범위를 별도로 검증합니다.
                  </p>
                </div>
              ) : null}
            </section>

            {simulationImageUrl && reviewAuthority ? (
              reviewStatus === "loading" ? (
                <section className="ui-card p-5 text-sm sm:p-6" data-face-lab-simulation-review-loading>
                  <p className="ui-kicker">GATE G · CALIBRATION REVIEW</p>
                  <p className="ui-text-secondary mt-2 leading-6">
                    현재 시뮬레이션에 연결된 검토 기준을 불러오고 있습니다.
                  </p>
                </section>
              ) : reviewTemplate ? (
                <FaceLabSimulationReviewPanel
                  key={reviewTemplate.caseId}
                  template={reviewTemplate}
                  submitStatus={reviewStatus}
                  submitError={reviewError}
                  result={reviewResult}
                  onSubmit={(responses) => void submitReview(responses)}
                  onResetResult={resetReviewResult}
                />
              ) : reviewError ? (
                <section className="ui-card p-5 sm:p-6" data-face-lab-simulation-review-error>
                  <p className="ui-kicker">GATE G · CALIBRATION REVIEW</p>
                  <p className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
                    {reviewError}
                  </p>
                </section>
              ) : null
            ) : null}

            {reviewStatus === "submitted" &&
            reviewResult &&
            simulationImageBlob ? (
              <section
                className="ui-card p-5 sm:p-6"
                data-face-lab-pilot-capture
              >
                <p className="ui-kicker">
                  GATE G-E2A-2 · PRIVATE PILOT CAPTURE
                </p>
                <h2 className="ui-title mt-2 text-lg">
                  검토 완료 Case를 로컬 private/에 저장
                </h2>
                <p className="ui-text-secondary mt-2 text-sm leading-6">
                  원본, 생성 결과, G-C/G-D 리뷰, G-B 입력 manifest를 같은 Case ID로 저장합니다.
                  서버에는 이미지를 추가 저장하지 않습니다.
                </p>
                <p className="ui-text-secondary mt-2 text-xs leading-5">
                  버튼을 누른 뒤 반드시 로컬 저장소의 <code>private</code> 폴더를 선택하세요.
                  다른 이름의 폴더는 저장을 거부합니다.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void savePilotCapture()}
                    disabled={pilotCaptureStatus === "saving"}
                    className="ui-button-primary min-h-11 px-4 text-sm font-semibold disabled:cursor-wait disabled:opacity-60"
                  >
                    {pilotCaptureStatus === "saving"
                      ? "Pilot Capture 저장 중..."
                      : "private/에 Pilot Capture 저장"}
                  </button>

                  {pilotCaptureStatus === "saved" ? (
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      저장 완료 · G-B evidence runner 입력 준비됨
                    </span>
                  ) : null}
                </div>

                {pilotCaptureError ? (
                  <p className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
                    {pilotCaptureError}
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
