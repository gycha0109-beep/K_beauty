import {inspectOfficialProductSemanticSurfacesV1,normalizeSemanticTextV1}
  from "./official-source-semantic-adapter.mjs";
import {inspectTrustVisibleProductIdentity}
  from "./official-visible-identity-v1.mjs";

export const TRUST_P3_PAGE_SHAPE_VERSION="trust-p3-official-page-shape-v1";
const LIMIT=2*1024*1024;
function norm(value){
  return normalizeSemanticTextV1(value??"").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu," ").trim();
}
function names(product){
  return [...new Set([product?.name,product?.name_en,product?.normalized_name]
    .map(norm).filter(v=>v.length>=6))];
}
function nameMatch(value,variants){
  const n=norm(value);
  return variants.some(v=>n===v||n.startsWith(v+" ")||n.endsWith(" "+v));
}
function asciiAlphaNumeric(c){
  const code=c.charCodeAt(0);
  return code>=48&&code<=57||code>=97&&code<=122||c==="-"||c==="_";
}
function readCharset(text){
  const lower=String(text??"").slice(0,8192).toLowerCase();
  let position=lower.indexOf("charset");
  while(position>=0){
    let equal=lower.indexOf("=",position+7);
    if(equal<0||equal>position+18)break;
    let start=equal+1;
    while(lower[start]===" "||lower[start]==="'"||lower[start]==='"')start++;
    let value="";
    while(start<lower.length&&value.length<32&&asciiAlphaNumeric(lower[start])){
      value+=lower[start];start++;
    }
    if(value)return value;
    position=lower.indexOf("charset",position+7);
  }
  return null;
}
function findScriptNameMention(html,variants){
  // indexOf-based bounded scanning: no untrusted HTML block regex matching.
  const lower=html.toLowerCase();
  let from=0;
  for(let count=0;count<256;count++){
    const open=lower.indexOf("<script",from);
    if(open<0)return false;
    const after=lower[open+7];
    if(after&&after!==">"&&after!==" "&&after!=="\t"&&after!=="\n"){
      from=open+7;continue;
    }
    const headerEnd=lower.indexOf(">",open+7);
    if(headerEnd<0)return false;
    const endTag=lower.indexOf("</script",headerEnd+1);
    if(endTag<0)return false;
    const next=lower.indexOf(">",endTag+8);
    if(next<0)return false;
    const body=norm(html.slice(headerEnd+1,endTag));
    if(variants.some(n=>body.includes(n)))return true;
    from=next+1;
  }
  return false;
}
/**
 * Bounded technical diagnostics only. Script/OG/raw-HTML matches must not be
 * used for SKU verification, market inference, formulation or Fact admission.
 */
export function inspectTrustP3OfficialPageShape(bytes,product,{contentType=""}={}){
  const buffer=Buffer.from(bytes??"");
  if(!buffer.length||buffer.length>LIMIT||!product?.id)
    throw Error("TRUST_P3_PAGE_SHAPE_INVALID_INPUT");
  const html=buffer.toString("utf8");
  const sem=inspectOfficialProductSemanticSurfacesV1(buffer);
  const visible=inspectTrustVisibleProductIdentity(buffer,product);
  const expected=names(product);
  const document=sem.document??{};
  const schema=sem.structured_product_names??[];
  const lower=html.toLowerCase();
  const result={
    contract:TRUST_P3_PAGE_SHAPE_VERSION,bytes:buffer.length,
    declaredCharset:readCharset(contentType)??readCharset(html.slice(0,8192))??"unspecified",
    titlePresent:!!document.title,titleNameMatch:nameMatch(document.title,expected),
    ogTitlePresent:!!document.og_title,ogTitleNameMatch:nameMatch(document.og_title,expected),
    schemaProductCount:sem.structured_product_count??0,
    schemaProductNameMatch:schema.some(n=>nameMatch(n,expected)),
    h1Count:Math.min(lower.split("<h1").length-1,100),
    rawMarkupNameMention:expected.some(n=>norm(html).includes(n)),
    visibleTextNameMention:visible.bodyMention===true||visible.scopedHeadingCount>0,
    scriptNameMention:findScriptNameMention(html,expected),
    likelyChallengeTitle:/^(?:just a moment|access denied|403 forbidden|service unavailable|보안 확인)/iu.test(document.title??""),
    marketVerified:false,formulationVerified:false,
    exactSkuVerified:false,factConfirmationAuthorized:false,
  };
  return Object.freeze(result);
}
