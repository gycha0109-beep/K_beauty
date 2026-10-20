import { fetchOfficialBytes, fetchOfficialSitemapBytes, sha256Hex } from "./official-source-fetch.mjs";
import { discoverOfficialSourceCandidates, REDISCOVERY_CONTRACT } from "./official-source-rediscovery.mjs";
import { inspectOfficialProductSemanticSurfacesV1, normalizeSemanticTextV1 } from "./official-source-semantic-adapter.mjs";
import { buildTrustOfficialDiscoveryRequests } from "./brand-official-frontier-v1.mjs";
import { findTrustP2BOfficialPeerLinks } from "./official-peer-index-links-v1.mjs";
import { inspectTrustVisibleProductIdentity } from "./official-visible-identity-v1.mjs";
import { inspectTrustOfficialVariantScope } from "./official-variant-scope-v1.mjs";
import { inspectTrustP3StrictPrimaryRoot } from "./official-primary-root-dom-p3-v1.mjs";
import { diagnoseTrustP2FetchFailure } from "./official-fetch-failure-diagnostic-v1.mjs";
import { inspectTrustP2CatalogUnitOfferScope } from "./official-catalog-unit-offer-scope-v1.mjs";

export const TRUST_P2_DISCOVERY_VERSION="trust-p2-official-discovery-v1";
const USER_AGENT="BEJEWELY-Trust-Research";
const MAX_ORIGINS=2;
const MAX_SITEMAPS=2;
const MAX_PAGES=2;
export const TRUST_P2_PRE_RESOLVED_KIND="PRE_RESOLVED_OFFICIAL_PRODUCT_URL";
const TRUST_P2_PRE_RESOLVED_SOURCE="OPERATOR_SUPPLIED_PUBLIC_URL";
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
export function strictOriginTransport(fetchImpl,origin,policy=null,{diagnoseRedirect=false}={}){
  if(typeof fetchImpl!=="function")fail("TRUST_P2_TRANSPORT_REQUIRED");
  return async (requested,options)=>{
    const url=new URL(String(requested));
    if(url.origin!==origin||url.protocol!=="https:"||url.username||
      url.password||(policy&&!policy.allowed(url)))
      fail("TRUST_P2_ORIGIN_OR_ROBOTS_BLOCKED");
    const response=await fetchImpl(requested,options);
    // No cross-site or policy-changing redirect is ever followed.
    if(REDIRECTS.has(response.status)){
      if(diagnoseRedirect)fail("SOURCE_BLOCKED:redirect_response");
      return new Response("",{status:403});
    }
    return response;
  };
}
function isGenericBrandPageTitle(title,brand){
  const page=normalized(title),b=normalized(brand);
  // Generic shop/brand-only titles are not authoritative product headings.
  // No brand-specific special cases or hard-coded product identifiers.
  return Boolean(page&&b&&(page===b||
    (page.startsWith(b+" ")&&page.length<=b.length+26&&
      page.split(" ").length<=3)));
}
/**
 * Stage enums are diagnostic only. No HTML, selectors, names, source options,
 * attributes or full P3 result are exposed by the P2 source record.
 * Historical snapshots lacking these fields remain valid and unchanged.
 */
function rootFailureStage(root,scopedNameAndSize){
  if(scopedNameAndSize)return "SCOPED_SELECTED_SIZE_SHADOW_ONLY";
  if(root.parseComplete!==true)return "STRICT_DOM_PARSER_HOLD";
  if(root.status==="PRIMARY_ROOT_AMBIGUOUS")return "MULTIPLE_PRIMARY_ROOTS_HOLD";
  if(!root.rootMarkers)return "NO_RECOGNIZED_PRIMARY_ROOT";
  if(!root.matchedTitles)return root.rootBodyNameMentionCount>0?
    "ROOT_BODY_NAME_WITHOUT_SCOPED_TITLE_HOLD":"NO_MATCHING_SCOPED_TITLE";
  if(!root.matchedRoots)return "MATCHING_TITLE_OUTSIDE_PRIMARY_ROOT_HOLD";
  if(root.status==="COMPETING_PRODUCT_TITLE")return "COMPETING_PRODUCT_TITLE_HOLD";
  if(!root.ownedFormCount)return "NO_OWNED_PURCHASE_FORM_HOLD";
  if(!root.ownedOptionControlCount)return "NO_OWNED_SIZE_CONTROL_HOLD";
  return "SELECTED_SIZE_SHADOW_NOT_MATCHED_HOLD";
}
const boundedP3Count=value=>Number.isInteger(value)&&value>=0?
  Math.min(99,value):0;
