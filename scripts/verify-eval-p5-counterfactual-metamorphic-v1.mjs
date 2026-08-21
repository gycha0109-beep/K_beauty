import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { register } from "node:module";

register("./node-next-alias-loader.mjs", import.meta.url);

globalThis.fetch = async () => {
  throw new Error("EVAL_P5_NETWORK_CALL_FORBIDDEN");
};

const contractPath = path.resolve(
  process.env.EVAL_P5_CONTRACT_PATH || "fixtures/persona-evaluation/eval-p5-metamorphic-evaluation-contract-v1.json"
);
const p4ManifestPath = path.resolve(
  process.env.EVAL_P5_P4_MANIFEST_PATH || "fixtures/persona-evaluation/eval-p4-cohort-freeze-manifest-v1.json"
);
const p3ReferenceRoot = path.resolve(process.env.EVAL_P5_P3_REFERENCE_ROOT || "_reference/persona-p3");
const recommendationReferenceRoot = path.resolve(
  process.env.EVAL_P5_RECOMMENDATION_REFERENCE_ROOT || "_reference/recommendation"
);
const artifactRoot = path.resolve(process.env.EVAL_P5_ARTIFACT_ROOT || "artifacts/eval-p5");
const implementationSha = process.env.EVAL_P5_IMPLEMENTATION_SHA || "UNSPECIFIED_IMPLEMENTATION_SHA";
const fixedGeneratedAt = "2000-01-01T00:00:00.000Z";

const contract = JSON.parse(await readFile(contractPath, "utf8"));
const p4Manifest = JSON.parse(await readFile(p4ManifestPath, "utf8"));

const p3ModulePath = path.join(
  p3ReferenceRoot,
  p4Manifest.execution_authority.p3_materializer_path
);
const p3 = await import(pathToFileURL(p3ModulePath).href);

const [
  { buildRecommendationProductFromSource },
  { buildSkinMatchDecisionBundle },
  { buildFallbackPhotoAnalysis },
  { buildSurveyInputContract },
  {
    filterSunscreenCandidates,
    getProductCategorySlot,
    isProductEligibleForGenderPreference,
    normalizeRecommendationAnswers
  }
] = await Promise.all([
  import("../lib/product-source.js"),
  import("../lib/skin-match-decision-engine.js"),
  import("../lib/photo-evidence.js"),
  import("../lib/survey-input-contract.js"),
  import("../lib/recommendation-scoring.ts")
]);

function invariant(condition, message, detail = null) {
  if (!condition) {
    const suffix = detail == null ? "" : `\n${JSON.stringify(detail, null, 2)}`;
    throw new Error(`${message}${suffix}`);
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setPath(object, dottedPath, value) {
  const keys = dottedPath.split(".");
  let cursor = object;
  for (const key of keys.slice(0, -1)) cursor = cursor[key];
  cursor[keys[keys.length - 1]] = value;
}

function diffPaths(left, right, prefix = "") {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right) ? [] : [prefix];
  }
  const leftObject = left && typeof left === "object";
  const rightObject = right && typeof right === "object";
  if (!leftObject || !rightObject) {
    return Object.is(left, right) ? [] : [prefix];
  }
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .sort((a, b) => a.localeCompare(b, "en"));
  return keys.flatMap((key) => diffPaths(
    left[key],
    right[key],
    prefix ? `${prefix}.${key}` : key
  ));
}

function getProductId(value) {
  if (!value || typeof value !== "object") return null;
  const direct = value.id || value.productId || value.product_id;
  if (direct != null) return String(direct);
  if (value.product && typeof value.product === "object") return getProductId(value.product);
  return null;
}

function priorityIdentity(priority) {
  if (typeof priority === "string") return priority;
  if (!priority || typeof priority !== "object") return null;
  return priority.axis || priority.key || priority.id || null;
}

function projectCategoryPicks(value) {
  if (Array.isArray(value)) return value.map(getProductId).filter(Boolean);
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.keys(value)
      .sort((a, b) => a.localeCompare(b, "en"))
      .map((key) => [key, getProductId(value[key])])
  );
}

