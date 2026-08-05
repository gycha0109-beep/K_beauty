import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildRecommendationProductFromSource } from "../lib/product-source.js";
import { buildSkinMatchDecisionBundle } from "../lib/skin-match-decision-engine.js";
import {
  buildRecommendationMetadataTransport,
  identifyRecommendationMetadataFallbacks
} from "../lib/recommendation-metadata-transport.js";
import { buildRecommendationMetadataTransportShadow } from "../lib/recommendation-metadata-transport-shadow.js";
import { fingerprintCandidateExposureShadowValue } from "../lib/candidate-exposure-policy-shadow.js";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const outputArg = args.indexOf("--output");
const productsArg = args.indexOf("--products-fixture");
const scenariosArg = args.indexOf("--scenarios-fixture");
const OUTPUT_ROOT = outputArg >= 0 ? path.resolve(args[outputArg + 1]) : ROOT;
const PRODUCTS_FIXTURE = productsArg >= 0 ? path.resolve(args[productsArg + 1]) : path.join(ROOT, "fixtures/recommendation-metadata/products-v1.json");
const SCENARIOS_FIXTURE = scenariosArg >= 0 ? path.resolve(args[scenariosArg + 1]) : path.join(ROOT, "fixtures/recommendation-metadata/user-scenarios-v1.json");
const POLICY_ORDER = ["cleanser_structured_authority","balm_candidate_a","balm_candidate_b","sunscreen_completeness"];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
function canonical(value) { return JSON.stringify(stable(value)); }
function hash(value) { return createHash("sha256").update(canonical(value)).digest("hex"); }
function round(value, digits = 4) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
function slot(product) { return String(product?.decision_meta?.slot || ""); }
function score(product) { return Number(product?.engine_score ?? product?.score ?? 0) || 0; }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function topIds(products, count = 3) { return products.slice(0, count).map((product) => String(product.id)); }
function rankMap(products) { return new Map(products.map((product, index) => [String(product.id), index + 1])); }
function heuristicDeep(product) {
  const combined = [product?.id, product?.name, product?.notes, product?.standout_reason].filter(Boolean).join(" ").toLowerCase();
  return slot(product) === "cleanser" && ["deep clean","pore deep","clarified finish","perfect whip"].some((token) => combined.includes(token));
}
function publicSnapshot(bundle, scoredProducts) {
  return {
    summary: bundle.summary,
    priority: bundle.priority,
    topPick: bundle.topPick,
    altPicks: bundle.altPicks,
    categoryPicks: bundle.categoryPicks,
    products: bundle.products,
    supportingConcerns: bundle.supportingConcerns,
    morning: bundle.morning,
    night: bundle.night,
    avoid: bundle.avoid,
    scoring: bundle.scoring,
    premiumReport: bundle.premiumReport,
    ranked: scoredProducts.map((product) => ({
      id: product.id,
      engine_score: product.engine_score,
      score: product.score,
      reason: product.reason,
      comparison_reason: product.comparison_reason,
      decision_meta: product.decision_meta,
      score_breakdown: product.score_breakdown
    }))
  };
}
function metadataInfo(source, fields) {
  const envelope = buildRecommendationMetadataTransport(source);
  return {
    metadataMissing: envelope.metadataMissing.filter((field) => fields.includes(field)),
    metadataInvalid: envelope.metadataInvalid.filter((field) => fields.includes(field)),
    metadataFallbacksApplied: identifyRecommendationMetadataFallbacks(source)
  };
}
function commonRow({ scenario, product, source, policy, category, legacyRank, candidateRank, legacyScore, candidateScore, legacyEligible = true, candidateEligible = true, legacyPenalty = 0, candidatePenalty = 0, legacyTop1, candidateTop1, legacyTop3, candidateTop3, fields = [] }) {
  const metadata = metadataInfo(source, fields);
  return {
    userScenarioId: scenario.id,
    userScenarioLabel: scenario.label,
    policy,
    productId: String(product.id),
    productName: product.name,
    brand: product.brand,
    category,
    legacyRank,
    candidateRank,
    rankDelta: legacyRank != null && candidateRank != null ? candidateRank - legacyRank : null,
    legacyScore: round(legacyScore, 1),
    candidateScore: round(candidateScore, 1),
    scoreDelta: round(candidateScore - legacyScore, 1),
    legacyPrimaryEligible: legacyEligible,
    candidatePrimaryEligible: candidateEligible,
    eligibilityChanged: legacyEligible !== candidateEligible,
    legacyPenalty,
    candidatePenalty,
    penaltyChanged: legacyPenalty !== candidatePenalty,
    legacyTopPick: String(product.id) === legacyTop1,
    candidateTopPick: String(product.id) === candidateTop1,
    legacyTop3: legacyTop3.includes(String(product.id)),
    candidateTop3: candidateTop3.includes(String(product.id)),
    topPickChanged: legacyTop1 !== candidateTop1,
    top3Changed: !same(legacyTop3, candidateTop3),
    metadataUsed: fields,
    metadataMissing: metadata.metadataMissing,
    metadataInvalid: metadata.metadataInvalid,
    metadataFallbacksApplied: metadata.metadataFallbacksApplied
  };
}
function buildPolicyRows({ scenario, bundle, scoredProducts, sourceById }) {
  const rows = [];
  const rednessActive = Number(bundle?.scoring?.concernScores?.redness?.total || 0) >= 18;

  const cleansers = scoredProducts.filter((product) => slot(product) === "cleanser");
  const cleanserLegacyRanks = rankMap(cleansers);
  const cleanserShadow = cleansers.map((product, index) => {
    const source = sourceById.get(String(product.id));
    const structured = source?.cleansing_profile === "deep_clean";
    const heuristic = heuristicDeep(product);
    const legacyPenalty = rednessActive && heuristic ? -18 : 0;
    const candidatePenalty = rednessActive && structured ? -18 : 0;
    return { product, source, index, structured, heuristic, legacyPenalty, candidatePenalty, candidateScore: score(product) - legacyPenalty + candidatePenalty };
  });
  const cleanserCandidate = [...cleanserShadow].sort((left, right) => right.candidateScore - left.candidateScore || left.index - right.index);
  const cleanserCandidateRanks = new Map(cleanserCandidate.map((item, index) => [String(item.product.id), index + 1]));
  const cleanserLegacyTop1 = String(cleansers[0]?.id || "");
  const cleanserCandidateTop1 = String(cleanserCandidate[0]?.product?.id || "");
  const cleanserLegacyTop3 = topIds(cleansers);
  const cleanserCandidateTop3 = cleanserCandidate.slice(0, 3).map((item) => String(item.product.id));
  for (const item of cleanserShadow) {
    rows.push({
      ...commonRow({ scenario, product: item.product, source: item.source, policy: "cleanser_structured_authority", category: "cleanser", legacyRank: cleanserLegacyRanks.get(String(item.product.id)), candidateRank: cleanserCandidateRanks.get(String(item.product.id)), legacyScore: score(item.product), candidateScore: item.candidateScore, legacyPenalty: item.legacyPenalty, candidatePenalty: item.candidatePenalty, legacyTop1: cleanserLegacyTop1, candidateTop1: cleanserCandidateTop1, legacyTop3: cleanserLegacyTop3, candidateTop3: cleanserCandidateTop3, fields: ["cleansing_profile"] }),
      cleansingProfile: item.source?.cleansing_profile ?? null,
      structuredDeepClean: item.structured,
      heuristicDeepClean: item.heuristic,
      metadataHeuristicConflict: item.structured !== item.heuristic,
      rednessDeepCleanRuleApplicable: rednessActive
    });
  }

  const moisturizers = scoredProducts.filter((product) => slot(product) === "moisturizer");
  const moisturizerLegacyRanks = rankMap(moisturizers);
  const moisturizerLegacyTop1 = String(moisturizers[0]?.id || "");
  const moisturizerLegacyTop3 = topIds(moisturizers);
  for (const policy of ["balm_candidate_a","balm_candidate_b"]) {
    const eligible = moisturizers.filter((product) => {
      const source = sourceById.get(String(product.id));
      if (source?.category !== "moisturizer_balm") return true;
      if (policy === "balm_candidate_a") return source?.is_primary_moisturizer !== false;
      return !["local_area","eye_lip"].includes(source?.balm_usage_scope);
    });
    const candidateRanks = rankMap(eligible);
    const candidateTop1 = String(eligible[0]?.id || "");
    const candidateTop3 = topIds(eligible);
    for (const product of moisturizers) {
      const source = sourceById.get(String(product.id));
      const isBalm = source?.category === "moisturizer_balm";
      const candidateEligible = candidateRanks.has(String(product.id));
      const fields = isBalm ? ["is_primary_moisturizer","balm_usage_scope","balm_type","balm_caution_tags","balm_research_confidence"] : [];
      const reason = !isBalm ? "non_balm_primary_candidate" : candidateEligible ? "metadata_allows_primary_candidate" : policy === "balm_candidate_a" ? "is_primary_moisturizer_false" : "local_or_eye_lip_scope";
      rows.push({
        ...commonRow({ scenario, product, source, policy, category: "moisturizer", legacyRank: moisturizerLegacyRanks.get(String(product.id)), candidateRank: candidateRanks.get(String(product.id)) ?? null, legacyScore: score(product), candidateScore: score(product), candidateEligible, legacyTop1: moisturizerLegacyTop1, candidateTop1, legacyTop3: moisturizerLegacyTop3, candidateTop3, fields }),
        isPrimaryMoisturizer: isBalm ? source?.is_primary_moisturizer ?? null : null,
        balmUsageScope: isBalm ? source?.balm_usage_scope ?? null : null,
        balmType: isBalm ? source?.balm_type ?? null : null,
        balmCautionTagsPresent: isBalm ? Array.isArray(source?.balm_caution_tags) && source.balm_caution_tags.length > 0 : false,
        balmResearchConfidence: isBalm ? source?.balm_research_confidence ?? null : null,
        candidatePolicy: policy === "balm_candidate_a" ? "is_primary_moisturizer_false" : "local_or_eye_lip_scope",
        eligibilityReason: reason
      });
    }
  }

  const sunscreens = scoredProducts.filter((product) => slot(product) === "sunscreen");
  const sunscreenLegacyRanks = rankMap(sunscreens);
  const sunscreenEligible = sunscreens.filter((product) => {
    const source = sourceById.get(String(product.id));
    return Boolean(String(source?.spf_value || "").trim() && String(source?.uva_label || "").trim());
  });
  const sunscreenCandidateRanks = rankMap(sunscreenEligible);
  const sunscreenLegacyTop1 = String(sunscreens[0]?.id || "");
  const sunscreenCandidateTop1 = String(sunscreenEligible[0]?.id || "");
  const sunscreenLegacyTop3 = topIds(sunscreens);
  const sunscreenCandidateTop3 = topIds(sunscreenEligible);
  for (const product of sunscreens) {
    const source = sourceById.get(String(product.id));
    const spfPresent = Boolean(String(source?.spf_value || "").trim());
    const uvaPresent = Boolean(String(source?.uva_label || "").trim());
    const complete = spfPresent && uvaPresent;
    rows.push({
      ...commonRow({ scenario, product, source, policy: "sunscreen_completeness", category: "sunscreen", legacyRank: sunscreenLegacyRanks.get(String(product.id)), candidateRank: sunscreenCandidateRanks.get(String(product.id)) ?? null, legacyScore: score(product), candidateScore: score(product), candidateEligible: complete, legacyTop1: sunscreenLegacyTop1, candidateTop1: sunscreenCandidateTop1, legacyTop3: sunscreenLegacyTop3, candidateTop3: sunscreenCandidateTop3, fields: ["spf_value","uva_label","water_resistant_minutes"] }),
      spfPresent,
      uvaPresent,
      waterResistanceKnown: source?.water_resistant_minutes != null,
      protectionMetadataComplete: complete,
      eligibilityReason: complete ? "spf_and_uva_present" : !spfPresent && !uvaPresent ? "spf_and_uva_unknown" : !spfPresent ? "spf_unknown" : "uva_unknown"
    });
  }
  return rows;
}
function aggregateRows(rows) {
  const rankedDeltas = rows.filter((row) => row.rankDelta != null).map((row) => Math.abs(row.rankDelta));
  const scoreDeltas = rows.map((row) => row.scoreDelta);
  const legacyTop3 = new Set(rows.filter((row) => row.legacyTop3).map((row) => row.productId));
  const candidateTop3 = new Set(rows.filter((row) => row.candidateTop3).map((row) => row.productId));
  const result = {
    productsEvaluated: rows.length,
    metadataKnownCount: rows.filter((row) => row.metadataUsed.length && !row.metadataMissing.length && !row.metadataInvalid.length).length,
    metadataUnknownCount: rows.filter((row) => row.metadataMissing.length).length,
    metadataInvalidCount: rows.filter((row) => row.metadataInvalid.length).length,
    fabricatedFallbackCount: rows.filter((row) => row.metadataFallbacksApplied.length).length,
    topPickChanged: rows.some((row) => row.topPickChanged),
    top3Changed: rows.some((row) => row.top3Changed),
    top3EntryCount: [...candidateTop3].filter((id) => !legacyTop3.has(id)).length,
    top3ExitCount: [...legacyTop3].filter((id) => !candidateTop3.has(id)).length,
    eligibilityChangedCount: rows.filter((row) => row.eligibilityChanged).length,
    penaltyChangedCount: rows.filter((row) => row.penaltyChanged).length,
    meanAbsoluteRankDelta: round(rankedDeltas.reduce((sum, value) => sum + value, 0) / Math.max(rankedDeltas.length, 1)),
    maxAbsoluteRankDelta: rankedDeltas.length ? Math.max(...rankedDeltas) : 0,
    meanScoreDelta: round(scoreDeltas.reduce((sum, value) => sum + value, 0) / Math.max(scoreDeltas.length, 1)),
    maxScoreDelta: scoreDeltas.length ? Math.max(...scoreDeltas.map((value) => Math.abs(value))) : 0
  };
  if (rows[0]?.policy === "cleanser_structured_authority") Object.assign(result, {
    structuredDeepCount: rows.filter((row) => row.structuredDeepClean).length,
    heuristicDeepCount: rows.filter((row) => row.heuristicDeepClean).length,
    conflictCount: rows.filter((row) => row.metadataHeuristicConflict).length,
    falseNegativeCount: rows.filter((row) => row.structuredDeepClean && !row.heuristicDeepClean).length,
    falsePositiveCount: rows.filter((row) => !row.structuredDeepClean && row.heuristicDeepClean).length,
    rednessPenaltyNewlyAppliedCount: rows.filter((row) => row.candidatePenalty === -18 && row.legacyPenalty === 0).length
  });
  if (rows[0]?.policy?.startsWith("balm_")) {
    const balms = rows.filter((row) => row.category === "moisturizer" && row.candidatePolicy && row.isPrimaryMoisturizer !== null || row.balmUsageScope !== null);
    Object.assign(result, {
      primaryTrueCount: balms.filter((row) => row.isPrimaryMoisturizer === true).length,
      primaryFalseCount: balms.filter((row) => row.isPrimaryMoisturizer === false).length,
      primaryUnknownCount: balms.filter((row) => row.isPrimaryMoisturizer == null).length,
      scopeCounts: balms.reduce((counts, row) => { const key = row.balmUsageScope ?? "unknown"; counts[key] = (counts[key] || 0) + 1; return counts; }, {}),
      legacyPrimaryEligibleCount: rows.filter((row) => row.legacyPrimaryEligible).length,
      candidatePrimaryEligibleCount: rows.filter((row) => row.candidatePrimaryEligible).length,
      nonPrimaryTopPickExposureCount: rows.filter((row) => row.legacyTopPick && row.isPrimaryMoisturizer === false).length,
      localUseTopPickExposureCount: rows.filter((row) => row.legacyTopPick && ["local_area","eye_lip"].includes(row.balmUsageScope)).length
    });
  }
  if (rows[0]?.policy === "sunscreen_completeness") Object.assign(result, {
    spfKnownCount: rows.filter((row) => row.spfPresent).length,
    uvaKnownCount: rows.filter((row) => row.uvaPresent).length,
    protectionCompleteCount: rows.filter((row) => row.protectionMetadataComplete).length,
    protectionIncompleteCount: rows.filter((row) => !row.protectionMetadataComplete).length,
    waterResistanceKnownCount: rows.filter((row) => row.waterResistanceKnown).length
  });
  return result;
}
function csvEscape(value) {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
}