const P3_TITLE_RELATIONS=new Set([
  "NO_MARKED_TITLE_IN_ROOT",
  "MARKED_TITLE_CATALOG_NAME_MATCH",
  "MARKED_TITLE_EMBEDS_CATALOG_NAME_BUT_FAILS_MATCH",
  "MARKED_TITLE_PARTIAL_CATALOG_TOKEN_OVERLAP",
  "MARKED_TITLE_NO_CATALOG_NAME_RELATION",
]);
function safeP3TitleMismatchFingerprint(raw){
  if(!raw||typeof raw!=="object")return null;
  const optionalCount=value=>value===null?null:boundedP3Count(value);
  return Object.freeze({
    recognizedTitlesWithinRootCount:boundedP3Count(raw.recognizedTitlesWithinRootCount),
    recognizedTitlesOutsideRootCount:boundedP3Count(raw.recognizedTitlesOutsideRootCount),
    catalogRelation:P3_TITLE_RELATIONS.has(raw.catalogRelation)?
      raw.catalogRelation:"UNDETERMINED_HOLD",
    unmarkedNameProbeComplete:raw.unmarkedNameProbeComplete===true,
    unmarkedCatalogNameHeadingCount:
      optionalCount(raw.unmarkedCatalogNameHeadingCount),
    unmarkedCatalogNameInlineCount:
      optionalCount(raw.unmarkedCatalogNameInlineCount),
  });
}