function projectBundle(bundle) {
  return {
    topPickId: getProductId(bundle?.topPick),
    alternativeId: getProductId(bundle?.alternative) || getProductId(bundle?.altPicks?.[0]),
    priority: priorityIdentity(bundle?.priority),
    categoryPickIds: projectCategoryPicks(bundle?.categoryPicks)
  };
}

function containsId(items, id) {
  return Array.isArray(items) && items.some((item) => String(item.id) === String(id));
}

function countBy(values) {
  return Object.fromEntries(
    [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map()).entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b), "en"))
  );
}

invariant(contract.schema_version === "eval-p5-metamorphic-evaluation-contract-v1", "P5 contract schema mismatch");
invariant(contract.stage === "EVAL-P5", "P5 stage mismatch");
invariant(contract.relations.length === 7, "P5 must execute exactly the seven P2 frozen metamorphic relations");
invariant(
  contract.authority.p2_metamorphic_registry_version === "persona-metamorphic-registry-v1",
  "P2 metamorphic registry version mismatch"
);
invariant(
  p3.semanticHash(p4Manifest) === contract.authority.p4_manifest_semantic_hash,
  "P4 manifest semantic hash mismatch",
  { expected: contract.authority.p4_manifest_semantic_hash, actual: p3.semanticHash(p4Manifest) }
);

const sourceSet = p3.materializeP3Personas();
invariant(
  sourceSet.lineage.cohort_hash === p4Manifest.execution_authority.p3_combined_cohort_hash,
  "immutable P3 source cohort hash mismatch"
);

const lockedByType = Object.fromEntries(
  p4Manifest.locked_cohorts.map((item) => [item.cohort_type, item])
);
const coverageLock = lockedByType.COVERAGE_COHORT;
const adversarialLock = lockedByType.ADVERSARIAL_COHORT;
invariant(coverageLock?.lifecycle === "LOCKED", "Coverage cohort is not LOCKED");
invariant(adversarialLock?.lifecycle === "LOCKED", "Adversarial cohort is not LOCKED");
invariant(p4Manifest.population_prior?.lifecycle === "DEFERRED_NOT_LOCKED", "Population-Prior authority drift");
invariant(p4Manifest.population_prior?.persona_count === 0, "Population-Prior Persona count must remain zero");

const personaById = new Map(sourceSet.personas.map((persona) => [persona.persona_id, persona]));
const coverage = coverageLock.member_ids.map((id) => personaById.get(id));
const adversarial = adversarialLock.member_ids.map((id) => personaById.get(id));
invariant(coverage.every(Boolean) && adversarial.every(Boolean), "LOCKED cohort member missing from immutable P3 source");
invariant(coverage.length === 29, "LOCKED Coverage count mismatch");
invariant(adversarial.length === 8, "LOCKED Adversarial count mismatch");
invariant(p3.semanticHash(coverage) === coverageLock.cohort_hash, "LOCKED Coverage hash mismatch");
invariant(p3.semanticHash(adversarial) === adversarialLock.cohort_hash, "LOCKED Adversarial hash mismatch");
const lockedPersonas = [...coverage, ...adversarial];

const productsFixture = JSON.parse(await readFile(
  path.join(recommendationReferenceRoot, "fixtures/recommendation-metadata/products-v1.json"),
  "utf8"
));
invariant(productsFixture.productCount === 164, "frozen catalog product count mismatch");
invariant(productsFixture.categoryCounts?.sunscreen === 11, "frozen sunscreen count mismatch");
const orderedProducts = [...productsFixture.products].sort((left, right) =>
  String(left.category).localeCompare(String(right.category), "en") ||
  String(left.brand).localeCompare(String(right.brand), "en") ||
  String(left.name).localeCompare(String(right.name), "en") ||
  String(left.id).localeCompare(String(right.id), "en")
);
const recommendationProducts = orderedProducts.map(buildRecommendationProductFromSource);
const sunscreenProducts = recommendationProducts.filter(
  (product) => getProductCategorySlot(product) === "sunscreen"
);
invariant(recommendationProducts.length === 164, "converted catalog count mismatch");
invariant(sunscreenProducts.length === 11, "converted sunscreen count mismatch");

