import Link from "next/link";

const POLICY_VERSION = "2026-09-01";

const COPY = {
  ko: {
    title: "개인정보 처리방침",
    intro: "BEJEWELY는 피부 분석·추천·다이어리·저장 리포트 기능을 제공하기 위해 필요한 범위에서 개인정보와 서비스 데이터를 처리합니다.",
    updated: "시행일",
    sections: [
      {
        title: "1. 처리하는 정보",
        items: [
          "계정·인증 정보: 사용자 ID, 이메일, 로그인 제공자(Google 또는 Apple), 인증·세션 정보.",
          "피부·설문 정보: 피부 타입, 고민, 민감도, 선호·예산, 설문 응답과 피부 프로필.",
          "사진·분석 정보: 사용자가 분석을 위해 제출한 이미지 또는 이미지 참조, 사진·얼굴 관찰값, 분석 결과, 요약, 신뢰도와 모델 관련 정보.",
          "다이어리·루틴 정보: 건조함·유분·붉음·트러블·자극감 수준, 메이크업·야외활동 여부, 컨텍스트, 메모, 생성된 루틴.",
          "추천·리포트 정보: 추천 상호작용, 선택·응답 기록, 저장 리포트와 공유 결과 상태.",
          "운영·보안 정보: 요청·세션 식별자, 처리 시각, 오류·보안 이벤트 등 서비스 운영에 필요한 로그."
        ]
      },
      {
        title: "2. 이용 목적",
        items: [
          "로그인과 계정 관리, 사용자별 피부 프로필·다이어리·리포트 제공.",
          "피부·사진 관찰, 추천 및 설명 생성, 결과 저장과 재진입 기능 제공.",
          "서비스 품질·보안·오류 대응, 악용 방지와 운영 감사."
        ]
      },
      {
        title: "3. 외부 서비스 처리",
        items: [
          "Supabase: 계정 인증, 세션, 데이터베이스 저장과 관련 서버 기능.",
          "Google 및 Apple: 사용자가 선택한 소셜 로그인 인증.",
          "OpenAI: AI 기반 사진·분석·설명 생성이 활성화된 경우 필요한 분석 입력을 처리할 수 있습니다.",
          "Vercel: BEJEWELY 웹/API 애플리케이션의 호스팅 및 실행 인프라."
        ]
      },
      {
        title: "4. 보관 및 삭제",
        items: [
          "계정에 연결된 소비자용 피부 프로필, 분석 결과, 추천 기록, 저장 리포트, 체크인·루틴 데이터는 계정 사용 중 보관되며 계정 삭제 절차의 삭제 대상입니다.",
          "계정 삭제는 Auth 계정을 영구 삭제하고, 자동 cascade만으로 남을 수 있는 분석·추천·프로필 데이터도 명시적으로 삭제하도록 구현됩니다.",
          "보안·사기 방지·법적 의무 또는 보호된 운영 감사에 필요한 기록은 해당 목적에 필요한 범위에서 별도 보관될 수 있습니다. 이 경우 일반 소비자 데이터로 재사용하지 않습니다.",
          "이미 발급된 인증 access token은 공급자 특성상 만료 시점까지 기술적으로 남을 수 있으나, 계정 삭제 후 새 세션·refresh token 발급은 차단됩니다."
        ]
      },
      {
        title: "5. 계정 및 데이터 삭제",
        items: [
          "모바일 앱: My 화면의 개인정보·계정 메뉴에서 계정 영구 삭제를 시작할 수 있습니다.",
          "웹: 앱을 다시 설치하지 않아도 공식 계정 삭제 페이지에서 로그인 후 삭제를 요청할 수 있습니다.",
          "Sign in with Apple 계정은 삭제 직전에 Apple 재인증과 사용자 토큰 해제가 필요합니다."
        ]
      },
      {
        title: "6. 기기 권한",
        items: [
          "현재 모바일 핵심 기능은 피부 사진 촬영을 위한 카메라 권한을 사용합니다.",
          "마이크, 위치, 연락처, 광범위한 사진 보관함 읽기 권한은 현재 승인된 모바일 권한 계약에 포함되지 않습니다."
        ]
      },
      {
        title: "7. 문의",
        items: [
          "개인정보 관련 문의는 아래 공개 문의 주소로 보낼 수 있습니다. 출시 전 실제 운영 주소가 production 환경에 설정되어야 합니다."
        ]
      }
    ],
    deletion: "계정 삭제 페이지",
    contactMissing: "개인정보 문의 주소가 아직 production 환경에 설정되지 않았습니다.",
    contactLabel: "개인정보 문의"
  },
  en: {
    title: "Privacy Policy",
    intro: "BEJEWELY processes personal and service data only as needed to provide skin analysis, recommendations, diary features, and saved reports.",
    updated: "Effective date",
    sections: [
      {
        title: "1. Data we process",
        items: [
          "Account and authentication data: user ID, email, sign-in provider (Google or Apple), authentication and session information.",
          "Skin and survey data: skin type, concerns, sensitivity, preferences, budget, survey responses, and skin profiles.",
          "Photo and analysis data: images or image references submitted for analysis, photo and face observations, analysis outputs, summaries, confidence values, and model-related metadata.",
          "Diary and routine data: dryness, oiliness, redness, breakout and irritation levels, makeup/outdoor context, notes, and generated routines.",
          "Recommendation and report data: recommendation interactions, answers, saved reports, and shared-result state.",
          "Operational and security data: request/session identifiers, processing timestamps, errors, security events, and other logs needed to operate and protect the service."
        ]
      },
      {
        title: "2. Why we use data",
        items: [
          "Authentication and account management, including user-specific profiles, diaries, and reports.",
          "Skin/photo observation, recommendations, explanation generation, result storage, and re-entry.",
          "Service reliability, security, abuse prevention, troubleshooting, and operational audit."
        ]
      },
      {
        title: "3. Service providers",
        items: [
          "Supabase: account authentication, sessions, database storage, and related server capabilities.",
          "Google and Apple: social sign-in selected by the user.",
          "OpenAI: when AI-based photo/analysis or explanation generation is enabled, required analysis inputs may be processed by OpenAI.",
          "Vercel: hosting and runtime infrastructure for the BEJEWELY web/API application."
        ]
      },
      {
        title: "4. Retention and deletion",
        items: [
          "Consumer skin profiles, analysis results, recommendation history, saved reports, check-ins, and routines linked to an account are retained while the account is in use and are covered by the account deletion flow.",
          "Account deletion permanently deletes the Auth account and explicitly removes analysis, recommendation, and profile rows that would otherwise survive database cascades.",
          "Records needed for security, fraud prevention, legal obligations, or protected operational audit may be retained only for those purposes and are not reused as normal consumer profile data.",
          "Previously issued access tokens can technically remain valid until their expiry under the authentication provider's token model, but account deletion removes the account/session authority needed to mint new sessions or refresh tokens."
        ]
      },
      {
        title: "5. Account and data deletion",
        items: [
          "Mobile app: start permanent account deletion from Privacy · Account in My.",
          "Web: request deletion from the official web deletion page without reinstalling the app.",
          "Sign in with Apple accounts require Apple reauthorization and user-token revocation immediately before deletion."
        ]
      },
      {
        title: "6. Device permissions",
        items: [
          "The current mobile core uses camera permission for skin-photo capture.",
          "Microphone, location, contacts, broad photo-library read access, and broad external-storage permissions are not part of the currently approved mobile permission contract."
        ]
      },
      {
        title: "7. Contact",
        items: [
          "Privacy questions can be sent to the public contact address below. A real production contact address must be configured before store submission."
        ]
      }
    ],
    deletion: "Account deletion page",
    contactMissing: "A production privacy contact address has not been configured yet.",
    contactLabel: "Privacy contact"
  }
};

