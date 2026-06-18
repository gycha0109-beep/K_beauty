const MY_COPY = {
  ko: {
    locale: "ko",
    dateLocale: "ko-KR",
    metadata: {
      title: "My Page",
      checkInTitle: "Daily Check-in"
    },
    paths: {
      home: "/",
      my: "/my",
      checkIn: "/my/check-in"
    },
    menu: {
      languages: {
        ko: "한국어",
        en: "English"
      },
      startAnalysis: "무료 진단 시작하기",
      open: "My 메뉴 열기",
      close: "My 메뉴 닫기"
    },
    pageError: {
      kicker: "My Skin",
      title: "대시보드를 불러오지 못했습니다.",
      body: "잠시 후 다시 시도해 주세요."
    },
    dashboard: {
      kicker: "Bejewely Revisit",
      title: "My Skin",
      body: "오늘 상태를 먼저 보고, 필요한 루틴만 빠르게 확인합니다."
    },
    emptyProfile: {
      kicker: "My Skin",
      title: "아직 저장된 피부 프로필이 없습니다.",
      body: "먼저 무료 진단을 진행하면 이곳에서 오늘 체크와 루틴을 이어갈 수 있습니다.",
      cta: "무료 진단 시작하기"
    },
    savedReport: {
      kicker: "저장된 리포트",
      empty: "아직 저장된 결과가 없습니다.",
      emptyBody: "진단을 완료하면 이곳에서 다시 확인할 수 있습니다.",
      fallbackTitle: "저장된 진단 결과",
      typeFallback: "리포트",
      created: "생성일",
      updated: "마지막 업데이트",
      statusComplete: "분석 완료",
      statusSaved: "저장 완료"
    },
    checkInPrompt: {
      kicker: "Today Check-in",
      title: "오늘 피부 상태 체크",
      body: "건조함, 유분감, 붉어짐을 짧게 기록하면 오늘 루틴이 바로 정리됩니다.",
      cta: "오늘 피부 체크하기"
    },
    checkInDone: {
      kicker: "Today Check-in",
      title: "오늘 피부 상태 체크 완료",
      cta: "다시 체크하기"
    },
    routinePending: {
      kicker: "Today Routine",
      title: "오늘 체크인은 저장되었습니다.",
      body: "루틴 카드가 아직 없으면 잠시 후 다시 확인해 주세요."
    },
    routine: {
      kicker: "Today Routine",
      title: "오늘 루틴",
      keep: "유지할 것",
      reduce: "줄일 것",
      avoid: "피할 것",
      am: "AM 루틴",
      pm: "PM 루틴",
      emptyItems: "아직 항목이 없습니다.",
      emptyRoutine: "아직 루틴이 없습니다.",
      stepFallback: "단계"
    },
    profile: {
      kicker: "Skin Profile",
      title: "최근 피부 프로필",
      skinType: "피부 타입",
      sensitivity: "민감도",
      unknown: "미정"
    },
    checkInPage: {
      noProfile: {
        kicker: "Daily Check-in",
        title: "아직 저장된 피부 프로필이 없습니다.",
        body: "오늘 피부 체크는 피부 프로필 저장 후 사용할 수 있습니다.",
        back: "My로 돌아가기"
      },
      header: {
        back: "My로 돌아가기",
        kicker: "Daily Check-in",
        title: "오늘 피부 체크",
        body: "오늘 피부 상태를 저장하면 rule 기반 루틴 카드가 생성됩니다."
      },
      error: {
        kicker: "Daily Check-in",
        title: "체크인 화면을 불러오지 못했습니다.",
        body: "잠시 후 다시 시도해 주세요.",
        back: "My로 돌아가기"
      }
    },
    checkInForm: {
      activeProfile: "Active Profile",
      noConcerns: "저장된 고민 없음",
      unknownSkinType: "피부 타입 미정",
      date: "체크인 날짜",
      makeupToday: "오늘 메이크업 예정",
      outdoorToday: "오늘 외출 많음",
      memo: "메모",
      memoPlaceholder: "오늘 느낀 피부 상태를 짧게 남겨주세요.",
      profileRequired: "피부 프로필 저장 후 체크인을 사용할 수 있습니다.",
      saveError: "체크인을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      submit: "오늘 체크인 저장하기",
      saving: "저장 중...",
      cancel: "취소",
      levels: [
        {
          key: "dryness_level",
          label: "건조감",
          low: "편안함",
          high: "매우 건조"
        },
        {
          key: "oiliness_level",
          label: "유분감",
          low: "산뜻함",
          high: "매우 번들"
        },
        {
          key: "redness_level",
          label: "붉음",
          low: "없음",
          high: "강함"
        },
        {
          key: "breakout_level",
          label: "트러블",
          low: "없음",
          high: "많음"
        },
        {
          key: "irritation_level",
          label: "자극감",
          low: "없음",
          high: "강함"
        }
      ]
    }
  },
  en: {
    locale: "en",
    dateLocale: "en-US",
    metadata: {
      title: "My Page",
      checkInTitle: "Daily Check-in"
    },
    paths: {
      home: "/en",
      my: "/en/my",
      checkIn: "/en/my/check-in"
    },
    menu: {
      languages: {
        ko: "한국어",
        en: "English"
      },
      startAnalysis: "Start Free Analysis",
      open: "Open My menu",
      close: "Close My menu"
    },
    pageError: {
      kicker: "My Page",
      title: "Unable to load your reports",
      body: "Please try again in a moment."
    },
    dashboard: {
      kicker: "Bejewely Revisit",
      title: "My Page",
      body: "Check today's skin and face context, then continue with the routine that fits now."
    },
    emptyProfile: {
      kicker: "My Page",
      title: "No saved reports yet",
      body: "Complete an analysis to view your saved reports here.",
      cta: "Start Free Analysis"
    },
    savedReport: {
      kicker: "Saved Reports",
      empty: "No saved reports yet",
      emptyBody: "Complete an analysis to view your saved reports here.",
      fallbackTitle: "Saved Analysis Result",
      typeFallback: "Report",
      created: "Created",
      updated: "Last updated",
      statusComplete: "Analysis complete",
      statusSaved: "Saved"
    },
    checkInPrompt: {
      kicker: "Today Check-in",
      title: "Check Today's Beauty Context",
      body: "Log dryness, oiliness, redness, and irritation so today's routine can adjust to your current state.",
      cta: "Start Check-in"
    },
    checkInDone: {
      kicker: "Today Check-in",
      title: "Today's check-in is complete",
      cta: "Check Again"
    },
    routinePending: {
      kicker: "Today Routine",
      title: "Today's check-in has been saved.",
      body: "If the routine card is not ready yet, please check again in a moment."
    },
    routine: {
      kicker: "Today Routine",
      title: "Today's Routine",
      keep: "Keep",
      reduce: "Reduce",
      avoid: "Avoid",
      am: "AM Routine",
      pm: "PM Routine",
      emptyItems: "No items yet.",
      emptyRoutine: "No routine yet.",
      stepFallback: "Step"
    },
    profile: {
      kicker: "Skin Match",
      title: "Recent Skin Profile",
      skinType: "Skin Type",
      sensitivity: "Sensitivity",
      unknown: "Not set"
    },
    checkInPage: {
      noProfile: {
        kicker: "Daily Check-in",
        title: "No saved reports yet",
        body: "Save a Skin Match profile before using today's check-in.",
        back: "Back to My Page"
      },
      header: {
        back: "Back to My Page",
        kicker: "Daily Check-in",
        title: "Today's Check-in",
        body: "Save today's skin and routine context to generate a rule-based routine card."
      },
      error: {
        kicker: "Daily Check-in",
        title: "Unable to load your reports",
        body: "Please try again in a moment.",
        back: "Back to My Page"
      }
    },
    checkInForm: {
      activeProfile: "Active Profile",
      noConcerns: "No saved concerns",
      unknownSkinType: "Skin type not set",
      date: "Check-in date",
      makeupToday: "Wearing makeup today",
      outdoorToday: "Spending more time outdoors today",
      memo: "Memo",
      memoPlaceholder: "Add a short note about how your skin feels today.",
      profileRequired: "Save a skin profile before using check-in.",
      saveError: "Unable to save your check-in. Please try again in a moment.",
      submit: "Save Today's Check-in",
      saving: "Saving...",
      cancel: "Cancel",
      levels: [
        {
          key: "dryness_level",
          label: "Dryness",
          low: "Comfortable",
          high: "Very dry"
        },
        {
          key: "oiliness_level",
          label: "Oiliness",
          low: "Fresh",
          high: "Very shiny"
        },
        {
          key: "redness_level",
          label: "Redness",
          low: "None",
          high: "Strong"
        },
        {
          key: "breakout_level",
          label: "Breakouts",
          low: "None",
          high: "Many"
        },
        {
          key: "irritation_level",
          label: "Irritation",
          low: "None",
          high: "Strong"
        }
      ]
    }
  }
};

function normalizeLocale(locale) {
  return locale === "en" ? "en" : "ko";
}

export function getMyCopy(locale = "ko") {
  return MY_COPY[normalizeLocale(locale)];
}

export function getMyLocale(locale = "ko") {
  return normalizeLocale(locale);
}

export function getMyPath(locale = "ko") {
  return getMyCopy(locale).paths.my;
}
