"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import LoginButtons from "@/components/auth/LoginButtons";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COPY = {
  ko: {
    eyebrow: "ACCOUNT · PRIVACY",
    title: "계정 삭제",
    description: "BEJEWELY 계정과 연결된 소비자용 피부·분석·추천·다이어리 데이터를 영구 삭제합니다.",
    signedOut: "Google 계정으로 로그인하면 웹에서 바로 삭제할 수 있습니다.",
    signIn: "Google로 로그인",
    connecting: "연결 중…",
    signedIn: "현재 로그인 계정",
    deleteButton: "계정 영구 삭제",
    deleting: "삭제 중…",
    confirm: "계정과 연결된 피부 프로필, 분석 결과, 추천 기록, 저장 리포트와 다이어리 기록을 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?",
    failed: "계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    support: "보호된 운영·보안 감사 기록과 연결된 계정은 자동 삭제가 중단될 수 있으며, 이 경우 아래 삭제 요청 경로를 이용해 주세요.",
    appleWeb: "Sign in with Apple이 연결된 계정은 Apple 토큰 해제를 위해 앱의 My → 개인정보 · 계정에서 직접 삭제하는 것이 기본 경로입니다. 앱을 사용할 수 없다면 아래 이메일로 삭제를 요청할 수 있습니다.",
    deleted: "계정 삭제가 완료되었습니다.",
    home: "홈으로 이동",
    requestTitle: "앱 없이 삭제 요청하기",
    requestBody: "앱을 삭제했거나 로그인할 수 없는 경우에도 이 웹 페이지에서 삭제를 요청할 수 있습니다. 계정에 사용한 이메일 주소를 포함해 보내 주세요. 본인 확인이 필요할 수 있습니다.",
    requestEmail: "계정 삭제 이메일 요청",
    contactMissing: "삭제 요청용 공개 문의 주소가 아직 production 환경에 설정되지 않았습니다. 출시 전 반드시 설정해야 합니다."
  },
  en: {
    eyebrow: "ACCOUNT · PRIVACY",
    title: "Delete account",
    description: "Permanently delete your BEJEWELY account and associated consumer skin, analysis, recommendation, report, and diary data.",
    signedOut: "Sign in with Google to delete immediately on the web.",
    signIn: "Sign in with Google",
    connecting: "Connecting…",
    signedIn: "Signed-in account",
    deleteButton: "Delete account permanently",
    deleting: "Deleting…",
    confirm: "This permanently deletes your account and associated skin profile, analysis results, recommendations, saved reports, and diary records. This cannot be undone. Continue?",
    failed: "We could not delete the account. Please try again shortly.",
    support: "Automatic deletion can stop when an account is tied to protected operational or security audit records. Use the deletion-request path below in that case.",
    appleWeb: "For accounts linked to Sign in with Apple, the primary path is My → Privacy · Account in the app so Apple authorization can be revoked. If you cannot use the app, you can still request deletion by email below.",
    deleted: "Your account has been deleted.",
    home: "Go to home",
    requestTitle: "Request deletion without the app",
    requestBody: "You can request deletion from this web page even if the app is uninstalled or you cannot sign in. Include the email address used for your account. Identity verification may be required.",
    requestEmail: "Email account deletion request",
    contactMissing: "A public deletion-request contact has not been configured in the production environment yet. It must be configured before store submission."
  }
};

function getVisibleUser(user) {
  if (!user || user.is_anonymous || user.app_metadata?.provider === "anonymous") {
    return null;
  }
  return user;
}

function getPrivacyContactEmail() {
  const value = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() || "";
  return EMAIL_PATTERN.test(value) ? value : "";
}

export default function AccountDeletionPanel({ locale = "ko" }) {
  const language = locale === "en" ? "en" : "ko";
  const copy = COPY[language];
  const homePath = language === "en" ? "/en" : "/";
  const pagePath = language === "en" ? "/en/account-deletion" : "/account-deletion";
  const contactEmail = getPrivacyContactEmail();
  const mailSubject = language === "en" ? "BEJEWELY account deletion request" : "BEJEWELY 계정 삭제 요청";
  const mailBody = language === "en"
    ? "Please delete my BEJEWELY account and associated data.\n\nAccount email: "
    : "BEJEWELY 계정과 연결 데이터를 삭제해 주세요.\n\n계정 이메일: ";
  const deletionRequestHref = contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`
    : "";
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
        const code = typeof payload?.error === "string" ? payload.error : "account_deletion_failed";
        throw new Error(code);
      }

      await supabase?.auth.signOut({ scope: "local" }).catch(() => undefined);
      setUser(null);
      setState("deleted");
    } catch (deleteError) {
      setState("ready");
      const code = deleteError instanceof Error ? deleteError.message : "";
      setError(
        code === "apple_reauthorization_required" ||
        code === "apple_revocation_not_configured" ||
        code === "account_deletion_requires_support"
          ? `${copy.appleWeb} ${copy.support}`
          : copy.failed
      );
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
              locale={language}
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

        {state !== "deleted" ? (
          <div className="mt-8 border-t border-[#ead9d6] pt-6 dark:border-[#5a3a48]">
            <h2 className="text-base font-extrabold">{copy.requestTitle}</h2>
            <p className="mt-2 text-sm leading-7 text-[#76505d] dark:text-[#d9bdc7]">{copy.requestBody}</p>
            <p className="mt-2 text-xs leading-6 text-[#8a6672] dark:text-[#c8aeb8]">{copy.appleWeb}</p>
            {deletionRequestHref ? (
              <a
                data-account-deletion-request="email"
                href={deletionRequestHref}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#ead9d6] px-5 text-sm font-bold dark:border-[#5a3a48]"
              >
                {copy.requestEmail}
              </a>
            ) : (
              <p data-account-deletion-request="missing" className="mt-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
                {copy.contactMissing}
              </p>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
