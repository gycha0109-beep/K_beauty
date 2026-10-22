import { createHash } from "node:crypto";
import { fetchOfficialBytes } from "./trust/official-source-fetch.mjs";
import { inspectOfficialProductSemanticSurfacesV1 } from "./trust/official-source-semantic-adapter.mjs";
import { createTrustRobotsPolicy, strictOriginTransport } from "./trust/official-product-discovery-p2-v1.mjs";

/**
 * Evidence-candidate capture for an EXISTING canonical cleanser.
 *
 * Never treats an HTML response or a host allowlist as governed identity,
 * source authorization, Product Fact confirmation, or recommendation admission.
 * The caller must establish site rights / robots compliance before fetching.
 */
export const EXISTING_CLEANSER_OFFICIAL_CAPTURE_VERSION =
  "existing-cleanser-official-capture-candidate-v1";

const CONTROL = /[\u0000-\u001f\u007f]/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const SECONDARY_HOSTS = new Set([
  "oliveyoung.co.kr", "www.oliveyoung.co.kr", "m.oliveyoung.co.kr",
  "hwahae.co.kr", "www.hwahae.co.kr", "hwahae.com", "www.hwahae.com",
  "smartstore.naver.com", "brand.naver.com", "www.coupang.com", "coupang.com",
]);
const text = (value) => typeof value === "string" ? value.trim() : "";
const normal = (value) => text(value).normalize("NFKC").toLowerCase()
  .replace(/[™®©]/g, "").replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim();
