import {
  evaluateAutomaticProductEvidence,
} from "./automatic-product-evidence-evaluator-v1.mjs";

export const LIVE_EVIDENCE_ADAPTER_VERSION =
  "automatic-product-evidence-live-readonly-adapter-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_TAXONOMY = "catalog-taxonomy-v1";
const SUNSCREEN_TERM = ACTIVE_TAXONOMY + ":category:sunscreen";
const CONFIDENCE = new Set(["high", "medium"]);
const OFFICIAL_FACT = new Set(["spf_value", "uva_label", "uv_filter_type"]);
const ACCEPTED_REGISTRY = new Set([
  "product-fact-registry-cross-category-v1",
  "product-fact-registry-cross-category-v2",
]);
const REVIEW_LABELS = Object.freeze({
  "백탁없는": ["white_cast", "favorable"],
  "백탁있는": ["white_cast", "unfavorable"],
  "눈통증없는": ["eye_sting", "favorable"],
  "눈통증있는": ["eye_sting", "unfavorable"],
  "자극없는": ["irritation_risk", "favorable"],
  "따가운": ["irritation_risk", "unfavorable"],
  "알러지반응오는": ["irritation_risk", "unfavorable"],
  "잘발리는": ["texture", "favorable"],
  "밀리는": ["pilling_risk", "unfavorable"],
  "유분있는": ["finish", "unfavorable"],
  "끈적하지않은": ["finish", "favorable"],
});
function fail(code) { throw new Error(code); }
function array(v, name, max) {
  if (!Array.isArray(v) || v.length > max) fail("LIVE_INVALID_ROWS:" + name);
  return v;
}
function unique(rows, key) {
  const seen = new Set();
  for (const row of rows) {
    const k = row?.[key];
    if (typeof k !== "string" || seen.has(k)) fail("LIVE_DUPLICATE_OR_INVALID:" + key);
    seen.add(k);
  }
}
function trustedUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch { return false; }
}
function currentFact(f, c, definitions, subjectId, nowDate) {
  if (!f || !c || f.subject_id !== subjectId ||
      f.fact_instance_id !== c.fact_instance_id ||
      f.registry_version == null ||
      !ACCEPTED_REGISTRY.has(f.registry_version) ||
      f.semantic_status !== "supported" ||
      f.authority_ceiling !== "product_specific_primary" ||
      !CONFIDENCE.has(f.fused_confidence) ||
      (f.valid_to && f.valid_to <= nowDate) ||
      c.subject_id !== subjectId || !UUID.test(String(c.confirmation_id)) ||
      !definitions.some(d => d.registry_version === f.registry_version &&
        d.fact_key === f.fact_key && d.deprecated === false &&
        d.value_type === f.value_type)) return false;
  return true;
}
function trustedReviewObservations(product, bindings, subjectId) {
  const signal = product.review_signals;
  const source = bindings.filter(x =>
    x.source_name === "hwahae" && x.binding_state === "resolved" &&
    x.product_scope_state === "product" &&
    x.product_id === product.id && trustedUrl(x.source_url) &&
    x.source_url === product.hwahae_url);
  // Products with unresolved source-to-subject identity are intentionally skipped.
  if (source.length !== 1 || signal?.source !== "hwahae_ai_review" ||
      !Array.isArray(signal.positive) || !Array.isArray(signal.negative)) return [];
  const out = [];
  for (const [group, direction] of [["positive", "favorable"], ["negative", "unfavorable"]]) {
    for (const item of signal[group]) {
      const mapping = REVIEW_LABELS[String(item?.label ?? "").replace(/\s/g, "")];
      if (!mapping || mapping[1] !== direction ||
          !Number.isInteger(item.count) || item.count <= 0) continue;
      out.push({
        field:mapping[0],direction,sourceKind:"aggregate_tag",
        sourceId:source[0].binding_id + ":" + mapping[0] + ":" + direction,
        sourceRef:source[0].source_url,subjectId,
        context:"상품 연결 검증된 화해 AI 후기 태그 — 독립 표본·발생 확률 아님",
        mentionCount:item.count,
      });
    }
  }
  return out.sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
}

/**
 * Only a server-side service-role DB reader may supply these rows.
 * This pure projector is not an authorization boundary or public request parser.
 * It NEVER accepts caller-provided confirmed facts directly.
 */
