import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { buildExistingRecommendationSnapshot } from "./functional-shadow-adapter.js";

const CAPTURE_VERSION = "v1";
const DEFAULT_CAPTURE_DIR = path.join(process.cwd(), "tmp", "functional-shadow-captures");

function normalizeEnv(env = process.env) {
  return {
    NODE_ENV: env.NODE_ENV,
    FUNCTIONAL_SHADOW_CAPTURE: env.FUNCTIONAL_SHADOW_CAPTURE
  };
}

export function isFunctionalShadowCaptureEnabled(env = process.env) {
  const normalized = normalizeEnv(env);
  return normalized.NODE_ENV === "development" && normalized.FUNCTIONAL_SHADOW_CAPTURE === "1";
}

function getDisabledReason(env = process.env) {
  const normalized = normalizeEnv(env);

  if (normalized.NODE_ENV === "production") {
    return "production";
  }

  return "disabled";
}

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function normalizeBoolean(value) {
  return typeof value === "boolean" ? value : Boolean(value);
}

function sanitizeSurveyContract(contract = {}) {
  return {
    skinState: {
      skinType: contract?.skinState?.skinType ?? null,
      sensitivity: contract?.skinState?.sensitivity ?? null,
      postWashFeeling: contract?.skinState?.postWashFeeling ?? null,
      afternoonSkinChange: contract?.skinState?.afternoonSkinChange ?? null
    },
    goals: {
      primaryConcern: contract?.goals?.primaryConcern ?? null,
      secondaryConcerns: normalizeArray(contract?.goals?.secondaryConcerns),
      unresolvedPrimaryConcern: Boolean(contract?.goals?.unresolvedPrimaryConcern)
    },
    safety: {
      recentSkinChange: contract?.safety?.recentSkinChange ?? null,
      recentlyChangedProduct: contract?.safety?.recentlyChangedProduct ?? null,
      sensitivityRisk: contract?.safety?.sensitivityRisk ?? null,
      drynessRisk: contract?.safety?.drynessRisk ?? null,
      rednessRisk: contract?.safety?.rednessRisk ?? null
    },
    behavior: {
      cleansingFrequency: contract?.behavior?.cleansingFrequency ?? null,
      environmentExposure: normalizeArray(contract?.behavior?.environmentExposure)
    },
    preferences: {
      preferredTexture: contract?.preferences?.preferredTexture ?? null,
      mostDislikedFeel: contract?.preferences?.mostDislikedFeel ?? null
    },
    sunscreen: {
      whiteCastHate: normalizeBoolean(contract?.sunscreen?.whiteCastHate),
      toneUpWanted: normalizeBoolean(contract?.sunscreen?.toneUpWanted),
      makeupUse: normalizeBoolean(contract?.sunscreen?.makeupUse),
      eyeSensitive: normalizeBoolean(contract?.sunscreen?.eyeSensitive),
      sourceCompleteness: contract?.sunscreen?.sourceCompleteness ?? null
    }
  };
}

function sanitizeFreeResultContext(freeResult = {}, goalPolicy = {}) {
  return {
    priorityAxis: freeResult?.priority?.axis || freeResult?.priority?.concern || null,
    priorityReasonCode: freeResult?.priority?.reasonCode || freeResult?.priority?.reason_code || null,
    safetySummary: goalPolicy?.safetyGoal || null,
    recommendationSuppressed: Boolean(freeResult?.recommendationSuppressed),
    suppressionReason: freeResult?.suppressionReason || null
  };
}

function sanitizeGoalPolicy(goalPolicy = {}) {
  return {
    rankingGoal: goalPolicy?.rankingGoal || null,
    safetyGoal: goalPolicy?.safetyGoal || null,
    recommendationGuard: goalPolicy?.recommendationGuard || null,
    hasTension: Boolean(goalPolicy?.hasTension),
    tensionType: goalPolicy?.tensionType || null
  };
}

function unwrapProduct(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  return item.product && typeof item.product === "object" ? item.product : item;
}

function collectFinalResultProducts(result = {}) {
  return [
    result?.topPick,
    ...(Array.isArray(result?.premiumReport?.supportingProducts) ? result.premiumReport.supportingProducts : []),
    ...(Array.isArray(result?.premiumReport?.budgetAlternatives) ? result.premiumReport.budgetAlternatives : [])
  ]
    .map(unwrapProduct)
    .filter(Boolean);
}

function sanitizeFunctionalSignals(ingredientSignals) {
  const functional = Array.isArray(ingredientSignals?.functional)
    ? ingredientSignals.functional
    : [];

  return functional.length
    ? {
        functional: functional
          .map((entry) => ({
            label: normalizeString(entry?.label),
            count: Number.isFinite(Number(entry?.count)) ? Number(entry.count) : 0
          }))
          .filter((entry) => entry.label && entry.count > 0)
          .slice(0, 24)
      }
    : null;
}

function sanitizeMarketSignals(marketSignals) {
  if (!marketSignals || typeof marketSignals !== "object") {
    return null;
  }

  return {
    review_count: Number.isFinite(Number(marketSignals.review_count))
      ? Number(marketSignals.review_count)
      : null,
    rating: Number.isFinite(Number(marketSignals.rating))
      ? Number(marketSignals.rating)
      : null
  };
}

