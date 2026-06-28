import {
  getCurrentProductRoutineSlots,
  resolveCurrentProductSemantics
} from "@/lib/current-products";

const VERDICT_STATUSES = new Set(["keep", "adjust", "hold", "check_needed"]);

const STRUCTURED_ACTIVE_FIELDS = [
  "active_ingredients",
  "activeIngredients",
  "ingredients",
  "ingredient_list",
  "ingredientList",
  "key_ingredients",
  "keyIngredients",
  "hero_ingredients",
  "heroIngredients",
  "active_signals",
  "activeSignals",
  "ingredient_signals",
  "ingredientSignals",
  "functional_signals",
  "functionalSignals"
];

const STRONG_ACTIVE_PATTERN = /\b(retinol|retinal|retinoid|aha|bha|pha|peeling|peel|scrub|acid|exfoliat|vitamin c)\b/i;

function getLocale(locale) {
  return locale === "en" ? "en" : "ko";
}

function normalizeVerdictCategory(category) {
  const raw = String(category || "").trim();
  return ["serum", "ampoule", "essence"].includes(raw) ? "treatment" : raw;
}

export function getCurrentProductVerdictSlotKey(mode, slot, category) {
  const normalizedCategory = normalizeVerdictCategory(category);
  return [mode, slot, normalizedCategory].filter(Boolean).join(".");
}

function getSnapshot(selection) {
  return selection?.productSnapshot || selection?.product || null;
}

function getProductId(selection, snapshot) {
  return String(snapshot?.id || selection?.productId || selection?.product_id || "").trim() || null;
}

function getProductTitle(selection, snapshot, locale) {
  const brand = String(snapshot?.brand || snapshot?.brandName || "").trim();
  const name = String(snapshot?.name || snapshot?.productName || "").trim();

  if (brand || name) {
    return [brand, name || (locale === "en" ? "Selected product" : "선택한 제품")]
      .filter(Boolean)
      .join(" ");
  }

  if (selection?.status === "not_in_db") {
    return locale === "en" ? "Unregistered current product" : "등록되지 않은 현재 제품";
  }

  return locale === "en" ? "Selected product" : "선택한 제품";
}

function flattenStructuredValues(value, output = []) {
  if (value == null) {
    return output;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    output.push(String(value));
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => flattenStructuredValues(item, output));
    return output;
  }

  if (typeof value === "object") {
    Object.values(value).forEach((item) => flattenStructuredValues(item, output));
  }

  return output;
}

function getStructuredActiveSignal(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return { detected: false, matches: [] };
  }

  const values = STRUCTURED_ACTIVE_FIELDS.flatMap((field) => flattenStructuredValues(snapshot[field]));
  const matches = Array.from(
    new Set(
      values
        .map((value) => String(value || "").match(STRONG_ACTIVE_PATTERN)?.[0]?.toLowerCase())
        .filter(Boolean)
    )
  );

  return {
    detected: matches.length > 0,
    matches
  };
}

function isTreatmentCategory(category) {
  return ["treatment", "serum", "ampoule", "essence", "toner_pad"].includes(String(category || "").trim());
}

function isBarrierSensitiveAxis(axis) {
  return ["barrier", "redness", "acne"].includes(String(axis || "").trim());
}

function buildCheckNeeded(selection, snapshot, locale, reason) {
  return {
    status: "check_needed",
    title: locale === "en" ? "Needs more product information" : "제품 정보 확인 필요",
    summary: locale === "en"
      ? "The current product is noted, but detailed fit was not judged from the available DB information."
      : "현재 사용 중인 제품으로 반영했지만, DB 정보가 부족해 상세 적합도는 판단하지 않았어요.",
    reasons: [
      reason ||
        (locale === "en"
          ? "Product detail is missing or outside the registered DB."
          : "제품 상세 정보가 없거나 등록 DB 밖의 제품입니다.")
    ],
    adjustment: locale === "en"
      ? "Keep the routine step, and confirm the exact product before making a strong call."
      : "루틴 단계는 유지하되, 정확한 제품 정보가 확인된 뒤에만 강하게 판단하세요."
  };
}

