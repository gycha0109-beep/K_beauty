export const SUNSCREEN_ACTIVATION_REDESIGN_VERSION =
  "data-ai29c-d-r1-staged-sunscreen-activation-redesign-v1";

export const SUNSCREEN_RECOMMENDATION_SEMANTIC_BUNDLE_VERSION =
  "sunscreen-recommendation-semantic-bundle-v1";

export const SUNSCREEN_INITIAL_ADMISSION_POLICY_VERSION =
  "sunscreen-initial-admission-grant-policy-v1";

export const SUNSCREEN_REQUIRED_SEMANTIC_FIELDS = Object.freeze([
  "category",
  "skin_types",
  "concerns",
  "texture",
  "finish",
  "sensitivity_safe",
  "irritation_risk",
  "tone_up",
  "white_cast",
  "eye_sting",
  "pilling_risk"
]);

function missingRawSemantics(product) {
  const raw = product?.raw_semantics || {};
  return SUNSCREEN_REQUIRED_SEMANTIC_FIELDS.filter(
    (key) => raw[key] == null
  );
}

export function evaluateSunscreenActivationRedesign(snapshot) {
  if (
    snapshot?.version !== SUNSCREEN_ACTIVATION_REDESIGN_VERSION ||
    !Array.isArray(snapshot?.current_primary_products)
  ) {
    throw new Error("sunscreen_activation_redesign_snapshot_invalid");
  }

  const protectionReady =
    snapshot.current_state?.prospective_corpus?.spf?.ranking_useful === true &&
    snapshot.current_state?.prospective_corpus?.uva?.ranking_useful === true;

  const products = snapshot.current_primary_products.map((product) => {
    const missing = missingRawSemantics(product);
    const uvFilterReady = typeof product?.uv_filter_type === "string";
    return Object.freeze({
      productId: product.product_id,
      name: product.name,
      protectionFactsReady:
        Number.isFinite(Number(product.spf_value)) &&
        typeof product.uva_label === "string",
      uvFilterReady,
      missingRawSemanticFields: Object.freeze(missing),
      rawSemanticComplete: missing.length === 0,
      semanticBundleReady: false,
      sunscreenAdmissionGrantReady: false
    });
  });

  const semanticBundleReadyCount = products.filter(
    (item) => item.semanticBundleReady
  ).length;
  const uvFilterReadyCount = products.filter(
    (item) => item.uvFilterReady
  ).length;

  const genericAdmissionSupportsSunscreen =
    snapshot.current_state?.existing_admission_authority
      ?.sunscreen_grant_supported === true;

  const blockers = [];
  if (!protectionReady) blockers.push("PROTECTION_AXIS_NOT_READY");
  if (!genericAdmissionSupportsSunscreen) {
    blockers.push("SUNSCREEN_INITIAL_ADMISSION_AUTHORITY_NOT_DEFINED");
  }
  if (semanticBundleReadyCount !== products.length) {
    blockers.push("SUNSCREEN_RECOMMENDATION_SEMANTIC_AUTHORITY_NOT_ESTABLISHED");
  }
  if (products.some((item) => item.missingRawSemanticFields.length > 0)) {
    blockers.push("C6_PRIMARY_RECOMMENDATION_SEMANTICS_NOT_REVIEWED");
  }
  if (uvFilterReadyCount !== products.length) {
    blockers.push("C6_PRIMARY_UV_FILTER_TYPE_INCOMPLETE");
  }

  return Object.freeze({
    version: SUNSCREEN_ACTIVATION_REDESIGN_VERSION,
    protectionAxisReady: protectionReady,
    readyProtectionAxes: Object.freeze(
      protectionReady ? ["spf", "uva"] : []
    ),
    waterRequiredForSpfUvaProgression: false,
    waterActivationReady:
      snapshot.current_state?.prospective_corpus?.water_resistance
        ?.ranking_useful === true,
    genericAdmissionSupportsSunscreen,
    semanticBundleVersion: SUNSCREEN_RECOMMENDATION_SEMANTIC_BUNDLE_VERSION,
    sunscreenAdmissionPolicyVersion:
      SUNSCREEN_INITIAL_ADMISSION_POLICY_VERSION,
    primaryProductCount: products.length,
    semanticBundleReadyCount,
    uvFilterReadyCount,
    products: Object.freeze(products),
    stages: Object.freeze({
      D0: protectionReady ? "PASS" : "BLOCKED",
      D1:
        semanticBundleReadyCount === products.length
          ? "PASS"
          : "BLOCKED_DATA_ENRICHMENT",
      D2:
        genericAdmissionSupportsSunscreen &&
        semanticBundleReadyCount === products.length
          ? "READY_TO_EVALUATE"
          : "BLOCKED_BY_D1",
      D3: "BLOCKED_BY_D2",
      D4: "BLOCKED_BY_D3",
      D5: "NOT_AUTHORIZED"
    }),
    overall:
      blockers.length === 0
        ? "READY_FOR_INTEGRATED_SHADOW"
        : "BLOCKED_BEFORE_INTEGRATED_SHADOW",
    blockers: Object.freeze([...new Set(blockers)].sort()),
    nextStage:
      semanticBundleReadyCount !== products.length
        ? "DATA-AI29C-D1-SUNSCREEN-SEMANTIC-AUTHORITY"
        : "DATA-AI29C-D2-SUNSCREEN-INITIAL-ADMISSION-AUTHORITY",
    limits: Object.freeze({
      recommendationAdmissionMutated: false,
      productionRankingChanged: false,
      productionCutoverAuthorized: false,
      outdoorRankableSignalAuthorized: false,
      waterResistanceActivated: false,
      publicActivation: false,
      persistence: false
    })
  });
}
