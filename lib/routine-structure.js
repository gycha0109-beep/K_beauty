const ROUTINE_STRUCTURE_COPY = {
  ko: {
    amPmLabel: "아침 + 저녁 분리형",
    amPmTitle: "아침 · 저녁 분리 루틴",
    amPmBody: "현재 결과는 낮과 밤 역할을 나눠 보는 구조로 읽는 편이 더 자연스럽습니다.",
    amOnlyLabel: "아침 집중형",
    amOnlyTitle: "아침 집중 루틴",
    amOnlyBody: "현재 결과는 아침 쪽 역할 비중이 더 크게 잡혀 있습니다.",
    pmOnlyLabel: "저녁 회복형",
    pmOnlyTitle: "저녁 집중 루틴",
    pmOnlyBody: "현재 결과는 저녁 쪽에서 회복과 보정을 먼저 잡는 구조로 읽힙니다.",
    singleTrackLabel: "하루 공통 1포인트",
    singleTrackTitle: "하루 공통 루틴",
    singleTrackBody: "현재는 하루 공통 포인트 하나로 읽는 편이 더 자연스럽습니다.",
    morningFocus: "아침 핵심",
    nightFocus: "저녁 핵심",
    coreFocus: "하루 공통 핵심"
  },
  en: {
    amPmLabel: "AM + PM split",
    amPmTitle: "AM + PM Split Routine",
    amPmBody: "The current result still reads more naturally as separate daytime and evening roles.",
    amOnlyLabel: "Morning-led",
    amOnlyTitle: "Morning-led Routine",
    amOnlyBody: "The current result leans more heavily on the morning side.",
    pmOnlyLabel: "Night-led",
    pmOnlyTitle: "Night-led Routine",
    pmOnlyBody: "The current result leans more heavily on the evening side.",
    singleTrackLabel: "All-day single track",
    singleTrackTitle: "All-day Core Routine",
    singleTrackBody: "The routine reads better as one common track for now.",
    morningFocus: "Morning Focus",
    nightFocus: "Night Focus",
    coreFocus: "All-day Core"
  }
};

function getRoutineCopy(locale = "ko") {
  return ROUTINE_STRUCTURE_COPY[locale] || ROUTINE_STRUCTURE_COPY.ko;
}

function inferRoutineStructureType(structure, cards) {
  if (structure?.type) {
    return structure.type;
  }

  const hasMorning = cards.some((item) => item?.key === "morning");
  const hasNight = cards.some((item) => item?.key === "night");

  if (hasMorning && hasNight) {
    return "am_pm_balanced";
  }
  if (hasMorning) {
    return "am_only";
  }
  if (hasNight) {
    return "pm_only";
  }

  return "single_track";
}

function getLocalizedRoutineStructureCopy(type, locale = "ko") {
  const copy = getRoutineCopy(locale);

  if (type === "am_pm_balanced" || type === "mode_split") {
    return {
      label: copy.amPmLabel,
      title: copy.amPmTitle,
      body: copy.amPmBody
    };
  }
  if (type === "am_only") {
    return {
      label: copy.amOnlyLabel,
      title: copy.amOnlyTitle,
      body: copy.amOnlyBody
    };
  }
  if (type === "pm_only") {
    return {
      label: copy.pmOnlyLabel,
      title: copy.pmOnlyTitle,
      body: copy.pmOnlyBody
    };
  }

  return {
    label: copy.singleTrackLabel,
    title: copy.singleTrackTitle,
    body: copy.singleTrackBody
  };
}

function localizeRoutineStructureForDisplay(structure, locale = "ko") {
  if (locale !== "en") {
    return structure;
  }

  const copy = getRoutineCopy(locale);
  const cards = Array.isArray(structure?.cards) ? structure.cards.filter(Boolean) : [];
  const type = inferRoutineStructureType(structure, cards);
  const localized = getLocalizedRoutineStructureCopy(type, locale);

  return {
    ...structure,
    type,
    label: localized.label,
    title: localized.title,
    body: localized.body,
    cards: cards.map((card) => ({
      ...card,
      label:
        card?.key === "morning"
          ? copy.morningFocus
          : card?.key === "night"
            ? copy.nightFocus
            : copy.coreFocus
    }))
  };
}