function buildSelectedVerdict(selection, snapshot, context, locale, category) {
  const axis = context?.priorityAxis || context?.priority?.axis || "";
  const answers = context?.answers || {};
  const useTime = String(selection?.useTime || "").trim();
  const satisfaction = String(selection?.satisfaction || "").trim();
  const activeSignal = getStructuredActiveSignal(snapshot);

  if (activeSignal.detected && isBarrierSensitiveAxis(axis)) {
    const activeList = activeSignal.matches.join(", ");

    return {
      status: "hold",
      title: locale === "en" ? "Pause until skin is calmer" : "피부가 안정될 때까지 잠시 쉬기",
      summary: locale === "en"
        ? "Structured product information shows an active signal that can conflict with the current barrier or sensitivity priority."
        : "구조화된 제품 정보에서 현재 장벽·민감 신호와 충돌할 수 있는 활성 신호가 확인됐어요.",
      reasons: [
        locale === "en"
          ? "The current priority is barrier or sensitivity related."
          : "현재 우선 관리 축이 장벽·민감 쪽입니다.",
        locale === "en"
          ? `Structured product metadata includes ${activeList}.`
          : `구조화된 제품 정보에 ${activeList} 신호가 있습니다.`
      ],
      adjustment: locale === "en"
        ? "Recheck after the skin feels stable for several days."
        : "며칠간 피부 컨디션이 안정된 뒤 소량으로 다시 확인하세요."
    };
  }

  if (
    satisfaction === "bad" ||
    (category === "cleanser" && (answers.cleansingFrequency === "3_plus" || answers.postWashFeeling === "tight")) ||
    (isTreatmentCategory(category) && isBarrierSensitiveAxis(axis)) ||
    (category === "sunscreen" && useTime === "evening")
  ) {
    return {
      status: "adjust",
      title: locale === "en" ? "Adjust how you use it first" : "제품보다 사용 방식 먼저 조정",
      summary: locale === "en"
        ? "It does not need to be removed immediately, but the amount, timing, or pairing should be lighter."
        : "바로 제외하기보다 양, 시간대, 함께 쓰는 단계를 먼저 가볍게 조정해 보세요.",
      reasons: [
        locale === "en"
          ? "The current skin priority or survey context can make this step feel heavier."
          : "현재 피부 우선순위나 설문 맥락에서 이 단계가 부담으로 느껴질 수 있습니다."
      ],
      adjustment: locale === "en"
        ? "Use less often or keep it away from other active steps."
        : "사용 빈도나 양을 줄이고, 기능성 단계와는 겹치지 않게 조정하세요."
    };
  }

  return {
    status: "keep",
    title: locale === "en" ? "OK to keep in this routine" : "현재 루틴에서 유지 가능",
    summary: locale === "en"
      ? "No clear conflict was found between this product role and the current routine priority."
      : "현재 피부 우선순위와 루틴 역할 기준에서 뚜렷한 충돌 신호는 없어요.",
    reasons: [
      locale === "en"
        ? "The product is registered and connected to a visible routine step."
        : "등록된 제품이고 현재 루틴 단계와 연결됩니다."
    ],
    adjustment: null
  };
}

function withSlot(selection, verdict, slot, locale, category) {
  const snapshot = getSnapshot(selection);
  return {
    slotKey: getCurrentProductVerdictSlotKey(slot.mode, slot.slot, category),
    productId: getProductId(selection, snapshot),
    status: VERDICT_STATUSES.has(verdict.status) ? verdict.status : "check_needed",
    title: String(verdict.title || getProductTitle(selection, snapshot, locale)).trim(),
    summary: String(verdict.summary || "").trim(),
    reasons: Array.isArray(verdict.reasons)
      ? verdict.reasons.map((reason) => String(reason || "").trim()).filter(Boolean).slice(0, 3)
      : [],
    adjustment: verdict.adjustment ? String(verdict.adjustment).trim() : null
  };
}

export function buildCurrentProductVerdicts(currentProducts, context = {}) {
  const locale = getLocale(context.locale);
  const selections = Array.isArray(currentProducts)
    ? currentProducts
    : Array.isArray(currentProducts?.selections)
      ? currentProducts.selections
      : [];
  const verdicts = [];

  for (const selection of selections) {
    const status = String(selection?.status || "").trim();

    if (status === "not_using") {
      continue;
    }

    const semantics = resolveCurrentProductSemantics(selection);
    const slots = getCurrentProductRoutineSlots(selection);

    if (!semantics || !slots.length) {
      continue;
    }

    const snapshot = getSnapshot(selection);
    const category = semantics.canonicalCategory;
    const baseVerdict = status === "not_in_db"
      ? buildCheckNeeded(
          selection,
          snapshot,
          locale,
          locale === "en"
            ? "The product is marked as in use, but it is not registered in the DB."
            : "사용 중으로 입력됐지만 DB에 등록되지 않은 제품입니다."
        )
      : status === "selected" && !snapshot
        ? buildCheckNeeded(
            selection,
            snapshot,
            locale,
            locale === "en"
              ? "The selected product snapshot was not available in the saved report."
              : "저장된 리포트에 선택 제품 snapshot이 없습니다."
          )
        : status === "selected"
          ? buildSelectedVerdict(selection, snapshot, context, locale, category)
          : null;

    if (!baseVerdict) {
      continue;
    }

    for (const slot of slots) {
      verdicts.push(withSlot(selection, baseVerdict, slot, locale, category));
    }
  }

  return verdicts;
}
