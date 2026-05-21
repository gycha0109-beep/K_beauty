"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

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

export default function LoginButtons({
  compact = false,
  label = "Google로 로그인",
  loadingLabel = "연결 중...",
  next = "/my"
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleGoogleSignIn() {
    setIsLoading(true);
    setErrorMessage("");

    try {
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
        setErrorMessage("Google login failed. Please try again.");
        setIsLoading(false);
      }
    } catch {
      setErrorMessage("Google login is not configured yet.");
      setIsLoading(false);
    }
  }

  // Kakao OAuth can be added here after provider settings are ready.
  return (
    <div className={compact ? "flex min-w-0 flex-col gap-1.5" : "flex flex-col gap-3"}>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className={
          compact
            ? "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full border border-[#ead2ca] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#5a2d3c] transition hover:border-[#dbaea4] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df] dark:hover:border-[#6a4050] dark:hover:bg-[#352430]"
            : "inline-flex min-h-11 items-center justify-center rounded-full border border-[#ead2ca] bg-white px-4 py-2 text-sm font-semibold text-[#5a2d3c] transition hover:bg-[#fff8f3] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df] dark:hover:bg-[#352430]"
        }
      >
        {isLoading ? loadingLabel : label}
      </button>
      {errorMessage ? (
        <p className={compact ? "max-w-[180px] text-[11px] text-red-600" : "text-sm text-red-600"}>
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
