const COMMON_COPY = {
  ko: {
    navigation: {
      languages: {
        ko: "한국어",
        en: "English"
      },
      openMenu: "메뉴 열기",
      closeMenu: "메뉴 닫기",
      language: "언어",
      account: "계정",
      theme: "화면 모드"
    },
    auth: {
      signInGoogle: "Google로 로그인",
      connecting: "연결 중...",
      signOut: "로그아웃",
      loginFailed: "Google login failed. Please try again.",
      loginNotConfigured: "Google login is not configured yet."
    },
    theme: {
      dark: "다크",
      light: "라이트",
      switchTo: {
        dark: "다크 테마로 전환",
        light: "라이트 테마로 전환"
      }
    }
  },
  en: {
    navigation: {
      languages: {
        ko: "한국어",
        en: "English"
      },
      openMenu: "Open menu",
      closeMenu: "Close menu",
      language: "Language",
      account: "Account",
      theme: "Theme"
    },
    auth: {
      signInGoogle: "Sign in with Google",
      connecting: "Connecting...",
      signOut: "Sign out",
      loginFailed: "Google login failed. Please try again.",
      loginNotConfigured: "Google login is not configured yet."
    },
    theme: {
      dark: "Dark",
      light: "Light",
      switchTo: {
        dark: "Switch to Dark theme",
        light: "Switch to Light theme"
      }
    }
  }
};

export function getCommonCopy(locale = "ko") {
  return COMMON_COPY[locale === "en" ? "en" : "ko"];
}