function surveyForDomain(domain, source) {
  return buildSurveyInputContract(p3.toRecommendationAnswers(domain), {
    source,
    generatedAt: fixedGeneratedAt
  });
}

function buildPair(persona, relationId) {
  const source = persona.domain;
  const before = deepClone(source);
  const after = deepClone(source);
  let applicable = true;
  let reason = null;

  if (relationId === "MR-GENDER-001") {
    setPath(before, "profile.genderPreference", "unspecified");
    setPath(after, "profile.genderPreference", "female");
  } else if (relationId === "MR-SUN-EYE-001") {
    if (source.sunscreen.preferenceState !== "answered") {
      applicable = false;
      reason = "SUNSCREEN_PREFERENCE_NOT_ANSWERED";
    } else {
      setPath(before, "sunscreen.eyeSensitive", false);
      setPath(after, "sunscreen.eyeSensitive", true);
    }
  } else if (relationId === "MR-SUN-WHITECAST-001") {
    if (source.sunscreen.preferenceState !== "answered") {
      applicable = false;
      reason = "SUNSCREEN_PREFERENCE_NOT_ANSWERED";
    } else if (source.sunscreen.toneUpWanted !== false) {
      applicable = false;
      reason = "TONE_UP_PRECONDITION_NOT_MET";
    } else {
      setPath(before, "sunscreen.whiteCastHate", false);
      setPath(after, "sunscreen.whiteCastHate", true);
    }
  } else if (relationId === "MR-SUN-MAKEUP-001") {
    if (source.sunscreen.preferenceState !== "answered") {
      applicable = false;
      reason = "SUNSCREEN_PREFERENCE_NOT_ANSWERED";
    } else {
      setPath(before, "sunscreen.makeupUse", false);
      setPath(after, "sunscreen.makeupUse", true);
    }
  } else if (relationId === "MR-SUN-SENSITIVITY-001") {
    if (!["low", "medium"].includes(source.sensitivity)) {
      applicable = false;
      reason = "SOURCE_SENSITIVITY_NOT_LOW_OR_MEDIUM";
    } else if (["redness", "barrier"].includes(source.primaryConcern)) {
      applicable = false;
      reason = "PRIMARY_CONCERN_PRECONDITION_NOT_MET";
    } else if (source.routeExtensions.verySensitivePeriod !== false) {
      applicable = false;
      reason = "VERY_SENSITIVE_PERIOD_PRECONDITION_NOT_MET";
    } else {
      setPath(after, "sensitivity", "high");
    }
  } else if (relationId === "MR-DERIVED-DRYNESS-001") {
    if (source.afternoonSkinChange === "more_dry") {
      applicable = false;
      reason = "AFTERNOON_MORE_DRY_MASKS_CONTROLLED_CHANGE";
    } else {
      setPath(before, "postWashFeeling", "comfortable");
      setPath(after, "postWashFeeling", "tight");
    }
  } else if (relationId === "MR-DERIVED-REDNESS-001") {
    setPath(before, "afternoonSkinChange", "mostly_same");
    setPath(after, "afternoonSkinChange", "red_or_irritated");
    const beforeSurvey = surveyForDomain(before, "eval_p5_redness_precondition");
    if (beforeSurvey.safety.rednessRisk === "high") {
      applicable = false;
      reason = "REDNESS_ALREADY_HIGH_FROM_OTHER_SIGNAL";
    }
  } else {
    throw new Error(`UNKNOWN_RELATION:${relationId}`);
  }

  if (!applicable) {
    return {
      source_persona_id: persona.persona_id,
      cohort_type: persona.cohort_type,
      applicable: false,
      reason
    };
  }

  const relation = contract.relations.find((item) => item.relation_id === relationId);
  const changedPaths = diffPaths(before, after);
  invariant(
    changedPaths.length === 1 && changedPaths[0] === relation.controlled_path,
    "paired scenario must change exactly the frozen controlled raw-input path",
    { relationId, persona_id: persona.persona_id, changedPaths, expected: relation.controlled_path }
  );

  return {
    scenario_id: `${relationId}::${persona.persona_id}`,
    relation_id: relationId,
    source_persona_id: persona.persona_id,
    cohort_type: persona.cohort_type,
    applicable: true,
    controlled_path: relation.controlled_path,
    before,
    after,
    before_domain_hash: p3.semanticHash(before),
    after_domain_hash: p3.semanticHash(after),
    changed_paths: changedPaths
  };
}

