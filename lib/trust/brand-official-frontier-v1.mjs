export const TRUST_BRAND_OFFICIAL_FRONTIER_VERSION="trust-brand-official-frontier-v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OFFICIAL_KINDS=new Set([
  "official_product_page","brand_official_product_page",
  "official_brand_product_page","official_brand_owner_product_page",
  "brand_official_technical_document",
]);
const EXCLUDED_HOSTS=new Set([
  "hwahae.com","www.hwahae.com","oliveyoung.co.kr",
  "www.oliveyoung.co.kr","smartstore.naver.com",
  "shopping.naver.com","www.amazon.com","amazon.com",
]);
const LIMIT=500;
function safeOrigin(value) {
  try {
    const u=new URL(value);
    if(u.protocol!=="https:"||u.username||u.password||
      (u.port&&u.port!=="443")||!u.hostname||u.hostname==="localhost"||
      u.hostname.endsWith(".localhost")||u.hostname.endsWith(".internal")||
      u.hostname.endsWith(".local")||/^\d+(\.\d+){3}$/.test(u.hostname)||
      u.hostname.includes(":")||EXCLUDED_HOSTS.has(u.hostname.toLowerCase()))
      return null;
    return u.origin;
  }catch{return null;}
}
function key(value){
  return typeof value==="string" ? value.normalize("NFKC").trim().toLowerCase() : "";
}
function validRow(row,fields){
  return row&&typeof row==="object"&&fields.every(f=>UUID.test(row[f]??""));
}

/**
 * A verified official source of a DIFFERENT product is only a discovery
 * origin for the same canonical brand. This NEVER grants source binding,
 * market, formulation, Subject, or Fact authority to the target.
 */
export function planTrustBrandOfficialFrontier(input) {
  if(!input||!Array.isArray(input.backlog)||!Array.isArray(input.products)||
    !Array.isArray(input.bindings)||!Array.isArray(input.sources)||
    [input.backlog.length,input.products.length,input.bindings.length,input.sources.length]
      .some(n=>n>LIMIT))
    throw new Error("TRUST_FRONTIER_INVALID_INPUT");
  const products=new Map();
  for(const p of input.products) {
    if(!validRow(p,["id"])||products.has(p.id))
      throw new Error("TRUST_FRONTIER_DUPLICATE_OR_INVALID_PRODUCT");
    products.set(p.id,p);
  }
  const sourceMap=new Map();
  for(const s of input.sources) {
    if(!validRow(s,["source_id"])||sourceMap.has(s.source_id))
      throw new Error("TRUST_FRONTIER_DUPLICATE_OR_INVALID_SOURCE");
    sourceMap.set(s.source_id,s);
  }
  const seeds=new Map();
  for(const b of input.bindings) {
    if(!validRow(b,["source_id","product_id","subject_id","binding_id"]))
      throw new Error("TRUST_FRONTIER_INVALID_BINDING");
    if(b.binding_state!=="exact_subject_match"||
      b.scope_relation!=="equivalent")continue;
    const known=products.get(b.product_id);
    const source=sourceMap.get(b.source_id);
    const brand=key(known?.normalized_brand);
    const origin=safeOrigin(source?.canonical_locator);
    if(!brand||!known||!OFFICIAL_KINDS.has(source?.source_kind)||!origin)continue;
    const k=brand+"\u0000"+origin;
    if(!seeds.has(k))seeds.set(k,[]);
    seeds.get(k).push({sourceId:b.source_id,bindingId:b.binding_id,
      knownProductId:b.product_id,officialKind:source.source_kind});
  }
  const seen=new Set(),result=[];
  for(const target of input.backlog){
    if(!validRow(target,["id","product_id"])||
       !products.has(target.product_id)||seen.has(target.id))
      throw new Error("TRUST_FRONTIER_INVALID_TARGET");
    seen.add(target.id);
    if(target.identity_state!=="SUBJECT_CREATION_REQUIRED"||
      target.trust_state!=="REVIEW_REQUIRED")
      throw new Error("TRUST_FRONTIER_INVALID_STATE");
    const product=products.get(target.product_id),brand=key(product.normalized_brand);
    if(!brand) {
      result.push({intakeId:target.id,productId:target.product_id,
        discoveryOrigins:[],seedCount:0,status:"NO_CANONICAL_BRAND",
        marketVerified:false,subjectCreationAuthorized:false});
      continue;
    }
    const origins=[];
    for(const [k,refs] of seeds) {
      if(!k.startsWith(brand+"\u0000"))continue;
      const origin=k.slice(brand.length+1);
      const otherProductRefs=refs.filter(ref=>ref.knownProductId!==target.product_id);
      if(!otherProductRefs.length)continue;
      origins.push({origin,sourceCount:otherProductRefs.length,
        evidenceRefs:otherProductRefs.slice(0,3)});
    }
    origins.sort((a,b)=>a.origin.localeCompare(b.origin));
    result.push({
      intakeId:target.id,productId:target.product_id,
      discoveryOrigins:origins.slice(0,3),seedCount:origins.length,
      status:origins.length?"BRAND_OFFICIAL_DISCOVERY_SEEDS":"NO_GOVERNED_BRAND_SEEDS",
      // NEVER infer KR from Hwahae/official root; a known brand is not a formulation proof.
      marketVerified:false,subjectCreationAuthorized:false,
    });
  }
  result.sort((a,b)=>a.productId.localeCompare(b.productId));
  return Object.freeze({
    version:TRUST_BRAND_OFFICIAL_FRONTIER_VERSION,
    total:result.length,
    withSeeds:result.filter(x=>x.seedCount>0).length,
    withoutSeeds:result.filter(x=>x.seedCount===0).length,
    items:result,
    mutationPolicy:"DISCOVERY_ONLY_NO_DB_WRITE",
    aiApiCalls:0,
  });
}

export function buildTrustOfficialDiscoveryRequests(row,product){
  if(!row||row.status!=="BRAND_OFFICIAL_DISCOVERY_SEEDS"||
    !Array.isArray(row.discoveryOrigins)||!product||
    product.id!==row.productId)
    throw new Error("TRUST_FRONTIER_NO_DISCOVERY_SEEDS");
  const queryTerms=[product.name_en,product.name,
    product.normalized_name].filter(v=>typeof v==="string"&&v.trim())
    .slice(0,3);
  return row.discoveryOrigins.map(seed=>{
    const base=new URL(seed.origin);
    return {
      product_id:row.productId,
      intake_id:row.intakeId,
      allowed_hosts:[base.hostname],
      discovery_surfaces:[
        {kind:"sitemap",url:new URL("/sitemap.xml",base).toString()},
        {kind:"sitemap",url:new URL("/sitemap_index.xml",base).toString()},
      ],
      query_terms:queryTerms,
      candidate_limit:5,
      max_sitemaps:2,
      product_path_prefixes:["/products/","/product/","/shop/","/item/"],
      discovery_authority:"UNVERIFIED_OTHER_PRODUCT_BRAND_SEED",
    };
  });
}
