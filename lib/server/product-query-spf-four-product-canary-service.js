import "server-only";

import "@/lib/server/recommendation-candidate-admission-runtime";
import { getRecommendationProducts } from "@/lib/product-source";
import {
  rankStructuredProductQueryFromProducts,
} from "@/lib/product-query-recommendation";
import {
  PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
} from "@/lib/product-query-intent-contract.mjs";
import {
  D5C_SUNSCREEN_CANARY_PRODUCT_IDS,
  D5C_SUNSCREEN_CANARY_AUTHORITY_STATUS,
  buildD5cInitialAdmissionInput,
} from "@/lib/sunscreen-d5c-canary-authority-contract.mjs";
import {
  readD5cSunscreenCanaryAuthorities,
} from "@/lib/server/sunscreen-d5c-canary-authority-reader";
import {
  D5E_E_COSRX_CANARY_PRODUCT_ID,
} from "@/lib/sunscreen-d5e-e-cosrx-canary-authority-contract.mjs";
import {
  readD5eECosrxCanaryAuthority,
} from "@/lib/server/sunscreen-d5e-e-cosrx-canary-authority-reader";
import {
  evaluateSunscreenInitialAdmissionGrant,
} from "@/lib/sunscreen-initial-admission-grant-policy.mjs";
import {
  projectEstablishedSunscreenSemantics,
} from "@/lib/sunscreen-recommendation-semantic-projection.mjs";
import {
  readRecommendationSunscreenProtectionAuthoritiesWithBoundedRetry,
} from "@/lib/server/recommendation-sunscreen-protection-bounded-reader";
import {
  projectSunscreenProtectionAuthority,
  projectSunscreenSpfFact,
} from "@/lib/sunscreen-protection-projection.mjs";

export const PRODUCT_QUERY_SPF_FOUR_PRODUCT_CANARY_CONTRACT_VERSION =
  "data-ai29c-d5e-e-four-product-internal-canary-v1";

const EXPECTED_LEGACY_SUNSCREEN_COUNT = 11;
const REQUIRED_CANARY_COMPARABILITY_FIELDS = Object.freeze([
  "category_slot",
  "uv_filter_type",
  "finish",
  "tone_up",
]);

const D5E_E_FOUR_PRODUCT_CANARY_IDS = Object.freeze([
  ...D5C_SUNSCREEN_CANARY_PRODUCT_IDS,
  D5E_E_COSRX_CANARY_PRODUCT_ID,
]);

function fixedIntent(overrides = {}) {
  return Object.freeze({
    schema_version: PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
    category: "sunscreen",
    skin_type: null,
    concerns: [],
    sensitivity: null,
    texture: null,
    disliked_feel: null,
    preferred_finish: null,
    post_wash_feeling: null,
    afternoon_skin_change: null,
    very_sensitive_period: null,
    sunscreen_intent: true,
    white_cast_hate: null,
    tone_up_wanted: null,
    eye_sensitive: null,
    makeup_use: null,
    outdoor_exposure: null,
    unresolved_terms: [],
    confidence: "high",
    ...overrides,
  });
}

export const PRODUCT_QUERY_SPF_FOUR_PRODUCT_CANARY_CASES = Object.freeze([
  Object.freeze({
    id: "outdoor_spf_on",
    intent: fixedIntent({ outdoor_exposure: true }),
    spfEnabled: true,
    expectedStatus: "ranked",
    expectedSpfApplied: true,
  }),
  Object.freeze({
    id: "rollback_off",
    intent: fixedIntent({ outdoor_exposure: true }),
    spfEnabled: false,
    expectedStatus: "insufficient_supported_intent",
    expectedSpfApplied: false,
  }),
  Object.freeze({
    id: "non_outdoor_control",
    intent: fixedIntent({
      skin_type: "oily",
      outdoor_exposure: false,
    }),
    spfEnabled: true,
    expectedStatus: "ranked",
    expectedSpfApplied: false,
  }),
]);

function canaryCase(caseId) {
  return PRODUCT_QUERY_SPF_FOUR_PRODUCT_CANARY_CASES.find(
    (candidate) => candidate.id === caseId,
  );
}

function established(bundle, fieldName) {
  const field = bundle?.fields?.[fieldName];
  return field?.state === "established" && field?.value !== null;
}

