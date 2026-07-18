"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ResultShareCard from "@/components/result/ResultShareCard";
import { buildResultFingerprint, getSharePath } from "@/lib/analysis-results";
import { getBrowserPermanentSupabaseAccessToken } from "@/lib/supabase/browser-client";
import { writeSafeLog } from "@/lib/security/error-redaction";
import {
  clearAnonymousWriteGrantState,
  clearResultWriteAccessToken,
  createAnonymousResultPersistencePayload,
  readAnonymousWriteGrantState
} from "@/lib/write-access-client";

const SHARE_SESSION_KEY = "skinTestShare";

const ACTION_COPY = {
  ko: {
    groupLabel: "결과 공유",
    copy: "링크 복사",
    share: "공유",
    saveImage: "이미지 저장",
    copied: "링크를 복사했습니다.",
    sharedFallback: "공유가 어려워 링크를 복사했습니다.",
    savedMessage: "공유 링크가 준비되었습니다.",
    imageSaved: "이미지를 저장했습니다.",
    saveError: "공유 링크를 만들지 못했습니다.",
    sessionExpired: "저장 세션이 만료되었습니다. 다시 진단해 주세요.",
    imageError: "이미지를 저장하지 못했습니다.",
    shareText: "내 피부 결과를 확인해보세요"
  },
  en: {
    groupLabel: "Share result",
    copy: "Copy link",
    share: "Share",
    saveImage: "Save image",
    copied: "Link copied.",
    sharedFallback: "Native share failed, so the link was copied.",
    savedMessage: "Share link is ready.",
    imageSaved: "Image saved.",
    saveError: "Failed to prepare the share link.",
    sessionExpired: "The save session expired. Please run the analysis again.",
    imageError: "Failed to save the image.",
    shareText: "Check out my skin result"
  }
};

function getActionCopy(locale = "ko") {
  return ACTION_COPY[locale] || ACTION_COPY.ko;
}

function getAbsoluteShareUrl(shareId) {
  if (typeof window === "undefined") {
    return getSharePath(shareId);
  }

  return `${window.location.origin}${getSharePath(shareId)}`;
}

function readSavedShare(fingerprint) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(SHARE_SESSION_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed?.fingerprint === fingerprint ? parsed : null;
  } catch {
    return null;
  }
}

function writeSavedShare(payload) {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(SHARE_SESSION_KEY, JSON.stringify(payload));
}

async function getShareAccessToken() {
  return getBrowserPermanentSupabaseAccessToken();
}

async function tryWriteClipboardText(text) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    writeSafeLog("warn", {
      event: "client_operation_failed",
      category: "browser_api_unavailable",
      operation: "client",
      dependency: "browser",
      retryable: false
    });
    return false;
  }
}

