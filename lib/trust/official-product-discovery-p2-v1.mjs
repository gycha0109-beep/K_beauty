import { fetchOfficialBytes, fetchOfficialSitemapBytes, sha256Hex } from "./official-source-fetch.mjs";
import { discoverOfficialSourceCandidates, REDISCOVERY_CONTRACT } from "./official-source-rediscovery.mjs";
import { inspectOfficialProductSemanticSurfacesV1, normalizeSemanticTextV1 } from "./official-source-semantic-adapter.mjs";
import { buildTrustOfficialDiscoveryRequests } from "./brand-official-frontier-v1.mjs";
import { findTrustP2BOfficialPeerLinks } from "./official-peer-index-links-v1.mjs";

export const TRUST_P2_DISCOVERY_VERSION="trust-p2-official-discovery-v1";
const USER_AGENT="BEJEWELY-Trust-Research";
const MAX_ORIGINS=2;
const MAX_SITEMAPS=2;
const MAX_PAGES=2;
const REDIRECTS=new Set([301,302,303,307,308]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(code){throw new Error(code);}
function normalized(value){
  return normalizeSemanticTextV1(value??"").toLowerCase()
    .replace(/[-_]+/g," ").replace(/[^\p{L}\p{N}]+/gu," ")
    .replace(/\s+/g," ").trim();
}
function escapeLiteral(value){
  return [...value].map(c=>"\\^$.*+?()[]{}|".includes(c)?"\\"+c:c).join("");
}
function robotsPattern(pattern){
  const end=pattern.endsWith("$");
  const raw=end?pattern.slice(0,-1):pattern;
  return new RegExp("^"+raw.split("*").map(escapeLiteral).join(".*")+(end?"$":""));
}
function robotsGroups(bytes){
  const text=Buffer.from(bytes).toString("utf8");
  if(text.length>128*1024)fail("TRUST_P2_ROBOTS_TOO_LARGE");
  const groups=[];let current=null;let rulesStarted=false;
  for(const original of text.split(/\r?\n/)){
    const line=original.replace(/#.*$/,"").trim();
    if(!line)continue;
    const colon=line.indexOf(":");if(colon<=0)continue;
    const field=line.slice(0,colon).trim().toLowerCase();
    const value=line.slice(colon+1).trim();
    if(field==="user-agent"){
      if(!current||rulesStarted){current={agents:[],rules:[],delay:null};groups.push(current);rulesStarted=false;}
      current.agents.push(value.toLowerCase());
    }else if(current&&current.agents.length){
      if(["allow","disallow"].includes(field)){
        rulesStarted=true;
        if(value)current.rules.push({type:field,path:value});
      }else if(field==="crawl-delay"){
        rulesStarted=true;
        const delay=Number(value);
        current.delay=Number.isFinite(delay)&&delay>=0?delay:Infinity;
      }
    }
  }
  return groups;
}
/** Conservative robots policy: most specific user-agent and longest path.
 * Reject sites with positive crawl-delay rather than ignoring required pacing. */
export function createTrustRobotsPolicy(bytes,agent=USER_AGENT){
  const groups=robotsGroups(bytes);
  const name=agent.toLowerCase();
  const matching=groups.map(group=>{
    const m=group.agents.reduce((best,ua)=>{
      if(ua==="*")return Math.max(best,1);
      return name.includes(ua)?Math.max(best,ua.length+1):best;
    },0);
    return {group,m};
  }).filter(x=>x.m>0);
  if(!matching.length)return {allowed:()=>true,delayBlocked:false};
  const highest=Math.max(...matching.map(x=>x.m));
  const chosen=matching.filter(x=>x.m===highest).map(x=>x.group);
  const delayBlocked=chosen.some(x=>x.delay!==null&&x.delay>0);
  const rules=chosen.flatMap(x=>x.rules);
  return {
    delayBlocked,
    allowed(url){
      if(delayBlocked)return false;
      const u=typeof url==="string"?new URL(url):url;
      const path=u.pathname+u.search;
      let best=-1;let accepted=true;
      for(const rule of rules){
        const matches=robotsPattern(rule.path).test(path);
        if(!matches)continue;
        const rank=rule.path.replace(/[*$]/g,"").length;
        if(rank>best||(rank===best&&rule.type==="disallow")){
          best=rank;accepted=rule.type==="allow";
        }
      }
      return accepted;
    },
  };
}
/** A source's DNS/SSRF validation remains owned by the existing fetcher. */
export function strictOriginTransport(fetchImpl,origin,policy=null){
  if(typeof fetchImpl!=="function")fail("TRUST_P2_TRANSPORT_REQUIRED");
  return async (requested,options)=>{
    const url=new URL(String(requested));
    if(url.origin!==origin||url.protocol!=="https:"||url.username||
      url.password||(policy&&!policy.allowed(url)))
      fail("TRUST_P2_ORIGIN_OR_ROBOTS_BLOCKED");
    const response=await fetchImpl(requested,options);
    // No cross-site or policy-changing redirect is ever followed.
    if(REDIRECTS.has(response.status))return new Response("",{status:403});
    return response;
  };
}
function classifyPage(bytes,product){
  const sem=inspectOfficialProductSemanticSurfacesV1(bytes);
  const names=[product.name,product.name_en,product.normalized_name]
    .map(normalized).filter(v=>v.length>=6);
  if(!names.length)return {status:"IDENTITY_UNRESOLVED",title:null,identitySurface:null};
  const structured=(sem.structured_product_names??[])
    .map(normalized).filter(Boolean);
  const exact=structured.some(x=>names.includes(x));
  const title=sem.document?.title||sem.document?.og_title||null;
  const nt=normalized(title);
  const titleMatch=names.some(n=>nt===n||nt.startsWith(n+" ")||
    nt.endsWith(" "+n)||nt.includes(" "+n+" "));
  return {
    status:exact?"STRUCTURED_NAME_CANDIDATE":titleMatch?"TITLE_NAME_CANDIDATE":"IDENTITY_UNRESOLVED",
    title:typeof title==="string"?title.slice(0,180):null,
    identitySurface:exact?"product_jsonld_name":titleMatch?"page_title":null,
  };
}
/** A matching name never proves exact SKU, market, or formulation. */
export function classifyTrustOfficialCandidatePage(bytes,product){
  if(!bytes||!product||!UUID.test(product.id??""))
    fail("TRUST_P2_PRODUCT_INVALID");
  return Object.freeze({...classifyPage(bytes,product),sha256:sha256Hex(bytes),
    marketVerified:false,formulationVerified:false,
    subjectCreationAuthorized:false,factConfirmationAuthorized:false});
}
function publicDisposition(detail) {
  const msg=String(detail??"");
  if(msg==="FETCHED")return "FETCHED";
  if(msg.startsWith("TRANSIENT_FAILURE:"))return "TRANSIENT_FAILURE";
  return "SOURCE_BLOCKED";
}
function tidyOrigin(origin) {
  const u=new URL(origin);
  if(u.protocol!=="https:"||u.username||u.password||
    (u.port&&u.port!=="443")||u.pathname!=="/"||u.search||u.hash)
    fail("TRUST_P2_UNSAFE_ORIGIN");
  return u.origin;
}
/** Read-only. No request before robots.txt is retrieved and checked. */
export async function runTrustP2Discovery(row,product,{fetchRobots,fetchSitemap,fetchPage}={}){
  if(typeof fetchRobots!=="function"||typeof fetchSitemap!=="function"||
    typeof fetchPage!=="function")fail("TRUST_P2_FETCH_BOUNDARY_REQUIRED");
  const requests=buildTrustOfficialDiscoveryRequests(row,product).slice(0,MAX_ORIGINS);
  const sites=[];
  for(const request of requests){
    const seed=row.discoveryOrigins.find(x=>new URL(x.origin).hostname===request.allowed_hosts[0]);
    const origin=tidyOrigin(seed?.origin??"");
    let robots,policy;
    try{
      robots=await fetchRobots(origin+"/robots.txt",origin);
      policy=createTrustRobotsPolicy(robots.bytes);
    }catch{
      sites.push({origin,status:"ROBOTS_UNAVAILABLE",candidates:[],pages:[]});
      continue;
    }
    if(policy.delayBlocked){
      sites.push({origin,status:"CRAWL_DELAY_NOT_SUPPORTED",candidates:[],pages:[]});
      continue;
    }
    const surfaces=request.discovery_surfaces
      .slice(0,MAX_SITEMAPS)
      .filter(s=>s.kind==="sitemap"&&policy.allowed(s.url));
    if(!surfaces.length){
      sites.push({origin,status:"ROBOTS_DISALLOWED",candidates:[],pages:[]});
      continue;
    }
    const args={...request,contract:REDISCOVERY_CONTRACT,
      case_id:row.intakeId,discovery_surfaces:surfaces,
      max_sitemaps:MAX_SITEMAPS,candidate_limit:MAX_PAGES,
      external_search_seeds:[]};
    const discovered=await discoverOfficialSourceCandidates(args,{
      fetchHtml:async()=>{fail("TRUST_P2_HTML_INDEX_NOT_ALLOWED");},
      fetchSitemap:async url=>{
        if(new URL(url).origin!==origin||!policy.allowed(url))
          fail("SOURCE_BLOCKED:robots_or_origin");
        return fetchSitemap(url,origin,policy);
      },
    });
    // Some official catalogs (e.g. numeric goodsNo routes) cannot be matched
    // from sitemap URL tokens. At most one governed PEER page may supply an
    // exact visible-link label for the target product. It remains unverified.
    const peerLinks=[];
    for(const peerUrl of (request.peer_official_index_urls??[]).slice(0,1)){
      if(new URL(peerUrl).origin!==origin||!policy.allowed(peerUrl))continue;
      try {
        const peer=await fetchPage(peerUrl,origin,policy);
        if(new URL(peer.finalUrl).origin!==origin||!policy.allowed(peer.finalUrl))
          fail("TRUST_P2_PEER_REDIRECT_SCOPE");
        peerLinks.push(...findTrustP2BOfficialPeerLinks(peer.bytes,peer.finalUrl,product,{max:MAX_PAGES}));
      }catch {
        // Peer index is optional, never authority for a target product.
      }
    }
    const discoveredLocators=[
      ...peerLinks,
      ...discovered.candidates.map(c=>c.candidate_locator),
    ].filter((v,i,a)=>a.indexOf(v)===i).slice(0,MAX_PAGES);
    const pages=[];
    for(const url of discoveredLocators){
      if(new URL(url).origin!==origin||!policy.allowed(url)){
        pages.push({url,status:"ROBOTS_DISALLOWED"});
        continue;
      }
      try{
        const fetched=await fetchPage(url,origin,policy);
        if(new URL(fetched.finalUrl).origin!==origin||
          !policy.allowed(fetched.finalUrl))fail("TRUST_P2_REDIRECT_SCOPE");
        pages.push({url:fetched.finalUrl,
          ...classifyTrustOfficialCandidatePage(fetched.bytes,product)});
      }catch(error){
        pages.push({url,status:publicDisposition(error?.message)});
      }
    }
    sites.push({origin,status:discoveredLocators.length?
        "CANDIDATES_DISCOVERED":discovered.disposition,
      candidateCount:discoveredLocators.length,peerIndexCandidateCount:peerLinks.length,pages,
      observations:discovered.surface_observations.map(o=>({
        kind:o.kind,status:publicDisposition(o.status),
        fetched:o.status==="FETCHED",
      }))});
  }
  return Object.freeze({
    version:TRUST_P2_DISCOVERY_VERSION,productId:row.productId,intakeId:row.intakeId,
    sites,readOnly:true,officialProductEvidenceConfirmed:false,
    marketVerified:false,formulationVerified:false,subjectCreationAuthorized:false,
    factWrites:0,recommendationWrites:0,aiApiCalls:0,
  });
}
/** Live adapter is SSRF-safe, request-timed and byte-bounded. */
export function trustP2LiveFetchers(fetchImpl=fetch){
  return {
    fetchRobots:(url,origin)=>fetchOfficialBytes(url,strictOriginTransport(fetchImpl,origin)),
    fetchSitemap:(url,origin,policy)=>fetchOfficialSitemapBytes(url,strictOriginTransport(fetchImpl,origin,policy)),
    fetchPage:(url,origin,policy)=>fetchOfficialBytes(url,strictOriginTransport(fetchImpl,origin,policy)),
  };
}