const P3_EMBEDDED_REVIEW_STAGES=new Set([
  "REVIEW_SCAN_BUDGET_HOLD",
  "STRICT_MATCH_TITLE_PRESENT_HOLD",
  "MULTIPLE_MARKED_TITLE_NODES_HOLD",
  "NO_MARKED_TITLE_HOLD",
  "NO_FULL_CATALOG_NAME_EMBED_HOLD",
  "OFFER_OR_BUNDLE_TITLE_HOLD",
  "HIDDEN_MARKED_TITLE_HOLD",
  "TITLE_OUTSIDE_PRODUCT_ROOT_HOLD",
  "AMBIGUOUS_TITLE_ROOT_HOLD",
  "UNIQUE_OWNED_FORM_NOT_PROVEN_HOLD",
  "CROSS_PRODUCT_FORM_HOLD",
  "OWNED_OPTION_CONTROL_MISSING_HOLD",
  "SELECTED_CATALOG_SIZE_NOT_MATCHED_HOLD",
  "EMBEDDED_TITLE_OWNED_SELECTED_SIZE_REVIEW_ONLY",
]);
const P3_SELECTED_SIZE_HOLDS=new Set([
  "INVALID_OR_UNBOUNDED_INPUT_HOLD",
  "FORM_OWNERSHIP_AMBIGUOUS_HOLD",
  "CONTROL_OPTION_LIMIT_HOLD",
  "RADIO_GROUP_AMBIGUOUS_HOLD",
  "MULTIPLE_SIZE_GROUPS_HOLD",
  "NO_SCOPED_SIZE_CONTROL_HOLD",
  "NO_EXPLICIT_SELECTED_SIZE_HOLD",
  "MULTIPLE_EXPLICIT_SELECTIONS_HOLD",
  "SELECTED_CONTROL_DISABLED_HOLD",
  "BUNDLE_OR_SET_HOLD",
  "NON_ML_UNIT_HOLD",
  "VALUE_LABEL_CONFLICT_HOLD",
  "SELECTED_SIZE_NOT_UNIQUE_HOLD",
  "SELECTED_SIZE_MISMATCH_HOLD",
  "SELECTED_SIZE_MATCH_SHADOW_ONLY",
]);
function safeP3EmbeddedTitleReviewShadow(raw){
  if(!raw||typeof raw!=="object")return null;
  const status=P3_EMBEDDED_REVIEW_STAGES.has(raw.status)?
    raw.status:"REVIEW_SCAN_BUDGET_HOLD";
  const selectedSizeStatus=P3_SELECTED_SIZE_HOLDS.has(raw.selectedSizeStatus)?
    raw.selectedSizeStatus:null;
  return Object.freeze({
    status,
    // Diagnostic candidate is never promoted to nameSignal/page identity.
    reviewCandidate:status==="EMBEDDED_TITLE_OWNED_SELECTED_SIZE_REVIEW_ONLY"&&
      raw.reviewCandidate===true&&
      selectedSizeStatus==="SELECTED_SIZE_MATCH_SHADOW_ONLY",
    embeddedTitleCount:boundedP3Count(raw.embeddedTitleCount),
    matchedRootCount:boundedP3Count(raw.matchedRootCount),
    ownedFormCount:boundedP3Count(raw.ownedFormCount),
    ownedOptionControlCount:boundedP3Count(raw.ownedOptionControlCount),
    selectedSizeStatus,
    exactSkuVerified:false,
  });
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
  const visible=!exact&&!titleMatch?
    inspectTrustVisibleProductIdentity(bytes,product):null;
  const genericBrandTitle=!exact&&!titleMatch&&
    isGenericBrandPageTitle(title,product.brand);
  // P2 only consumes P3's already-existing strict root + selected-size
  // shadow signal. No ownership, selection or SKU authority is promoted.
  const primaryRoot=genericBrandTitle?
    inspectTrustP3StrictPrimaryRoot(bytes,product):null;
  const strictRootAndSizeCandidate=primaryRoot?.status===
    "SCOPED_NAME_AND_FORM_CANDIDATE"&&
    primaryRoot.selectedVariantShadow?.status==="SELECTED_SIZE_MATCH_SHADOW_ONLY";
  const signalStatus=exact?"STRUCTURED_NAME_CANDIDATE":
    titleMatch?"TITLE_NAME_CANDIDATE":
    genericBrandTitle?(strictRootAndSizeCandidate?
      "SCOPED_HEADING_CANDIDATE":
      visible?.status==="BODY_NAME_MENTION_ONLY"?
        "BODY_NAME_MENTION_ONLY":"IDENTITY_UNRESOLVED"):
    visible.status;
  const variantScope=inspectTrustOfficialVariantScope(title,product);
  const unitOfferScope=inspectTrustP2CatalogUnitOfferScope(title,product);
  const unitOrOfferBlocked=[
    "UNIT_AND_OFFER_MISMATCH_REVIEW_REQUIRED",
    "UNIT_MISMATCH_REVIEW_REQUIRED",
    "OFFER_COMPOSITION_REVIEW_REQUIRED",
  ].includes(unitOfferScope.status);
  const variantBlocked=["CATALOG_SIZE_MISMATCH","SIZE_CONFLICT_REVIEW_REQUIRED",
    "BUNDLE_VARIANT_REVIEW_REQUIRED"].includes(variantScope.status);
  const nameSignal=["STRUCTURED_NAME_CANDIDATE","TITLE_NAME_CANDIDATE",
    "SCOPED_HEADING_CANDIDATE"].includes(signalStatus);
  return {
    status:nameSignal&&variantBlocked?variantScope.status:
      nameSignal&&unitOrOfferBlocked?unitOfferScope.status:signalStatus,
    nameSignalStatus:signalStatus,variantScope,unitOfferScope,
    title:typeof title==="string"?title.slice(0,180):null,
    identitySurface:exact?"product_jsonld_name":titleMatch?"page_title":
      strictRootAndSizeCandidate?"p3_primary_root_selected_size_shadow":
      genericBrandTitle?"unverified_generic_brand_title":visible.surface,
    ...(genericBrandTitle?{primaryRootDiagnostic:{
      status:primaryRoot.status,
      holdStage:rootFailureStage(primaryRoot,strictRootAndSizeCandidate),
      parseComplete:primaryRoot.parseComplete===true,
      rootMarkerCount:boundedP3Count(primaryRoot.rootMarkers),
      titleMarkerCount:boundedP3Count(primaryRoot.titleMarkerCount),
      rootBodyNameMentionCount:boundedP3Count(
        primaryRoot.rootBodyNameMentionCount),
      titleMismatchFingerprint:safeP3TitleMismatchFingerprint(
        primaryRoot.titleMismatchFingerprint),
      embeddedTitleReviewShadow:safeP3EmbeddedTitleReviewShadow(
        primaryRoot.embeddedTitleReviewShadow),
      matchedRootCount:boundedP3Count(primaryRoot.matchedRoots),
      matchedTitleCount:boundedP3Count(primaryRoot.matchedTitles),
      ownedFormCount:boundedP3Count(primaryRoot.ownedFormCount),
      ownedOptionControlCount:boundedP3Count(primaryRoot.ownedOptionControlCount),
      selectedSizeStatus:primaryRoot.selectedVariantShadow?.status??null,
      scopedNameAndSizeCandidate:Boolean(strictRootAndSizeCandidate),
      exactSkuVerified:false,
    }}:{}),
    // Body-only mention NEVER means that the target SKU was identified.
    identityAuthority:"NONE",
    marketVerified:false,formulationVerified:false,
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
/**
 * Pure URL prefetch priority: 2 explicit catalog-size candidate, 1 unknown
 * size, 0 rejected. Product URL text is never exact-SKU evidence.
 * Shared by sitemap pre-truncation ordering and the final 2-page selection.
 */
function trustP2LocatorPriority(raw,product,{origin=null,policy=null}={}){
  let url,decoded;
  try{
    url=new URL(raw);
    decoded=decodeURIComponent(url.pathname+" "+url.search);
  }catch{return 0;}
  if(url.protocol!=="https:"||url.username||url.password||url.hash||
    (origin!==null&&url.origin!==origin)||
    (policy!==null&&!policy.allowed(url)))return 0;
  // Explicit offer/pack locators are excluded, not silently confirmed.
  if(/(?:^|[-/_\s])(?:kit|bundle|refill|gift|giveaway|set|multi-?pack)(?=$|[-/_\s])|1\s*\+\s*1/iu.test(decoded))
    return 0;
  const scope=inspectTrustOfficialVariantScope(decoded,product);
  if(["CATALOG_SIZE_MISMATCH","SIZE_CONFLICT_REVIEW_REQUIRED",
    "BUNDLE_VARIANT_REVIEW_REQUIRED"].includes(scope.status))return 0;
  return scope.status==="SIZE_MATCH_CANDIDATE"?2:1;
}
// Only RFC3986 unreserved %-escapes are equivalent to literal URL characters.
// Keep the original vetted URL for fetch/evidence, preserving encoded reserved
// delimiters (e.g. %2F slash) and parameter order as distinct locators.
function trustP2EquivalentLocatorKey(href){
  return href.replace(/%([0-9a-fA-F]{2})/gu,(escaped,hex)=>{
    const code=Number.parseInt(hex,16);
    const unreserved=(code>=48&&code<=57)||(code>=65&&code<=90)||
      (code>=97&&code<=122)||code===45||code===46||code===95||code===126;
    return unreserved?String.fromCharCode(code):escaped.toUpperCase();
  });
}

/**
 * Typed, non-authoritative operator-provided discovery candidates.
 * Validate the entire input before the first robots/network callback.
 * The origin is pinned to existing official discovery seeds, never supplied
 * as an additional trusted host. A URL cannot establish exact SKU identity.
 */
export function validateTrustP2PreResolvedLocators(entries,row,product){
  if(!Array.isArray(entries)||entries.length>MAX_PAGES||
    !product||!UUID.test(product.id??"")||product.id!==row?.productId||
    !Array.isArray(row.discoveryOrigins))fail("TRUST_P2_PRE_RESOLVED_INPUT_INVALID");
  const origins=new Set(row.discoveryOrigins.map(x=>tidyOrigin(x.origin)));
  const seen=new Set();
  return entries.map(entry=>{
    if(!entry||typeof entry!=="object"||Array.isArray(entry)||
      entry.kind!==TRUST_P2_PRE_RESOLVED_KIND||
      entry.source!==TRUST_P2_PRE_RESOLVED_SOURCE||
      entry.productId!==product.id||typeof entry.origin!=="string"||
      typeof entry.url!=="string"||entry.url.length>2048||
      /[\\\s\u0000-\u001f\u007f]/u.test(entry.url))
      fail("TRUST_P2_PRE_RESOLVED_INPUT_INVALID");
    let url;
    try{
      url=new URL(entry.url);
      decodeURIComponent(url.pathname+url.search);
    }catch{fail("TRUST_P2_PRE_RESOLVED_URL_INVALID");}
    if(!origins.has(entry.origin)||url.origin!==entry.origin||
      url.protocol!=="https:"||url.username||url.password||
      (url.port&&url.port!=="443")||url.hash||
      seen.has(trustP2EquivalentLocatorKey(url.href)))
      fail("TRUST_P2_PRE_RESOLVED_ORIGIN_OR_DUPLICATE");
    seen.add(trustP2EquivalentLocatorKey(url.href));
    return Object.freeze({kind:entry.kind,source:entry.source,
      productId:entry.productId,origin:entry.origin,url:url.href});
  });
}

/** Pre-fetch locator ranking, bounded to the unchanged 2 product pages. */
export function selectTrustP2CandidateLocators(peerLinks,sitemapLocators,product,{max=MAX_PAGES,origin=null}={}){
  if(!Array.isArray(peerLinks)||!Array.isArray(sitemapLocators)||
    !Number.isInteger(max)||max<1||max>MAX_PAGES||
    (origin!==null&&(typeof origin!=="string"||!origin.startsWith("https://"))))
    fail("TRUST_P2_LOCATOR_SELECTION_INVALID");
  const ranked=new Map();
  for(const [order,raw] of [...peerLinks,...sitemapLocators].entries()){
    const priority=trustP2LocatorPriority(raw,product,{origin});
    if(!priority)continue;
    const url=new URL(raw);
    const key=trustP2EquivalentLocatorKey(url.href);
    const previous=ranked.get(key);
    if(!previous||priority>previous.priority)
      ranked.set(key,{url:url.href,priority,order});
  }
  return [...ranked.values()]
    .sort((a,b)=>b.priority-a.priority||a.order-b.order)
    .slice(0,max).map(x=>x.url);
}

/** Read-only. No request before robots.txt is retrieved and checked. */
export async function runTrustP2Discovery(row,product,{fetchRobots,fetchSitemap,fetchPage,preResolvedLocators=[]}={}){
  if(typeof fetchRobots!=="function"||typeof fetchSitemap!=="function"||
    typeof fetchPage!=="function")fail("TRUST_P2_FETCH_BOUNDARY_REQUIRED");
  const supplied=validateTrustP2PreResolvedLocators(preResolvedLocators,row,product);
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

    // A typed input uses the existing first-party, robots-first transport but
    // deliberately skips sitemap/peer/homepage requests. No URL-based SKU proof.
    const direct=supplied.filter(x=>x.origin===origin);
    if(direct.length){
      const eligible=direct.filter(x=>policy.allowed(x.url));
      const locators=selectTrustP2CandidateLocators([],eligible.map(x=>x.url),
        product,{origin});
      // Explicit candidates rejected by robots or catalog URL ranking do not
      // fall back to unbounded automatic discovery for this origin.
      const pages=[];
      for(const url of locators){
        try{
          const fetched=await fetchPage(url,origin,policy);
          if(new URL(fetched.finalUrl).origin!==origin||
            !policy.allowed(fetched.finalUrl))fail("TRUST_P2_REDIRECT_SCOPE");
          pages.push({url:fetched.finalUrl,locatorMode:"PRE_RESOLVED",
            ...classifyTrustOfficialCandidatePage(fetched.bytes,product)});
        }catch(error){
          pages.push({url,locatorMode:"PRE_RESOLVED",
            status:publicDisposition(error?.message),
            fetchFailure:diagnoseTrustP2FetchFailure(error)});
        }
      }
      sites.push({origin,locatorMode:"PRE_RESOLVED",
        status:locators.length?"CANDIDATES_DISCOVERED":
          "NO_ELIGIBLE_PRE_RESOLVED_LOCATOR",
        candidateCount:locators.length,peerIndexCandidateCount:0,
        homepageIndexStatus:"NOT_USED_PRE_RESOLVED",pages,observations:[]});
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
      max_sitemaps:MAX_SITEMAPS,candidate_limit:12,
      external_search_seeds:[]};
    const discovered=await discoverOfficialSourceCandidates(args,{
      // Rank ALL already bounded sitemap XML locators before rediscovery
      // limits its output to 12. No additional sitemap or page requests.
      candidatePriority:url=>trustP2LocatorPriority(url,product,{origin,policy}),
      fetchHtml:async()=>{fail("TRUST_P2_HTML_INDEX_NOT_ALLOWED");},
      fetchSitemap:async url=>{
        if(new URL(url).origin!==origin||!policy.allowed(url))
          fail("SOURCE_BLOCKED:robots_or_origin");
        return fetchSitemap(url,origin,policy);
      },
    });
    // A sitemap URL is only fetch-eligible after same-origin and robots checks.
    // Filter before ranking/truncation so forbidden URLs cannot occupy both
    // product-page slots or suppress the bounded homepage fallback.
    const policyEligibleLocators=locators=>locators.filter(url=>{
      try{return new URL(url).origin===origin&&policy.allowed(url);}
      catch{return false;}
    });
    const sitemapLocators=policyEligibleLocators(
      discovered.candidates.map(c=>c.candidate_locator));
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
    // One extra official same-origin catalog index, only on a discovery miss.
    // Do not follow redirects or relax robots/SSRF checks.
    let homepageIndexStatus="NOT_NEEDED";
    const viableBeforeHomepage=selectTrustP2CandidateLocators(
      policyEligibleLocators(peerLinks),sitemapLocators,product,{origin});
    if(viableBeforeHomepage.length===0){
      const homepage=origin+"/";
      if(!policy.allowed(homepage))homepageIndexStatus="ROBOTS_DISALLOWED";
      else{
        try{
          const home=await fetchPage(homepage,origin,policy);
          if(new URL(home.finalUrl).origin!==origin||!policy.allowed(home.finalUrl))
            fail("TRUST_P2_INDEX_REDIRECT_SCOPE");
          homepageIndexStatus="FETCHED";
          peerLinks.push(...findTrustP2BOfficialPeerLinks(
            home.bytes,home.finalUrl,product,{max:MAX_PAGES}));
        }catch(error){homepageIndexStatus=publicDisposition(error?.message);}
      }
    }
    const discoveredLocators=selectTrustP2CandidateLocators(
      policyEligibleLocators(peerLinks),sitemapLocators,product,{origin});
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
        pages.push({url,status:publicDisposition(error?.message),
          fetchFailure:diagnoseTrustP2FetchFailure(error)});
      }
    }
    sites.push({origin,status:discoveredLocators.length?
        "CANDIDATES_DISCOVERED":discovered.disposition==="CANDIDATES_DISCOVERED"?
        "NO_ELIGIBLE_OFFICIAL_LOCATOR":discovered.disposition,
      candidateCount:discoveredLocators.length,peerIndexCandidateCount:peerLinks.length,
      homepageIndexStatus,pages,
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
    fetchRobots:(url,origin)=>fetchOfficialBytes(url,strictOriginTransport(fetchImpl,origin,null,{diagnoseRedirect:true})),
    fetchSitemap:(url,origin,policy)=>fetchOfficialSitemapBytes(url,strictOriginTransport(fetchImpl,origin,policy,{diagnoseRedirect:true})),
    fetchPage:(url,origin,policy)=>fetchOfficialBytes(url,strictOriginTransport(fetchImpl,origin,policy,{diagnoseRedirect:true})),
  };
}
