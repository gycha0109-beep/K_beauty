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
      note: "Authentication is implemented in MOBILE-2, My / Skin Diary in MOBILE-3, native camera acquisition in MOBILE-5, and on-device face-capture guidance in MOBILE-6. Analysis results and Premium remain separate later phases."
    },
    analyze: {
      eyebrow: "ANALYZE · MOBILE-5 / MOBILE-6",
      title: "Native skin photo capture",
      description: "The front camera now evaluates face distance, centering, and head pose on device before capture while analysis remains server-authoritative and separate.",
      notice: "Guidance samples stay local and are deleted after on-device detection. Final photos remain in local cache only; this phase does not upload, score, recommend products, or invoke Face Lab.",
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
        localOnly: "This image currently remains only in the app's local cache and is not uploaded or analyzed.",
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
      eyebrow: "MY · MOBILE-3",
      title: "Native My & Skin Diary",
      description: "Native My reuses the existing authenticated dashboard, check-in, routine, and skin-diary APIs over Bearer while Web cookie auth remains unchanged.",
      notice: "Google OAuth returns through bejewely://auth/callback. Hosted sign-in still requires that native callback in the Supabase redirect allow-list.",
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
      note: "MOBILE-2에서 인증, MOBILE-3에서 My / Skin Diary, MOBILE-5에서 네이티브 카메라 획득, MOBILE-6에서 기기 내 얼굴 촬영 가이드를 연결했습니다. 분석 결과와 Premium은 이후 별도 단계로 유지합니다."
    },
    analyze: {
      eyebrow: "ANALYZE · MOBILE-5 / MOBILE-6",
      title: "네이티브 피부 사진 촬영",
      description: "전면 카메라에서 얼굴 거리·중앙 정렬·정면 상태를 기기 내에서 확인하면서 촬영할 수 있게 하되 실제 분석 권한은 서버에 유지하고 별도 단계로 분리합니다.",
      notice: "가이드용 샘플은 기기 안에서만 판정하고 즉시 삭제합니다. 최종 사진도 로컬 캐시에만 유지하며 업로드·점수 계산·제품 추천·Face Lab 호출은 수행하지 않습니다.",
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
        localOnly: "현재 이 이미지는 앱 로컬 캐시에만 있으며 업로드하거나 분석하지 않습니다.",
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
      eyebrow: "MY · MOBILE-3",
      title: "네이티브 My · 스킨 다이어리",
      description: "기존 인증 대시보드·체크인·루틴·스킨 다이어리 API를 Native Bearer로 재사용하며 Web cookie 인증은 그대로 보존합니다.",
      notice: "Google OAuth는 bejewely://auth/callback으로 복귀합니다. Hosted 로그인에는 Supabase redirect allow-list에 이 native callback이 등록되어 있어야 합니다.",
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
