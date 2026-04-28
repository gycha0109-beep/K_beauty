"use client";

import { toPng } from "html-to-image";
import { useEffect, useMemo, useRef, useState } from "react";
import ResultShareCard from "@/components/result/ResultShareCard";
import { buildResultFingerprint, getSharePath } from "@/lib/analysis-results";
import { getBrowserSupabaseAccessToken } from "@/lib/supabase/browser-client";
import { readWriteAccessToken } from "@/lib/write-access-client";

const SHARE_SESSION_KEY = "skinTestShare";

const ACTION_COPY = {
  ko: {
    save: "Save result",
    saved: "Saved",
    copy: "Copy link",
    share: "Share",
    saveImage: "Save image",
    saving: "저장 중...",
    copied: "링크를 복사했습니다.",
    sharedFallback: "공유를 열 수 없어 링크를 복사했습니다.",
    savedMessage: "결과를 저장했습니다.",
    imageSaved: "이미지를 저장했습니다.",
    saveError: "결과 저장에 실패했습니다.",
    sessionExpired: "보안을 위해 저장 세션이 만료되었습니다. 다시 분석해 주세요.",
    imageError: "이미지를 저장하지 못했습니다.",
    shareText: "내 피부 결과를 확인해보세요"
  },
  en: {
    save: "Save result",
    saved: "Saved",
    copy: "Copy link",
    share: "Share",
    saveImage: "Save image",
    saving: "Saving...",
    copied: "Link copied.",
    sharedFallback: "Native share failed, so the link was copied.",
    savedMessage: "Result saved.",
    imageSaved: "Image saved.",
    saveError: "Failed to save the result.",
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

export default function ResultShareActions({ result, submission, locale = "ko" }) {
  const copy = getActionCopy(locale);
  const exportRef = useRef(null);
  const fingerprint = useMemo(() => buildResultFingerprint(result, submission), [result, submission]);
  const [shareInfo, setShareInfo] = useState(null);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    void getShareAccessToken();
  }, []);

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

    await navigator.clipboard.writeText(saved.shareUrl);
    setStatus(copy.copied);
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

    await navigator.clipboard.writeText(saved.shareUrl);
    setStatus(copy.sharedFallback);
  }

  async function handleDownloadImage() {
    if (!exportRef.current) {
      return;
    }

    try {
      setIsDownloading(true);
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
    }
  }

  return (
    <>
      <div className="ui-card p-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => saveResult()}
            disabled={isSaving}
            className="ui-button-secondary min-h-11 px-3 text-sm font-medium"
          >
            {isSaving ? copy.saving : shareInfo?.shareId ? copy.saved : copy.save}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={isSaving}
            className="ui-button-secondary min-h-11 px-3 text-sm font-medium"
          >
            {copy.copy}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={isSaving}
            className="ui-button-secondary min-h-11 px-3 text-sm font-medium"
          >
            {copy.share}
          </button>
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={isDownloading}
            className="ui-button-secondary min-h-11 px-3 text-sm font-medium"
          >
            {copy.saveImage}
          </button>
        </div>

        {shareInfo?.shareUrl ? (
          <p className="ui-text-secondary mt-3 truncate text-xs">{shareInfo.shareUrl}</p>
        ) : null}

        {status ? <p className="ui-text-secondary mt-2 text-xs">{status}</p> : null}
      </div>

      <div className="pointer-events-none fixed left-0 top-0 -z-10 opacity-0">
        <div ref={exportRef} className="w-[720px] p-6">
          <ResultShareCard
            locale={locale}
            skinType={submission?.form?.skinType || ""}
            mainConcerns={submission?.form?.mainConcerns || (submission?.form?.mainConcern ? [submission.form.mainConcern] : [])}
            summary={result?.summary || ""}
            topPick={result?.topPick || null}
            categoryPicks={result?.alternative ? [result.alternative] : []}
            routineAm={result?.amFocus ? [result.amFocus] : []}
            routinePm={result?.pmFocus ? [result.pmFocus] : []}
          />
        </div>
      </div>
    </>
  );
}
