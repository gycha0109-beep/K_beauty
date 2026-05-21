"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ResultShareCard from "@/components/result/ResultShareCard";
import { buildResultFingerprint, getSharePath } from "@/lib/analysis-results";
import { getBrowserSupabaseAccessToken } from "@/lib/supabase/browser-client";
import { readWriteAccessToken } from "@/lib/write-access-client";

const SHARE_SESSION_KEY = "skinTestShare";

const ACTION_COPY = {
  ko: {
    groupLabel: "공유 옵션",
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
    groupLabel: "Share",
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
  return getBrowserSupabaseAccessToken();
}

async function tryWriteClipboardText(text) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("[result/share] clipboard write failed", error);
    return false;
  }
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

  async function saveResult({ force = false } = {}) {
    if (!result || !submission?.form) {
      return null;
    }

    try {
      setIsSaving(true);
      setStatus("");
      const writeAccessToken = readWriteAccessToken();
      const supabaseAccessToken = await getShareAccessToken();
      const token = supabaseAccessToken;

      if (!token && !writeAccessToken) {
        setStatus(copy.sessionExpired);
        return null;
      }

      if (!force && shareInfo?.shareId && (!supabaseAccessToken || shareInfo?.savedWithAuth)) {
        setStatus(copy.savedMessage);
        return shareInfo;
      }

      const headers = {
        "Content-Type": "application/json"
      };

      if (writeAccessToken) {
        headers["x-kbeauty-write-token"] = writeAccessToken;
      }

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch("/api/results", {
        method: "POST",
        headers,
        body: JSON.stringify({
          locale,
          result,
          submission,
          share: true
        })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.shareId) {
        const responseError = response.status === 401
          ? copy.sessionExpired
          : data?.error || copy.saveError;

        throw new Error(responseError);
      }

      const nextShare = {
        shareId: data.shareId,
        sharePath: data.sharePath || getSharePath(data.shareId),
        shareUrl: getAbsoluteShareUrl(data.shareId),
        fingerprint,
        savedWithAuth: Boolean(supabaseAccessToken)
      };

      setShareInfo(nextShare);
      writeSavedShare(nextShare);
      setStatus(copy.savedMessage);
      return nextShare;
    } catch (error) {
      console.error("[result/share] save failed", error);
      setStatus(copy.saveError);
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopy() {
    const saved = await saveResult();

    if (!saved?.shareUrl) {
      return;
    }

    const copied = await tryWriteClipboardText(saved.shareUrl);

    setStatus(copied ? copy.copied : saved.shareUrl);
  }

  async function handleShare() {
    const saved = await saveResult();

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
      } catch (error) {
        console.error("[result/share] native share failed", error);
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
    } catch (error) {
      console.error("[result/share] image export failed", error);
      setStatus(copy.imageError);
    } finally {
      setIsDownloading(false);
      setIsExportMounted(false);
    }
  }

  const isHeaderVariant = variant === "header";
  const containerClassName = isHeaderVariant
    ? "w-full sm:w-auto"
    : "rounded-[1.3rem] border border-[#ead2ca] bg-[#fffaf6] p-4 dark:border-[#3a2630] dark:bg-[#2f202a]";
  const buttonClassName = isHeaderVariant
    ? "inline-flex min-h-9 flex-1 items-center justify-center whitespace-nowrap rounded-full border border-[#ead9d6] bg-white/70 px-3 py-2 text-[11px] font-medium text-[#6e4050] transition hover:bg-white disabled:opacity-60 dark:border-[#5a3a48] dark:bg-[#301f28]/80 dark:text-[#c8aeb8] dark:hover:bg-[#352430] sm:flex-none"
    : "ui-button-secondary min-h-10 px-3 text-sm font-medium";

  return (
    <>
      <div className={containerClassName}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a6c78] dark:text-[#b99aa6]">
          {copy.groupLabel}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={isSaving}
            className={buttonClassName}
          >
            {copy.copy}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={isSaving}
            className={buttonClassName}
          >
            {copy.share}
          </button>
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={isDownloading}
            className={buttonClassName}
          >
            {copy.saveImage}
          </button>
        </div>

        {shareInfo?.shareUrl ? (
          <p className="ui-text-secondary mt-2 max-w-[18rem] truncate text-xs">{shareInfo.shareUrl}</p>
        ) : null}

        {status ? <p className="ui-text-secondary mt-2 text-xs">{status}</p> : null}
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