function buildCanaryRecommendationProduct(resolved) {
  const authority = resolved.authority;
  const projection = projectEstablishedSunscreenSemantics(
    authority.semanticBundle,
  );

  if (!projection.envelope.envelopeReady || !projection.projected) {
    return Object.freeze({
      ok: false,
      reason: "SEMANTIC_ENVELOPE_NOT_READY",
      product: null,
    });
  }

  const missingComparable = REQUIRED_CANARY_COMPARABILITY_FIELDS.filter(
    (fieldName) => !established(authority.semanticBundle, fieldName),
  );
  if (missingComparable.length > 0) {
    return Object.freeze({
      ok: false,
      reason:
        "CANARY_COMPARABILITY_AUTHORITY_MISSING:" +
        missingComparable.join(","),
      product: null,
    });
  }

  const semantic = projection.projected;
  return Object.freeze({
    ok: true,
    reason: null,
    product: Object.freeze({
      id: authority.product.id,
      brand: authority.product.brand,
      name: authority.product.name,
      category: "sunscreen",
      skin_types: Array.isArray(semantic.skin_types)
        ? [...semantic.skin_types]
        : [],
      concerns: Array.isArray(semantic.concerns)
        ? [...semantic.concerns]
        : [],
      texture: semantic.texture ?? null,
      finish: semantic.finish ?? null,
      uv_filter_type: semantic.uv_filter_type ?? null,
      sensitivity_safe: semantic.sensitivity_safe ?? null,
      irritation_risk: semantic.irritation_risk ?? null,
      tone_up: semantic.tone_up ?? null,
      white_cast: semantic.white_cast ?? null,
      eye_sting: semantic.eye_sting ?? null,
      pilling_risk: semantic.pilling_risk ?? null,
      review_signals: null,
      market_signals: null,
      ingredient_signals: null,
      is_kbeauty: true,
    }),
  });
}

function buildCanaryProtectionProjection(resolved) {
  const spfFact = resolved.authority.currentFacts.find(
    (fact) => fact.fact_key === "spf_value",
  );
  const spf = projectSunscreenSpfFact(spfFact || null);

  return Object.freeze({
    version: "data-ai29c-d5c-canary-protection-projection-v1",
    productId: resolved.authority.product.id,
    authorityResolved: true,
    spf,
    // D5E-E remains SPF-only; UVA and water are deliberately ineligible.
    uva: Object.freeze({
      eligible: false,
      label: null,
      bucket: null,
    }),
    waterResistance: Object.freeze({
      eligible: false,
      minutes: null,
      bucket: null,
    }),
  });
}

function summarizeGate(execution) {
  const gate = execution?.runtimeGateEvidence?.spf || null;
  return Object.freeze({
    present: Boolean(gate),
    flagEnabled: gate?.flagEnabled === true,
    requestEligible: gate?.requestEligible === true,
    authorityComplete: gate?.authorityComplete === true,
    axisApplied: gate?.axisApplied === true,
    reason: gate?.reason || null,
    missingProductIds: Object.freeze([
      ...(gate?.missingProductIds || []),
    ]),
    adjustments: Object.freeze(
      (gate?.adjustments || []).map((row) =>
        Object.freeze({
          productId: row.productId,
          spfBucket: row.spfBucket,
          spfDelta: row.spfDelta,
          baselineScore: row.baselineScore,
          finalScore: row.finalScore,
        }),
      ),
    ),
  });
}

function safeExecution(execution) {
  return Object.freeze({
    status: execution?.status || null,
    effectiveCategory: execution?.effectiveCategory || null,
    candidateCount: Number(execution?.candidateCount || 0),
    resultCount: Array.isArray(execution?.results)
      ? execution.results.length
      : 0,
    resultIds: Object.freeze(
      (execution?.results || []).map((product) => product.id),
    ),
    rankableSignals: Object.freeze([
      ...(execution?.rankableSignals || []),
    ]),
    constraintStatus: execution?.constraintStatus || null,
    unresolvedTerms: Object.freeze([
      ...(execution?.unresolvedTerms || []),
    ]),
    gate: summarizeGate(execution),
  });
}

