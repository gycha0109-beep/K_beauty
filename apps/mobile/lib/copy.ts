import type { SupportedLocale } from "@bejewely/shared";

type MobileCopy = {
  tabs: {
    home: string;
    analyze: string;
    my: string;
  };
  localeSwitch: string;
  theme: {
    label: string;
    light: string;
    dark: string;
  };
  home: {
    eyebrow: string;
    title: string;
    description: string;
    cardTitle: string;
    routes: string;
    localeLabel: string;
    nativeGate: string;
    note: string;
  };
  analyze: {
    eyebrow: string;
    title: string;
    description: string;
    notice: string;
  };
  my: {
    eyebrow: string;
    title: string;
    description: string;
    notice: string;
    signInGoogle: string;
    signingIn: string;
    signedOut: string;
    signedIn: string;
    signOut: string;
    loading: string;
    authUnavailable: string;
    authFailed: string;
    dashboardReady: string;
    dashboardNoProfile: string;
    dashboardCheckIn: string;
    dashboardUnavailable: string;
  };
};

export const MOBILE_COPY: Record<SupportedLocale, MobileCopy> = {
  en: {
    tabs: {
      home: "Home",
      analyze: "Analyze",
      my: "My"
    },
    localeSwitch: "KO",
    theme: {
      label: "Theme",
      light: "Light",
      dark: "Dark"
    },
    home: {
      eyebrow: "MOBILE-1",
      title: "BEJEWELY Mobile",
      description: "The native shell now runs beside the existing Web client while server authority remains unchanged.",
      cardTitle: "Native shell ready",
      routes: "Routes · Home / Analyze / My",
      localeLabel: "Locale",
      nativeGate: "Android gate · prebuild / APK / emulator launch",
      note: "Authentication is now implemented in MOBILE-2 while camera capture, analysis requests, and Premium remain separate mobile phases."
    },
    analyze: {
      eyebrow: "ANALYZE",
      title: "Native analysis entry",
      description: "This route is reserved for the future native survey and camera flow.",
      notice: "The native client does not move Recommendation, Product Fact, or Face Lab server authority into the app."
    },
    my: {
      eyebrow: "MY · MOBILE-2",
      title: "Native account space",
      description: "Native Supabase sessions stay on-device and authenticated API calls send the access token as Bearer while Web cookie auth remains unchanged.",
      notice: "Google OAuth returns through bejewely://auth/callback. The Supabase redirect allow-list must include that native scheme before hosted sign-in can complete.",
      signInGoogle: "Continue with Google",
      signingIn: "Opening Google sign-in…",
      signedOut: "Not signed in",
      signedIn: "Signed in",
      signOut: "Sign out",
      loading: "Restoring session…",
      authUnavailable: "Mobile auth is not configured in this build.",
      authFailed: "Authentication could not be completed.",
      dashboardReady: "Authenticated dashboard connected",
      dashboardNoProfile: "Signed in · skin profile not created yet",
      dashboardCheckIn: "Signed in · today's check-in is pending",
      dashboardUnavailable: "Signed in, but the dashboard API is unavailable."
    }
  },
  ko: {
    tabs: {
      home: "홈",
      analyze: "분석",
      my: "마이"
    },
    localeSwitch: "EN",
    theme: {
      label: "테마",
      light: "라이트",
      dark: "다크"
    },
    home: {
      eyebrow: "MOBILE-1",
      title: "BEJEWELY 모바일",
      description: "기존 Web 클라이언트와 서버 권한은 그대로 유지하면서 네이티브 앱 셸을 병렬로 실행합니다.",
      cardTitle: "네이티브 셸 준비 완료",
      routes: "경로 · 홈 / 분석 / 마이",
      localeLabel: "언어",
      nativeGate: "Android 게이트 · prebuild / APK / emulator launch",
      note: "MOBILE-2에서 인증을 연결했으며 카메라 촬영, 분석 요청, Premium은 별도 모바일 단계로 유지합니다."
    },
    analyze: {
      eyebrow: "ANALYZE",
      title: "네이티브 분석 진입점",
      description: "향후 네이티브 설문과 카메라 흐름이 들어올 경로입니다.",
      notice: "Recommendation, Product Fact, Face Lab 서버 권한은 네이티브 앱으로 이동하지 않습니다."
    },
    my: {
      eyebrow: "MY · MOBILE-2",
      title: "네이티브 계정 영역",
      description: "Supabase 네이티브 세션은 기기에 유지하고 인증 API 호출에는 access token을 Bearer로 전송하며 Web cookie 인증은 그대로 보존합니다.",
      notice: "Google OAuth는 bejewely://auth/callback으로 복귀합니다. 실제 로그인 전 Supabase redirect allow-list에 이 native scheme이 등록되어 있어야 합니다.",
      signInGoogle: "Google로 계속하기",
      signingIn: "Google 로그인 여는 중…",
      signedOut: "로그인되지 않음",
      signedIn: "로그인됨",
      signOut: "로그아웃",
      loading: "세션 복원 중…",
      authUnavailable: "이 빌드에는 모바일 인증 환경값이 설정되지 않았습니다.",
      authFailed: "인증을 완료하지 못했습니다.",
      dashboardReady: "인증된 대시보드 연결 완료",
      dashboardNoProfile: "로그인됨 · 아직 피부 프로필이 없습니다",
      dashboardCheckIn: "로그인됨 · 오늘 체크인이 필요합니다",
      dashboardUnavailable: "로그인은 되었지만 대시보드 API를 사용할 수 없습니다."
    }
  }
};