function makeSunscreenProbe(relationId) {
  const base = {
    id: `eval-p5-probe-${relationId.toLowerCase()}`,
    name: `EVAL P5 ${relationId} Rule Probe`,
    brand: "EVAL_ONLY",
    category: "sunscreen",
    is_mens: false,
    skin_types: ["oily", "dry", "combination", "sensitive"],
    concerns: ["uv", "redness", "barrier", "dehydration", "oiliness", "acne", "pores", "uneven_tone"],
    texture: "lotion",
    finish: "natural",
    irritation_risk: "low",
    sensitivity_safe: true,
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "none",
    eye_sting: "low",
    pilling_risk: "low",
    recommendation_tier: "Tier1"
  };
  if (relationId === "MR-SUN-EYE-001") return { ...base, eye_sting: "high" };
  if (relationId === "MR-SUN-WHITECAST-001") return { ...base, white_cast: "high" };
  if (relationId === "MR-SUN-MAKEUP-001") return { ...base, pilling_risk: "high" };
  if (relationId === "MR-SUN-SENSITIVITY-001") return { ...base, irritation_risk: "high" };
  throw new Error(`NO_SUNSCREEN_PROBE_FOR:${relationId}`);
}

function catalogTargetsForRelation(relationId) {
  if (relationId === "MR-GENDER-001") {
    return recommendationProducts.filter((product) => product.is_mens === true);
  }
  if (relationId === "MR-SUN-EYE-001") {
    return sunscreenProducts.filter((product) => product.eye_sting === "high");
  }
  if (relationId === "MR-SUN-WHITECAST-001") {
    return sunscreenProducts.filter((product) => product.white_cast === "high");
  }
  if (relationId === "MR-SUN-MAKEUP-001") {
    return sunscreenProducts.filter((product) => product.pilling_risk === "high");
  }
  if (relationId === "MR-SUN-SENSITIVITY-001") {
    return sunscreenProducts.filter((product) => product.irritation_risk === "high");
  }
  return [];
}

function evaluateProductComparison(relationId, product, beforeDomain, afterDomain) {
  const beforeAnswers = p3.toRecommendationAnswers(beforeDomain);
  const afterAnswers = p3.toRecommendationAnswers(afterDomain);
  const id = String(product.id);

  if (relationId === "MR-GENDER-001") {
    const beforeEligible = isProductEligibleForGenderPreference(
      product,
      normalizeRecommendationAnswers(beforeAnswers)
    );
    const afterEligible = isProductEligibleForGenderPreference(
      product,
      normalizeRecommendationAnswers(afterAnswers)
    );
    return {
      product_id: id,
      classification: beforeEligible
        ? (afterEligible ? "METAMORPHIC_VIOLATION" : "EVALUABLE_PASS")
        : "MASKED_BY_OTHER_CONSTRAINT",
      before_state: beforeEligible ? "ELIGIBLE" : "INELIGIBLE",
      after_state: afterEligible ? "ELIGIBLE" : "INELIGIBLE"
    };
  }

  const before = filterSunscreenCandidates([product], beforeAnswers);
  const after = filterSunscreenCandidates([product], afterAnswers);

  if (["MR-SUN-EYE-001", "MR-SUN-SENSITIVITY-001"].includes(relationId)) {
    const beforeRejected = containsId(before.rejected, id);
    const afterRejected = containsId(after.rejected, id);
    return {
      product_id: id,
      classification: beforeRejected
        ? "MASKED_BY_OTHER_CONSTRAINT"
        : (afterRejected ? "EVALUABLE_PASS" : "METAMORPHIC_VIOLATION"),
      before_state: beforeRejected ? "HARD_REJECTED" : "NOT_HARD_REJECTED",
      after_state: afterRejected ? "HARD_REJECTED" : "NOT_HARD_REJECTED"
    };
  }

  if (["MR-SUN-WHITECAST-001", "MR-SUN-MAKEUP-001"].includes(relationId)) {
    const beforeStrict = containsId(before.strictCandidates, id);
    const afterStrict = containsId(after.strictCandidates, id);
    return {
      product_id: id,
      classification: beforeStrict
        ? (afterStrict ? "METAMORPHIC_VIOLATION" : "EVALUABLE_PASS")
        : "MASKED_BY_OTHER_CONSTRAINT",
      before_state: beforeStrict ? "STRICT_CANDIDATE" : "NOT_STRICT_CANDIDATE",
      after_state: afterStrict ? "STRICT_CANDIDATE" : "NOT_STRICT_CANDIDATE",
      after_penalty_only: containsId(after.penaltyOnlyCandidates, id)
    };
  }

  throw new Error(`NO_PRODUCT_EVALUATOR_FOR:${relationId}`);
}

