"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LoginButtons from "@/components/auth/LoginButtons";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const PENDING_SAVE_REPORT_KEY = "pendingSaveReport";
const TRACKING_SESSION_KEY = "skinTestTrackingSessionId";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getVisibleUser(user) {
  if (!user || user.is_anonymous || user.app_metadata?.provider === "anonymous") {
    return null;
  }

  return user;
}

function safeJson(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function buildSurveySnapshot(submission) {
  const snapshot = safeJson(submission, {});

  if (!isPlainObject(snapshot)) {
    return {};
  }

  delete snapshot.imagePreviewDataUrl;
  delete snapshot.imagePreview;

  return snapshot;
}

function getSourceSessionId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(TRACKING_SESSION_KEY) || null;
}

function buildPendingSavePayload({ result, submission, faceLabFull }) {
  const freeResult = safeJson(result, {});
  const faceLab = safeJson(faceLabFull || result?.faceLab, {});

  return {
    reportType: "free",
    sourceType: "session",
    sourceSessionId: getSourceSessionId(),
    reportVersion: "free-v1",
    freeResult,
    faceLab,
    surveySnapshot: buildSurveySnapshot(submission),
    photoAnalysis:
      result?.photoAnalysis ??
      result?.photo_analysis ??
      result?.photoObservations ??
      faceLab?.photoAnalysis ??
      null
  };
}

async function saveReport(payload) {
  const response = await fetch("/api/my/save-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    return {
      unauthorized: true,
      data
    };
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "save_report_failed");
  }

  return {
    unauthorized: false,
    data
  };
}

export default function SaveReportCTA({ result, submission, faceLabFull, locale = "ko" }) {
  const router = useRouter();
  const restoreAttemptedRef = useRef(false);
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [message, setMessage] = useState("");
  const isEnglish = locale === "en";
  const nextPath = isEnglish ? "/en/result" : "/result";

  useEffect(() => {
    let isMounted = true;
    let supabase;

    try {
      supabase = createBrowserSupabaseClient();
    } catch {
      setIsAuthLoading(false);
      return () => {
        isMounted = false;
      };
    }

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!isMounted) {
          return;
        }

        setUser(getVisibleUser(data?.user));
        setIsAuthLoading(false);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setUser(null);
        setIsAuthLoading(false);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(getVisibleUser(session?.user));
      setIsAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isAuthLoading || !user || restoreAttemptedRef.current) {
      return;
    }

    const rawPendingPayload = window.sessionStorage.getItem(PENDING_SAVE_REPORT_KEY);

    if (!rawPendingPayload) {
      return;
    }

    restoreAttemptedRef.current = true;
    setIsSaving(true);
    setMessage(isEnglish ? "Saving your pending result..." : "이전 결과를 저장하는 중입니다...");

    let pendingPayload;

    try {
      pendingPayload = JSON.parse(rawPendingPayload);
    } catch {
      window.sessionStorage.removeItem(PENDING_SAVE_REPORT_KEY);
      setIsSaving(false);
      setMessage(isEnglish ? "The saved result data was invalid." : "저장 대기 결과 데이터가 올바르지 않습니다.");
      return;
    }

    saveReport(pendingPayload)
      .then(({ unauthorized }) => {
        if (unauthorized) {
          setShowLogin(true);
          setMessage(isEnglish ? "Please sign in to save this result." : "로그인 후 결과를 저장할 수 있습니다.");
          return;
        }

        window.sessionStorage.removeItem(PENDING_SAVE_REPORT_KEY);
        router.push("/my");
      })
      .catch((error) => {
        console.error("[result/save-report] pending save failed", error);
        setMessage(
          isEnglish
            ? "Could not save the result. The result page is still available."
            : "결과 저장에 실패했습니다. 결과 화면은 그대로 유지됩니다."
        );
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, [isAuthLoading, user, router, isEnglish]);

  async function handleSaveClick() {
    if (!result) {
      setMessage(isEnglish ? "There is no result to save." : "저장할 결과가 없습니다.");
      return;
    }

    const payload = buildPendingSavePayload({
      result,
      submission,
      faceLabFull
    });

    if (!user) {
      window.sessionStorage.setItem(PENDING_SAVE_REPORT_KEY, JSON.stringify(payload));
      setShowLogin(true);
      setMessage(isEnglish ? "Sign in with Google and this result will be saved." : "Google 로그인 후 이 결과를 저장합니다.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const { unauthorized } = await saveReport(payload);

      if (unauthorized) {
        window.sessionStorage.setItem(PENDING_SAVE_REPORT_KEY, JSON.stringify(payload));
        setShowLogin(true);
        setMessage(isEnglish ? "Please sign in to save this result." : "로그인 후 결과를 저장할 수 있습니다.");
        return;
      }

      window.sessionStorage.removeItem(PENDING_SAVE_REPORT_KEY);
      router.push("/my");
    } catch (error) {
      console.error("[result/save-report] save failed", error);
      setMessage(
        isEnglish
          ? "Could not save the result. The result page is still available."
          : "결과 저장에 실패했습니다. 결과 화면은 그대로 유지됩니다."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        data-testid="save-report-to-account"
        onClick={handleSaveClick}
        disabled={isAuthLoading || isSaving}
        className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full border border-[#ead2ca] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#5a2d3c] transition hover:border-[#dbaea4] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df] dark:hover:border-[#6a4050] dark:hover:bg-[#352430]"
      >
        {isSaving
          ? isEnglish
            ? "Saving..."
            : "저장 중..."
          : user
            ? isEnglish
              ? "Save to My"
              : "My에 저장"
            : isEnglish
              ? "Sign in to save"
              : "로그인하고 저장"}
      </button>

      {showLogin ? (
        <LoginButtons
          compact
          next={nextPath}
          label={isEnglish ? "Continue with Google" : "Google로 로그인"}
          loadingLabel={isEnglish ? "Connecting..." : "연결 중..."}
        />
      ) : null}

      {message ? (
        <p className="max-w-[18rem] text-right text-[11px] leading-5 text-[#7a5360] dark:text-[#c8aeb8]">
          {message}
        </p>
      ) : null}
    </div>
  );
}