export default function PrivacyPolicy({ locale = "ko" }) {
  const language = locale === "en" ? "en" : "ko";
  const copy = COPY[language];
  const deletionPath = language === "en" ? "/en/account-deletion" : "/account-deletion";
  const contactEmail = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() || "";

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-3xl px-5 py-12 text-[#26101a] dark:text-[#fff8f3] sm:px-8">
      <article className="rounded-[1.5rem] border border-[#ead9d6] bg-white/90 p-6 shadow-[0_18px_50px_rgba(38,16,26,0.08)] dark:border-[#5a3a48] dark:bg-[#241720]/95 sm:p-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#a45c70]">BEJEWELY · PRIVACY</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-xs font-semibold text-[#8a6672] dark:text-[#c8aeb8]">{copy.updated}: {POLICY_VERSION}</p>
        <p className="mt-5 text-sm leading-7 text-[#76505d] dark:text-[#d9bdc7]">{copy.intro}</p>

        <div className="mt-8 space-y-8">
          {copy.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-extrabold">{section.title}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[#76505d] dark:text-[#d9bdc7]">
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-[#ead9d6] pt-6 dark:border-[#5a3a48] sm:flex-row sm:items-center">
          <Link href={deletionPath} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ead9d6] px-5 text-sm font-bold dark:border-[#5a3a48]">
            {copy.deletion}
          </Link>
          {contactEmail ? (
            <a href={`mailto:${contactEmail}`} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#26101a] px-5 text-sm font-bold text-white dark:bg-[#fff8f3] dark:text-[#26101a]">
              {copy.contactLabel}: {contactEmail}
            </a>
          ) : (
            <p data-privacy-contact-state="missing" className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              {copy.contactMissing}
            </p>
          )}
        </div>
      </article>
    </main>
  );
}

export function getPrivacyPolicyContract() {
  return Object.freeze({
    version: POLICY_VERSION,
    contactEnvironmentKey: "NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL"
  });
}
