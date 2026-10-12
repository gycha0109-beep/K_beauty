import { normalizeSemanticTextV1 } from "./official-source-semantic-adapter.mjs";
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
  const html=bytes.toString("utf8");
  const pattern=/<a\b[^>]*?href\s*=\s*(?:"([^"]{1,2048})"|'([^']{1,2048})')[^>]*>([\s\S]{1,800}?)<\/a\s*>/gi;
  const found=new Set();
  for(const match of html.matchAll(pattern)){
    const label=plain(match[3]);
    if(!names.some(n=>label===n||label.startsWith(n+" ")||
      label.endsWith(" "+n)))continue;
    let u;
    try{u=new URL(decodeHref(match[1]??match[2]),peer);}
    catch{continue;}
    if(u.origin!==peer.origin||u.protocol!=="https:"||
      u.username||u.password||u.hash||u.href.length>2048||
      !(/^\/goods\/goods_view\.php$/i.test(u.pathname)||
        /^\/(products|product|shop|item)\//i.test(u.pathname)))
      continue;
    found.add(u.href);
    if(found.size>=max)break;
  }
  return [...found].sort();
}
