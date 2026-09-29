"use client";

import { useEffect, useRef, useState } from "react";
import PremiumFaceLabSection from "@/components/full-report/PremiumFaceLabSection";
import {
  getFaceLabObservationAnalysis,
  isFaceLabResultEnvelope
} from "@/lib/face-lab-result-envelope";
import {
  buildPremiumFaceLabSummary,
  buildUnavailablePremiumFaceLab
} from "@/lib/premium-face-lab";

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

function cleanError(payload) {
  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }

  return "Face Lab 분석을 완료하지 못했습니다. 다른 사진으로 다시 시도해 주세요.";
}

export default function FaceLabTestClient() {
  const inputRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [faceLabSummary, setFaceLabSummary] = useState(
    buildUnavailablePremiumFaceLab()
  );
  const [faceLabAnalysis, setFaceLabAnalysis] = useState(null);
  const [resultKey, setResultKey] = useState("face-lab-test-empty");

  useEffect(() => {
    return () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [photoUrl]);

  const resetAnalysis = () => {
    setStatus("idle");
    setError("");
    setFaceLabSummary(buildUnavailablePremiumFaceLab());
    setFaceLabAnalysis(null);
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
    setStatus("analyzing");

    const formData = new FormData();
    formData.append("image", file);
    formData.append("locale", "ko");

    try {
      const response = await fetch("/api/face-reading", {
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
              : "현재 사진에서는 Face Lab 판단에 필요한 얼굴 근거가 충분하지 않습니다.";

        setError(reason);
        setFaceLabSummary(summary);
        setStatus("error");
        return;
      }

      setFaceLabSummary(summary);
      setFaceLabAnalysis(analysis);
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
                사진은 기존 Face Lab 분석 경로로 처리되며 이 페이지는 테스트 후 제거할 수 있습니다.
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
                className="h-20 w-16 rounded-lg object-cover"
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
          <PremiumFaceLabSection
            key={resultKey}
            faceLabSummary={faceLabSummary}
            faceLabAnalysis={faceLabAnalysis}
            photoUrl={photoUrl}
            locale="ko"
            resultKey={resultKey}
            savedReportId={null}
          />
        ) : null}
      </div>
    </main>
  );
}
