import { normalizeSemanticTextV1 } from "./official-source-semantic-adapter.mjs";

export const TRUST_VISIBLE_IDENTITY_VERSION="trust-official-visible-identity-v1";
const MAX_HTML=2*1024*1024;
const REMOVE=/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const STRIP=/<[^>]+>/g;
const H1=/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi;
const PRODUCT_DETAILS=/<(div|strong|span|h2|h3)\b[^>]*class\s*=\s*["']([^"']{0,240})["'][^>]*>([\s\S]*?)<\/\1\s*>/gi;
const NAME_CLASS=/(?:^|[\s_-])(goods[\s_-]?name|goods[\s_-]?tit|product[\s_-]?name|item[\s_-]?tit[\s_-]?detail|prd[\s_-]?name)(?:$|[\s_-])/i;
function normalize(v){
  return normalizeSemanticTextV1(v??"").toLowerCase()
    .replace(/[-_]+/g," ").replace(/[^\p{L}\p{N}]+/gu," ")
    .replace(/\s+/g," ").trim();
}
function toText(text){
  return normalize(String(text??"").replace(STRIP," "));
}
function productNames(product){
  return [...new Set([product?.name,product?.name_en,product?.normalized_name]
    .map(normalize).filter(x=>x.length>=6))];
}
function scopedMatch(label,names){
  // Name must begin at a clear field boundary, not be buried inside a
  // description. Allow up to 24 trailing chars for 50ml/brand suffix.
  return names.some(n=>label===n ||
    (label.startsWith(n+" ") && label.length<=n.length+24));
}
/**
 * Classifies non-script HTML into DIAGNOSTIC identity signals only.
 * Product heading > isolated visible mention. Generic mention is NOT
 * positive SKU, market, formulation or Product Fact evidence.
 */
export function inspectTrustVisibleProductIdentity(bytes,product){
  if(!bytes||!Buffer.isBuffer(Buffer.from(bytes))||
     Buffer.byteLength(bytes)>MAX_HTML||!product||typeof product!=="object")
    throw Error("TRUST_VISIBLE_IDENTITY_INVALID_INPUT");
  const names=productNames(product);
  if(!names.length)return Object.freeze({status:"IDENTITY_UNRESOLVED",surface:null,
    bodyMention:false,scopedHeadingCount:0,authorized:false});
  const html=Buffer.from(bytes).toString("utf8")
    .replace(/<!--[\s\S]*?-->/g," ").replace(REMOVE," ");
  const headings=[];
  for(const match of html.matchAll(H1)){
    const label=toText(match[1].replace(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi," "));
    if(scopedMatch(label,names))headings.push({label,surface:"h1"});
    if(headings.length>6)break;
  }
  for(const match of html.matchAll(PRODUCT_DETAILS)){
    if(!NAME_CLASS.test(match[2]))continue;
    const text=toText(match[3].replace(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi," "));
    if(scopedMatch(text,names))headings.push({label:text,surface:"product_title_class"});
    if(headings.length>6)break;
  }
  const scopedHeadingCount=headings.length;
  // Unrelated product links, scripts, and templates must not be relied on as
  // even a visible body mention. Exclude links to reduce nav false signals.
  const visible=toText(html.replace(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi," "));
  const bodyMention=names.some(n=>visible.includes(n));
  const status=scopedHeadingCount>0?"SCOPED_HEADING_CANDIDATE":
    bodyMention?"BODY_NAME_MENTION_ONLY":"IDENTITY_UNRESOLVED";
  return Object.freeze({
    version:TRUST_VISIBLE_IDENTITY_VERSION,status,
    surface:scopedHeadingCount>0?"product_heading":
      bodyMention?"visible_body_mention":null,
    bodyMention,scopedHeadingCount,
    authorized:false,marketVerified:false,formulationVerified:false,
  });
}
