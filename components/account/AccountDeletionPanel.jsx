"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import LoginButtons from "@/components/auth/LoginButtons";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const COPY = {
  ko: {
    eyebrow: "ACCOUNT · PRIVACY",
    title: "계정 삭제",
    description: "BEJEWELY 계정과 연결된 소비자용 피부·분석·추천·다이어리 데이터를 영구 삭제합니다.",
    signedOut: "계정을 삭제하려면 먼저 로그인해 주세요.",
    signIn: "Google로 로그인",
    connecting: "연결 중…",
    signedIn: "현재 로그인 계정",
    deleteButton: "계정 영구 삭제",
    deleting: "삭제 중…",
    confirm: "계정과 연결된 피부 프로필, 분석 결과, 추천 기록, 저장 리포트와 다이어리 기록을 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?",
    failed: "계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    support: "운영·보안 감사 기록과 연결된 계정은 자동 삭제가 중단될 수 있습니다.",
    deleted: "계정 삭제가 완료되었습니다.",
    home: "홈으로 이동"
  },
  en: {
    eyebrow: "ACCOUNT · PRIVACY",
    title: "Delete account",
    description: "Permanently delete your BEJEWELY account and associated consumer skin, analysis, recommendation, report, and diary data.",
    signedOut: "Sign in before requesting account deletion.",
    signIn: "Sign in with Google",
    connecting: "Connecting…",
    signedIn: "Signed-in account",
    deleteButton: "Delete account permanently",
    deleting: "Deleting…",
    confirm: "This permanently deletes your account and associated skin profile, analysis results, recommendations, saved reports, and diary records. This cannot be undone. Continue?",
    failed: "We could not delete the account. Please try again shortly.",
    support: "Automatic deletion can stop when an account is tied to protected operational or security audit records.",
    deleted: "Your account has been deleted.",
    home: "Go to home"
  }
};

function getVisibleUser(user) {
  if (!user || user.is_anonymous || user.app_metadata?.provider === "anonymous") {
    return null;
  }
  return user;
}

export default function AccountDeletionPanel({ locale = "ko" }) {
  const copy = COPY[locale === "en" ? "en" : "ko"];
  const homePath = locale === "en" ? "/en" : "/";
  const pagePath = locale === "en" ? "/en/account-deletion" : "/account-deletion";
  const [user, setUser] = useState(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setState("signed-out");
      return;
    }

    let active = true;

    supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      const nextUser = authError ? null : getVisibleUser(data?.user);
      setUser(nextUser);
      setState(nextUser ? "ready" : "signed-out");
    }).catch(() => {
      if (!active) return;
      setUser(null);
      setState("signed-out");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = getVisibleUser(session?.user);
      setUser(nextUser);
      setState(nextUser ? "ready" : "signed-out");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleDelete() {
    if (!user || state === "deleting") return;
    if (!window.confirm(copy.confirm)) return;

    setState("deleting");
    setError("");

    try {
      const response = await fetch("/api/my/account", {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ confirmation: "delete_account" })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.deleted !== true) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "account_deletion_failed");
      }

      await supabase?.auth.signOut({ scope: "local" }).catch(() => undefined);
      setUser(null);
      setState("deleted");
    } catch {
      setState("ready");
      setError(copy.failed);
    }
  }

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-2xl px-5 py-12 text-[#26101a] dark:text-[#fff8f3] sm:px-8">
      <section className="rounded-[1.5rem] border border-[#ead9d6] bg-white/90 p-6 shadow-[0_18px_50px_rgba(38,16,26,0.08)] dark:border-[#5a3a48] dark:bg-[#241720]/95 sm:p-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#a45c70]">{copy.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">{copy.title}</h1>
        <p className="mt-4 text-sm leading-7 text-[#76505d] dark:text-[#d9bdc7]">{copy.description}</p>

        {state === "loading" ? (
          <div className="mt-8 h-12 rounded-full border border-[#ead9d6] bg-white/60 dark:border-[#5a3a48] dark:bg-[#301f28]" />
        ) : null}

        {state === "signed-out" ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-[#76505d] dark:text-[#d9bdc7]">{copy.signedOut}</p>
            <LoginButtons
              compact
              label={copy.signIn}
              loadingLabel={copy.connecting}
              next={pagePath}
              locale={locale}
            />
          </div>
        ) : null}

        {(state === "ready" || state === "deleting") && user ? (
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-[#ead9d6] bg-[#fff9f7] p-4 dark:border-[#5a3a48] dark:bg-[#301f28]">
              <p className="text-xs font-semibold text-[#a45c70]">{copy.signedIn}</p>
              <p className="mt-1 break-all text-sm font-semibold">{user.email || user.id}</p>
            </div>
            <p className="text-xs leading-6 text-[#8a6672] dark:text-[#c8aeb8]">{copy.support}</p>
            <button
              type="button"
              disabled={state === "deleting"}
              onClick={handleDelete}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-red-300 bg-red-50 px-5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300"
            >
              {state === "deleting" ? copy.deleting : copy.deleteButton}
            </button>
            {error ? <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p> : null}
          </div>
        ) : null}

        {state === "deleted" ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm font-semibold">{copy.deleted}</p>
            <Link href={homePath} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#26101a] px-5 text-sm font-bold text-white dark:bg-[#fff8f3] dark:text-[#26101a]">
              {copy.home}
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
