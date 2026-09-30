export const SUNSCREEN_SEMANTIC_PROJECTION_POLICY_VERSION =
  "sunscreen-recommendation-semantic-projection-policy-v1";

export const SUNSCREEN_SEMANTIC_CORE_FIELDS = Object.freeze([
  "category_slot",
  "uv_filter_type",
]);

export const SUNSCREEN_SEMANTIC_CONTEXT_GATES = Object.freeze({
  sensitivityRelevant: Object.freeze([
    "sensitivity_safe",
    "irritation_risk",
  ]),
  whiteCastRelevant: Object.freeze(["white_cast"]),
  eyeStingRelevant: Object.freeze(["eye_sting"]),
  pillingRelevant: Object.freeze(["pilling_risk"]),
  toneUpRelevant: Object.freeze(["tone_up"]),
  finishRelevant: Object.freeze(["finish"]),
  textureRelevant: Object.freeze(["texture"]),
});

const ALL_FIELDS = Object.freeze([
  "category_slot",
  "skin_types",
  "concerns",
  "texture",
  "finish",
  "uv_filter_type",
  "sensitivity_safe",
  "irritation_risk",
  "tone_up",
  "white_cast",
  "eye_sting",
  "pilling_risk",
]);

function field(bundle, name) {
  return bundle?.fields?.[name] || {
    state: "not_reviewed",
    value: null,
    confidence: "unknown",
  };
}

function isEstablished(bundle, name) {
  const current = field(bundle, name);
  return current.state === "established" && current.value !== null;
}

function isReviewed(bundle, name) {
  return field(bundle, name).state !== "not_reviewed";
}

export function evaluateSunscreenSemanticEnvelope(bundle) {
  const subjectExact = bundle?.subjectCount === 1;
  const contractValid =
    bundle?.contractVersion === "sunscreen-recommendation-semantic-bundle-v1";
  const allReviewed = ALL_FIELDS.every((name) => isReviewed(bundle, name));
  const coreEstablished = SUNSCREEN_SEMANTIC_CORE_FIELDS.every((name) =>
    isEstablished(bundle, name),
  );

  const unresolvedFields = ALL_FIELDS.filter(
    (name) => !isEstablished(bundle, name),
  );

  return Object.freeze({
    policyVersion: SUNSCREEN_SEMANTIC_PROJECTION_POLICY_VERSION,
    productId: bundle?.productId || null,
    subjectId: bundle?.subjectId || null,
    contractValid,
    subjectExact,
    allReviewed,
    coreEstablished,
    envelopeReady:
      contractValid && subjectExact && allReviewed && coreEstablished,
    unresolvedFields: Object.freeze(unresolvedFields),
  });
}

export function projectEstablishedSunscreenSemantics(bundle) {
  const envelope = evaluateSunscreenSemanticEnvelope(bundle);
  if (!envelope.envelopeReady) {
    return Object.freeze({
      envelope,
      projected: null,
      uncertainty: null,
    });
  }

  const projected = {};
  const uncertainty = {};

  for (const name of ALL_FIELDS) {
    const current = field(bundle, name);
    const targetName = name === "category_slot" ? "category" : name;
    if (current.state === "established") {
      projected[targetName] = current.value;
    } else {
      uncertainty[targetName] = Object.freeze({
        state: current.state,
        confidence: current.confidence || "unknown",
      });
    }
  }

  return Object.freeze({
    envelope,
    projected: Object.freeze(projected),
    uncertainty: Object.freeze(uncertainty),
  });
}

export function evaluateSunscreenSemanticScoringEligibility(
  bundle,
  context = {},
) {
  const projection = projectEstablishedSunscreenSemantics(bundle);
  const blockers = [];

  if (!projection.envelope.envelopeReady) {
    blockers.push("SEMANTIC_ENVELOPE_NOT_READY");
  } else {
    for (const [contextKey, requiredFields] of Object.entries(
      SUNSCREEN_SEMANTIC_CONTEXT_GATES,
    )) {
      if (context?.[contextKey] !== true) continue;
      for (const requiredField of requiredFields) {
        if (!isEstablished(bundle, requiredField)) {
          blockers.push(
            `SEMANTIC_UNCERTAINTY:${contextKey}:${requiredField}`,
          );
        }
      }
    }
  }

  const uniqueBlockers = [...new Set(blockers)].sort();

  return Object.freeze({
    policyVersion: SUNSCREEN_SEMANTIC_PROJECTION_POLICY_VERSION,
    productId: bundle?.productId || null,
    eligible: uniqueBlockers.length === 0,
    blockers: Object.freeze(uniqueBlockers),
    projected: projection.projected,
    uncertainty: projection.uncertainty,
    limits: Object.freeze({
      missingConvertedToFalse: false,
      unresolvedValueScoredAsEstablished: false,
      productRowMutated: false,
      recommendationAdmissionMutated: false,
      productionRankingChanged: false,
      publicActivation: false,
    }),
  });
}
