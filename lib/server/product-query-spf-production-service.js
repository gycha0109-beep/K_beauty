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
  readRecommendationSunscreenProtectionAuthorities,
} from "@/lib/recommendation-sunscreen-protection-authority-reader";
import {
  projectSunscreenProtectionAuthority,
  projectSunscreenSpfFact,
} from "@/lib/sunscreen-protection-projection.mjs";
import {
  readD5dSpfRuntimeActivation,
} from "@/lib/server/sunscreen-spf-production-activation-reader";

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

  const legacyProtectionRecords =
    await readRecommendationSunscreenProtectionAuthorities(
      productionSunscreens.map((product) => product.id),
      { allowShadowTransportFallback: true },
    );
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
      publicSearchCutover: false,
      uvaActivated: false,
      waterResistanceApplied: false,
    },
    includeActivationEvidence,
  );
}