function probeForRelation(relationId) {
  if (relationId === "MR-GENDER-001") {
    return {
      id: "eval-p5-probe-mr-gender-001",
      name: "EVAL P5 MR-GENDER-001 Rule Probe",
      brand: "EVAL_ONLY",
      category: "cleanser",
      is_mens: true
    };
  }
  return makeSunscreenProbe(relationId);
}

async function engineObservation(domain) {
  const answers = p3.toRecommendationAnswers(domain);
  const normalizedDirect = normalizeRecommendationAnswers(answers);
  const routePayload = p3.buildRouteLikePayload(domain, { explicitOutdoorExposure: false });
  const routeInput = p3.materializeRouteRecommendationInput(routePayload);
  const normalizedRoute = normalizeRecommendationAnswers(routeInput);
  const directHash = p3.semanticHash(normalizedDirect);
  const routeHash = p3.semanticHash(normalizedRoute);
  invariant(
    directHash === routeHash,
    "P5 pair route normalization divergence",
    { directHash, routeHash }
  );

  const bundle = await buildSkinMatchDecisionBundle(answers, {
    products: recommendationProducts,
    photoAnalysis: buildFallbackPhotoAnalysis("ko"),
    currentProducts: [],
    currentProductSnapshots: [],
    locale: "ko"
  });
  return {
    normalized_answers_hash: directHash,
    route_normalization_equivalent: true,
    recommendation: projectBundle(bundle)
  };
}

