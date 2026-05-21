const CALMING_AVOID_ITEMS = ["각질 패드", "레티놀", "비타민C", "강한 클렌징"];
const CALMING_KEEP_ITEMS = ["진정 세럼", "장벽 크림", "저자극 선크림"];
const DRYNESS_REDUCE_ITEMS = ["강한 클렌저", "과한 세안"];
const DRYNESS_KEEP_ITEMS = ["보습 토너", "장벽 크림", "수분 세럼"];
const OILINESS_REDUCE_ITEMS = ["무거운 크림 과다 사용", "오일리한 제품 레이어링"];
const OILINESS_KEEP_ITEMS = ["가벼운 수분 루틴", "산뜻한 선크림"];
const BREAKOUT_AVOID_ITEMS = ["새 제품 동시 테스트", "과한 각질 제거", "무거운 제형 과다 사용"];
const BREAKOUT_KEEP_ITEMS = ["진정 루틴", "가벼운 보습"];
const MAKEUP_REDUCE_ITEMS = ["밀림 위험 높은 제품 과다 레이어링", "끈적한 선크림 과다 사용"];
const MAKEUP_KEEP_ITEMS = ["얇은 보습", "밀림 적은 선크림"];
const OUTDOOR_KEEP_ITEMS = ["선크림", "필요 시 덧바름", "저녁 세안 꼼꼼히"];

function addUnique(target, items) {
  items.forEach((item) => {
    if (item && !target.includes(item)) {
      target.push(item);
    }
  });
}

function getLevel(checkin, key) {
  const value = Number(checkin?.[key] ?? 0);

  return Number.isFinite(value) ? value : 0;
}

function buildAmRoutine({ keepItems, checkin }) {
  const steps = [
    {
      step: "cleanse",
      name: "가벼운 아침 세안",
      instruction:
        getLevel(checkin, "dryness_level") >= 2
          ? "건조감이 있으면 물 세안 또는 저자극 세안으로 줄여주세요."
          : "피부 상태에 맞춰 부담 없이 세안하세요."
    },
    {
      step: "hydrate",
      name: keepItems.includes("수분 세럼") ? "수분 세럼" : "가벼운 보습",
      instruction: "흡수가 빠른 보습을 얇게 올려 피부 컨디션을 안정시켜 주세요."
    },
    {
      step: "sun_protection",
      name: keepItems.includes("저자극 선크림") ? "저자극 선크림" : "선크림",
      instruction: checkin?.outdoor_today
        ? "외출 시간이 길면 덧바름까지 고려하세요."
        : "자극이나 밀림이 적은 양으로 마무리하세요."
    }
  ];

  if (checkin?.makeup_today) {
    steps.splice(2, 0, {
      step: "makeup_prep",
      name: "얇은 보습",
      instruction: "메이크업 전에는 제품을 많이 겹치기보다 얇게 흡수시켜 주세요."
    });
  }

  return steps;
}

function buildPmRoutine({ keepItems, checkin }) {
  const steps = [
    {
      step: "cleanse",
      name: checkin?.makeup_today ? "꼼꼼한 저녁 세안" : "저자극 저녁 세안",
      instruction: checkin?.makeup_today
        ? "메이크업 잔여물이 남지 않게 부드럽게 세안하세요."
        : "피부가 당기지 않는 강도로 세안하세요."
    },
    {
      step: "calm",
      name: keepItems.includes("진정 세럼") ? "진정 세럼" : "피부 진정",
      instruction: "붉음, 트러블, 자극감이 있는 부위는 단순한 진정 루틴으로 관리하세요."
    },
    {
      step: "barrier",
      name: keepItems.includes("장벽 크림") ? "장벽 크림" : "보습 마무리",
      instruction: "피부 장벽을 편안하게 마무리하는 보습으로 끝내세요."
    }
  ];

  return steps;
}

export function generateDailyRoutine({ skinProfile = null, checkin }) {
  const keepItems = [];
  const reduceItems = [];
  const avoidItems = [];
  const warnings = [];

  const rednessLevel = getLevel(checkin, "redness_level");
  const irritationLevel = getLevel(checkin, "irritation_level");
  const drynessLevel = getLevel(checkin, "dryness_level");
  const oilinessLevel = getLevel(checkin, "oiliness_level");
  const breakoutLevel = getLevel(checkin, "breakout_level");

  if (rednessLevel >= 2 || irritationLevel >= 2) {
    addUnique(avoidItems, CALMING_AVOID_ITEMS);
    addUnique(keepItems, CALMING_KEEP_ITEMS);
    warnings.push({
      type: "barrier_caution",
      level: "medium",
      message: "붉음이나 자극감이 있어 오늘은 강한 활성 성분과 클렌징을 피하세요."
    });
  }

  if (drynessLevel >= 2) {
    addUnique(reduceItems, DRYNESS_REDUCE_ITEMS);
    addUnique(keepItems, DRYNESS_KEEP_ITEMS);
    warnings.push({
      type: "dryness_caution",
      level: "medium",
      message: "건조감이 높아 세안 강도와 보습 공백을 줄이는 것이 좋습니다."
    });
  }

  if (oilinessLevel >= 2) {
    addUnique(reduceItems, OILINESS_REDUCE_ITEMS);
    addUnique(keepItems, OILINESS_KEEP_ITEMS);
  }

  if (breakoutLevel >= 2) {
    addUnique(avoidItems, BREAKOUT_AVOID_ITEMS);
    addUnique(keepItems, BREAKOUT_KEEP_ITEMS);
    warnings.push({
      type: "breakout_caution",
      level: "medium",
      message: "트러블이 올라온 날은 새 제품 테스트와 과한 각질 제거를 피하세요."
    });
  }

  if (checkin?.makeup_today) {
    addUnique(reduceItems, MAKEUP_REDUCE_ITEMS);
    addUnique(keepItems, MAKEUP_KEEP_ITEMS);
  }

  if (checkin?.outdoor_today) {
    addUnique(keepItems, OUTDOOR_KEEP_ITEMS);
  }

  if (keepItems.length === 0) {
    addUnique(keepItems, ["기본 보습 루틴", "선크림"]);
  }

  return {
    am_routine: buildAmRoutine({ keepItems, checkin, skinProfile }),
    pm_routine: buildPmRoutine({ keepItems, checkin, skinProfile }),
    keep_items: keepItems,
    reduce_items: reduceItems,
    avoid_items: avoidItems,
    warnings,
    generation_source: "rule"
  };
}
