/**
 * Diagnostic catalog variant gate, not Subject or Product Fact authority.
 * The title is a direct primary page presentation, never formulation proof.
 */
export const TRUST_OFFICIAL_VARIANT_SCOPE_VERSION="trust-official-variant-scope-v1";
function normalize(s){return String(s??"").normalize("NFKC").toLowerCase();}
export function inspectTrustOfficialVariantScope(title,product){
  const titleText=normalize(title);
  const expected=Number(product?.size_ml);
  const catalogSizeKnown=Number.isFinite(expected)&&expected>0;
  const explicit=[...titleText.matchAll(/(\d+(?:\.\d+)?)\s*(?:ml|mℓ|밀리리터)/giu)]
    .map(m=>Number(m[1])).filter(n=>Number.isFinite(n)&&n>0);
  const distinct=[...new Set(explicit)];
  const bundle=/(?:\b(?:x|set)\s*[2-9]\d*\b|[2-9]\d*\s*(?:개묶음|종세트|개\s*묶음)|\b[2-9]\d*\s*pack\b|\[\s*[2-9]\d*\s*종세트)/iu.test(titleText)||
    /\d+\s*ml\s*(?:x|×|\*)\s*[2-9]\d*/iu.test(titleText);
  const status=bundle?"BUNDLE_VARIANT_REVIEW_REQUIRED":
    !catalogSizeKnown||distinct.length===0?"SIZE_UNKNOWN":
    distinct.length!==1?"SIZE_CONFLICT_REVIEW_REQUIRED":
    distinct[0]!==expected?"CATALOG_SIZE_MISMATCH":"SIZE_MATCH_CANDIDATE";
  return Object.freeze({version:TRUST_OFFICIAL_VARIANT_SCOPE_VERSION,
    status,catalogSizeMl:catalogSizeKnown?expected:null,
    explicitTitleSizesMl:distinct.slice(0,4),bundle,
    marketVerified:false,formulationVerified:false,
    exactSkuVerified:false,authorized:false});
}
