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
      label: "Appearance",
      light: "Light",
      dark: "Dark"
    },
    home: {
      eyebrow: "PERSONALIZED K-BEAUTY",
      title: "Skincare that fits your skin",
      description: "Take a clear skin photo, answer a short survey, and get personalized K-beauty guidance.",
      cardTitle: "Start with your skin",
      routes: "Photo + short survey · personalized skin analysis",
      localeLabel: "Locale",
      nativeGate: "Your final photo is sent only when you choose to start analysis.",
      note: "Use Analyze to check your skin, then revisit saved reports and daily changes from My."
    },
    analyze: {
      eyebrow: "SKIN ANALYSIS",
      title: "Skin photo",
      description: "Take a clear front-facing photo. Camera guidance helps with distance, centering, and head position before you capture.",
      notice: "Camera-guidance images stay on your device. Your final photo is sent only when you choose to start analysis.",
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
        localOnly: "Your captured photo stays on your device until you choose to start analysis.",
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
      eyebrow: "MY",
      title: "My skin",
      description: "Sign in to view your skin profile, daily check-ins, routine, and saved reports.",
      notice: "Sign in to keep your skin diary and saved reports connected to your account.",
      signInGoogle: "Continue with Google",
      signingIn: "Opening Google sign-in…",
      signedOut: "Not signed in",
      signedIn: "Signed in",
      signOut: "Sign out",
      loading: "Restoring session…",
      authUnavailable: "Sign-in is temporarily unavailable. Please try again later.",
      authFailed: "Authentication could not be completed.",
      dashboardReady: "Your skin dashboard is ready",
      dashboardNoProfile: "Signed in · skin profile not created yet",
      dashboardCheckIn: "Signed in · today's check-in is pending",
      dashboardUnavailable: "Signed in, but we could not load your skin dashboard."
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
      label: "화면 모드",
      light: "라이트",
      dark: "다크"
    },
    home: {
      eyebrow: "맞춤 K-뷰티",
      title: "내 피부에 맞는 스킨케어",
      description: "피부 사진과 짧은 설문을 바탕으로 나에게 맞는 K-뷰티 가이드를 확인하세요.",
      cardTitle: "내 피부부터 시작하세요",
      routes: "사진 + 짧은 설문 · 맞춤 피부 분석",
      localeLabel: "언어",
      nativeGate: "최종 사진은 분석을 시작할 때만 전송됩니다.",
      note: "분석에서 피부 상태를 확인하고, 마이에서 저장 리포트와 일상 변화를 다시 볼 수 있습니다."
    },
    analyze: {
      eyebrow: "피부 분석",
      title: "피부 사진",
      description: "선명한 정면 사진을 촬영하세요. 촬영 가이드가 얼굴 거리·중앙 정렬·정면 상태를 확인하는 데 도움을 줍니다.",
      notice: "촬영 가이드용 이미지는 기기에만 유지됩니다. 최종 사진은 분석을 시작할 때만 전송됩니다.",
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
        localOnly: "촬영한 사진은 분석을 시작하기 전까지 기기에만 유지됩니다.",
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
      eyebrow: "MY",
      title: "내 피부",
      description: "로그인하면 피부 프로필, 오늘 체크인, 루틴, 저장 리포트를 한곳에서 확인할 수 있습니다.",
      notice: "로그인하면 스킨 다이어리와 저장 리포트를 계정에 연결해 계속 확인할 수 있습니다.",
      signInGoogle: "Google로 계속하기",
      signingIn: "Google 로그인 여는 중…",
      signedOut: "로그인되지 않음",
      signedIn: "로그인됨",
      signOut: "로그아웃",
      loading: "세션 복원 중…",
      authUnavailable: "지금은 로그인을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      authFailed: "인증을 완료하지 못했습니다.",
      dashboardReady: "내 피부 대시보드 준비 완료",
      dashboardNoProfile: "로그인됨 · 아직 피부 프로필이 없습니다",
      dashboardCheckIn: "로그인됨 · 오늘 체크인이 필요합니다",
      dashboardUnavailable: "로그인했지만 내 피부 정보를 불러오지 못했습니다."
    }
  }
};