async function evaluatePair(pair) {
  const relationId = pair.relation_id;
  const beforeObservation = await engineObservation(pair.before);
  const afterObservation = await engineObservation(pair.after);
  const base = {
    scenario_id: pair.scenario_id,
    relation_id: relationId,
    source_persona_id: pair.source_persona_id,
    cohort_type: pair.cohort_type,
    controlled_path: pair.controlled_path,
    before_domain_hash: pair.before_domain_hash,
    after_domain_hash: pair.after_domain_hash,
    changed_paths: pair.changed_paths,
    route_normalization_equivalent:
      beforeObservation.route_normalization_equivalent &&
      afterObservation.route_normalization_equivalent,
    full_recommendation_delta: {
      authority: "DIAGNOSTIC_ONLY",
      rank_direction_asserted: false,
      top_pick_changed:
        beforeObservation.recommendation.topPickId !== afterObservation.recommendation.topPickId,
      before: beforeObservation.recommendation,
      after: afterObservation.recommendation
    }
  };

  if (relationId === "MR-DERIVED-DRYNESS-001") {
    const beforeSurvey = surveyForDomain(pair.before, `${pair.scenario_id}:before`);
    const afterSurvey = surveyForDomain(pair.after, `${pair.scenario_id}:after`);
    const passed =
      beforeSurvey.safety.drynessRisk !== "high" &&
      afterSurvey.safety.drynessRisk === "high";
    return {
      ...base,
      hard_evaluation: {
        type: "SURVEY_DERIVED_STATE",
        before_state: beforeSurvey.safety.drynessRisk,
        after_state: afterSurvey.safety.drynessRisk,
        classification: passed ? "EVALUABLE_PASS" : "DERIVED_STATE_VIOLATION"
      }
    };
  }

  if (relationId === "MR-DERIVED-REDNESS-001") {
    const beforeSurvey = surveyForDomain(pair.before, `${pair.scenario_id}:before`);
    const afterSurvey = surveyForDomain(pair.after, `${pair.scenario_id}:after`);
    const passed =
      beforeSurvey.safety.rednessRisk !== "high" &&
      afterSurvey.safety.rednessRisk === "high";
    return {
      ...base,
      hard_evaluation: {
        type: "SURVEY_DERIVED_STATE",
        before_state: beforeSurvey.safety.rednessRisk,
        after_state: afterSurvey.safety.rednessRisk,
        classification: passed ? "EVALUABLE_PASS" : "DERIVED_STATE_VIOLATION"
      }
    };
  }

  const catalogTargets = catalogTargetsForRelation(relationId);
  const catalogComparisons = catalogTargets.map((product) =>
    evaluateProductComparison(relationId, product, pair.before, pair.after)
  );
  const probe = probeForRelation(relationId);
  const probeComparison = evaluateProductComparison(
    relationId,
    probe,
    pair.before,
    pair.after
  );
  invariant(
    probeComparison.classification === "EVALUABLE_PASS",
    "isolated evaluator-rule probe failed or became masked",
    { pair: pair.scenario_id, probeComparison }
  );

  return {
    ...base,
    hard_evaluation: {
      type: contract.relations.find((item) => item.relation_id === relationId).assertion_level,
      catalog_target_count: catalogTargets.length,
      catalog_observation_classification:
        catalogTargets.length > 0 ? "CATALOG_PRODUCT_PREDICATE_OBSERVED" : "CATALOG_PRODUCT_PREDICATE_NOT_OBSERVED",
      catalog_comparisons: catalogComparisons,
      probe_authority: contract.pair_contract.probe_authority,
      probe_comparison: probeComparison
    }
  };
}

function summarizeRelation(relationId, pairResults, notApplicable) {
  const relationPairs = pairResults.filter((item) => item.relation_id === relationId);
  const byCohort = {
    COVERAGE_COHORT: relationPairs.filter((item) => item.cohort_type === "COVERAGE_COHORT").length,
    ADVERSARIAL_COHORT: relationPairs.filter((item) => item.cohort_type === "ADVERSARIAL_COHORT").length
  };
  const topPickChanged = relationPairs.filter(
    (item) => item.full_recommendation_delta.top_pick_changed
  ).length;

  if (["MR-DERIVED-DRYNESS-001", "MR-DERIVED-REDNESS-001"].includes(relationId)) {
    const violations = relationPairs.filter(
      (item) => item.hard_evaluation.classification !== "EVALUABLE_PASS"
    ).length;
    return {
      relation_id: relationId,
      applicable_pair_count: relationPairs.length,
      not_applicable_count: notApplicable.length,
      applicable_pairs_by_cohort: byCohort,
      hard_assertion: "SURVEY_DERIVED_STATE",
      derived_state_violation_count: violations,
      full_recommendation_top_pick_change_count: topPickChanged,
      full_recommendation_delta_authority: "DIAGNOSTIC_ONLY",
      status: violations === 0 && relationPairs.length > 0 ? "PASS" : "FAIL"
    };
  }

  const comparisons = relationPairs.flatMap(
    (item) => item.hard_evaluation.catalog_comparisons
  );
  const probeComparisons = relationPairs.map(
    (item) => item.hard_evaluation.probe_comparison
  );
  const catalogViolations = comparisons.filter(
    (item) => item.classification === "METAMORPHIC_VIOLATION"
  ).length;
  const catalogPasses = comparisons.filter(
    (item) => item.classification === "EVALUABLE_PASS"
  ).length;
  const masked = comparisons.filter(
    (item) => item.classification === "MASKED_BY_OTHER_CONSTRAINT"
  ).length;
  const probeViolations = probeComparisons.filter(
    (item) => item.classification !== "EVALUABLE_PASS"
  ).length;
  const targetCounts = [...new Set(
    relationPairs.map((item) => item.hard_evaluation.catalog_target_count)
  )];

  return {
    relation_id: relationId,
    applicable_pair_count: relationPairs.length,
    not_applicable_count: notApplicable.length,
    applicable_pairs_by_cohort: byCohort,
    catalog_target_count: targetCounts.length === 1 ? targetCounts[0] : null,
    catalog_product_comparison_count: comparisons.length,
    catalog_evaluable_pass_count: catalogPasses,
    catalog_masked_by_other_constraint_count: masked,
    catalog_metamorphic_violation_count: catalogViolations,
    isolated_probe_comparison_count: probeComparisons.length,
    isolated_probe_violation_count: probeViolations,
    full_recommendation_top_pick_change_count: topPickChanged,
    full_recommendation_delta_authority: "DIAGNOSTIC_ONLY",
    status:
      relationPairs.length > 0 &&
      probeViolations === 0 &&
      catalogViolations === 0
        ? "PASS"
        : "FAIL"
  };
}