function ShareActionIcon({ type }) {
  if (type === "image") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <path
          d="M5.5 19h13a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 18.5 5h-13A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="m6.8 16.8 4.15-4.55 3.15 3.1 1.8-2.05 2.8 3.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M8.3 8.7h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "share") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <path d="M8.4 12.8 15.6 17M15.6 7 8.4 11.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        <path d="M6.4 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2ZM17.6 8.9a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2ZM17.6 20.3a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M8 7.5V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-1.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M6 8h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ResultShareActions({ result, submission, locale = "ko", variant = "card" }) {
  const copy = getActionCopy(locale);
  const exportRef = useRef(null);
  const fingerprint = useMemo(() => buildResultFingerprint(result, submission), [result, submission]);
  const [shareInfo, setShareInfo] = useState(null);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExportMounted, setIsExportMounted] = useState(false);

  useEffect(() => {
    const saved = readSavedShare(fingerprint);

    if (saved?.shareId) {
      setShareInfo(saved);
      return;
    }

    setShareInfo(null);
    setStatus("");
  }, [fingerprint, result, submission]);

  async function saveResult({ force = false, publish = false } = {}) {
    if (!result || !submission?.form) {
      setStatus(copy.sessionExpired);
      return null;
    }

    try {
      setIsSaving(true);
      setStatus("");
      const supabaseAccessToken = await getShareAccessToken();
      const token = supabaseAccessToken;
      const anonymousWriteGrant = readAnonymousWriteGrantState();
      const resultWriteAccessToken = token ? null : anonymousWriteGrant.resultToken;
      const analysisRunId = token ? null : anonymousWriteGrant.analysisRunId;
      const resultPayload = resultWriteAccessToken
        ? createAnonymousResultPersistencePayload(result)
        : result;
      const hasExistingShareId = Boolean(shareInfo?.shareId);

      if (!resultPayload || (!token && (!resultWriteAccessToken || !analysisRunId) && !hasExistingShareId)) {
        setStatus(copy.sessionExpired);
        return null;
      }

      if (token) {
        clearAnonymousWriteGrantState();
      }

      if (
        !force &&
        shareInfo?.shareId &&
        (!supabaseAccessToken || shareInfo?.savedWithAuth) &&
        (!publish || shareInfo?.isPublic)
      ) {
        setStatus(copy.savedMessage);
        return shareInfo;
      }

      const headers = {
        "Content-Type": "application/json"
      };

      if (resultWriteAccessToken) {
        headers["x-kbeauty-result-write-token"] = resultWriteAccessToken;
      }

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch("/api/results", {
        method: "POST",
        headers,
        body: JSON.stringify({
          locale,
          result: resultPayload,
          submission,
          share: true,
          shareId: shareInfo?.shareId || undefined,
          analysisRunId: analysisRunId || undefined
        })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.shareId) {
        if ([
          "anonymous_write_token_required",
          "anonymous_write_token_invalid",
          "anonymous_write_token_expired",
          "anonymous_write_token_scope_mismatch",
          "anonymous_write_principal_mismatch",
          "anonymous_write_resource_mismatch"
        ].includes(data?.error)) {
          clearResultWriteAccessToken();
        }

        const responseError = response.status === 401
          ? copy.sessionExpired
          : copy.saveError;

        throw new Error(responseError);
      }

      const nextShare = {
        shareId: data.shareId,
        sharePath: data.sharePath || getSharePath(data.shareId),
        shareUrl: getAbsoluteShareUrl(data.shareId),
        fingerprint,
        savedWithAuth: Boolean(supabaseAccessToken),
        isPublic: data.publicShared === true || publish
      };

      setShareInfo(nextShare);
      writeSavedShare(nextShare);
      if (resultWriteAccessToken) {
        clearResultWriteAccessToken();
      }
      setStatus(copy.savedMessage);
      return nextShare;
    } catch {
      writeSafeLog("warn", {
        event: "client_operation_failed",
        category: "network_unavailable",
        operation: "client",
        dependency: "application",
        retryable: true
      });
      setStatus(copy.saveError);
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopy() {
    const saved = await saveResult({ publish: true });

    if (!saved?.shareUrl) {
      return;
    }

    const copied = await tryWriteClipboardText(saved.shareUrl);

    setStatus(copied ? copy.copied : saved.shareUrl);
  }

  async function handleShare() {
    const saved = await saveResult({ publish: true });

    if (!saved?.shareUrl) {
      return;
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: locale === "en" ? "K-Beauty Result" : "K-뷰티 결과",
          text: copy.shareText,
          url: saved.shareUrl
        });
        return;
      } catch {
        writeSafeLog("warn", {
          event: "client_operation_failed",
          category: "browser_api_unavailable",
          operation: "client",
          dependency: "browser",
          retryable: false
        });
      }
    }

    const copied = await tryWriteClipboardText(saved.shareUrl);
    setStatus(copied ? copy.sharedFallback : saved.shareUrl);
  }

  async function handleDownloadImage() {
    try {
      setIsDownloading(true);
      setIsExportMounted(true);
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });

      if (!exportRef.current) {
        return;
      }

      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#fffdf9"
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `k-beauty-result-${Date.now()}.png`;
      link.click();
      setStatus(copy.imageSaved);
    } catch {
      writeSafeLog("warn", {
        event: "client_operation_failed",
        category: "browser_api_unavailable",
        operation: "client",
        dependency: "browser",
        retryable: false
      });
      setStatus(copy.imageError);
    } finally {
      setIsDownloading(false);
      setIsExportMounted(false);
    }
  }

  async function handleUnpublish() {
    if (!shareInfo?.shareId || !shareInfo?.savedWithAuth || !shareInfo?.isPublic) {
      return;
    }

    try {
      setIsSaving(true);
      const token = await getShareAccessToken();
      if (!token) {
        setStatus(copy.sessionExpired);
        return;
      }

      const response = await fetch(`/api/results/${encodeURIComponent(shareInfo.shareId)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ isPublic: false })
      });

      if (!response.ok) {
        throw new Error("unpublish_failed");
      }

      const nextShare = { ...shareInfo, isPublic: false };
      setShareInfo(nextShare);
      writeSavedShare(nextShare);
      setStatus(locale === "en" ? "Sharing stopped." : "Sharing has been stopped.");
    } catch {
      setStatus(copy.saveError);
    } finally {
      setIsSaving(false);
    }
  }

  const isHeaderVariant = variant === "header";
  const isCompactVariant = variant === "compact";
  const containerClassName = isCompactVariant
    ? "w-full sm:w-auto"
    : isHeaderVariant
      ? "w-full sm:w-auto"
      : "rounded-[1.3rem] border border-[#ead2ca] bg-[#fffaf6] p-4 dark:border-[#3a2630] dark:bg-[#2f202a]";
  const actionsClassName = isCompactVariant ? "flex items-center gap-1.5" : "mt-2 flex flex-wrap gap-2";
  const buttonClassName = isCompactVariant
    ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#ead9d6] bg-white/55 text-[#203755] shadow-sm transition hover:border-[#d8b7ad] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#5a3a48] dark:bg-[#301f28]/70 dark:text-[#f4d7df] dark:hover:bg-[#352430]"
    : isHeaderVariant
      ? "inline-flex min-h-9 flex-1 items-center justify-center whitespace-nowrap rounded-full border border-[#ead9d6] bg-white/70 px-3 py-2 text-[11px] font-medium text-[#6e4050] transition hover:bg-white disabled:opacity-60 dark:border-[#5a3a48] dark:bg-[#301f28]/80 dark:text-[#c8aeb8] dark:hover:bg-[#352430] sm:flex-none"
      : "ui-button-secondary min-h-10 px-3 text-sm font-medium";
  const actions = [
    {
      key: "copy",
      label: copy.copy,
      icon: "copy",
      onClick: handleCopy,
      disabled: isSaving
    },
    {
      key: "share",
      label: copy.share,
      icon: "share",
      onClick: handleShare,
      disabled: isSaving
    },
    {
      key: "image",
      label: copy.saveImage,
      icon: "image",
      onClick: handleDownloadImage,
      disabled: isDownloading
    },
    ...(shareInfo?.savedWithAuth && shareInfo?.isPublic
      ? [{
          key: "unpublish",
          label: locale === "en" ? "Stop sharing" : "Stop sharing",
          icon: "copy",
          onClick: handleUnpublish,
          disabled: isSaving
        }]
      : [])
  ];

  return (
    <>
      <div className={containerClassName}>
        {!isCompactVariant ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a6c78] dark:text-[#b99aa6]">
            {copy.groupLabel}
          </p>
        ) : null}
        <div className={actionsClassName}>
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={buttonClassName}
              aria-label={action.label}
              title={action.label}
            >
              {isCompactVariant ? (
                <>
                  <ShareActionIcon type={action.icon} />
                  <span className="sr-only">{action.label}</span>
                </>
              ) : (
                action.label
              )}
            </button>
          ))}
        </div>

        {!isCompactVariant && shareInfo?.shareUrl ? (
          <p className="ui-text-secondary mt-2 max-w-[18rem] truncate text-xs">{shareInfo.shareUrl}</p>
        ) : null}

        {status ? (
          <p className={isCompactVariant ? "mt-1.5 max-w-[13rem] truncate text-[11px] text-[#7a5360] dark:text-[#c8aeb8]" : "ui-text-secondary mt-2 text-xs"}>
            {status}
          </p>
        ) : null}
      </div>

      {isExportMounted ? (
        <div className="pointer-events-none fixed left-0 top-0 -z-10 opacity-0">
          <div ref={exportRef} className="w-[720px] p-6">
            <ResultShareCard
              locale={locale}
              skinType={submission?.form?.skinType || ""}
              mainConcerns={submission?.form?.mainConcerns || (submission?.form?.mainConcern ? [submission.form.mainConcern] : [])}
              summary={result?.summary || ""}
              topPick={result?.topPick || null}
              categoryPicks={result?.alternative ? [result.alternative] : []}
              routineStructure={result?.routineStructure || null}
              routineAm={Array.isArray(result?.morning) && result.morning.length ? result.morning : result?.amFocus ? [result.amFocus] : []}
              routinePm={Array.isArray(result?.night) && result.night.length ? result.night : result?.pmFocus ? [result.pmFocus] : []}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
