import "server-only";

import "@/lib/server/recommendation-candidate-admission-runtime";
import { getRecommendationProducts } from "@/lib/product-source";
import {
  rankStructuredProductQueryFromProducts,
} from "@/lib/product-query-recommendation";
import {
  D5C_SUNSCREEN_CANARY_PRODUCT_IDS,
  D5C_SUNSCREEN_CANARY_AUTHORITY_STATUS,
  buildD5cInitialAdmissionInput,
} from "@/lib/sunscreen-d5c-canary-authority-contract.mjs";
import {
  readD5cSunscreenCanaryAuthorities,
} from "@/lib/server/sunscreen-d5c-canary-authority-reader";
import {
  evaluateSunscreenInitialAdmissionGrant,
} from "@/lib/sunscreen-initial-admission-grant-policy.mjs";
import {
  projectEstablishedSunscreenSemantics,
} from "@/lib/sunscreen-recommendation-semantic-projection.mjs";
import {
  getRecommendationProtectionCredentialMode,
} from "@/lib/recommendation-sunscreen-protection-authority-reader";
import {
  readRecommendationSunscreenProtectionAuthoritiesWithBoundedRetry,
} from "@/lib/server/recommendation-sunscreen-protection-bounded-reader";
import {
  projectSunscreenProtectionAuthority,
  projectSunscreenSpfFact,
} from "@/lib/sunscreen-protection-projection.mjs";
import {
  readD5dSpfRuntimeActivation,
} from "@/lib/server/sunscreen-spf-production-activation-reader";
import {
  PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
} from "@/lib/product-query-intent-contract.mjs";

export const D5D_SPF_PRODUCTION_ACTIVATION_VERSION =
  "data-ai29c-d5d-spf-production-activation-v1";

const EXPECTED_LEGACY_SUNSCREEN_COUNT = 11;
const REQUIRED_COMPARABILITY_FIELDS = Object.freeze([
  "category_slot",
  "uv_filter_type",
  "finish",
  "tone_up",
]);

function established(bundle, fieldName) {
  const field = bundle?.fields?.[fieldName];
  return field?.state === "established" && field?.value !== null;
}

