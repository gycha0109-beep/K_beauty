// This adapter constructs an OFFLINE compatibility fixture from the frozen
// BUSHMAN S2 evidence packet. It does not query or attest Production DB facts.
export const BUSHMAN_AUTO_EVALUATION_PILOT_VERSION =
  "bushman-automatic-evaluation-offline-pilot-v1";

export function buildBushmanOfflineEvaluationInput(s2) {
  if (s2?.stage !== "DATA-AI29C-FILTER-R4-D-S2" ||
      !s2?.scope?.productId || !s2?.scope?.subjectId ||
      s2?.independence?.manufacturerSignedSkuEquivalence !== false ||
      !Array.isArray(s2?.sources)) {
    throw new Error("BUSHMAN_S2_FROZEN_SOURCE_REQUIRED");
  }
  const sources = new Map(s2.sources.map(s => [s.id,s]));
  const url = id => {
    const out = sources.get(id)?.url;
    if (typeof out !== "string" || !out.startsWith("https://")) {
      throw new Error("BUSHMAN_PILOT_SOURCE_NOT_FOUND:" + id);
    }
    return out;
  };
  const getCore = name => {
    const row = s2.rpcPayloadPreview?.find(p => p.field_name === name);
    const sourceRef = row?.evidence_records?.[0]?.source_ref;
    if (row?.review_state !== "established" || !sourceRef?.startsWith("db:")) {
      throw new Error("BUSHMAN_PILOT_CORE_PREVIEW_MISSING:" + name);
    }
    return {
      field:name,
      value:row.field_value,
      confirmed:true,
      // These are TEST ASSUMPTIONS from S2's unexecuted preview only.
      // Never supply them as Production-current records without a server read.
      sourceKind:name === "category_slot" ? "canonical_taxonomy" : "governed_product_fact",
      sourceRef,subjectId:s2.scope.subjectId,
    };
  };
  const obs = (field,direction,id,sourceKind="individual_review",context="") => ({
    field,direction,sourceKind,sourceId:id,sourceRef:url(id),
    subjectId:s2.scope.subjectId,context,
  });
  const reviewObservations = [
    // Contradictory user experiences are NOT contradictory authoritative facts.
    obs("white_cast","favorable","HWAHAE_REVIEW_TAGS","aggregate_tag"),
    obs("white_cast","unfavorable","HWAHAE_DRY"),
    obs("white_cast","favorable","BRAND_PURCHASE_REVIEW_388"),
    obs("eye_sting","favorable","HWAHAE_REVIEW_TAGS","aggregate_tag"),
    obs("eye_sting","unfavorable","HWAHAE_DRY"),
    obs("eye_sting","favorable","BRAND_PURCHASE_REVIEW_508"),
    obs("pilling_risk","unfavorable","HWAHAE_INDIVIDUAL","individual_review","high_heat_or_thick_makeup"),
    obs("irritation_risk","favorable","HWAHAE_REVIEW_TAGS","aggregate_tag"),
    obs("irritation_risk","unfavorable","BRAND_PURCHASE_REVIEW_4845"),
    obs("sensitivity_safe","favorable","HWAHAE_REVIEW_TAGS","aggregate_tag"),
    obs("sensitivity_safe","unfavorable","BRAND_PURCHASE_REVIEW_4845"),
    obs("finish","favorable","BRAND_PURCHASE_REVIEW_388"),
    obs("finish","unfavorable","HWAHAE_REVIEW_TAGS","aggregate_tag"),
    obs("texture","favorable","HWAHAE_REVIEW_TAGS","aggregate_tag"),
    obs("texture","unfavorable","HWAHAE_DRY"),
  ];
  return {
    category:"sunscreen",
    productId:s2.scope.productId,
    subject:{
      subjectId:s2.scope.subjectId,
      identityStatus:"resolved",
      currentState:"current",
      ownerAssumesSame50g50mlProduct:true,
    },
    verifiedFacts:[getCore("category_slot"),getCore("uv_filter_type")],
    manufacturerClaims:[
      {field:"white_cast",statement:"백탁현상방지",sourceId:"BRAND_PRODUCT_31",
        sourceRef:url("BRAND_PRODUCT_31"),subjectId:s2.scope.subjectId},
      {field:"sensitivity_safe",statement:"저자극",sourceId:"BRAND_PRODUCT_31",
        sourceRef:url("BRAND_PRODUCT_31"),subjectId:s2.scope.subjectId},
    ],
    reviewObservations,
  };
}
