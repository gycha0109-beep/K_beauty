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
    stepPhoto: string;
    stepSurvey: string;
    stepGuidance: string;
    cta: string;
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
      label: "Theme",
      light: "Light",
      dark: "Dark"
    },
    home: {
      eyebrow: "PERSONALIZED K-BEAUTY",
      title: "Skincare matched to your skin",
      description: "Take a quick skin photo and answer a short survey to get skincare guidance shaped around your skin and routine.",
      cardTitle: "Start with your skin",
      stepPhoto: "Take one clear front-facing skin photo",
      stepSurvey: "Tell us a little about your skin and preferences",
      stepGuidance: "Review your personalized skincare guidance and product matches",
      cta: "Start skin analysis",
      note: "Your photo and survey are sent only when you choose to run the analysis."
    },
    analyze: {
      eyebrow: "SKIN ANALYSIS",
      title: "Take a clear skin photo",
      description: "Use the front camera and follow the framing guide. After the photo, answer a short skin survey to continue.",
      notice: "Your final photo and survey are sent only when you tap Run skin analysis. Framing samples stay on your device.",
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
        localOnly: "This photo stays on your device until you choose to run the analysis.",
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
      title: "My skin & diary",
      description: "Sign in to review your skin profile, daily check-ins, routines, and saved reports in one place.",
      notice: "Sign in to keep your skin diary and saved results connected across sessions.",
      signInGoogle: "Continue with Google",
      signingIn: "Opening sign-in…",
      signedOut: "Sign in to see your skin profile and diary",
      signedIn: "Signed in",
      signOut: "Sign out",
      loading: "Restoring session…",
      authUnavailable: "Sign-in is temporarily unavailable.",
      authFailed: "Sign-in could not be completed. Please try again.",
      dashboardReady: "Your skin dashboard is ready",
      dashboardNoProfile: "Create your skin profile to personalize your diary",
      dashboardCheckIn: "Today's check-in is ready when you are",
      dashboardUnavailable: "Your skin dashboard could not be loaded."
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
      eyebrow: "PERSONALIZED K-BEAUTY",
      title: "내 피부에 맞는 스킨케어",
      description: "간단한 피부 사진과 짧은 설문으로 내 피부와 루틴에 맞춘 스킨케어 가이드와 제품 매칭을 확인해 보세요.",
      cardTitle: "내 피부부터 확인하기",
      stepPhoto: "정면 피부 사진 한 장을 선명하게 촬영해요",
      stepSurvey: "피부 상태와 선호를 간단히 알려주세요",
      stepGuidance: "나에게 맞춘 스킨케어 가이드와 제품 매칭을 확인해요",
      cta: "피부 분석 시작",
      note: "사진과 설문은 사용자가 분석을 실행할 때만 전송됩니다."
    },
    analyze: {
      eyebrow: "피부 분석",
      title: "피부 사진을 촬영해 주세요",
      description: "전면 카메라의 촬영 가이드에 맞춰 사진을 찍은 뒤, 짧은 피부 설문에 답하면 분석을 진행할 수 있습니다.",
      notice: "최종 사진과 설문은 ‘피부 분석 실행’을 누를 때만 전송됩니다. 촬영 가이드용 샘플은 기기 안에서 처리됩니다.",
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
        localOnly: "이 사진은 사용자가 분석을 실행하기 전까지 기기에만 유지됩니다.",
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
      title: "내 피부 · 스킨 다이어리",
      description: "로그인하고 피부 프로필, 오늘의 체크인, 루틴, 저장한 리포트를 한곳에서 확인하세요.",
      notice: "로그인하면 스킨 다이어리와 저장한 결과를 다음에도 이어서 확인할 수 있습니다.",
      signInGoogle: "Google로 계속하기",
      signingIn: "로그인 여는 중…",
      signedOut: "로그인하고 내 피부 프로필과 다이어리를 확인하세요",
      signedIn: "로그인됨",
      signOut: "로그아웃",
      loading: "세션 복원 중…",
      authUnavailable: "현재 로그인을 사용할 수 없습니다.",
      authFailed: "로그인을 완료하지 못했습니다. 다시 시도해 주세요.",
      dashboardReady: "내 피부 대시보드가 준비되었습니다",
      dashboardNoProfile: "피부 프로필을 만들고 다이어리를 시작해 보세요",
      dashboardCheckIn: "오늘의 체크인을 기록해 보세요",
      dashboardUnavailable: "내 피부 정보를 불러오지 못했습니다."
    }
  }
};
