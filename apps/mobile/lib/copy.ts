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
    cardBody: string;
    cta: string;
    benefits: Array<{
      title: string;
      body: string;
    }>;
  };
  analyze: {
    eyebrow: string;
    title: string;
    description: string;
    notice: string;
    camera: {
      permissionLoading: string;
      permissionTitle: string;
      permissionDescription: string;
      grantPermission: string;
      openSettings: string;
      openCamera: string;
      closeCamera: string;
      previewLabel: string;
      ready: string;
      preparing: string;
      alignFace: string;
      capture: string;
      capturing: string;
      captureFailed: string;
      capturedLabel: string;
      retake: string;
      localOnly: string;
      guidance: {
        loading: string;
        noFace: string;
        multipleFaces: string;
        tooFar: string;
        tooClose: string;
        offCenter: string;
        notFrontal: string;
        stabilizing: string;
        ready: string;
        unavailable: string;
      };
    };
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
      eyebrow: "SKIN MATCH",
      title: "BEJEWELY",
      description: "A K-beauty routine matched to your skin, starting with one photo and a few questions.",
      cardTitle: "Find what fits your skin today",
      cardBody: "We organize your current skin profile, product picks, and a practical morning and night routine in one flow.",
      cta: "Start skin analysis",
      benefits: [
        {
          title: "Skin profile",
          body: "See the key signals from your photo and answers in a clear, practical summary."
        },
        {
          title: "Personalized product picks",
          body: "Get a focused shortlist matched to your skin type, concerns, and texture preferences."
        },
        {
          title: "AM / PM routine",
          body: "Turn your recommendations into a routine that is easy to follow every day."
        }
      ]
    },
    analyze: {
      eyebrow: "SKIN ANALYSIS",
      title: "Skin analysis",
      description: "Take a clear front-facing photo, answer a few quick questions, and get a routine matched to your skin.",
      notice: "Face-framing guidance is processed on device. Only the final photo you choose and your survey answers are sent when you start analysis.",
      camera: {
        permissionLoading: "Checking camera permission…",
        permissionTitle: "Camera access is required",
        permissionDescription: "BEJEWELY uses the front camera only to capture the skin photo you choose to take.",
        grantPermission: "Allow camera",
        openSettings: "Open app settings",
        openCamera: "Open camera",
        closeCamera: "Close camera",
        previewLabel: "Front camera preview",
        ready: "Camera ready",
        preparing: "Preparing camera…",
        alignFace: "Position your face inside the oval",
        capture: "Take photo",
        capturing: "Capturing…",
        captureFailed: "The camera could not capture a photo. Try again.",
        capturedLabel: "Captured photo",
        retake: "Retake",
        localOnly: "Your photo stays on this device until you choose to start analysis.",
        guidance: {
          loading: "Checking face alignment…",
          noFace: "No face detected. Place one face inside the oval.",
          multipleFaces: "Only one face should be visible.",
          tooFar: "Move a little closer.",
          tooClose: "Move a little farther away.",
          offCenter: "Center your face inside the oval.",
          notFrontal: "Face the camera straight.",
          stabilizing: "Hold still for a moment.",
          ready: "Framing looks good. Hold still or take the photo.",
          unavailable: "Face guidance is unavailable. You can still take the photo manually."
        }
      }
    },
    my: {
      eyebrow: "MY SKIN",
      title: "My · Skin Diary",
      description: "Keep your skin profile, daily check-ins, and routine history together in one place.",
      notice: "Sign in to keep your profile and diary connected across sessions.",
      signInGoogle: "Continue with Google",
      signingIn: "Opening Google sign-in…",
      signedOut: "Not signed in",
      signedIn: "Signed in",
      signOut: "Sign out",
      loading: "Restoring session…",
      authUnavailable: "Sign-in is temporarily unavailable. Please try again later.",
      authFailed: "Authentication could not be completed.",
      dashboardReady: "Your skin diary is ready",
      dashboardNoProfile: "Signed in · skin profile not created yet",
      dashboardCheckIn: "Signed in · today's check-in is pending",
      dashboardUnavailable: "Signed in, but your diary could not be loaded."
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
      eyebrow: "SKIN MATCH",
      title: "BEJEWELY",
      description: "사진 한 장과 몇 가지 질문으로 지금 내 피부에 맞는 K-뷰티 루틴을 찾아보세요.",
      cardTitle: "오늘 내 피부에 맞는 루틴 찾기",
      cardBody: "현재 피부 프로필부터 맞춤 제품 추천, 아침·저녁 루틴까지 한 흐름으로 정리해드립니다.",
      cta: "피부 분석 시작하기",
      benefits: [
        {
          title: "피부 프로필",
          body: "사진과 답변에서 확인한 핵심 포인트를 이해하기 쉽게 정리합니다."
        },
        {
          title: "맞춤 제품 추천",
          body: "피부 타입과 고민, 선호 사용감에 맞춰 먼저 볼 제품을 좁혀드립니다."
        },
        {
          title: "아침 · 저녁 루틴",
          body: "추천을 실제로 따라가기 쉬운 데일리 루틴 순서로 연결합니다."
        }
      ]
    },
    analyze: {
      eyebrow: "SKIN ANALYSIS",
      title: "피부 분석",
      description: "밝은 곳에서 정면 사진을 촬영하고 몇 가지 질문에 답하면 내 피부에 맞는 루틴을 확인할 수 있습니다.",
      notice: "얼굴 위치를 맞추는 가이드는 기기 안에서 처리합니다. 분석을 시작할 때 선택한 최종 사진과 설문 답변만 전송됩니다.",
      camera: {
        permissionLoading: "카메라 권한 확인 중…",
        permissionTitle: "카메라 접근 권한이 필요합니다",
        permissionDescription: "BEJEWELY는 사용자가 선택해 촬영하는 피부 사진을 얻기 위해서만 전면 카메라를 사용합니다.",
        grantPermission: "카메라 허용",
        openSettings: "앱 설정 열기",
        openCamera: "카메라 열기",
        closeCamera: "카메라 닫기",
        previewLabel: "전면 카메라 미리보기",
        ready: "카메라 준비 완료",
        preparing: "카메라 준비 중…",
        alignFace: "얼굴을 타원 안에 맞춰 주세요",
        capture: "사진 촬영",
        capturing: "촬영 중…",
        captureFailed: "사진을 촬영하지 못했습니다. 다시 시도해 주세요.",
        capturedLabel: "촬영한 사진",
        retake: "다시 촬영",
        localOnly: "분석을 시작하기 전까지 촬영한 사진은 이 기기에만 보관됩니다.",
        guidance: {
          loading: "얼굴 정렬 상태 확인 중…",
          noFace: "얼굴이 보이지 않습니다. 한 명의 얼굴을 타원 안에 맞춰 주세요.",
          multipleFaces: "한 명의 얼굴만 화면에 보이게 해 주세요.",
          tooFar: "조금 더 가까이 와 주세요.",
          tooClose: "조금 더 멀리 떨어져 주세요.",
          offCenter: "얼굴을 타원 중앙에 맞춰 주세요.",
          notFrontal: "카메라를 정면으로 바라봐 주세요.",
          stabilizing: "잠시 그대로 유지해 주세요.",
          ready: "정렬이 좋습니다. 그대로 유지하거나 사진을 촬영하세요.",
          unavailable: "얼굴 가이드를 사용할 수 없습니다. 사진은 수동으로 계속 촬영할 수 있습니다."
        }
      }
    },
    my: {
      eyebrow: "MY SKIN",
      title: "마이 · 스킨 다이어리",
      description: "내 피부 프로필과 오늘의 변화, 루틴 기록을 한곳에서 이어서 관리하세요.",
      notice: "로그인하면 피부 프로필과 스킨 다이어리를 계속 이어서 사용할 수 있습니다.",
      signInGoogle: "Google로 계속하기",
      signingIn: "Google 로그인 여는 중…",
      signedOut: "로그인되지 않음",
      signedIn: "로그인됨",
      signOut: "로그아웃",
      loading: "세션 복원 중…",
      authUnavailable: "현재 로그인을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      authFailed: "인증을 완료하지 못했습니다.",
      dashboardReady: "스킨 다이어리 준비 완료",
      dashboardNoProfile: "로그인됨 · 아직 피부 프로필이 없습니다",
      dashboardCheckIn: "로그인됨 · 오늘 체크인이 필요합니다",
      dashboardUnavailable: "로그인은 되었지만 스킨 다이어리를 불러오지 못했습니다."
    }
  }
};