async function executeEvaluation() {
  const pairResults = [];
  const notApplicable = [];
  for (const relation of contract.relations) {
    for (const persona of lockedPersonas) {
      const pair = buildPair(persona, relation.relation_id);
      if (!pair.applicable) {
        notApplicable.push({
          relation_id: relation.relation_id,
          source_persona_id: pair.source_persona_id,
          cohort_type: pair.cohort_type,
          classification: "PAIR_PRECONDITION_NOT_MET",
          reason: pair.reason
        });
        continue;
      }
      pairResults.push(await evaluatePair(pair));
    }
  }

  const relationResults = contract.relations.map((relation) =>
    summarizeRelation(
      relation.relation_id,
      pairResults,
      notApplicable.filter((item) => item.relation_id === relation.relation_id)
    )
  );
  return {
    pair_results: pairResults,
    not_applicable: notApplicable,
    relation_results: relationResults
  };
}

const firstPass = await executeEvaluation();
const secondPass = await executeEvaluation();

const firstSemanticHash = p3.semanticHash(firstPass);
const secondSemanticHash = p3.semanticHash(secondPass);
invariant(
  firstSemanticHash === secondSemanticHash,
  "P5 deterministic semantic replay mismatch",
  { firstSemanticHash, secondSemanticHash }
);
invariant(
  firstPass.relation_results.every((item) => item.status === "PASS"),
  "one or more frozen metamorphic relations failed",
  firstPass.relation_results
);
invariant(
  firstPass.pair_results.every((item) => item.changed_paths.length === 1),
  "a paired scenario changed more than one raw input path"
);
invariant(
  firstPass.pair_results.every((item) => item.route_normalization_equivalent),
  "route normalization equivalence failed for a P5 pair"
);
invariant(
  contract.authority_ceiling.evidence_class === "SYNTHETIC_SIMULATION_EVIDENCE",
  "synthetic evidence namespace drift"
);
for (const key of [
  "organic_production_evidence",
  "controlled_production_evidence",
  "real_user_truth",
  "market_prevalence",
  "satisfaction_or_conversion_truth",
  "product_fact_authority",
  "enforce_authority"
]) {
  invariant(contract.authority_ceiling[key] === false, `authority escalation detected: ${key}`);
}
invariant(contract.authority_ceiling.llm_judge_calls === 0, "P5 must not call LLM Judge");

const catalogComparisons = firstPass.pair_results.flatMap(
  (item) => item.hard_evaluation.catalog_comparisons || []
);
const hardViolations =
  firstPass.relation_results.reduce(
    (sum, item) =>
      sum +
      (item.catalog_metamorphic_violation_count || 0) +
      (item.derived_state_violation_count || 0) +
      (item.isolated_probe_violation_count || 0),
    0
  );

