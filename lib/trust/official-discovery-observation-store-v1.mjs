import { createHash } from "node:crypto";

export const TRUST_P2B_OBSERVATION_CONTRACT =
  "trust-p2b-official-discovery-observation-v1";
const MAX_ROWS=20;
const ALLOWED_SITE=new Set([
  "ROBOTS_UNAVAILABLE","ROBOTS_DISALLOWED","CRAWL_DELAY_NOT_SUPPORTED",
  "SOURCE_BLOCKED","TRANSIENT_FAILURE","NO_SAFE_CANDIDATE",
  "CANDIDATES_DISCOVERED",
]);
const ALLOWED_PAGE=new Set([
  "STRUCTURED_NAME_CANDIDATE","TITLE_NAME_CANDIDATE",
  "SCOPED_HEADING_CANDIDATE","BODY_NAME_MENTION_ONLY",
  "IDENTITY_UNRESOLVED","SOURCE_BLOCKED","TRANSIENT_FAILURE",
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST=/^[a-f0-9]{64}$/;
function error(code){throw new Error(code);}
function digest(value){return createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function origin(value){
  let url;
  try{url=new URL(value);}catch{error("TRUST_P2B_ORIGIN_INVALID");}
  if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||
    url.search||url.hash||(url.port&&url.port!=="443")||url.origin!==value)
    error("TRUST_P2B_ORIGIN_INVALID");
  return url.origin;
}
function locator(value,expectedOrigin){
  let u;
  try{u=new URL(value);}catch{error("TRUST_P2B_LOCATOR_INVALID");}
  if(u.protocol!=="https:"||u.origin!==expectedOrigin||u.username||u.password||
    u.hash||u.href.length>2048)error("TRUST_P2B_LOCATOR_INVALID");
  return u.href;
}
function normalize(row){
  const canonical={
    product_id:row.product_id,
    intake_id:row.intake_id,
    source_origin:row.source_origin,
    candidate_locator:row.candidate_locator,
    content_digest:row.content_digest,
    observation_kind:row.observation_kind,
    disposition:row.disposition,
    identity_surface:row.identity_surface,
    contract_version:TRUST_P2B_OBSERVATION_CONTRACT,
  };
  return {...canonical,observation_fingerprint:digest(canonical)};
}
/**
 * Input is from internal P2 only, not a caller-supplied fact authority.
 * The ledger records observation snapshots, never source binding/Subject/Fact.
 */
export function prepareTrustP2BObservations(run){
  if(!run||run.readOnly!==true||run.officialProductEvidenceConfirmed!==false||
     run.subjectCreationAuthorized!==false||run.marketVerified!==false||
     run.formulationVerified!==false||run.factWrites!==0||
     run.recommendationWrites!==0||run.aiApiCalls!==0||
     !UUID.test(run.productId??"")||!UUID.test(run.intakeId??"")||
     !Array.isArray(run.sites)||run.sites.length>2)
    error("TRUST_P2B_RUN_NOT_ELIGIBLE");
  const rows=[];
  for(const site of run.sites){
    const sourceOrigin=origin(site.origin);
    if(!ALLOWED_SITE.has(site.status)&&site.status!=="SOURCE_BLOCKED")
      error("TRUST_P2B_SITE_STATUS_INVALID");
    rows.push(normalize({
      product_id:run.productId,intake_id:run.intakeId,
      source_origin:sourceOrigin,candidate_locator:null,content_digest:null,
      observation_kind:"site_disposition",disposition:site.status,identity_surface:null,
    }));
    if(!Array.isArray(site.pages)&&site.pages!==undefined)
      error("TRUST_P2B_PAGES_INVALID");
    if((site.pages??[]).length>2)error("TRUST_P2B_PAGE_LIMIT");
    for(const page of site.pages??[]){
      if(page.status==="ROBOTS_DISALLOWED")continue;
      if(!ALLOWED_PAGE.has(page.status))error("TRUST_P2B_PAGE_STATUS_INVALID");
      const loc=locator(page.url,sourceOrigin);
      if(page.sha256!==undefined&&(!DIGEST.test(page.sha256)||![
        "STRUCTURED_NAME_CANDIDATE","TITLE_NAME_CANDIDATE",
        "SCOPED_HEADING_CANDIDATE","BODY_NAME_MENTION_ONLY","IDENTITY_UNRESOLVED"
      ].includes(page.status)))error("TRUST_P2B_DIGEST_INVALID");
      const identity=page.status==="STRUCTURED_NAME_CANDIDATE"?"product_jsonld_name":
        page.status==="TITLE_NAME_CANDIDATE"?"page_title":
        page.status==="SCOPED_HEADING_CANDIDATE"?"product_heading":
        page.status==="BODY_NAME_MENTION_ONLY"?"visible_body_mention":null;
      if(page.identitySurface!==undefined&&page.identitySurface!==identity)
        error("TRUST_P2C_SURFACE_MISMATCH");
      rows.push(normalize({
        product_id:run.productId,intake_id:run.intakeId,source_origin:sourceOrigin,
        candidate_locator:loc,content_digest:page.sha256??null,
        observation_kind:"page_candidate",disposition:page.status,
        identity_surface:identity,
      }));
    }
  }
  if(rows.length>MAX_ROWS)error("TRUST_P2B_OBSERVATION_LIMIT");
  const unique=new Map(rows.map(row=>[row.observation_fingerprint,row]));
  return [...unique.values()].sort((a,b)=>a.observation_fingerprint.localeCompare(b.observation_fingerprint));
}

const TABLE="trust_official_discovery_observations_v1";
async function readByHash(client,hash){
  const {data,error:dbError}=await client.from(TABLE)
    .select("observation_fingerprint,product_id,intake_id,source_origin,candidate_locator,content_digest,observation_kind,disposition,identity_surface,contract_version")
    .eq("observation_fingerprint",hash).limit(2);
  if(dbError||!Array.isArray(data)||data.length!==1)
    error("TRUST_P2B_OBSERVATION_READ_FAILED");
  return data[0];
}
export async function appendTrustP2BObservations(client,run){
  if(!client||typeof client.from!=="function")error("TRUST_P2B_DB_UNAVAILABLE");
  const rows=prepareTrustP2BObservations(run);
  const result={prepared:rows.length,inserted:0,duplicates:0,
    factWrites:0,subjectWrites:0,recommendationWrites:0,aiApiCalls:0};
  for(const row of rows){
    const {error:dbError}=await client.from(TABLE).insert(row);
    if(!dbError){result.inserted++;continue;}
    if(dbError.code!=="23505")error("TRUST_P2B_OBSERVATION_INSERT_FAILED");
    const prior=await readByHash(client,row.observation_fingerprint);
    const {observation_fingerprint:hash,...rest}=row;
    const {observation_fingerprint:found,...saved}=prior;
    if(hash!==found||Object.keys(rest).some(k=>rest[k]!==saved[k]))
      error("TRUST_P2B_OBSERVATION_COLLISION");
    result.duplicates++;
  }
  return Object.freeze(result);
}
