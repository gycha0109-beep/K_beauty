import { classifyTrustOfficialCandidatePage } from "./official-product-discovery-p2-v1.mjs";
import { normalizeSemanticTextV1 } from "./official-source-semantic-adapter.mjs";
import { sha256Hex } from "./official-source-fetch.mjs";

export const TRUST_P3_EXTRACTION_VERSION="trust-p3-official-direct-claims-v1";
const MAX_BYTES=2*1024*1024;
const ALLOWED_NAME=new Set(["STRUCTURED_NAME_CANDIDATE","TITLE_NAME_CANDIDATE","SCOPED_HEADING_CANDIDATE"]);
const LABEL_UV=[
  ["mineral",/(?:무기자차|무기\s*자외선\s*차단제|무기\s*필터|100%\s*mineral\s*(?:uv|sun)?\s*(?:filter|sunscreen)?)/iu],
  ["organic",/(?:유기자차|유기\s*자외선\s*차단제|유기\s*필터|chemical\s*(?:uv\s*)?filters?)/iu],
  ["hybrid",/(?:혼합자차|혼합\s*자외선\s*차단제|hybrid\s*(?:uv|sun)?\s*(?:filter|sunscreen)?)/iu],
];
function cleanHtmlText(value){
  return normalizeSemanticTextV1(String(value??"")
    .replace(/<!--[\s\S]*?-->/g," ")
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;|&#160;/gi," "));
}
function specSections(html){
  const sections=[];
  // Opt-in product specification roots, not page-wide body, recommendations or snippets.
  const candidates=/<(section|div)\b([^>]{0,500})>([\s\S]*?)<\/\1\s*>/gi;
  for(const m of html.matchAll(candidates)){
    if(!/\bdata-product-specs\b/i.test(m[2])&&
      !/\b(?:class|id)\s*=\s*["'][^"']*(?:product[-_ ]?(?:specs|specifications|claims)|goods[-_ ]?specs)[^"']*["']/i.test(m[2]))continue;
    const text=cleanHtmlText(m[3]);
    if(text&&text.length<=20_000)sections.push(text);
    if(sections.length>=3)break;
  }
  return sections;
}
function claim(text,re){
  const m=text.match(re);
  return m?.[0]??null;
}
function hasUncertainty(text){
  return /(?:아님|아닙니다|아니에요|미확인|무관|미보유|미표기|not\s+(?:spf|pa|uv)|without\s+(?:spf|uv)|\bno\s+(?:spf|pa|uv)\b)/iu.test(text);
}
function oneOrHold(values){
  const distinct=[...new Set(values.filter(Boolean))];
  return {value:distinct.length===1?distinct[0]:null,
    state:distinct.length>1?"CONFLICT_REVIEW_REQUIRED":distinct.length===1?"DIRECT_CLAIM_CANDIDATE":"UNKNOWN"};
}
function parseOfficialSpecs(sections){
  const spf=[],pa=[],uv=[],ingredientLists=[];
  for(const section of sections){
    if(hasUncertainty(section))continue;
    for(const token of section.matchAll(/\bSPF\s*(?:[1-9]\d?)(?:\+)?\b/giu)){
      const s=token[0].replace(/\s+/g,"").toUpperCase();
      // SPF50+ ends in '+' and must not be truncated to SPF50.
      const near=section.slice(token.index,token.index+token[0].length+1);
      spf.push(s+(near.startsWith(token[0]+"+")?"+":""));
    }
    for(const token of section.matchAll(/\bPA\s*\+{1,4}(?!\+)/giu))pa.push(token[0].replace(/\s+/g,"").toUpperCase());
    const filterLabels=LABEL_UV.filter(([,re])=>re.test(section)).map(([key])=>key);
    if(filterLabels.length===1)uv.push(filterLabels[0]);
    if(filterLabels.length>1)uv.push("CONFLICTING_UV_CLAIMS");
    const ingredient=section.match(/(?:전\s*성\s*분|全成分|ingredients?|INCI)\s*[:：]\s*([\p{L}\p{N}\s,().\-\/]+)$/iu);
    if(ingredient){
      const items=ingredient[1].split(/[,，]/).map(s=>s.trim()).filter(Boolean);
      if(items.length>=3&&items.length<=200)ingredientLists.push(items);
    }
  }
  const out={
    spf:oneOrHold(spf),
    pa:oneOrHold(pa),
    uvFilterType:oneOrHold(uv),
    inci:oneOrHold(ingredientLists.map(items=>items.join("|"))),
  };
  if(out.uvFilterType.value==="CONFLICTING_UV_CLAIMS"){
    out.uvFilterType={value:null,state:"CONFLICT_REVIEW_REQUIRED"};
  }
  if(out.inci.value)out.inci.value=out.inci.value.split("|");
  return out;
}
/**
 * Read-only candidates only; no Product Fact materialization or confirm authority.
 * Must be run against a governed first-party source after robots/same-origin fetch.
 * Reject wrong size/bundles, ambiguous primary identity, and body-only mentions.
 */
export function extractTrustP3OfficialProductCandidates(bytes,product,{
  sourceUrl,sourceKind="untrusted",robotsAllowed=false,
}={}){
  const buff=Buffer.from(bytes??"");
  if(!buff.length||buff.length>MAX_BYTES||!product?.id)
    throw new Error("TRUST_P3_INVALID_INPUT");
  const source=new URL(sourceUrl??"https://invalid.invalid/");
  const safeSource=source.protocol==="https:"&&!source.username&&!source.password&&
    sourceKind==="official_product_page"&&robotsAllowed===true;
  const classified=classifyTrustOfficialCandidatePage(buff,product);
  const nameSupported=ALLOWED_NAME.has(classified.status);
  const scope=classified.variantScope?.status??"SIZE_UNKNOWN";
  const scopeEligible=scope==="SIZE_MATCH_CANDIDATE";
  const gate=safeSource&&nameSupported&&scopeEligible?"EVIDENCE_CANDIDATE_ONLY":
    !safeSource?"SOURCE_POLICY_HOLD":
    !nameSupported?"IDENTITY_REVIEW_REQUIRED":"VARIANT_REVIEW_REQUIRED";
  const empty={spf:{value:null,state:"UNKNOWN"},pa:{value:null,state:"UNKNOWN"},
    uvFilterType:{value:null,state:"UNKNOWN"},inci:{value:null,state:"UNKNOWN"}};
  let findings=empty;
  let sections=0;
  if(gate==="EVIDENCE_CANDIDATE_ONLY"){
    const html=buff.toString("utf8");
    const scoped=specSections(html);sections=scoped.length;
    if(scoped.length)findings=parseOfficialSpecs(scoped);
  }
  return Object.freeze({
    contract:TRUST_P3_EXTRACTION_VERSION,
    sourceUrl:safeSource?source.href:null,sourceDigest:sha256Hex(buff),
    gate,identitySignal:classified.nameSignalStatus??classified.status,
    variantStatus:scope,scopedSpecificationSections:sections,
    findings,
    inference:{ingredientDerivedUvFilterType:null,state:"NOT_EVALUATED"},
    authority:"PROPOSALS_ONLY_NO_FACT_OR_SUBJECT_CONFIRMATION",
    subjectCreationAuthorized:false,factConfirmationAuthorized:false,
    marketVerified:false,formulationVerified:false,aiApiCalls:0,dbWrites:0,
  });
}
