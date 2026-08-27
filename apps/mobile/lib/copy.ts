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
      note: "Authentication, camera capture, analysis requests, and Premium remain intentionally deferred to later mobile phases."
    },
    analyze: {
      eyebrow: "ANALYZE",
      title: "Native analysis entry",
      description: "This route is reserved for the future native survey and camera flow.",
      notice: "MOBILE-1 does not call /api/analyze and does not move Recommendation, Product Fact, or Face Lab server authority into the app."
    },
    my: {
      eyebrow: "MY",
      title: "Native account space",
      description: "This route reserves the native My experience without changing the existing authenticated Web APIs.",
      notice: "Supabase mobile authentication and Bearer-token server authorization remain MOBILE-2 work."
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
      note: "로그인, 카메라 촬영, 분석 요청, Premium은 이후 모바일 단계로 의도적으로 분리되어 있습니다."
    },
    analyze: {
      eyebrow: "ANALYZE",
      title: "네이티브 분석 진입점",
      description: "향후 네이티브 설문과 카메라 흐름이 들어올 경로입니다.",
      notice: "MOBILE-1에서는 /api/analyze를 호출하지 않으며 Recommendation, Product Fact, Face Lab 서버 권한을 앱으로 옮기지 않습니다."
    },
    my: {
      eyebrow: "MY",
      title: "네이티브 계정 영역",
      description: "기존 인증 Web API를 변경하지 않고 네이티브 My 공간만 확보합니다.",
      notice: "Supabase 모바일 인증과 Bearer-token 서버 인증 어댑터는 MOBILE-2 범위입니다."
    }
  }
};