const compact = (value) => normal(value).replace(/\s/g,"");
const result = (productId, state, reasons, observation = null) => Object.freeze({
  version:EXISTING_CLEANSER_OFFICIAL_CAPTURE_VERSION, productId, state,
  reasons:Object.freeze([...new Set(reasons)].sort()),
  observation,
  trustedSourceAuthorized:false,
  exactSubjectResolved:false,
  productFactConfirmed:false,
  grantIssued:false,
  recommendationActivated:false,
  productionWrites:0,
});
function origin(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password || u.hash ||
      (u.port && u.port !== "443") || CONTROL.test(url)) return null;
    return u;
  } catch { return null; }
}
export const OFFICIAL_RESEARCH_SOURCE_MODE = Object.freeze({
  CATALOG_ONLY:"CATALOG_SOURCE_ONLY",
  ALTERNATE:"ALTERNATE_UNVERIFIED_CANDIDATE",
});
function samePage(a,b) {
  return a?.hostname===b?.hostname && a?.pathname===b?.pathname &&
    a?.search===b?.search;
}
function capacity(product) {
  if (product?.size_ml != null) {
    const n = Number(product.size_ml);
    if (!Number.isFinite(n) || n <= 0) return null;
    return {amount:n,unit:"ml"};
  }
  const hits = [...text(product?.name).matchAll(/(\d+(?:\.\d+)?)\s*(ml|g)(?=$|[^\p{L}])/giu)];
  if (hits.length !== 1) return null;
  return {amount:Number(hits[0][1]),unit:hits[0][2].toLowerCase()};
}
function sizes(s) {
  return [...text(s).matchAll(/(\d+(?:\.\d+)?)\s*(ml|g)(?=$|[^\p{L}])/giu)]
    .map(x=>({amount:Number(x[1]),unit:x[2].toLowerCase()}));
}
function isProductTitle(title, product) {
  const source = compact(title);
  const productName = compact(product.normalized_name || product.name);
  return source && productName.length >= 4 && source.includes(productName);
}
function variantDecision(surfaces, product, wanted) {
  // Identity must be in a product-specific title, not in a generic HTML body
  // (which may list recommendations, alternative sizes or package bundles).
  const titles = [
    ...((surfaces.structured_product_names || []).map(value=>({kind:"structured",value}))),
    ...["og_title","meta_title","title"].map(key=>({kind:key,value:surfaces.document?.[key]})),
  ].filter(row=>text(row.value) && isProductTitle(row.value,product));
  if (!titles.length) return {state:"HOLD_EXACT_NAME_NOT_OBSERVED"};
  const brand = compact(product.brand);
  const corroboratedTitles = titles.filter(x=>compact(x.value).includes(brand));
  // A brand must appear in an identity-bearing page title; matching a footer
  // or products in unrelated recommendations is not enough.
  if (!corroboratedTitles.length) return {state:"HOLD_BRAND_NOT_OBSERVED_IN_IDENTITY"};
  const candidates = corroboratedTitles.map(x=>({source:x.kind,value:x.value,found:sizes(x.value)}));
  const containingCapacity = candidates.filter(x=>x.found.some(c=>
    c.amount===wanted.amount && c.unit===wanted.unit));
  if (!containingCapacity.length) return {state:"HOLD_EXACT_CAPACITY_NOT_OBSERVED"};
  // Even the correct amount cannot be trusted if an identity-bearing title
  // contains 2x/1+1/plus-value packs or multiple physical-unit capacities.
  if (candidates.some(x=>/\b(?:1\s*\+\s*1|2\s*\+\s*1|\d+\s*(?:개입|세트|입|팩))\b/iu.test(x.value))) {
    return {state:"HOLD_BUNDLE_OR_PACKAGING_AMBIGUITY"};
  }
  if (candidates.some(x=>new Set(x.found.map(c=>c.amount+"|"+c.unit)).size>1)) {
    return {state:"HOLD_VARIANT_SIZE_CONFLICT"};
  }
  return {state:"CANDIDATE_CAPTURED",source:containingCapacity[0].source,
    observedCapacity:wanted};
}
export function evaluateExistingCleanserOfficialCapture({
  product, officialUrl, finalUrl=officialUrl, htmlBytes, approvedBrandHosts=[],
  capturedAt=new Date().toISOString(),
  researchSourceMode=OFFICIAL_RESEARCH_SOURCE_MODE.CATALOG_ONLY,
}={}) {
  const productId=UUID.test(String(product?.id||"")) ? product.id : null;
  if (!productId || product?.category!=="cleanser" ||
    !text(product?.brand) || !text(product?.name) || !text(product?.normalized_name)) {
    return result(productId,"HOLD",["INVALID_CANONICAL_PRODUCT"]);
  }
  const source=origin(officialUrl), destination=origin(finalUrl);
  const catalogSource=origin(product.source_url);
  if (!source || !destination || !catalogSource) {
    return result(productId,"HOLD",["UNSAFE_OR_MISSING_SOURCE"]);
  }
  if (!samePage(source,destination)) {
    return result(productId,"HOLD",["SOURCE_REDIRECT_OR_CATALOG_BINDING_MISMATCH"]);
  }
  const catalogSourceAgreement=samePage(source,catalogSource);
  if (researchSourceMode!==OFFICIAL_RESEARCH_SOURCE_MODE.CATALOG_ONLY &&
      researchSourceMode!==OFFICIAL_RESEARCH_SOURCE_MODE.ALTERNATE) {
    return result(productId,"HOLD",["UNKNOWN_RESEARCH_SOURCE_MODE"]);
  }
  if (!catalogSourceAgreement &&
      researchSourceMode!==OFFICIAL_RESEARCH_SOURCE_MODE.ALTERNATE) {
    return result(productId,"HOLD",["SOURCE_REDIRECT_OR_CATALOG_BINDING_MISMATCH"]);
  }
  const hostname=source.hostname.toLowerCase();
  if (SECONDARY_HOSTS.has(hostname)) return result(productId,"HOLD",["SECONDARY_RETAILER_NOT_OFFICIAL_SOURCE"]);
  if (!Array.isArray(approvedBrandHosts) ||
    !approvedBrandHosts.some(x=>text(x).toLowerCase()===hostname)) {
    return result(productId,"HOLD",["OFFICIAL_HOST_NOT_AUTHORIZED_FOR_RESEARCH"]);
  }
  const at=Date.parse(capturedAt);
  if (!Number.isFinite(at) || at>Date.now()+1000) return result(productId,"HOLD",["INVALID_CAPTURE_TIMESTAMP"]);
  const wanted=capacity(product);
  if (!wanted) return result(productId,"HOLD",["CANONICAL_UNIT_CAPACITY_MISSING"]);
  if (!Buffer.isBuffer(htmlBytes) && !(htmlBytes instanceof Uint8Array)) {
    return result(productId,"HOLD",["CAPTURE_BYTES_REQUIRED"]);
  }
  if (!htmlBytes.byteLength || htmlBytes.byteLength>MAX_HTML_BYTES) {
    return result(productId,"HOLD",["CAPTURE_BYTES_INVALID_SIZE"]);
  }
  const surfaces=inspectOfficialProductSemanticSurfacesV1(htmlBytes);
  const variant=variantDecision(surfaces,product,wanted);
  if (variant.state!=="CANDIDATE_CAPTURED") return result(productId,"HOLD",[variant.state]);
  const digest=createHash("sha256").update(htmlBytes).digest("hex");
  return result(productId,"RESEARCH_CANDIDATE_ONLY",[],Object.freeze({
    productId, sourceUrl:source.toString(), sourceKindCandidate:"brand_official_product_page",
    market:"KR", contentDigest:digest, digestBasis:"live-page-bytes-v1",
    capturedAt:new Date(at).toISOString(),
    candidateCapacity:Object.freeze(variant.observedCapacity),
    identitySurface:variant.source,
    catalogSourceAgreement,
    catalogSourceRelation:catalogSourceAgreement?"EXACT_CATALOG_SOURCE":
      "ALTERNATE_OFFICIAL_SOURCE_PENDING_MANUAL_BINDING",
    verification:"EVIDENCE_CANDIDATE_NOT_ADOPTED",
    sourceAuthority:"UNVERIFIED_PENDING_GOVERNED_BINDING",
  }));
}

