#!/usr/bin/env node
// D8K-11 operator-local existing PRIVATE evidence integrity check.
// NEVER downloads from Storage, sends a request, authenticates any actor,
// changes a DB row or publishes source price. Reads ONLY named local files.
// A positive result is review METADATA ready, not VERIFIED in production.
import { lstatSync, readFileSync } from "node:fs";
import { resolve, basename, dirname, parse, extname } from "node:path";
import { preflightExistingR16IEvidence }
  from "../../lib/product-intelligence/r16i-d8k11-existing-evidence-preflight.mjs";

const MAX_CAPTURE_BYTES=4194304;
const MAX_METADATA_BYTES=65536;
const MAX_AGE_MS=604800000;
const ARG_NAMES=new Set(["--metadata","--official","--hwahae","--reviews"]);
const ALLOWED_EXT=new Set([".png",".jpg",".jpeg",".webp"]);
function fail(code){throw new Error(code);}
function parseArgs(values) {
 if(values.length===1&&values[0]==="--help")return {help:true};
 if(values.length<6||values.length>8||values.length%2!==0)
   fail("USAGE_METADATA_OFFICIAL_HWAHAE_REQUIRED");
 const result={};
 for(let i=0;i<values.length;i+=2){
  const k=values[i],v=values[i+1];
  if(!ARG_NAMES.has(k)||!v||v.startsWith("--")||Object.hasOwn(result,k))
    fail("INVALID_OR_DUPLICATED_ARGUMENT");
  result[k]=v;
 }
 if(!result["--metadata"]||!result["--official"]||!result["--hwahae"])
   fail("METADATA_AND_BOTH_ARCHIVES_REQUIRED");
 if(new Set(Object.values(result).map(v=>resolve(v))).size!==
    Object.keys(result).length)fail("SOURCE_METADATA_PATH_COLLISION");
 return result;
}
function readBounded(path,limit,isImage=false) {
 const full=resolve(path);
 const leaf=basename(full);
 if(/^\.env(?:\.|$)/i.test(leaf)||
    /(?:service.role|secret|private.key)/i.test(leaf))
   fail("POTENTIAL_SECRET_FILE_FORBIDDEN");
 const root=parse(full).root;
 for(let dir=dirname(full);dir!==root;dir=dirname(dir)) {
  if(lstatSync(dir).isSymbolicLink())
    fail("LOCAL_DIRECTORY_SYMLINK_FORBIDDEN");
 }
 const stat=lstatSync(full);
 if(stat.isSymbolicLink()||!stat.isFile()||stat.size<1||stat.size>limit)
   fail("LOCAL_FILE_TYPE_OR_SIZE_UNSUPPORTED");
 if(isImage&&!ALLOWED_EXT.has(extname(full).toLowerCase()))
   fail("EVIDENCE_EXTENSION_UNSUPPORTED");
 const bytes=readFileSync(full);
 if(bytes.length!==stat.size)fail("LOCAL_SOURCE_CHANGED_DURING_READ");
 return bytes;
}
function readJson(path) {
 let obj;
 try {obj=JSON.parse(readBounded(path,MAX_METADATA_BYTES).toString("utf8"));}
 catch{fail("PRIVATE_METADATA_JSON_INVALID");}
 if(!obj||typeof obj!=="object"||Array.isArray(obj))
   fail("PRIVATE_METADATA_OBJECT_REQUIRED");
 return obj;
}
function render(result) {
 return {
  stage:"D8K11_LOCAL_ARCHIVE_AND_INDEPENDENT_REVIEW_PREFLIGHT",
  status:result.status,reason:result.reason,
  evidenceCount:result.evidenceCount,
  archiveBytesMatchedCount:result.archiveBytesMatchedCount,
  reviewMetadataReadyCount:result.reviewMetadataReadyCount,
  records:result.records,
  realMerchantImageContentReviewedByTool:false,
  collectorReviewerAccountsAuthenticated:false,
  productionDbWrites:0,verifiedSellerPricesPublished:0,
  liveParentOfferBound:false,directCtaAuthorized:false,
  releaseAuthorized:false
 };
}
function run() {
 const args=parseArgs(process.argv.slice(2));
 if(args.help) {
  console.log("node scripts/product-evidence/check-d8k11-local-existing-archives-v1.mjs --metadata <private-evidence.json> --official <official.png> --hwahae <bundle.png> [--reviews <private-review.json>]");
  console.log("Read-only LOCAL original-image SHA-256/magic/identity preflight. Never share files or private metadata in a public Git commit.");
  return;
 }
 const data=readJson(args["--metadata"]);
 if(!Array.isArray(data.evidenceRows)||data.evidenceRows.length!==2)
   fail("EXACT_TWO_PRIVATE_EVIDENCE_ROWS_REQUIRED");
 const lookup=new Map();
 for(const row of data.evidenceRows) {
  if(!row||!["official_single","hwahae_bundle"].includes(row.source_key)||
     lookup.has(row.source_key))fail("TWO_DISTINCT_R16I_SOURCES_REQUIRED");
  lookup.set(row.source_key,row);
 }
 if(lookup.size!==2)fail("TWO_DISTINCT_R16I_SOURCES_REQUIRED");
 const images=new Map([
  [lookup.get("official_single").evidence_id,
   readBounded(args["--official"],MAX_CAPTURE_BYTES,true)],
  [lookup.get("hwahae_bundle").evidence_id,
   readBounded(args["--hwahae"],MAX_CAPTURE_BYTES,true)]
 ]);
 let reviews=null;
 if(args["--reviews"]){
  const input=readJson(args["--reviews"]);
  if(!Array.isArray(input.reviews)||input.reviews.length!==2)
    fail("TWO_PRIVATE_INDEPENDENT_REVIEW_ROWS_REQUIRED");
  reviews=new Map();
  for(const row of input.reviews){
   if(!row||typeof row.evidence_id!=="string"||
      reviews.has(row.evidence_id))
     fail("REVIEW_IDENTITIES_OR_DUPLICATES_INVALID");
   reviews.set(row.evidence_id,row);
  }
  if(reviews.size!==2)fail("TWO_PRIVATE_INDEPENDENT_REVIEW_ROWS_REQUIRED");
 }
 const result=preflightExistingR16IEvidence({
  evidenceRows:data.evidenceRows,archivedBytesByEvidenceId:images,
  reviewByEvidenceId:reviews,nowIso:new Date().toISOString(),
  maxAgeMs:MAX_AGE_MS
 });
 console.log(JSON.stringify(render(result)));
 if(result.status!=="TWO_REVIEW_METADATA_PACKETS_READY_NO_WRITE")
   process.exitCode=1;
}
try{run();}
catch(error){
 const valid=typeof error?.message==="string"&&
   /^[A-Z0-9_]{4,100}$/.test(error.message);
 console.log(JSON.stringify({
  stage:"D8K11_LOCAL_ARCHIVE_AND_INDEPENDENT_REVIEW_PREFLIGHT",
  status:"HOLD",
  reason:valid?error.message:"PRIVATE_FILE_READ_OR_FORMAT_FAILED",
  productionDbWrites:0,verifiedSellerPricesPublished:0,
  directCtaAuthorized:false,releaseAuthorized:false
 }));
 process.exitCode=1;
}