export function buildFallbackRoutineStructure(result, locale = "ko") {
  const copy = getRoutineCopy(locale);
  const hasMorning = Boolean(result?.amFocus);
  const hasNight = Boolean(result?.pmFocus);

  if (hasMorning && hasNight) {
    return {
      type: "am_pm_balanced",
      label: copy.amPmLabel,
      title: copy.amPmTitle,
      body: copy.amPmBody,
      cards: [
        {
          key: "morning",
          label: copy.morningFocus,
          body: result.amFocus
        },
        {
          key: "night",
          label: copy.nightFocus,
          body: result.pmFocus
        }
      ].filter((item) => item.body)
    };
  }

  if (hasMorning) {
    return {
      type: "am_only",
      label: copy.amOnlyLabel,
      title: copy.amOnlyTitle,
      body: copy.amOnlyBody,
      cards: [
        {
          key: "morning",
          label: copy.morningFocus,
          body: result.amFocus
        }
      ].filter((item) => item.body)
    };
  }

  if (hasNight) {
    return {
      type: "pm_only",
      label: copy.pmOnlyLabel,
      title: copy.pmOnlyTitle,
      body: copy.pmOnlyBody,
      cards: [
        {
          key: "night",
          label: copy.nightFocus,
          body: result.pmFocus
        }
      ].filter((item) => item.body)
    };
  }

  return {
    type: "single_track",
    label: copy.singleTrackLabel,
    title: copy.singleTrackTitle,
    body: copy.singleTrackBody,
    cards: []
  };
}

export function getRoutineStructureData(result, locale = "ko") {
  const structure = result?.routineStructure;
  const cards = Array.isArray(structure?.cards) ? structure.cards.filter(Boolean) : [];

  if (structure && typeof structure === "object" && (cards.length || structure.type || structure.title || structure.label || structure.body)) {
    return localizeRoutineStructureForDisplay({
      ...structure,
      cards
    }, locale);
  }

  return buildFallbackRoutineStructure(result, locale);
}

export function getRoutineStructureLabel(result, locale = "ko") {
  return getRoutineStructureData(result, locale).label;
}

export function buildRoutineSections({
  locale = "ko",
  routineStructure = null,
  morningItems = [],
  nightItems = [],
  labels = {}
}) {
  const copy = getRoutineCopy(locale);
  const cards = Array.isArray(routineStructure?.cards) ? routineStructure.cards : [];
  const morningLabel = labels.morning || copy.morningFocus;
  const nightLabel = labels.night || copy.nightFocus;
  const coreLabel = labels.core || copy.coreFocus;
  const type = routineStructure?.type || (
    morningItems.length && nightItems.length
      ? "am_pm_balanced"
      : morningItems.length
        ? "am_only"
        : nightItems.length
          ? "pm_only"
          : "single_track"
  );

  if (!cards.length) {
    if (type === "single_track") {
      const items = morningItems.length ? morningItems : nightItems;
      return items.length
        ? [
            {
              key: "core",
              label: coreLabel,
              items
            }
          ]
        : [];
    }

    return [
      morningItems.length
        ? {
            key: "morning",
            label: morningLabel,
            items: morningItems
          }
        : null,
      nightItems.length
        ? {
            key: "night",
            label: nightLabel,
            items: nightItems
          }
        : null
    ].filter(Boolean);
  }

  if (type === "single_track") {
    const items = morningItems.length ? morningItems : nightItems;
    return [
      {
        key: "core",
        label: cards[0]?.label || coreLabel,
        items
      }
    ].filter((section) => section.items.length);
  }

  if (type === "am_only") {
    return morningItems.length
      ? [
          {
            key: "morning",
            label: cards[0]?.label || morningLabel,
            items: morningItems
          }
        ]
      : [];
  }

  if (type === "pm_only") {
    return nightItems.length
      ? [
          {
            key: "night",
            label: cards[0]?.label || nightLabel,
            items: nightItems
          }
        ]
      : [];
  }

  return [
    morningItems.length
      ? {
          key: "morning",
          label: cards.find((item) => item.key === "morning")?.label || morningLabel,
          items: morningItems
        }
      : null,
    nightItems.length
      ? {
          key: "night",
          label: cards.find((item) => item.key === "night")?.label || nightLabel,
          items: nightItems
        }
      : null
  ].filter(Boolean);
}