function validateAdmission(resolved) {
  if (
    resolved.status !== D5C_SUNSCREEN_CANARY_AUTHORITY_STATUS.RESOLVED ||
    !resolved.authority
  ) {
    return Object.freeze({
      productId: resolved?.authority?.product?.id || null,
      authorityResolved: false,
      grant: false,
      decision: "NO_GRANT",
      reasons: Object.freeze([
        resolved.reason || "D5C_CANARY_AUTHORITY_UNAVAILABLE",
      ]),
      product: null,
      protection: null,
    });
  }

  const input = buildD5cInitialAdmissionInput(resolved);
  const decision = evaluateSunscreenInitialAdmissionGrant(input);
  if (!decision.grant) {
    return Object.freeze({
      productId: resolved.authority.product.id,
      authorityResolved: true,
      grant: false,
      decision: decision.decision,
      reasons: decision.reasons,
      product: null,
      protection: null,
    });
  }

  const projection = buildCanaryRecommendationProduct(resolved);
  if (!projection.ok) {
    return Object.freeze({
      productId: resolved.authority.product.id,
      authorityResolved: true,
      grant: false,
      decision: "NO_GRANT",
      reasons: Object.freeze([projection.reason]),
      product: null,
      protection: null,
    });
  }

  const protection = buildCanaryProtectionProjection(resolved);
  if (!protection.spf.eligible) {
    return Object.freeze({
      productId: resolved.authority.product.id,
      authorityResolved: true,
      grant: false,
      decision: "NO_GRANT",
      reasons: Object.freeze(["SPF_AUTHORITY_NOT_ELIGIBLE"]),
      product: null,
      protection: null,
    });
  }

  return Object.freeze({
    productId: resolved.authority.product.id,
    authorityResolved: true,
    grant: true,
    decision: decision.decision,
    reasons: decision.reasons,
    product: projection.product,
    protection,
  });
}

export function getProductQuerySpfFourProductCanaryCaseIds() {
  return PRODUCT_QUERY_SPF_FOUR_PRODUCT_CANARY_CASES.map((testCase) => testCase.id);
}