function buildRecommendationProduct(resolved) {
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

  const missingComparable = REQUIRED_COMPARABILITY_FIELDS.filter(
    (fieldName) => !established(authority.semanticBundle, fieldName),
  );
  if (missingComparable.length > 0) {
    return Object.freeze({
      ok: false,
      reason:
        "PRODUCTION_COMPARABILITY_AUTHORITY_MISSING:" +
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

function buildProtectionProjection(resolved) {
  const spfFact = resolved.authority.currentFacts.find(
    (fact) => fact.fact_key === "spf_value",
  );
  const spf = projectSunscreenSpfFact(spfFact || null);

  return Object.freeze({
    version: "data-ai29c-d5d-production-protection-projection-v1",
    productId: resolved.authority.product.id,
    authorityResolved: true,
    spf,
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

function validateTargetAdmission(resolved) {
  if (
    resolved.status !== D5C_SUNSCREEN_CANARY_AUTHORITY_STATUS.RESOLVED ||
    !resolved.authority
  ) {
    return Object.freeze({
      productId: resolved?.authority?.product?.id || null,
      grant: false,
      reason:
        resolved.reason || "D5D_TARGET_AUTHORITY_UNAVAILABLE",
      product: null,
      protection: null,
    });
  }

  const input = buildD5cInitialAdmissionInput(resolved);
  const decision = evaluateSunscreenInitialAdmissionGrant(input);
  if (!decision.grant) {
    return Object.freeze({
      productId: resolved.authority.product.id,
      grant: false,
      reason:
        "INITIAL_ADMISSION_NOT_GRANTED:" +
        String(decision.decision || "UNKNOWN"),
      product: null,
      protection: null,
    });
  }

  const projected = buildRecommendationProduct(resolved);
  if (!projected.ok) {
    return Object.freeze({
      productId: resolved.authority.product.id,
      grant: false,
      reason: projected.reason,
      product: null,
      protection: null,
    });
  }

  const protection = buildProtectionProjection(resolved);
  if (!protection.spf.eligible) {
    return Object.freeze({
      productId: resolved.authority.product.id,
      grant: false,
      reason: "SPF_AUTHORITY_NOT_ELIGIBLE",
      product: null,
      protection: null,
    });
  }

  return Object.freeze({
    productId: resolved.authority.product.id,
    grant: true,
    reason: null,
    product: projected.product,
    protection,
  });
}

function baselineExecution(intent, products, limit) {
  return rankStructuredProductQueryFromProducts(intent, products, {
    limit,
  });
}

function attachActivationEvidence(execution, evidence, enabled) {
  if (enabled !== true) return execution;
  return Object.freeze({
    ...execution,
    spfProductionActivation: Object.freeze(evidence),
  });
}

export async function executeD5dSpfProductionQuery(
  intent,
  {
    limit = 5,
    includeActivationEvidence = false,
  } = {},
) {
  const productionProducts = await getRecommendationProducts();

  const activation = await readD5dSpfRuntimeActivation();
  const sunscreenRequest =
    intent?.category === "sunscreen" &&
    intent?.sunscreen_intent === true;

  if (!activation.enabled || !sunscreenRequest) {
    const baseline = baselineExecution(
      intent,
      productionProducts,
      limit,
    );
    return attachActivationEvidence(
      baseline,
      {
        version: D5D_SPF_PRODUCTION_ACTIVATION_VERSION,
        switchEnabled: activation.enabled,
        sunscreenRequest,
        activated: false,
        fallbackReason:
          activation.reason ||
          (!activation.enabled
            ? "D5D_RUNTIME_SWITCH_OFF"
            : "NON_SUNSCREEN_REQUEST"),
        productionSunscreenCount:
          productionProducts.filter(
            (product) => product?.category === "sunscreen",
          ).length,
        targetGrantedCount: 0,
        combinedSunscreenCount: null,
        protectionCredentialMode: null,
        publicSearchCutover: false,
        uvaActivated: false,
        waterResistanceApplied: false,
      },
      includeActivationEvidence,
    );
  }

  const productionSunscreens = productionProducts.filter(
    (product) => product?.category === "sunscreen",
  );
  const productionIds = new Set(
    productionProducts.map((product) => product.id),
  );

  const fallbackReasons = [];
  if (
    productionSunscreens.length !== EXPECTED_LEGACY_SUNSCREEN_COUNT
  ) {
    fallbackReasons.push(
      "PRODUCTION_SUNSCREEN_CORPUS_COUNT_CHANGED",
    );
  }
  for (const productId of D5C_SUNSCREEN_CANARY_PRODUCT_IDS) {
    if (productionIds.has(productId)) {
      fallbackReasons.push(
        "D5D_TARGET_ALREADY_IN_BASE_PRODUCT_SOURCE:" + productId,
      );
    }
  }

  const authorityResults =
    await readD5cSunscreenCanaryAuthorities();
  const targetAdmissions = authorityResults.map(
    validateTargetAdmission,
  );
  const granted = targetAdmissions.filter((row) => row.grant);

  if (granted.length !== D5C_SUNSCREEN_CANARY_PRODUCT_IDS.length) {
    fallbackReasons.push("D5D_TARGET_ADMISSION_INCOMPLETE");
  }

  const protectionCredentialMode =
    getRecommendationProtectionCredentialMode({
      allowShadowTransportFallback: true,
    });
  if (
    protectionCredentialMode !== "dedicated" &&
    protectionCredentialMode !== "admission_shadow_fallback"
  ) {
    fallbackReasons.push(
      "D5D_PROTECTION_CREDENTIAL_UNAVAILABLE",
    );
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
  const legacySpfEligibleCount = legacyProjections.filter(
    (projection) => projection?.spf?.eligible === true,
  ).length;

  if (
    legacySpfEligibleCount !== productionSunscreens.length
  ) {
    fallbackReasons.push("D5D_LEGACY_SPF_AUTHORITY_INCOMPLETE");
  }

  if (fallbackReasons.length > 0) {
    const baseline = baselineExecution(
      intent,
      productionProducts,
      limit,
    );
    return attachActivationEvidence(
      baseline,
      {
        version: D5D_SPF_PRODUCTION_ACTIVATION_VERSION,
        switchEnabled: true,
        sunscreenRequest: true,
        activated: false,
        fallbackReason: fallbackReasons.join("|"),
        productionSunscreenCount: productionSunscreens.length,
        targetGrantedCount: granted.length,
        combinedSunscreenCount: null,
        legacySpfEligibleCount,
        protectionCredentialMode,
        legacyProtectionReadAttempts: legacyProtectionRead.attempts,
        legacyProtectionRetried: legacyProtectionRead.retried,
        publicSearchCutover: false,
        uvaActivated: false,
        waterResistanceApplied: false,
      },
      includeActivationEvidence,
    );
  }

  const protectionByProductId = new Map(
    legacyProjections.map((projection) => [
      projection.productId,
      projection,
    ]),
  );
  for (const row of granted) {
    protectionByProductId.set(row.productId, row.protection);
  }

  const combinedProducts = [
    ...productionProducts,
    ...granted.map((row) => row.product),
  ];

  const execution = rankStructuredProductQueryFromProducts(
    intent,
    combinedProducts,
    {
      limit,
      spfRuntimeGate: {
        enabled: true,
        protectionByProductId,
      },
      includeRuntimeGateEvidence:
        includeActivationEvidence === true,
    },
  );

  const gate = execution?.runtimeGateEvidence?.spf || null;
  const activated =
    combinedProducts.filter(
      (product) => product?.category === "sunscreen",
    ).length === 14 &&
    gate?.axisApplied ===
      (intent?.outdoor_exposure === true);

  return attachActivationEvidence(
    execution,
    {
      version: D5D_SPF_PRODUCTION_ACTIVATION_VERSION,
      switchEnabled: true,
      sunscreenRequest: true,
      activated,
      fallbackReason: null,
      productionSunscreenCount: productionSunscreens.length,
      targetGrantedCount: granted.length,
      combinedSunscreenCount: 14,
      legacySpfEligibleCount,
      protectionCredentialMode,
      legacyProtectionReadAttempts: legacyProtectionRead.attempts,
      legacyProtectionRetried: legacyProtectionRead.retried,
      publicSearchCutover: false,
      uvaActivated: false,
      waterResistanceApplied: false,
    },
    includeActivationEvidence,
  );
}


function d5dProbeIntent(overrides = {}) {
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

export const D5D_SPF_PRODUCTION_PROBE_CASES = Object.freeze([
  Object.freeze({
    id: "outdoor_live",
    intent: d5dProbeIntent({ outdoor_exposure: true }),
    expectedSpfApplied: true,
  }),
  Object.freeze({
    id: "non_outdoor_live",
    intent: d5dProbeIntent({
      skin_type: "oily",
      outdoor_exposure: false,
    }),
    expectedSpfApplied: false,
  }),
]);

export function getD5dSpfProductionProbeCaseIds() {
  return D5D_SPF_PRODUCTION_PROBE_CASES.map(
    (testCase) => testCase.id,
  );
}

export async function runD5dSpfProductionProbeCase(caseId) {
  const testCase = D5D_SPF_PRODUCTION_PROBE_CASES.find(
    (candidate) => candidate.id === caseId,
  );
  if (!testCase) {
    const error = new Error("DATA_AI29C_D5D_CASE_INVALID");
    error.code = "DATA_AI29C_D5D_CASE_INVALID";
    throw error;
  }

  const execution = await executeD5dSpfProductionQuery(
    testCase.intent,
    {
      limit: 10,
      includeActivationEvidence: true,
    },
  );
  const activation = execution?.spfProductionActivation || null;
  const gate = execution?.runtimeGateEvidence?.spf || null;
  const failures = [];

  if (!activation || activation.switchEnabled !== true) {
    failures.push("D5D_RUNTIME_SWITCH_NOT_ENABLED");
  }
  if (activation?.activated !== true) {
    failures.push("D5D_PRODUCTION_ACTIVATION_NOT_ACTIVE");
  }
  if (activation?.productionSunscreenCount !== 11) {
    failures.push("D5D_PRODUCTION_SUNSCREEN_COUNT_MISMATCH");
  }
  if (activation?.targetGrantedCount !== 3) {
    failures.push("D5D_TARGET_GRANT_COUNT_MISMATCH");
  }
  if (activation?.combinedSunscreenCount !== 14) {
    failures.push("D5D_COMBINED_SUNSCREEN_COUNT_MISMATCH");
  }
  if (activation?.legacySpfEligibleCount !== 11) {
    failures.push("D5D_LEGACY_SPF_AUTHORITY_MISMATCH");
  }
  if (activation?.fallbackReason !== null) {
    failures.push("D5D_UNEXPECTED_FALLBACK");
  }
  if (execution?.candidateCount !== 14) {
    failures.push("D5D_EXECUTION_CANDIDATE_COUNT_MISMATCH");
  }
  if (execution?.status !== "ranked") {
    failures.push("D5D_EXECUTION_NOT_RANKED");
  }

  if (testCase.expectedSpfApplied) {
    if (gate?.axisApplied !== true) {
      failures.push("D5D_SPF_AXIS_NOT_APPLIED");
    }
    if (gate?.authorityComplete !== true) {
      failures.push("D5D_SPF_AUTHORITY_INCOMPLETE");
    }
    if (gate?.adjustments?.length !== 14) {
      failures.push("D5D_SPF_ADJUSTMENT_COUNT_MISMATCH");
    }
    if (
      !Array.isArray(execution?.rankableSignals) ||
      !execution.rankableSignals.includes("outdoor_exposure")
    ) {
      failures.push("D5D_OUTDOOR_SIGNAL_NOT_RANKABLE");
    }

    const deltaById = new Map(
      (gate?.adjustments || []).map((row) => [
        row.productId,
        row.spfDelta,
      ]),
    );
    if (
      deltaById.get(
        "a6994fcd-302f-4e63-acbe-91a3f17a5a65",
      ) !== 2 ||
      deltaById.get(
        "b90bf992-07ae-4f49-a3a4-d90ea6d4a858",
      ) !== 4 ||
      deltaById.get(
        "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
      ) !== 4
    ) {
      failures.push("D5D_NEW_PRODUCT_SPF_DELTA_MISMATCH");
    }
  } else {
    if (gate?.axisApplied === true) {
      failures.push("D5D_NON_OUTDOOR_SPF_AXIS_LEAK");
    }
    if (
      Array.isArray(execution?.rankableSignals) &&
      execution.rankableSignals.includes("outdoor_exposure")
    ) {
      failures.push("D5D_NON_OUTDOOR_SIGNAL_LEAK");
    }
  }

  return Object.freeze({
    version: D5D_SPF_PRODUCTION_ACTIVATION_VERSION,
    caseId,
    status: execution?.status || null,
    candidateCount: Number(execution?.candidateCount || 0),
    resultCount: Array.isArray(execution?.results)
      ? execution.results.length
      : 0,
    activation: activation
      ? Object.freeze({ ...activation })
      : null,
    gate: gate
      ? Object.freeze({
          flagEnabled: gate.flagEnabled === true,
          authorityComplete: gate.authorityComplete === true,
          axisApplied: gate.axisApplied === true,
          reason: gate.reason || null,
          adjustmentCount: Array.isArray(gate.adjustments)
            ? gate.adjustments.length
            : 0,
        })
      : null,
    pass: failures.length === 0,
    failures: Object.freeze(failures),
    limits: Object.freeze({
      authenticatedBetaOnly: true,
      publicSearchCutover: false,
      providerInvoked: false,
      rawQueryAccepted: false,
      profileRead: false,
      historyRead: false,
      productionWrite: false,
      recommendationLogWrite: false,
      uvaActivated: false,
      waterResistanceApplied: false,
      persistence: false,
    }),
  });
}
