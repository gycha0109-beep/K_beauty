/**
 * Existing cleanser catalog-row TRUST backfill plan.
 *
 * Pure read-only projection. Action codes are operator/research work items,
 * never permissions to create a subject, confirm a fact, or admit candidates.
 * The existing GPT catalog intake RPC BLOCKS duplicate normalized identities;
 * do not call it for these already-promoted catalog rows.
 */
export const EXISTING_CLEANSER_TRUST_BACKFILL_PLAN_VERSION = "existing-cleanser-trust-backfill-plan-v1";

const RETAILER_HOSTS = new Set([
  "oliveyoung.co.kr", "www.oliveyoung.co.kr", "m.oliveyoung.co.kr",
  "hwahae.co.kr", "www.hwahae.co.kr",
  "coupang.com", "www.coupang.com", "link.coupang.com",
  "naver.com", "smartstore.naver.com", "brand.naver.com",
  "11st.co.kr", "www.11st.co.kr",
  "gmarket.co.kr", "www.gmarket.co.kr",
]);
const TASKS = Object.freeze([
  {
    code:"RECONCILE_CANONICAL_IDENTITY",
    blockers:["CANONICAL_PRODUCT_INVALID","CANONICAL_DUPLICATE_OR_VARIANT_COLLISION"],
    owner:"catalog-identity-review",
    description:"Resolve the exact brand, normalized name, variant and duplicate collision before further evidence binding.",
  },
  {
    code:"VALIDATE_OFFICIAL_PRODUCT_SOURCE",
    blockers:["PRODUCT_SOURCE_URL_MISSING_OR_UNSAFE","RESOLVED_OFFICIAL_SOURCE_BINDING_REQUIRED"],
    owner:"trust-official-source-binding",
    description:"Find and authenticate the manufacturer/brand source, then bind it to the existing product ID via the governed TRUST process.",
  },
  {
    code:"RESOLVE_EXISTING_PRODUCT_SUBJECT",
    blockers:["CURRENT_EXACT_SUBJECT_REQUIRED"],
    owner:"trust-subject-resolution",
    description:"Resolve exactly one current KR formulation subject for this existing catalog product; do not re-ingest it as a new GPT candidate.",
  },
  {
    code:"CAPTURE_EXACT_OFFICIAL_VARIANT",
    blockers:["CURRENT_OFFICIAL_IDENTITY_OBSERVATION_REQUIRED","VERIFIED_EXACT_CAPACITY_REQUIRED"],
    owner:"trust-source-observation",
    description:"Capture recent product-bound official-page evidence and explicitly verify one physical unit's ml/g capacity and formulation revision.",
  },
  {
    code:"LINK_AND_REVALIDATE_HWAHAE_CAPTURE",
    blockers:["HWAHAE_PRODUCT_CAPTURE_BINDING_REQUIRED","CURRENT_REVIEW_SIGNALS_REQUIRED","CURRENT_MARKET_SIGNALS_REQUIRED","VALID_CURRENT_INGREDIENT_SIGNALS_REQUIRED"],
    owner:"hwahae-review-provenance",
    description:"Match the exact Hwahae product and variant, retain source/capture provenance, and verify review/ingredient signal structure without asserting efficacy.",
  },
  {
    code:"ESTABLISH_RECOMMENDATION_SEMANTICS",
    blockers:["VERIFIED_RECOMMENDATION_SEMANTICS_REQUIRED"],
    owner:"recommendation-evidence-review",
    description:"Establish supportable skin types and concerns from product-specific evidence; do not infer them from generic ingredient counts or market popularity.",
  },
  {
    code:"CONFIRM_GOVERNED_CLEANSER_FACT",
    blockers:["GOVERNED_CURRENT_FACT_REQUIRED"],
    owner:"product-fact-controlled-confirmation",
    description:"Create reviewed product-specific current Fact lineage via existing governed confirmation, not a synthesized UUID or Hwahae review claim.",
  },
]);
const codeText = (v) => typeof v === "string" ? v.trim() : "";
function sourceKind(url) {
  if (!codeText(url)) return "MISSING";
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password) return "UNSAFE";
    if ([...RETAILER_HOSTS].some((domain) => u.hostname.toLowerCase() === domain)) return "RETAILER_OR_SECONDARY";
    return "OFFICIAL_SOURCE_CANDIDATE_UNVERIFIED";
  } catch {
    return "INVALID";
  }
}
export function buildExistingCleanserTrustBackfillPlan(product, preflight) {
  if (!product || product.category !== "cleanser" ||
      !preflight || !Array.isArray(preflight.blockers) || !Array.isArray(preflight.conflicts)) {
    throw new TypeError("EXISTING_CLEANSER_BACKFILL_PLAN_INVALID_INPUT");
  }
  const current = new Set([...preflight.blockers, ...preflight.conflicts]);
  const tasks = TASKS.filter(({blockers}) => blockers.some((reason) => current.has(reason)))
    .map(({code,owner,description,blockers}) => Object.freeze({
      code,owner,description,triggeredBy:Object.freeze(blockers.filter((reason)=>current.has(reason))),
      status:"NOT_STARTED",
      execution:"REQUIRES_INDEPENDENT_EVIDENCE_OR_GOVERNED_ACTION",
    }));
  const deferredAdmission = Object.freeze({
    code:"EXTEND_GOVERNED_CLEANSER_G2_INITIAL_ADMISSION",
    status:"NOT_AUTHORIZED",
    reason:"Current G2 permits only governed treatment/toner categories; a preflight PASS is not a recommendation admission grant.",
  });
  return Object.freeze({
    version:EXISTING_CLEANSER_TRUST_BACKFILL_PLAN_VERSION,
    productId:product.id,
    sourceUrlClassification:sourceKind(product.source_url),
    researchLocatorCandidate:sourceKind(product.source_url) === "OFFICIAL_SOURCE_CANDIDATE_UNVERIFIED"
      ? product.source_url : null,
    tasks:Object.freeze(tasks),
    nextTask:tasks[0]?.code || deferredAdmission.code,
    deferredAdmission,
    currentPreflightState:preflight.state,
    automaticConfirmation:false,
    productionWrites:0,
    recommendationAdmissionGranted:false,
    runtimeCutover:false,
  });
}