export function buildLiveAutomaticEvidenceInput(rows, productId, nowDate = new Date().toISOString().slice(0, 10)) {
  if (!UUID.test(String(productId))) fail("LIVE_INVALID_PRODUCT_ID");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nowDate)) fail("LIVE_INVALID_DATE");
  if (!rows || typeof rows !== "object") fail("LIVE_SNAPSHOT_MISSING");
  const product = rows.product;
  if (!product || product.id !== productId) fail("LIVE_PRODUCT_NOT_FOUND");
  const subjects = array(rows.subjects,"subjects",30);
  unique(subjects,"subject_id");
  const current = subjects.filter(s=>s.product_id===productId && s.current_state==="current");
  if (current.length !== 1 || current[0].identity_status !== "resolved")
    fail("LIVE_CURRENT_SUBJECT_NOT_UNIQUE_RESOLVED");
  const subject = current[0], subjectId = subject.subject_id;
  const assignments = array(rows.taxonomy,"taxonomy",30).filter(x=>x.product_id===productId);
  const currentRows = array(rows.currentFacts,"currentFacts",200);
  const factInstances = array(rows.factInstances,"factInstances",200);
  const confirmations = array(rows.confirmations,"confirmations",200);
  const definitions = array(rows.definitions,"definitions",500);
  const bindings = array(rows.sourceBindings,"sourceBindings",100);
  unique(currentRows,"fact_instance_id");
  unique(factInstances,"fact_instance_id");
  unique(confirmations,"confirmation_id");
  const verifiedFacts = [];
  const diagnostics = { taxonomyMapped:false, currentFactsChecked:0,
    excludedCurrentFacts:[], protectedSunscreenFacts:[], reviewSourceTrusted:false,
    manufacturerClaimsExtracted:0, sourceObservationsRead:rows.sourceObservationCount ?? 0 };
  const category = assignments.filter(a =>
    a.taxonomy_version===ACTIVE_TAXONOMY && a.category_term_id===SUNSCREEN_TERM &&
    a.assignment_state==="shadow" && a.assignment_method==="source_classification");
  if (assignments.length===1 && category.length===1) {
    diagnostics.taxonomyMapped=true;
    verifiedFacts.push({field:"category_slot",value:"sunscreen",confirmed:true,
      sourceKind:"canonical_taxonomy",
      sourceRef:"db:product_catalog_taxonomy_assignments:"+productId,
      subjectId});
  }
  for(const c of currentRows) {
    if (c.subject_id !== subjectId) fail("LIVE_CROSS_SUBJECT_CURRENT_FACT");
    diagnostics.currentFactsChecked++;
    const f = factInstances.find(x=>x.fact_instance_id===c.fact_instance_id);
    const confirmation = confirmations.find(x=>x.confirmation_id===c.confirmation_id);
    const validated = currentFact(f,c,definitions,subjectId,nowDate) &&
      confirmation?.result?.status === "confirmed";
    if (!validated || !OFFICIAL_FACT.has(f?.fact_key)) {
      diagnostics.excludedCurrentFacts.push(c.fact_instance_id);
      continue;
    }
    const value = f.value_type === "enum" ? f.value_enum :
      f.value_type === "number" ? Number(f.value_number) : null;
    const fact = {
      key:f.fact_key,value,registryVersion:f.registry_version,
      factInstanceId:f.fact_instance_id,confirmed:true,
    };
    diagnostics.protectedSunscreenFacts.push(fact);
    if(f.fact_key==="uv_filter_type" &&
      ["mineral","organic","hybrid"].includes(f.value_enum)) {
      verifiedFacts.push({field:"uv_filter_type",value:f.value_enum,confirmed:true,
        sourceKind:"governed_product_fact",
        sourceRef:"db:product_fact_current:"+f.fact_instance_id,subjectId});
    }
  }
  const reviews = trustedReviewObservations(product,bindings,subjectId);
  diagnostics.reviewSourceTrusted = reviews.length>0;
  return {
    input:{
      category:"sunscreen",productId,
      subject:{subjectId,identityStatus:subject.identity_status,currentState:subject.current_state},
      verifiedFacts,manufacturerClaims:[],reviewObservations:reviews,
    },
    diagnostics,
  };
}
export function evaluateLiveAutomaticEvidenceSnapshot(rows, productId, context, nowDate) {
  const snapshot = buildLiveAutomaticEvidenceInput(rows,productId,nowDate);
  const evaluation = evaluateAutomaticProductEvidence(snapshot.input, context);
  return Object.freeze({
    adapterVersion:LIVE_EVIDENCE_ADAPTER_VERSION,
    dataOrigin:"SERVER_READ_ONLY",
    evaluation,diagnostics:snapshot.diagnostics,
    databaseWrites:0,adminReviewWrites:0,recommendationWrites:0,
  });
}
