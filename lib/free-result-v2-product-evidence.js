import {
  buildProductEvidencePresentationProjection,
  validateProductEvidencePresentationProjection
} from "./product-evidence-presentation-contract.js";

export const FREE_RESULT_V2_PRODUCT_EVIDENCE_FEATURES = Object.freeze([
  "eye_sting",
  "white_cast",
  "pilling_risk",
  "finish"
]);

const FEATURE_SET = new Set(FREE_RESULT_V2_PRODUCT_EVIDENCE_FEATURES);

const FEATURE_LABELS = Object.freeze({
  ko: Object.freeze({
    eye_sting: "눈 시림",
    white_cast: "백탁",
    pilling_risk: "밀림",
    finish: "마무리감"
  }),
  en: Object.freeze({
    eye_sting: "Eye sting",
    white_cast: "White cast",
    pilling_risk: "Pilling",
    finish: "Finish"
  })
});

const EVIDENCE_COPY = Object.freeze({
  ko: Object.freeze({
    product_evidence_repeated_consistent: "독립된 근거가 같은 방향을 가리켜요.",
    product_review_pattern_repeated: "독립된 사용 경험에서 같은 경향이 반복됐어요.",
    product_review_pattern_observed: "사용 경험에서 확인된 경향이에요.",
    product_evidence_supported: "확인 가능한 근거가 있어요.",
    product_evidence_mixed: "근거가 한 방향으로 완전히 모이지는 않아요."
  }),
  en: Object.freeze({
    product_evidence_repeated_consistent: "Independent evidence points in the same direction.",
    product_review_pattern_repeated: "The same pattern repeats across independent use experiences.",
    product_review_pattern_observed: "This pattern appears in observed use experiences.",
    product_evidence_supported: "Traceable evidence supports this view.",
    product_evidence_mixed: "The evidence does not point entirely in one direction."
  })
});

function normalizeLocale(locale) {
  return locale === "en" ? "en" : "ko";
}

function normalizeValueLabel(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeValueSourceRef(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rebuildProjection(rawProjection) {
  if (!rawProjection || typeof rawProjection !== "object" || Array.isArray(rawProjection)) {
    return null;
  }

  try {
    return buildProductEvidencePresentationProjection({
      featureKey: rawProjection.featureKey,
      factRef: rawProjection.factRef,
      axisRef: rawProjection.axisRef,
      knowledgeState: rawProjection.knowledgeState,
      dominantFamily: rawProjection.evidenceView?.dominantFamily,
      independentSupport: rawProjection.evidenceView?.independentSupport,
      recency: rawProjection.evidenceView?.recency,
      agreement: rawProjection.evidenceView?.agreement,
      evidenceRefs: rawProjection.evidenceRefs
    });
  } catch {
    return null;
  }
}

function isValueTraceableToProjection(valueSourceRef, projection) {
  return Boolean(
    valueSourceRef &&
      (valueSourceRef === projection.factRef || valueSourceRef === projection.axisRef)
  );
}

/**
 * Presentation-only adapter for the sunscreen trust pilot.
 *
 * Nothing is inferred from ordinary product fields. A row is admitted only when callers supply:
 * 1) a projection that can be rebuilt under the canonical Product Evidence contract,
 * 2) explanation-only authority, and
 * 3) a presentation value explicitly bound to the projection's Fact or Decision Axis ref.
 *
 * Missing, blocked, malformed, unsupported, or unbound inputs disappear from the UI.
 */
export function buildFreeResultV2ProductEvidenceItems(entries, locale = "ko") {
  if (!Array.isArray(entries)) return [];

  const language = normalizeLocale(locale);
  const seen = new Set();
  const items = [];

  for (const entry of entries) {
    const projection = rebuildProjection(entry?.projection);
    if (!projection) continue;

    const validation = validateProductEvidencePresentationProjection(projection);
    if (!validation.valid) continue;
    if (!FEATURE_SET.has(projection.featureKey)) continue;
    if (seen.has(projection.featureKey)) continue;
    if (projection.knowledgeState !== "supported") continue;
    if (projection.recommendationUse !== "explanation_only") continue;

    const valueLabel = normalizeValueLabel(entry?.valueLabel);
    const valueSourceRef = normalizeValueSourceRef(entry?.valueSourceRef);
    if (!valueLabel || !isValueTraceableToProjection(valueSourceRef, projection)) continue;

    const evidenceCopy = EVIDENCE_COPY[language][projection.presentation.copyKey];
    if (!evidenceCopy) continue;

    seen.add(projection.featureKey);
    items.push(
      Object.freeze({
        featureKey: projection.featureKey,
        featureLabel: FEATURE_LABELS[language][projection.featureKey],
        valueLabel,
        valueSourceRef,
        tone: projection.presentation.tone,
        evidenceCopy,
        presentationPolicyVersion: projection.presentationPolicyVersion,
        admissionPolicyVersion: projection.admissionPolicyVersion
      })
    );
  }

  return Object.freeze(items);
}