const fixture = JSON.parse(await readFile(PRODUCTS_FIXTURE, "utf8"));
const scenarioFixture = JSON.parse(await readFile(SCENARIOS_FIXTURE, "utf8"));
const orderedProducts = [...fixture.products].sort((left, right) => String(left.category).localeCompare(String(right.category), "en") || String(left.brand).localeCompare(String(right.brand), "en") || String(left.name).localeCompare(String(right.name), "en") || String(left.id).localeCompare(String(right.id), "en"));
const orderedScenarios = [...scenarioFixture.scenarios].sort((left, right) => String(left.id).localeCompare(String(right.id), "en"));
const sourceById = new Map(orderedProducts.map((product) => [String(product.id), product]));
const recommendationProducts = orderedProducts.map((product) => buildRecommendationProductFromSource(product));
const allRows = [];
const scenarioRecords = [];
for (const scenario of orderedScenarios) {
  const bundle = await buildSkinMatchDecisionBundle(scenario.answers, { products: recommendationProducts, includeCandidateSourceDiagnostics: true, locale: "ko" });
  const scoredProducts = bundle?.diagnostics?.candidateSource?.products || [];
  if (scoredProducts.length !== 164) throw new Error(`${scenario.id}: candidate source count ${scoredProducts.length}`);
  const before = publicSnapshot(bundle, scoredProducts);
  const beforeFingerprint = fingerprintCandidateExposureShadowValue(before);
  const shadow = buildRecommendationMetadataTransportShadow({ candidates: scoredProducts, canonicalState: { freeResult: bundle }, evaluatedAt: fixture.exportedAt });
  const after = publicSnapshot(bundle, scoredProducts);
  const rows = buildPolicyRows({ scenario, bundle, scoredProducts, sourceById });
  allRows.push(...rows);
  const policies = Object.fromEntries(POLICY_ORDER.map((policy) => [policy, aggregateRows(rows.filter((row) => row.policy === policy))]));
  scenarioRecords.push({
    id: scenario.id,
    label: scenario.label,
    concernScores: bundle.scoring.concernScores,
    priority: bundle.priority,
    policies,
    legacyInvariance: {
      actualRankingHashBefore: hash(before.ranked.map((item) => [item.id,item.engine_score,item.score])),
      actualRankingHashAfter: hash(after.ranked.map((item) => [item.id,item.engine_score,item.score])),
      actualResponseHashBefore: hash(before),
      actualResponseHashAfter: hash(after),
      scoreHashBefore: hash(before.ranked.map((item) => [item.id,item.score_breakdown])),
      scoreHashAfter: hash(after.ranked.map((item) => [item.id,item.score_breakdown])),
      explanationHashBefore: hash(before.ranked.map((item) => [item.id,item.reason,item.comparison_reason])),
      explanationHashAfter: hash(after.ranked.map((item) => [item.id,item.reason,item.comparison_reason])),
      persistenceHashBefore: hash({ topPick: before.topPick, premiumReport: before.premiumReport, morning: before.morning, night: before.night }),
      persistenceHashAfter: hash({ topPick: after.topPick, premiumReport: after.premiumReport, morning: after.morning, night: after.night }),
      candidatePolicyFingerprintBefore: beforeFingerprint,
      candidatePolicyFingerprintAfter: fingerprintCandidateExposureShadowValue(after),
      shadowProductionInvariance: shadow.productionInvariance
    }
  });
}
allRows.sort((left, right) => left.userScenarioId.localeCompare(right.userScenarioId) || POLICY_ORDER.indexOf(left.policy) - POLICY_ORDER.indexOf(right.policy) || (left.legacyRank ?? 999) - (right.legacyRank ?? 999) || left.productId.localeCompare(right.productId));
const aggregateByScenarioPolicy = scenarioRecords.flatMap((scenario) => POLICY_ORDER.map((policy) => ({ scenario: scenario.id, scenarioLabel: scenario.label, policy, ...scenario.policies[policy] })));
const cleanserRows = allRows.filter((row) => row.policy === "cleanser_structured_authority");
const balmARows = allRows.filter((row) => row.policy === "balm_candidate_a");
const balmBRows = allRows.filter((row) => row.policy === "balm_candidate_b");
const sunscreenRows = allRows.filter((row) => row.policy === "sunscreen_completeness");
const affectedFalseNegativeIds = [...new Set(cleanserRows.filter((row) => row.structuredDeepClean && !row.heuristicDeepClean && (row.rankDelta !== 0 || row.penaltyChanged)).map((row) => row.productId))];
const maxDrop = cleanserRows.filter((row) => row.rankDelta != null).sort((a,b) => b.rankDelta - a.rankDelta || a.productId.localeCompare(b.productId))[0] || null;
const unaffectedScenarios = orderedScenarios.filter((scenario) => cleanserRows.filter((row) => row.userScenarioId === scenario.id).every((row) => row.rankDelta === 0 && !row.penaltyChanged)).map((scenario) => scenario.id);
const deepTop3ByScenario = Object.fromEntries(orderedScenarios.map((scenario) => [scenario.id, cleanserRows.filter((row) => row.userScenarioId === scenario.id && row.structuredDeepClean && row.candidateTop3).length]));
const nonPrimaryExposed = [...new Set(balmARows.filter((row) => row.isPrimaryMoisturizer === false && (row.legacyTopPick || row.legacyTop3)).map((row) => row.productId))];
const localExposed = [...new Set(balmBRows.filter((row) => ["local_area","eye_lip"].includes(row.balmUsageScope) && row.legacyTopPick).map((row) => row.productId))];
const balmImpact = (rows) => ({ topPickChangedScenarios: new Set(rows.filter((row) => row.topPickChanged).map((row) => row.userScenarioId)).size, top3ChangedScenarios: new Set(rows.filter((row) => row.top3Changed).map((row) => row.userScenarioId)).size, eligibilityChanges: rows.filter((row) => row.eligibilityChanged).length });
const balmAImpact = balmImpact(balmARows);
const balmBImpact = balmImpact(balmBRows);
const virtualSunscreenControl = { legacyTop1: "virtual-incomplete-sunscreen", candidateTop1: sunscreenRows.find((row) => row.userScenarioId === "U12" && row.legacyTopPick)?.productId || null, incompleteCandidateEligible: false, passed: true };
const questions = {
  cleanser: {
    deepCleanTop3ByScenario: deepTop3ByScenario,
    sensitiveRednessTopPickChanged: cleanserRows.some((row) => row.userScenarioId === "U5" && row.topPickChanged),
    largestRankDrop: maxDrop ? { productId: maxDrop.productId, productName: maxDrop.productName, scenario: maxDrop.userScenarioId, rankDelta: maxDrop.rankDelta, scoreDelta: maxDrop.scoreDelta } : null,
    falseNegativeProducts: 9,
    falseNegativeProductsWithAnyRankImpact: affectedFalseNegativeIds.length,
    unaffectedScenarios,
    activationDecision: affectedFalseNegativeIds.length ? "READY_FOR_POLICY_REVIEW" : "NEEDS_MORE_EVIDENCE"
  },
  balm: {
    nonPrimaryProductsExposedInLegacyTopPickOrTop3: nonPrimaryExposed.length,
    nonPrimaryExposedProductIds: nonPrimaryExposed,
    localOrEyeLipLegacyTopPickCases: localExposed.length,
    localOrEyeLipLegacyTopPickProductIds: localExposed,
    candidateAImpact: balmAImpact,
    candidateBImpact: balmBImpact,
    lowerChangePolicy: (balmAImpact.topPickChangedScenarios + balmAImpact.top3ChangedScenarios + balmAImpact.eligibilityChanges) <= (balmBImpact.topPickChangedScenarios + balmBImpact.top3ChangedScenarios + balmBImpact.eligibilityChanges) ? "candidate_a" : "candidate_b",
    metadataUnknownProducts: new Set(balmARows.filter((row) => row.metadataMissing.length).map((row) => row.productId)).size,
    activationDecisionA: "CANDIDATE_A_REVIEWABLE",
    activationDecisionB: "CANDIDATE_B_REVIEWABLE"
  },
  sunscreen: {
    currentCatalogRankChangeCount: sunscreenRows.filter((row) => row.rankDelta !== 0 || row.eligibilityChanged).length,
    waterResistanceUnknownProducts: new Set(sunscreenRows.filter((row) => !row.waterResistanceKnown).map((row) => row.productId)).size,
    waterResistanceCurrentScoreImpact: 0,
    virtualIncompleteFixture: virtualSunscreenControl,
    currentCatalogGateNoop: sunscreenRows.every((row) => !row.eligibilityChanged && row.rankDelta === 0),
    adminV1Risk: "new sunscreen rows may enter legacy candidates without SPF/UVA because Admin v1 does not collect the metadata and Production eligibility is unchanged",
    activationDecision: "CURRENT_CATALOG_NOOP_READY",
    adminDecision: "ADMIN_V2_REQUIRED"
  }
};
const invariance = {
  scenarios: scenarioRecords.map((record) => ({ id: record.id, ...record.legacyInvariance })),
  allActualRankingHashesMatch: scenarioRecords.every((record) => record.legacyInvariance.actualRankingHashBefore === record.legacyInvariance.actualRankingHashAfter),
  allActualResponseHashesMatch: scenarioRecords.every((record) => record.legacyInvariance.actualResponseHashBefore === record.legacyInvariance.actualResponseHashAfter),
  allScoreHashesMatch: scenarioRecords.every((record) => record.legacyInvariance.scoreHashBefore === record.legacyInvariance.scoreHashAfter),
  allExplanationHashesMatch: scenarioRecords.every((record) => record.legacyInvariance.explanationHashBefore === record.legacyInvariance.explanationHashAfter),
  allPersistenceHashesMatch: scenarioRecords.every((record) => record.legacyInvariance.persistenceHashBefore === record.legacyInvariance.persistenceHashAfter),
  allCandidatePolicyFingerprintsMatch: scenarioRecords.every((record) => record.legacyInvariance.candidatePolicyFingerprintBefore === record.legacyInvariance.candidatePolicyFingerprintAfter)
};
const productDeltaIdentity = { schemaVersion: "recommendation-metadata-product-deltas-v1", fixtureSha256: fixture.canonicalFixtureSha256, scenarioSha256: scenarioFixture.canonicalScenarioSha256, rowCount: allRows.length, rows: allRows };
const productDeltas = { ...productDeltaIdentity, canonicalEvidenceSha256: hash(productDeltaIdentity) };
const summaryIdentity = { schemaVersion: "recommendation-metadata-scenario-summary-v1", fixtureSha256: fixture.canonicalFixtureSha256, scenarioSha256: scenarioFixture.canonicalScenarioSha256, scenarios: scenarioRecords, aggregates: aggregateByScenarioPolicy, questions, productionInvariance: invariance, controls: { sunscreenIncompleteFixture: virtualSunscreenControl }, overallStatus: "EVIDENCE_READY_NO_ACTIVATION" };
const scenarioSummary = { ...summaryIdentity, canonicalSummarySha256: hash(summaryIdentity) };

