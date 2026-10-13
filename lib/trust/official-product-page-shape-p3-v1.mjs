import { inspectOfficialProductSemanticSurfacesV1,normalizeSemanticTextV1 }
  from "./official-source-semantic-adapter.mjs";

export const TRUST_P3_PAGE_SHAPE_VERSION="trust-p3-official-page-shape-v1";
const LIMIT=2*1024*1024;
function norm(value){
  return normalizeSemanticTextV1(value??"").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim();
}
function names(product){
  return [...new Set([product?.name,product?.name_en,product?.normalized_name]
    .map(norm).filter(v=>v.length>=6))];
}
function nameMatch(value,variants){
  const n=norm(value);
  return variants.some(v=>n===v||n.startsWith(v+" ")||n.endsWith(" "+v));
}
function encoding(contentType,html){
  const header=String(contentType??"").match(/(?:^|;)\s*charset\s*=\s*["']?([a-zA-Z0-9_-]{1,32})/i);
  const meta=html.slice(0,8192).match(/<meta\b[^>]*charset\s*=\s*["']?([a-zA-Z0-9_-]{1,32})/i);
  return (header?.[1]??meta?.[1]??"UNSPECIFIED").toLowerCase();
}
/**
 * Technical diagnosis of fetched bytes. No identity/variant/market/Fact
 * authority. A name in a script, OG meta or raw markup is NOT a SKU proof.
 */
export function inspectTrustP3OfficialPageShape(bytes,product,{contentType=""}={}){
  const buffer=Buffer.from(bytes??"");
  if(!buffer.length||buffer.length>LIMIT||!product?.id)
    throw Error("TRUST_P3_PAGE_SHAPE_INVALID_INPUT");
  const html=buffer.toString("utf8");
  const sem=inspectOfficialProductSemanticSurfacesV1(buffer);
  const expected=names(product);
  const document=sem.document??{};
  const schema=sem.structured_product_names??[];
  const h1=(html.match(/<h1\b/gi)??[]).length;
  const scripts=html.match(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)??[];
  const bodyWithoutScripts=html.replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi," ")
    .replace(/<!--[\s\S]*?-->/g," ").replace(/<[^>]+>/g," ");
  const raw=norm(html);
  const visible=norm(bodyWithoutScripts);
  const scriptMatches=scripts.some(script=>expected.some(name=>norm(script).includes(name)));
  const result={
    contract:TRUST_P3_PAGE_SHAPE_VERSION,bytes:buffer.length,
    declaredCharset:encoding(contentType,html),
    titlePresent:!!document.title,titleNameMatch:nameMatch(document.title,expected),
    ogTitlePresent:!!document.og_title,ogTitleNameMatch:nameMatch(document.og_title,expected),
    schemaProductCount:sem.structured_product_count??0,
    schemaProductNameMatch:schema.some(name=>nameMatch(name,expected)),
    h1Count:Math.min(h1,100),
    rawMarkupNameMention:expected.some(name=>raw.includes(name)),
    visibleTextNameMention:expected.some(name=>visible.includes(name)),
    scriptNameMention:scriptMatches,
    likelyChallengeTitle:/^(?:just a moment|access denied|403 forbidden|service unavailable|보안 확인)/iu.test(document.title??""),
    marketVerified:false,formulationVerified:false,
    exactSkuVerified:false,factConfirmationAuthorized:false,
  };
  return Object.freeze(result);
}