const summary = {
  schema_version: "eval-p5-counterfactual-metamorphic-summary-v1",
  stage: "EVAL-P5",
  terminal_outcome: "SUCCESS",
  evidence_class: "SYNTHETIC_SIMULATION_EVIDENCE",
  authority: {
    ...contract.authority,
    evaluation_implementation_sha: implementationSha,
    catalog_declared_sha256: productsFixture.canonicalFixtureSha256
  },
  locked_cohort_input: {
    coverage_personas: coverage.length,
    adversarial_personas: adversarial.length,
    total_locked_personas: lockedPersonas.length,
    population_prior_personas: 0,
    coverage_hash: p3.semanticHash(coverage),
    adversarial_hash: p3.semanticHash(adversarial)
  },
  counts: {
    relations: contract.relations.length,
    applicable_pairs: firstPass.pair_results.length,
    not_applicable_source_relation_combinations: firstPass.not_applicable.length,
    catalog_product_comparisons: catalogComparisons.length,
    catalog_evaluable_passes: catalogComparisons.filter((item) => item.classification === "EVALUABLE_PASS").length,
    catalog_masked_by_other_constraints: catalogComparisons.filter((item) => item.classification === "MASKED_BY_OTHER_CONSTRAINT").length,
    hard_violations: hardViolations,
    full_recommendation_top_pick_changes: firstPass.pair_results.filter(
      (item) => item.full_recommendation_delta.top_pick_changed
    ).length,
    llm_judge_calls: 0
  },
  pair_precondition_exclusions: countBy(firstPass.not_applicable.map((item) => item.reason)),
  relation_results: firstPass.relation_results,
  acceptance: {
    deterministic_semantic_hash_replay: firstSemanticHash === secondSemanticHash,
    seven_frozen_relations_executed: firstPass.relation_results.length === 7,
    all_relations_passed: firstPass.relation_results.every((item) => item.status === "PASS"),
    one_raw_input_path_changed_per_pair: firstPass.pair_results.every((item) => item.changed_paths.length === 1),
    route_normalization_equivalent_for_all_pairs: firstPass.pair_results.every((item) => item.route_normalization_equivalent),
    rank_monotonicity_not_used_as_hard_assertion: true,
    full_recommendation_deltas_diagnostic_only: true,
    masked_constraints_not_counted_as_failures: true,
    evaluator_probes_not_catalog_truth: true,
    synthetic_evidence_evaluation_only: true
  },
  hashes: {
    evaluation_semantic_hash: firstSemanticHash,
    replay_semantic_hash: secondSemanticHash,
    contract_semantic_hash: p3.semanticHash(contract),
    p4_manifest_semantic_hash: p3.semanticHash(p4Manifest)
  },
  production_boundary: {
    production_network_calls: 0,
    hosted_writes: 0,
    product_fact_writes: 0,
    organic_evidence_writes: 0,
    controlled_production_probe: 0,
    shadow_mode_changed: false,
    enforce_authorized_by_persona: false,
    enforce_activated_by_persona: false,
    production_config_change: 0
  }
};

await mkdir(artifactRoot, { recursive: true });
await Promise.all([
  writeFile(
    path.join(artifactRoot, "counterfactual-metamorphic-summary-v1.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8"
  ),
  writeFile(
    path.join(artifactRoot, "counterfactual-pair-results-v1.json"),
    `${JSON.stringify({
      schema_version: "eval-p5-counterfactual-pair-results-v1",
      pair_results: firstPass.pair_results,
      not_applicable: firstPass.not_applicable
    }, null, 2)}\n`,
    "utf8"
  ),
  writeFile(
    path.join(artifactRoot, "metamorphic-relation-results-v1.json"),
    `${JSON.stringify({
      schema_version: "eval-p5-metamorphic-relation-results-v1",
      relation_results: firstPass.relation_results,
      evaluation_semantic_hash: firstSemanticHash
    }, null, 2)}\n`,
    "utf8"
  )
]);

console.log("EVAL-P5 counterfactual/metamorphic evaluator: PASS");
console.log(`locked_personas=${lockedPersonas.length}`);
console.log(`applicable_pairs=${firstPass.pair_results.length}`);
console.log(`not_applicable=${firstPass.not_applicable.length}`);
console.log(`hard_violations=${hardViolations}`);
console.log(`evaluation_semantic_hash=${firstSemanticHash}`);