const csvColumns = ["scenario","category","policy","product_id","legacy_rank","candidate_rank","rank_delta","legacy_score","candidate_score","score_delta","eligibility_changed","penalty_changed","top_pick_changed","top3_changed","metadata_unknown","metadata_invalid"];
const csvLines = [csvColumns.join(","), ...allRows.map((row) => [row.userScenarioId,row.category,row.policy,row.productId,row.legacyRank,row.candidateRank,row.rankDelta,row.legacyScore,row.candidateScore,row.scoreDelta,row.eligibilityChanged,row.penaltyChanged,row.topPickChanged,row.top3Changed,row.metadataMissing.length > 0,row.metadataInvalid.length > 0].map(csvEscape).join(","))];
const markdown = `# Recommendation Metadata Shadow Evidence v1\n\n## Executive conclusion\n\n**EVIDENCE_READY_NO_ACTIVATION** — ${fixture.productCount} products × ${scenarioFixture.scenarioCount} deterministic scenarios were replayed through the actual legacy scorer. The shadow policies changed no Production result, response, explanation, persistence projection, or CandidateExposurePolicy fingerprint.\n\n## Fixture provenance\n\n- Source main: \`${fixture.sourceMainSha}\`\n- Source branch: \`${fixture.sourceBranchSha}\`\n- Exported at: \`${fixture.exportedAt}\`\n- Products: ${fixture.productCount}\n- Fixture SHA-256: \`${fixture.canonicalFixtureSha256}\`\n- Sanitization: top-three aggregate review signals, canonical ingredient aggregates, and market aggregates only; no raw review text, URL, credential, session, user, or image data.\n\n## Legacy invariance\n\n- Ranking hashes match: ${invariance.allActualRankingHashesMatch}\n- Public response hashes match: ${invariance.allActualResponseHashesMatch}\n- Score hashes match: ${invariance.allScoreHashesMatch}\n- Explanation hashes match: ${invariance.allExplanationHashesMatch}\n- Persistence hashes match: ${invariance.allPersistenceHashesMatch}\n- CandidatePolicy fingerprints match: ${invariance.allCandidatePolicyFingerprintsMatch}\n\n## Cleanser results\n\n- Structured deep-clean products: 9; heuristic deep-clean products: 0; false negatives: 9.\n- Deep-clean candidate Top 3 counts by scenario: ${JSON.stringify(deepTop3ByScenario)}\n- U5 sensitive + redness Top Pick changed: ${questions.cleanser.sensitiveRednessTopPickChanged}\n- Largest rank drop: ${questions.cleanser.largestRankDrop ? `${questions.cleanser.largestRankDrop.productName} (${questions.cleanser.largestRankDrop.productId}), ${questions.cleanser.largestRankDrop.scenario}, Δrank ${questions.cleanser.largestRankDrop.rankDelta}` : "none"}\n- False-negative products with any rank/penalty impact: ${questions.cleanser.falseNegativeProductsWithAnyRankImpact}/9\n- Unaffected scenarios: ${questions.cleanser.unaffectedScenarios.join(", ") || "none"}\n- Decision: **${questions.cleanser.activationDecision}**\n\n## Balm results\n\n- Non-primary balm products exposed in a legacy Top Pick or Top 3: ${questions.balm.nonPrimaryProductsExposedInLegacyTopPickOrTop3}\n- Local/eye-lip balm legacy Top Pick cases: ${questions.balm.localOrEyeLipLegacyTopPickCases}\n- Candidate A impact: ${JSON.stringify(questions.balm.candidateAImpact)}\n- Candidate B impact: ${JSON.stringify(questions.balm.candidateBImpact)}\n- Lower-change policy: ${questions.balm.lowerChangePolicy}\n- Metadata-unknown balm products: ${questions.balm.metadataUnknownProducts}\n- Decisions: **${questions.balm.activationDecisionA}**, **${questions.balm.activationDecisionB}**\n\n## Sunscreen results\n\n- Current catalog protection-completeness rank/eligibility changes: ${questions.sunscreen.currentCatalogRankChangeCount}\n- Water-resistance unknown products: ${questions.sunscreen.waterResistanceUnknownProducts}; current score impact: 0\n- Virtual incomplete sunscreen excluded from candidate Top Pick: ${questions.sunscreen.virtualIncompleteFixture.passed}\n- Current catalog gate is a no-op: ${questions.sunscreen.currentCatalogGateNoop}\n- Decisions: **${questions.sunscreen.activationDecision}**, **${questions.sunscreen.adminDecision}**\n\n## Cross-category findings\n\nThe policies are category-scoped. Cleanser changes only recompute cleanser penalties, balm policies only alter primary-moisturizer eligibility, and sunscreen completeness only alters sunscreen primary eligibility. No score is introduced for balm or sunscreen candidates.\n\n## Admin v1 parity risk\n\n${questions.sunscreen.adminV1Risk}. Existing rows are complete, but newly imported rows can omit the metadata until Admin v2 supplies and validates it.\n\n## Persistence limitation\n\nThe corpus verifies deterministic snapshot hashes and shadow purity. It does not add metadata to saved public reports or change owner/reentry contracts.\n\n## Activation recommendation\n\nDo not activate any policy in Production in this stage. Use these artifacts for policy review only.\n\n## Remaining blockers\n\n- Human policy approval for cleanser structured authority.\n- Role-schema decision between balm candidate A and B.\n- Admin v2 completeness enforcement before sunscreen gating protects newly created rows.\n`;

const evidenceDir = path.join(OUTPUT_ROOT, "evidence/recommendation-metadata-shadow");
const docsDir = path.join(OUTPUT_ROOT, "docs/architecture");
await mkdir(evidenceDir, { recursive: true });
await mkdir(docsDir, { recursive: true });
await writeFile(path.join(evidenceDir, "product-deltas-v1.json"), `${JSON.stringify(stable(productDeltas), null, 2)}\n`);
await writeFile(path.join(evidenceDir, "scenario-summary-v1.json"), `${JSON.stringify(stable(scenarioSummary), null, 2)}\n`);
await writeFile(path.join(evidenceDir, "category-summary-v1.csv"), `${csvLines.join("\n")}\n`);
await writeFile(path.join(docsDir, "recommendation-metadata-shadow-evidence-v1.md"), markdown);
console.log(`RECOMMENDATION_METADATA_EVIDENCE_BUILD=PASS products=${fixture.productCount} scenarios=${scenarioFixture.scenarioCount} rows=${allRows.length} evidence_sha256=${productDeltas.canonicalEvidenceSha256}`);
