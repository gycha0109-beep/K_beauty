import Link from "next/link";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COPY = {
  ko: {
    eyebrow: "SUPPORT",
    title: "BEJEWELY 고객 지원",
    description: "계정, 피부 분석, 저장 리포트, 스킨 다이어리와 개인정보 관련 도움을 받을 수 있는 공식 지원 페이지입니다.",
    topicsTitle: "도움이 필요한 항목",
    topics: [
      "로그인 및 계정 이용",
      "피부 분석과 저장 리포트 이용",
      "스킨 다이어리 이용",
      "개인정보 및 계정 삭제"
    ],
    contactTitle: "문의하기",
    contactBody: "추가 도움이 필요하면 공개 지원 이메일로 문의해 주세요. 문의 내용과 사용 중인 기능을 함께 적어주시면 확인에 도움이 됩니다.",
    contactButton: "이메일로 문의하기",
    contactMissing: "공개 지원 이메일이 아직 운영 환경에 설정되지 않았습니다. 아래 개인정보 및 계정 삭제 공식 경로는 계속 이용할 수 있습니다.",
    privacy: "개인정보 처리방침",
    deletion: "계정 삭제",
    home: "BEJEWELY 홈"
  },
  en: {
    eyebrow: "SUPPORT",
    title: "BEJEWELY Support",
    description: "Official support for account access, skin analysis, saved reports, the skin diary, and privacy-related requests.",
    topicsTitle: "What we can help with",
    topics: [
      "Sign-in and account access",
      "Skin analysis and saved reports",
      "Skin diary usage",
      "Privacy and account deletion"
    ],
    contactTitle: "Contact support",
    contactBody: "If you need more help, contact the public support email and include the feature you were using and a short description of the issue.",
    contactButton: "Email support",
    contactMissing: "The public support email has not been configured in the production environment yet. The privacy and account-deletion resources below remain available.",
    privacy: "Privacy Policy",
    deletion: "Delete account",
    home: "BEJEWELY home"
  }
};

function getSupportEmail() {
  const value = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() || "";
  return EMAIL_PATTERN.test(value) ? value : "";
}

export default function SupportPanel({ locale = "ko" }) {
  const language = locale === "en" ? "en" : "ko";
  const copy = COPY[language];
  const supportEmail = getSupportEmail();
  const homePath = language === "en" ? "/en" : "/";
  const privacyPath = language === "en" ? "/en/privacy" : "/privacy";
  const deletionPath = language === "en" ? "/en/account-deletion" : "/account-deletion";
  const subject = language === "en" ? "BEJEWELY support request" : "BEJEWELY 고객 지원 문의";
  const supportHref = supportEmail
    ? `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}`
    : "";

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-2xl px-5 py-12 text-[#26101a] dark:text-[#fff8f3] sm:px-8">
      <section className="rounded-[1.5rem] border border-[#ead9d6] bg-white/90 p-6 shadow-[0_18px_50px_rgba(38,16,26,0.08)] dark:border-[#5a3a48] dark:bg-[#241720]/95 sm:p-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#a45c70]">{copy.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">{copy.title}</h1>
        <p className="mt-4 text-sm leading-7 text-[#76505d] dark:text-[#d9bdc7]">{copy.description}</p>

        <div className="mt-8 rounded-2xl border border-[#ead9d6] bg-[#fff9f7] p-5 dark:border-[#5a3a48] dark:bg-[#301f28]">
          <h2 className="text-base font-extrabold">{copy.topicsTitle}</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[#76505d] dark:text-[#d9bdc7]">
            {copy.topics.map((topic) => <li key={topic}>• {topic}</li>)}
          </ul>
        </div>

        <div className="mt-8 border-t border-[#ead9d6] pt-6 dark:border-[#5a3a48]">
          <h2 className="text-base font-extrabold">{copy.contactTitle}</h2>
          <p className="mt-2 text-sm leading-7 text-[#76505d] dark:text-[#d9bdc7]">{copy.contactBody}</p>
          {supportHref ? (
            <a
              data-support-contact="email"
              href={supportHref}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#26101a] px-5 text-sm font-bold text-white dark:bg-[#fff8f3] dark:text-[#26101a]"
            >
              {copy.contactButton}
            </a>
          ) : (
            <p data-support-contact="missing" className="mt-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
              {copy.contactMissing}
            </p>
          )}
        </div>

        <nav className="mt-8 grid gap-3 border-t border-[#ead9d6] pt-6 dark:border-[#5a3a48] sm:grid-cols-3" aria-label={copy.title}>
          <Link href={privacyPath} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ead9d6] px-4 text-center text-sm font-bold dark:border-[#5a3a48]">
            {copy.privacy}
          </Link>
          <Link href={deletionPath} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ead9d6] px-4 text-center text-sm font-bold dark:border-[#5a3a48]">
            {copy.deletion}
          </Link>
          <Link href={homePath} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ead9d6] px-4 text-center text-sm font-bold dark:border-[#5a3a48]">
            {copy.home}
          </Link>
        </nav>
      </section>
    </main>
  );
}
