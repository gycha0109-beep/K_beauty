import { normalizeSemanticTextV1 } from "./official-source-semantic-adapter.mjs";
import { inspectTrustOfficialVariantScope } from "./official-variant-scope-v1.mjs";
export const TRUST_P2B_PEER_LINK_VERSION="trust-p2b-governed-peer-link-v1";
function plain(value){
  return normalizeSemanticTextV1(value).normalize("NFKC").toLowerCase()
    .replace(/<[^>]*>/g," ")
    .replace(/[-_]+/g," ")
    .replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim();
}
function decodeHref(text) {
  return String(text).replace(/&amp;/gi,"&").replace(/&quot;/gi,'"');
}
/**
 * Only a recognized, visible link label on an independently governed
 * official PEER product page is a URL discovery candidate.
 * Never establishes identity/market/formulation Fact authority.
 */
export function findTrustP2BOfficialPeerLinks(bytes,peerUrl,target,{max=2}={}){
  if(!Buffer.isBuffer(bytes)||bytes.byteLength>2*1024*1024||
    !target||!peerUrl||!Number.isInteger(max)||max<1||max>3)
    throw new Error("TRUST_P2B_PEER_INVALID");
  const peer=new URL(peerUrl);
  if(peer.protocol!=="https:")throw new Error("TRUST_P2B_PEER_ORIGIN");
  const names=[target.name,target.name_en,target.normalized_name]
    .filter(x=>typeof x==="string").map(plain).filter(x=>x.length>=6);
  if(!names.length)return [];
  const brand=plain(target.brand??"");
  function labelCandidatePriority(raw){
    // Only visible anchor text determines the unverified locator's priority.
    // 2 = explicit catalog-sized label, 1 = otherwise plausible label.
    const visible=normalizeSemanticTextV1(String(raw).replace(/<[^>]*>/g," "));
    let label=plain(visible).replace(/^(?:new|신상)\s+/iu,"");
    if(brand&&label.startsWith(brand+" "))label=label.slice(brand.length+1);
    const matched=names.some(name=>{
      if(label===name)return true;
      if(!label.startsWith(name+" "))return false;
      const suffix=label.slice(name.length).trim();
      return Boolean(suffix)&&suffix.split(" ").every(token=>
        /^(?:\d+(?:\.\d+)?(?:ml|g|매|개|장)|x\d+|x|\d+)$/iu.test(token));
    });
    if(!matched)return 0;
    // Apply bundle and variant rejection even to exact catalog-name labels.
    if(/\d+\s*(?:ml|mℓ|g|매|개|장)?\s*[+＋]\s*\d+|증정|사은품|세트|기획|묶음|리필/iu.test(visible))
      return 0;
    const quantities=label.match(/\d+(?:\.\d+)?(?:ml|g|매|개|장)/giu)??[];
    if(quantities.length>1)return 0;
    const scope=inspectTrustOfficialVariantScope(visible,target);
    if(["CATALOG_SIZE_MISMATCH","SIZE_CONFLICT_REVIEW_REQUIRED",
      "BUNDLE_VARIANT_REVIEW_REQUIRED"].includes(scope.status))return 0;
    return scope.status==="SIZE_MATCH_CANDIDATE"?2:1;
  }
  const html=bytes.toString("utf8");
  const pattern=/<a\b[^>]*?href\s*=\s*(?:"([^"]{1,2048})"|'([^']{1,2048})')[^>]*>([\s\S]{1,800}?)<\/a\s*>/gi;
  const found=new Map();
  let anchorsSeen=0;
  for(const match of html.matchAll(pattern)){
    // Bounded scan lets a precise size link outrank earlier vague labels
    // without increasing the number of network fetches.
    if(++anchorsSeen>256)break;
    const priority=labelCandidatePriority(match[3]);
    if(!priority)continue;
    let u;
    try{u=new URL(decodeHref(match[1]??match[2]),peer);}
    catch{continue;}
    if(u.origin!==peer.origin||u.protocol!=="https:"||
      u.username||u.password||u.hash||u.href.length>2048||
      !(/^\/goods\/goods_view\.php$/i.test(u.pathname)||
        /^\/(?:m\/)?product_detail\.html$/i.test(u.pathname)||
        /^\/product\/detail\.html$/i.test(u.pathname)||
        /^\/(products|product|shop|item)\//i.test(u.pathname)))
      continue;
    found.set(u.href,Math.max(priority,found.get(u.href)??0));
  }
  return [...found.entries()]
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .slice(0,max).map(([url])=>url);
}