function sanitizeProductForCapture(product) {
  const unwrapped = unwrapProduct(product);

  if (!unwrapped || typeof unwrapped !== "object") {
    return null;
  }

  const sanitized = {
    id: normalizeString(unwrapped.id || unwrapped.productId || unwrapped.product_id),
    category: normalizeString(unwrapped.category),
    product_form: normalizeString(unwrapped.product_form || unwrapped.productForm),
    skin_types: normalizeArray(unwrapped.skin_types),
    concerns: normalizeArray(unwrapped.concerns),
    texture: normalizeString(unwrapped.texture),
    finish: normalizeString(unwrapped.finish),
    irritation_risk: normalizeString(unwrapped.irritation_risk),
    sensitivity_safe: typeof unwrapped.sensitivity_safe === "boolean" ? unwrapped.sensitivity_safe : null,
    uv_filter_type: normalizeString(unwrapped.uv_filter_type),
    tone_up: typeof unwrapped.tone_up === "boolean" ? unwrapped.tone_up : null,
    white_cast: normalizeString(unwrapped.white_cast),
    eye_sting: normalizeString(unwrapped.eye_sting),
    pilling_risk: normalizeString(unwrapped.pilling_risk),
    ingredient_signals: sanitizeFunctionalSignals(unwrapped.ingredient_signals),
    market_signals: sanitizeMarketSignals(unwrapped.market_signals)
  };

  return Object.fromEntries(
    Object.entries(sanitized).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return value !== null && value !== undefined;
    })
  );
}

function uniqueProducts(products = []) {
  const seen = new Set();
  const output = [];

  products.forEach((product) => {
    const sanitized = sanitizeProductForCapture(product);
    const id = sanitized?.id;

    if (!id || seen.has(id)) {
      return;
    }

    seen.add(id);
    output.push(sanitized);
  });

  return output;
}

function resolveCandidateSource({ candidateProducts, existingRecommendationResult }) {
  const provided = Array.isArray(candidateProducts) ? uniqueProducts(candidateProducts) : [];

  if (provided.length) {
    return {
      completeness: "complete",
      products: provided
    };
  }

  const finalProducts = uniqueProducts(collectFinalResultProducts(existingRecommendationResult));

  if (finalProducts.length) {
    return {
      completeness: "final_results_only",
      products: finalProducts
    };
  }

  return {
    completeness: "unavailable",
    products: []
  };
}

function countBy(items = [], keyFn) {
  return items.reduce((counts, item) => {
    const key = keyFn(item) || "unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function sanitizeCurrentProductFindingSummary(currentProductFindings) {
  const findings = Array.isArray(currentProductFindings?.findings)
    ? currentProductFindings.findings
    : Array.isArray(currentProductFindings)
      ? currentProductFindings
      : [];

  return {
    available: findings.length > 0,
    findingCount: findings.length,
    relationCounts: countBy(findings, (finding) => finding?.relationToPlan),
    sourceStateCounts: countBy(findings, (finding) => finding?.sourceState)
  };
}

function formatTimestampForFile(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "-",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds())
  ].join("");
}

function buildCaptureFixture({
  surveyContract,
  freeResult,
  goalPolicy,
  existingRecommendationResult,
  candidateProducts,
  currentProductFindings,
  now = new Date(),
  captureId = randomUUID()
}) {
  const candidateSource = resolveCandidateSource({
    candidateProducts,
    existingRecommendationResult
  });
  const existingRecommendationSnapshot = buildExistingRecommendationSnapshot({
    ...(existingRecommendationResult || freeResult || {}),
    candidateSourceCoverage:
      candidateSource.completeness === "complete"
        ? "complete"
        : candidateSource.completeness === "partial"
          ? "partial"
          : "final_result_only"
  });

  return {
    captureVersion: CAPTURE_VERSION,
    capturedAt: now.toISOString(),
    source: "dev_api_analyze",
    captureId,
    survey: sanitizeSurveyContract(surveyContract),
    freeResultContext: sanitizeFreeResultContext(freeResult, goalPolicy),
    goalPolicy: sanitizeGoalPolicy(goalPolicy),
    existingRecommendationSnapshot,
    candidateSource: {
      completeness: candidateSource.completeness,
      sourceCount: candidateSource.products.length,
      products: candidateSource.products
    },
    currentProductFindingSummary: sanitizeCurrentProductFindingSummary(currentProductFindings)
  };
}

export async function captureFunctionalShadowFixture({
  surveyContract,
  freeResult,
  goalPolicy,
  existingRecommendationResult,
  candidateProducts,
  currentProductFindings,
  options = {}
} = {}) {
  const env = options.env || process.env;

  if (!isFunctionalShadowCaptureEnabled(env)) {
    return {
      captured: false,
      reason: getDisabledReason(env)
    };
  }

  if (!surveyContract || !freeResult || !goalPolicy) {
    return {
      captured: false,
      reason: "insufficient_context"
    };
  }

  try {
    const now = options.now || new Date();
    const captureId = options.captureId || randomUUID();
    const fixture = buildCaptureFixture({
      surveyContract,
      freeResult,
      goalPolicy,
      existingRecommendationResult,
      candidateProducts,
      currentProductFindings,
      now,
      captureId
    });
    const outputDir = options.outputDir || DEFAULT_CAPTURE_DIR;
    const fileName = `${formatTimestampForFile(now)}-${captureId.slice(0, 8)}.json`;
    const filePath = path.join(outputDir, fileName);

    await mkdir(outputDir, { recursive: true });
    await writeFile(filePath, JSON.stringify(fixture, null, 2), { encoding: "utf8", flag: "wx" });

    return {
      captured: true,
      captureId,
      filePath
    };
  } catch (error) {
    return {
      captured: false,
      reason: "write_failed",
      error
    };
  }
}

export const FUNCTIONAL_SHADOW_CAPTURE_DEFAULT_DIR = DEFAULT_CAPTURE_DIR;
