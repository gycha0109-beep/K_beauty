function clampScore(value) {
  const numeric = Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function getLevel(score) {
  if (score >= 75) {
    return "high";
  }

  if (score >= 50) {
    return "medium";
  }

  return "low";
}

function normalizeList(values) {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function includesValue(list, value) {
  return normalizeList(list).includes(value);
}

function getTexture(product) {
  return String(product?.texture || "").trim().toLowerCase();
}

function getFinish(product) {
  return String(product?.finish || "").trim().toLowerCase();
}

function getIrritationRisk(product) {
  return String(product?.irritation_risk || "medium").trim().toLowerCase();
}

function getNumericSignal(product, key) {
  const decisionMeta = product?.decision_meta || {};
  const scoreBreakdown = product?.score_breakdown || {};
  const snakeKey = key
    .replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)
    .replace(/^_/, "");
  const candidates = [decisionMeta?.[key], scoreBreakdown?.[key], scoreBreakdown?.[snakeKey]];
  const found = candidates.find((value) => Number.isFinite(Number(value)));
  return Number(found || 0);
}

function scaleSignal(score, multiplier = 1.5, maxAbs = 12) {
  const safe = Math.max(-maxAbs, Math.min(maxAbs, Number(score || 0)));
  return safe * multiplier;
}

function buildGauge(key, label, score, reason) {
  const safeScore = clampScore(score);

  return {
    key,
    label,
    score: safeScore,
    level: getLevel(safeScore),
    reason
  };
}

function buildReasons(locale, scores) {
  if (locale === "en") {
    return {
      hydration:
        scores.hydration >= 75
          ? "Hydration and barrier-related signals point to better moisture support."
          : scores.hydration >= 50
            ? "The texture and finish sit in a generally comfortable hydration range."
            : "It reads lighter than a hydration-first product.",
      freshness:
        scores.freshness >= 75
          ? "The finish and texture point to a lighter, fresher wear profile."
          : scores.freshness >= 50
            ? "It stays fairly light in finish and after-feel."
            : "It leans more cushioned than fresh.",
      lowIrritation:
        scores.lowIrritation >= 75
          ? "Lower irritation-risk signals make it comparatively steady for sensitive conditions."
          : scores.lowIrritation >= 50
            ? "The irritation profile looks broadly manageable for repeated use."
            : "This is not the calmest low-irritation profile in the set.",
      barrierCalming:
        scores.barrierCalming >= 75
          ? "Barrier and calming support signals are clearly present."
          : scores.barrierCalming >= 50
            ? "It supports comfort and calming more than a purely neutral product."
            : "Barrier-calming support is not the strongest part of this pick.",
      acneSafe:
        scores.acneSafe >= 75
          ? "The wear profile leans lower-burden for acne-prone use."
          : scores.acneSafe >= 50
            ? "It looks broadly manageable for breakout-prone routines."
            : "The texture or finish is not the lightest for acne-prone use."
    };
  }

  return {
    hydration:
      scores.hydration >= 75
        ? "보습과 장벽 관련 신호가 있어 건조함 보완에 유리한 편입니다."
        : scores.hydration >= 50
          ? "제형과 마무리 기준으로 무난한 보습감을 기대할 수 있습니다."
          : "보습 중심보다는 비교적 가볍게 쓰는 쪽에 가깝습니다.",
    freshness:
      scores.freshness >= 75
        ? "산뜻한 마무리와 가벼운 제형 쪽에 가깝습니다."
        : scores.freshness >= 50
          ? "데일리로 쓰기에 비교적 가볍고 편한 편입니다."
          : "산뜻함보다는 쿠션감이나 보습감이 더 앞서는 편입니다.",
    lowIrritation:
      scores.lowIrritation >= 75
        ? "자극 리스크가 낮고 민감 피부 조건에 비교적 안정적입니다."
        : scores.lowIrritation >= 50
          ? "반복 사용 기준에서 자극 부담이 무난한 편입니다."
          : "민감한 날에는 자극 부담을 한 번 더 보는 쪽이 좋습니다.",
    barrierCalming:
      scores.barrierCalming >= 75
        ? "장벽과 붉은기 관련 고민을 보조하기 좋은 방향입니다."
        : scores.barrierCalming >= 50
          ? "편안함과 진정 보조 쪽으로 무난하게 연결됩니다."
          : "장벽·진정 쪽의 강점이 가장 큰 제품은 아닙니다.",
    acneSafe:
      scores.acneSafe >= 75
        ? "트러블 피부에서 부담을 줄이는 쪽의 신호가 있습니다."
        : scores.acneSafe >= 50
          ? "무겁지 않게 쓰기 쉬워 트러블 피부에서도 비교적 무난한 편입니다."
          : "질감이나 마무리 기준으로는 조금 더 가볍게 보는 편이 좋습니다."
  };
}

export function buildProductFitGauges(product, context = {}) {
  const locale = context.locale === "en" ? "en" : "ko";

  if (!product) {
    return {
      gauges: []
    };
  }

  const category = String(product?.category || "").trim().toLowerCase();
  const concerns = normalizeList(product?.concerns);
  const skinTypes = normalizeList(product?.skin_types);
  const texture = getTexture(product);
  const finish = getFinish(product);
  const irritationRisk = getIrritationRisk(product);
  const sensitivitySafe = product?.sensitivity_safe === true;
  const reviewSignalScore = getNumericSignal(product, "reviewSignalScore");
  const ingredientSignalScore = getNumericSignal(product, "ingredientSignalScore");
  const marketConfidenceScore = getNumericSignal(product, "marketConfidenceScore");

  let hydration = 42;
  if (includesValue(concerns, "dehydration")) hydration += 18;
  if (includesValue(concerns, "barrier")) hydration += 14;
  if (includesValue(skinTypes, "dry")) hydration += 12;
  if (includesValue(skinTypes, "sensitive")) hydration += 8;
  if (texture === "lotion") hydration += 10;
  if (texture === "cream") hydration += 15;
  if (finish === "dewy") hydration += 12;
  if (finish === "natural") hydration += 6;
  if (finish === "fresh") hydration -= 4;
  if (finish === "soft_matte") hydration -= 12;
  hydration += scaleSignal(ingredientSignalScore, 1.4, 10);
  hydration += scaleSignal(reviewSignalScore, 0.7, 8);

  let freshness = 40;
  if (finish === "fresh") freshness += 20;
  if (finish === "soft_matte") freshness += 16;
  if (finish === "natural") freshness += 7;
  if (finish === "dewy") freshness -= 10;
  if (texture === "watery") freshness += 18;
  if (texture === "gel") freshness += 14;
  if (texture === "lotion") freshness += 6;
  if (texture === "cream") freshness -= 12;
  if (["sunscreen", "cleanser", "toner_essence", "toner_pad", "essence"].includes(category)) {
    freshness += 6;
  }
  freshness += scaleSignal(reviewSignalScore, 1.1, 10);

  let lowIrritation = 50;
  if (irritationRisk === "low") lowIrritation += 20;
  if (irritationRisk === "medium") lowIrritation += 2;
  if (irritationRisk === "high") lowIrritation -= 26;
  if (sensitivitySafe) lowIrritation += 15;
  if (includesValue(skinTypes, "sensitive")) lowIrritation += 8;
  if (includesValue(concerns, "barrier")) lowIrritation += 6;
  if (includesValue(concerns, "redness")) lowIrritation += 6;
  if (category === "toner_pad") lowIrritation -= 6;
  if (category === "cleanser" && finish === "soft_matte") lowIrritation -= 4;
  lowIrritation += scaleSignal(ingredientSignalScore, 1.2, 10);
  lowIrritation += scaleSignal(reviewSignalScore, 0.8, 10);

  let barrierCalming = 38;
  if (includesValue(concerns, "barrier")) barrierCalming += 18;
  if (includesValue(concerns, "redness")) barrierCalming += 16;
  if (includesValue(skinTypes, "sensitive")) barrierCalming += 10;
  if (includesValue(skinTypes, "dry")) barrierCalming += 8;
  if (category === "serum" || category === "ampoule") barrierCalming += 6;
  if (category === "moisturizer") barrierCalming += 8;
  if (category === "cleanser") barrierCalming -= 10;
  if (category === "toner_pad") barrierCalming -= 6;
  if (irritationRisk === "medium") barrierCalming -= 6;
  if (irritationRisk === "high") barrierCalming -= 18;
  barrierCalming += scaleSignal(ingredientSignalScore, 1.6, 12);
  barrierCalming += scaleSignal(reviewSignalScore, 0.8, 8);

  let acneSafe = 42;
  if (includesValue(concerns, "acne")) acneSafe += 14;
  if (includesValue(concerns, "oiliness")) acneSafe += 10;
  if (includesValue(skinTypes, "oily")) acneSafe += 8;
  if (finish === "fresh") acneSafe += 14;
  if (finish === "natural") acneSafe += 8;
  if (finish === "dewy") acneSafe -= 8;
  if (texture === "watery") acneSafe += 12;
  if (texture === "gel") acneSafe += 12;
  if (texture === "lotion") acneSafe += 7;
  if (texture === "cream") acneSafe -= 14;
  if (["sunscreen", "cleanser", "toner_essence", "toner_pad", "essence", "serum", "ampoule"].includes(category)) {
    acneSafe += 6;
  }
  if (category === "moisturizer") {
    acneSafe -= 4;
  }
  if (irritationRisk === "medium") acneSafe -= 6;
  if (irritationRisk === "high") acneSafe -= 18;
  acneSafe += scaleSignal(reviewSignalScore, 1.1, 10);

  hydration += Math.min(4, Math.max(0, marketConfidenceScore * 0.2));
  freshness += Math.min(4, Math.max(0, marketConfidenceScore * 0.2));
  lowIrritation += Math.min(3, Math.max(0, marketConfidenceScore * 0.15));
  barrierCalming += Math.min(3, Math.max(0, marketConfidenceScore * 0.15));
  acneSafe += Math.min(3, Math.max(0, marketConfidenceScore * 0.15));

  const scores = {
    hydration: clampScore(hydration),
    freshness: clampScore(freshness),
    lowIrritation: clampScore(lowIrritation),
    barrierCalming: clampScore(barrierCalming),
    acneSafe: clampScore(acneSafe)
  };
  const reasons = buildReasons(locale, scores);

  return {
    gauges: [
      buildGauge(locale === "en" ? "hydration" : "hydration", locale === "en" ? "Hydration" : "보습감", scores.hydration, reasons.hydration),
      buildGauge(locale === "en" ? "freshness" : "freshness", locale === "en" ? "Freshness" : "산뜻함", scores.freshness, reasons.freshness),
      buildGauge(
        locale === "en" ? "low_irritation" : "low_irritation",
        locale === "en" ? "Low Irritation" : "저자극",
        scores.lowIrritation,
        reasons.lowIrritation
      ),
      buildGauge(
        locale === "en" ? "barrier_calming" : "barrier_calming",
        locale === "en" ? "Barrier + Calming" : "장벽·진정",
        scores.barrierCalming,
        reasons.barrierCalming
      ),
      buildGauge(
        locale === "en" ? "acne_safe" : "acne_safe",
        locale === "en" ? "Lower Breakout Burden" : "트러블 부담 낮음",
        scores.acneSafe,
        reasons.acneSafe
      )
    ]
  };
}