export async function runProductQuerySpfFourProductCanaryCase(caseId) {
  const testCase = canaryCase(caseId);
  if (!testCase) {
    const error = new Error("DATA_AI29C_D5E_E_CASE_INVALID");
    error.code = "DATA_AI29C_D5E_E_CASE_INVALID";
    throw error;
  }

  const productionProducts = await getRecommendationProducts();
  const productionSunscreens = productionProducts.filter(
    (product) => product?.category === "sunscreen",
  );
  const productionIds = new Set(
    productionProducts.map((product) => product.id),
  );

  const corpusGuardFailures = [];
  if (
    productionSunscreens.length !== EXPECTED_LEGACY_SUNSCREEN_COUNT
  ) {
    corpusGuardFailures.push(
      "PRODUCTION_SUNSCREEN_CORPUS_COUNT_CHANGED",
    );
  }
  for (const productId of D5E_E_FOUR_PRODUCT_CANARY_IDS) {
    if (productionIds.has(productId)) {
      corpusGuardFailures.push(
        "CANARY_TARGET_ALREADY_IN_PRODUCTION:" + productId,
      );
    }
  }

  const d5cAuthorityResults =
    await readD5cSunscreenCanaryAuthorities();
  const cosrxAuthority =
    await readD5eECosrxCanaryAuthority();
  const authorityResults = Object.freeze([
    ...d5cAuthorityResults,
    cosrxAuthority,
  ]);
  const admissions = authorityResults.map(validateAdmission);
  const granted = admissions.filter((row) => row.grant);

  if (granted.length !== D5E_E_FOUR_PRODUCT_CANARY_IDS.length) {
    corpusGuardFailures.push("CANARY_ADMISSION_NOT_COMPLETE");
  }

  const legacyProtectionRead =
    await readRecommendationSunscreenProtectionAuthoritiesWithBoundedRetry(
      productionSunscreens.map((product) => product.id),
      { allowShadowTransportFallback: true },
    );
  const legacyProtectionRecords = legacyProtectionRead.records;
  const legacyProjections = legacyProtectionRecords.map(
    projectSunscreenProtectionAuthority,
  );

  const protectionByProductId = new Map(
    legacyProjections.map((projection) => [
      projection.productId,
      projection,
    ]),
  );
  for (const row of granted) {
    protectionByProductId.set(
      row.productId,
      row.protection,
    );
  }

  const legacySpfEligibleCount = legacyProjections.filter(
    (projection) => projection?.spf?.eligible === true,
  ).length;
  if (
    legacySpfEligibleCount !== productionSunscreens.length
  ) {
    corpusGuardFailures.push(
      "LEGACY_SPF_AUTHORITY_INCOMPLETE",
    );
  }

  const combinedProducts = [
    ...productionProducts,
    ...granted.map((row) => row.product),
  ];

  const execution = rankStructuredProductQueryFromProducts(
    testCase.intent,
    combinedProducts,
    {
      limit: 10,
      spfRuntimeGate: {
        enabled: testCase.spfEnabled,
        protectionByProductId,
      },
      includeRuntimeGateEvidence: true,
    },
  );

  const safe = safeExecution(execution);
  const failures = [...corpusGuardFailures];

  if (safe.status !== testCase.expectedStatus) {
    failures.push("EXECUTION_STATUS_MISMATCH");
  }
  if (safe.candidateCount !== 15) {
    failures.push("CANARY_CANDIDATE_COUNT_MISMATCH");
  }

  const axisApplied = safe.gate.axisApplied;
  if (axisApplied !== testCase.expectedSpfApplied) {
    failures.push("SPF_AXIS_APPLICATION_MISMATCH");
  }

  if (
    testCase.id === "outdoor_spf_on" &&
    !safe.rankableSignals.includes("outdoor_exposure")
  ) {
    failures.push("OUTDOOR_SIGNAL_NOT_PROMOTED");
  }
  if (
    testCase.id !== "outdoor_spf_on" &&
    safe.rankableSignals.includes("outdoor_exposure")
  ) {
    failures.push("OUTDOOR_SIGNAL_LEAKED");
  }

  if (testCase.id === "outdoor_spf_on") {
    if (!safe.gate.authorityComplete) {
      failures.push("SPF_COHORT_AUTHORITY_INCOMPLETE");
    }
    if (safe.gate.adjustments.length !== 15) {
      failures.push("SPF_ADJUSTMENT_COUNT_MISMATCH");
    }

    const adjustmentById = new Map(
      safe.gate.adjustments.map((row) => [
        row.productId,
        row,
      ]),
    );
    const expectedDeltas = new Map([
      ["a6994fcd-302f-4e63-acbe-91a3f17a5a65", 2],
      ["b90bf992-07ae-4f49-a3a4-d90ea6d4a858", 4],
      ["7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17", 4],
      [D5E_E_COSRX_CANARY_PRODUCT_ID, 6],
    ]);
    for (const [productId, expectedDelta] of expectedDeltas) {
      if (
        adjustmentById.get(productId)?.spfDelta !== expectedDelta
      ) {
        failures.push(
          "CANARY_SPF_DELTA_MISMATCH:" + productId,
        );
      }
    }

    const legacyIds = new Set(
      productionSunscreens.map((product) => product.id),
    );
    const legacyDeltas = safe.gate.adjustments
      .filter((row) => legacyIds.has(row.productId))
      .map((row) => row.spfDelta);
    if (
      legacyDeltas.length !== EXPECTED_LEGACY_SUNSCREEN_COUNT ||
      !legacyDeltas.every((delta) => delta === 6)
    ) {
      failures.push("LEGACY_SPF_DELTA_NOT_UNIFORM");
    }
  }

  if (testCase.id === "rollback_off") {
    if (safe.resultCount !== 0) {
      failures.push("ROLLBACK_OFF_RANKED_ANYWAY");
    }
    if (safe.rankableSignals.length !== 0) {
      failures.push("ROLLBACK_OFF_SIGNAL_RETAINED");
    }
  }

  if (testCase.id === "non_outdoor_control") {
    if (safe.gate.present && safe.gate.axisApplied) {
      failures.push("NON_OUTDOOR_SPF_APPLIED");
    }
  }

  return Object.freeze({
    contractVersion: PRODUCT_QUERY_SPF_FOUR_PRODUCT_CANARY_CONTRACT_VERSION,
    caseId: testCase.id,
    currentProductionSunscreenCount:
      productionSunscreens.length,
    canaryTargetCount: D5E_E_FOUR_PRODUCT_CANARY_IDS.length,
    canaryGrantedCount: granted.length,
    combinedSunscreenCount:
      productionSunscreens.length + granted.length,
    legacySpfEligibleCount,
    legacyProtectionReadAttempts: legacyProtectionRead.attempts,
    legacyProtectionRetried: legacyProtectionRead.retried,
    canaryAdmission: Object.freeze(
      admissions.map((row) =>
        Object.freeze({
          productId: row.productId,
          authorityResolved: row.authorityResolved,
          grant: row.grant,
          decision: row.decision,
          reasons: row.reasons,
        }),
      ),
    ),
    execution: safe,
    rollbackReady:
      caseId === "rollback_off"
        ? failures.length === 0
        : true,
    persisted: false,
    pass: failures.length === 0,
    failures: Object.freeze(failures),
    limits: Object.freeze({
      internalOidcOnly: true,
      fixedCasesOnly: true,
      arbitraryQueryInput: false,
      providerInvoked: false,
      profileRead: false,
      historyRead: false,
      productionWrite: false,
      recommendationLogWrite: false,
      productRowMutation: false,
      permanentCandidateAdmissionMutation: false,
      productionRankingChanged: false,
      productionCutoverAuthorized: false,
      outdoorRankableSignalAuthorized: false,
      publicActivation: false,
      betaAllowlistExpanded: false,
      uvaActivated: false,
      waterResistanceApplied: false,
      persistence: false,
    }),
  });
}
