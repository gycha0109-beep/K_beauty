"use client";

import { useEffect, useRef, useState } from "react";
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

function getAuthCallbackOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    return siteUrl.replace(/\/$/, "");
  }

  return "";
}

async function startGoogleSignIn(next) {
  const supabase = createBrowserSupabaseClient();
  const origin = getAuthCallbackOrigin();
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/my";
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
    }
  });

  if (error) {
    throw error;
  }
}

function showSavedAlert(isEnglish) {
  if (typeof window === "undefined") {
    return;
  }

  window.alert(isEnglish ? "You can continue today's routine in My skin." : "My skin에서 오늘 루틴을 이어볼 수 있어요.");
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

export default function SaveReportCTA({
  result,
  submission,
  faceLabFull,
  locale = "ko",
  onSaved = null,
  previousLabel = "",
  onPrevious = null
}) {
  const restoreAttemptedRef = useRef(false);
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [message, setMessage] = useState("");
  const isEnglish = locale === "en";
  const nextPath = isEnglish ? "/en/result" : "/result";

  useEffect(() => {
    setIsSaved(false);
    setMessage("");
  }, [result, submission, faceLabFull]);

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
    setMessage(isEnglish ? "Saving your previous result..." : "이전 결과를 저장하는 중입니다.");

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
          setMessage(isEnglish ? "Please sign in to save this result." : "로그인 후 결과를 저장할 수 있습니다.");
          return;
        }

        window.sessionStorage.removeItem(PENDING_SAVE_REPORT_KEY);
        setIsSaved(true);
        setMessage("");
        onSaved?.();
        showSavedAlert(isEnglish);
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
  }, [isAuthLoading, user, isEnglish, onSaved]);

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
      setIsSaving(true);
      setMessage("");

      try {
        await startGoogleSignIn(nextPath);
      } catch (error) {
        console.error("[result/save-report] google sign-in failed", error);
        setIsSaving(false);
        setMessage(
          isEnglish
            ? "Could not start Google sign-in. Please try again."
            : "Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요."
        );
      }
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const { unauthorized } = await saveReport(payload);

      if (unauthorized) {
        window.sessionStorage.setItem(PENDING_SAVE_REPORT_KEY, JSON.stringify(payload));
        setMessage(isEnglish ? "Please sign in to save this result." : "로그인 후 결과를 저장할 수 있습니다.");
        return;
      }

      window.sessionStorage.removeItem(PENDING_SAVE_REPORT_KEY);
      setIsSaved(true);
      onSaved?.();
      showSavedAlert(isEnglish);
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

  if (isSaved) {
    return (
      <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:max-w-[20rem]">
        <div className="inline-flex min-h-8 items-center justify-center rounded-full border border-[#ead9d6] bg-white/55 px-3 py-1.5 text-xs font-semibold text-[#6e4050] dark:border-[#5a3a48] dark:bg-[#301f28]/55 dark:text-[#f4d7df]">
          {isEnglish ? "\u2713 Saved" : "\u2713 \uc800\uc7a5\ub428"}
        </div>
        <div className={onPrevious ? "grid grid-cols-[0.76fr_1.24fr] gap-2" : ""}>
          {onPrevious ? (
            <button
              type="button"
              onClick={onPrevious}
              className="ui-button-secondary min-h-10 w-full px-3 text-sm font-semibold"
            >
              {previousLabel || (isEnglish ? "Back" : "\uc774\uc804")}
            </button>
          ) : null}
          <a href="/my" className="ui-button-secondary min-h-10 w-full px-3 text-sm font-semibold">
            {isEnglish ? "View saved result" : "\uc800\uc7a5\ub41c \uacb0\uacfc \ubcf4\ub7ec\uac00\uae30"}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:max-w-[20rem]">
      <button
        type="button"
        data-testid="save-report-to-account"
        onClick={handleSaveClick}
        disabled={isAuthLoading || isSaving}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#e2c5bf] bg-white/72 px-4 text-sm font-semibold text-[#5a2d3c] shadow-[0_12px_28px_rgba(52,20,35,0.08)] transition hover:border-[#dbaea4] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#5a3a48] dark:bg-[#301f28]/80 dark:text-[#f4d7df] dark:hover:bg-[#352430]"
      >
        {isSaving
          ? isEnglish
            ? user
              ? "Saving..."
              : "Opening Google..."
            : user
              ? "저장 중..."
              : "Google로 이동 중..."
          : user
            ? isEnglish
              ? "Save to My Skin"
              : "\ub0b4 \ud53c\ubd80 \uae30\ub85d\uc5d0 \uc800\uc7a5"
            : isEnglish
              ? "Sign in with Google to save"
              : "\ub0b4 \ud53c\ubd80 \uae30\ub85d\uc5d0 \uc800\uc7a5"}
      </button>

      {!isSaved ? (
        <p className="text-left text-[11px] leading-5 text-[#7a5360] dark:text-[#c8aeb8]">
          {isEnglish ? "Save this to continue today's routine in My skin." : "\uc800\uc7a5\ud558\uba74 \uc624\ub298 \ub8e8\ud2f4\uc744 My skin\uc5d0\uc11c \uc774\uc5b4\ubcfc \uc218 \uc788\uc5b4\uc694."}
        </p>
      ) : null}

      {message ? (
        <p className="text-left text-[11px] leading-5 text-[#7a5360] dark:text-[#c8aeb8] sm:text-right">
          {message}
        </p>
      ) : null}
    </div>
  );
}