/**
 * Operator-supplied public locator leads are NOT official source authority.
 * Ensure exact bounded product IDs and explicit approved manufacturer hosts.
 */
export function validateExistingCleanserOfficialResearchLeads(input,{
  productIds=[],approvedBrandHosts=[],
}={}) {
  if(input?.version!=="cleanser-official-research-leads-v1" ||
     !Array.isArray(input.items)||input.items.length>25 ||
     !Array.isArray(productIds)||!Array.isArray(approvedBrandHosts)){
    throw Error("OFFICIAL_LEADS_FILE_INVALID");
  }
  const map=new Map();
  for(const item of input.items){
    if(!UUID.test(String(item?.productId||"")) ||
       !productIds.includes(item.productId) ||
       typeof item.officialUrl!=="string"||item.officialUrl.length>2048 ||
       map.has(item.productId)){
      throw Error("OFFICIAL_LEAD_SCOPE_OR_DUPLICATE");
    }
    const candidate=origin(item.officialUrl);
    if(!candidate || SECONDARY_HOSTS.has(candidate.hostname.toLowerCase()) ||
       !approvedBrandHosts.includes(candidate.hostname.toLowerCase())){
      throw Error("OFFICIAL_LEAD_HOST_OR_URL_NOT_APPROVED");
    }
    map.set(item.productId,candidate.toString());
  }
  return map;
}

/**
 * A caller-only permitted-fetch adapter. Explicit site-use permission is
 * required; callers must not equate 'hostname on allowlist' with legal rights.
 */
export async function collectExistingCleanserOfficialCapture({
  product, officialUrl=null,
  researchSourceMode=OFFICIAL_RESEARCH_SOURCE_MODE.CATALOG_ONLY,
  approvedBrandHosts=[], siteUseAuthorized=false, fetchImpl=fetch,
}={}) {
  const productId=UUID.test(String(product?.id||""))?product.id:null;
  if (siteUseAuthorized!==true) {
    return result(productId,"HOLD",["SITE_USE_AUTHORIZATION_REQUIRED"]);
  }
  const url=origin(officialUrl||product?.source_url);
  if (!url || SECONDARY_HOSTS.has(url.hostname.toLowerCase()) ||
    !Array.isArray(approvedBrandHosts) ||
    !approvedBrandHosts.includes(url.hostname.toLowerCase())) {
    return result(productId,"HOLD",["OFFICIAL_SOURCE_NOT_APPROVED"]);
  }
  const catalogSource=origin(product?.source_url);
  if (!catalogSource ||
      (!samePage(url,catalogSource) &&
        researchSourceMode!==OFFICIAL_RESEARCH_SOURCE_MODE.ALTERNATE)) {
    return result(productId,"HOLD",["ALTERNATE_OFFICIAL_SOURCE_REVIEW_REQUIRED"]);
  }
  // Robots policy is checked before the product request; a missing or
  // inaccessible robots.txt is a hold, not implied permission to scrape.
  const robotsUrl=url.origin+"/robots.txt";
  let policy;
  try {
    const robots=await fetchOfficialBytes(robotsUrl,
      strictOriginTransport(fetchImpl,url.origin,null,{diagnoseRedirect:true}));
    if (robots.finalUrl!==robotsUrl)throw Error("ROBOTS_REDIRECT");
    policy=createTrustRobotsPolicy(robots.bytes);
  } catch {
    return result(productId,"HOLD",["OFFICIAL_ROBOTS_UNAVAILABLE"]);
  }
  if (policy.delayBlocked || !policy.allowed(url)) {
    return result(productId,"HOLD",["OFFICIAL_ROBOTS_POLICY_BLOCKED"]);
  }
  const fetched=await fetchOfficialBytes(url.toString(),
    strictOriginTransport(fetchImpl,url.origin,policy,{diagnoseRedirect:true}));
  return evaluateExistingCleanserOfficialCapture({
    product,officialUrl:url.toString(),finalUrl:fetched.finalUrl,
    htmlBytes:fetched.bytes,approvedBrandHosts,researchSourceMode,
  });
}
