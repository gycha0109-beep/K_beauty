#!/usr/bin/env node
// Local private evidence intake ONLY. No network, database, external API,
// admin action, image OCR, file write or seller-price publication.
import { createHash } from "node:crypto";
import { readFileSync, lstatSync } from "node:fs";
import { extname, resolve, basename } from "node:path";
import { inspectManualOptionCapture, prepareIndependentOptionReview }
  from "../../lib/commerce/product-offer-manual-review-intake-v1.mjs";

const CAPTURE_LIMIT=12*1024*1024;
const JSON_LIMIT=32*1024;
const EXTENSIONS=new Set([".png",".jpg",".jpeg",".webp",".pdf",".html",".htm",".txt"]);
const CONFIG_KEYS=new Set(["--manifest","--source","--review"]);
function parseArgs(args) {
  if(args.length===1&&args[0]==="--help")return {help:true};
  if(args.length<4||args.length>6||args.length%2!==0)
    throw new Error("USAGE: --manifest <local.json> --source <local_evidence> [--review <local.json>]");
  const opts={};
  for(let i=0;i<args.length;i+=2) {
    if(!CONFIG_KEYS.has(args[i])||!args[i+1]||args[i+1].startsWith("--")||
       Object.hasOwn(opts,args[i]))throw new Error("INVALID_OR_DUPLICATED_ARGUMENT");
    opts[args[i]]=args[i+1];
  }
  if(!opts["--manifest"]||!opts["--source"])throw new Error("MANIFEST_AND_SOURCE_REQUIRED");
  const resolved=Object.values(opts).map(p=>resolve(p));
  if(new Set(resolved).size!==resolved.length)
    throw new Error("CAPTURE_AND_REVIEW_FILES_MUST_BE_DISTINCT");
  return opts;
}
function localFile(filename,limit,asEvidence=false) {
  const full=resolve(filename);
  if(/^\.env(?:\.|$)/i.test(basename(full))||
    /(?:secret|service.role|private.key)/i.test(basename(full)))
    throw new Error("PRIVATE_CREDENTIAL_FILE_FORBIDDEN");
  const stat=lstatSync(full);
  if(stat.isSymbolicLink()||!stat.isFile()||stat.size<1||stat.size>limit)
    throw new Error("LOCAL_FILE_TYPE_OR_SIZE_UNSUPPORTED");
  if(asEvidence&&!EXTENSIONS.has(extname(full).toLowerCase()))
    throw new Error("LOCAL_EVIDENCE_EXTENSION_UNSUPPORTED");
  const bytes=readFileSync(full);
  if(bytes.length!==stat.size)throw new Error("LOCAL_FILE_CHANGED_DURING_READ");
  if(asEvidence) {
    const ext=extname(full).toLowerCase();
    let valid=false;
    if(ext===".png")valid=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if(ext===".jpg"||ext===".jpeg")
      valid=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
    if(ext===".webp")valid=bytes.toString("ascii",0,4)==="RIFF"&&
      bytes.toString("ascii",8,12)==="WEBP";
    if(ext===".pdf")valid=bytes.toString("ascii",0,5)==="%PDF-";
    if(ext===".html"||ext===".htm")valid=/<!doctype html|<html\b/i.test(
      bytes.toString("utf8",0,Math.min(bytes.length,4096)));
    if(ext===".txt")valid=!bytes.includes(0);
    if(!valid)throw new Error("SOURCE_FILE_MAGIC_OR_SHAPE_INVALID");
  }
  return bytes;
}
function jsonFile(path) {
  const text=localFile(path,JSON_LIMIT).toString("utf8");
  let result;
  try{result=JSON.parse(text);}
  catch{throw new Error("LOCAL_METADATA_JSON_INVALID");}
  if(!result||typeof result!=="object"||Array.isArray(result))
    throw new Error("LOCAL_METADATA_OBJECT_REQUIRED");
  return result;
}
function summary(x,digest) {
  const result={
    stage:"D8K8_LOCAL_MANUAL_EVIDENCE_INTAKE",
    status:x.status,reason:x.reason,
    sourceDigestPrefix:digest.slice(0,12),
    localBytesDigestMatched:x.status==="CAPTURE_METADATA_MATCH_ONLY"||
      x.status==="AWAITING_INDEPENDENT_REVIEW"||
      x.status==="INDEPENDENT_REVIEW_PACKET_READY_NO_WRITE"||
      x.status==="REJECTION_PACKET_READY_NO_WRITE",
    independentReviewMetadataReady:x.status==="INDEPENDENT_REVIEW_PACKET_READY_NO_WRITE",
    actualSellerScreenshotContentMachineVerified:false,
    reviewerIdentityAuthenticated:false,sourceFilePersistedByTool:false,
    sellerPricePublished:false,dbWrites:0,apiMutations:0,
    directCtaAuthorized:false,productionReleaseAuthorized:false
  };
  return result;
}
function main() {
  const args=parseArgs(process.argv.slice(2));
  if(args.help) {
    console.log("node scripts/product-evidence/prepare-d8k8-local-option-review-v1.mjs --manifest <private-capture.json> --source <private-screenshot.png|html|pdf> [--review <private-independent-review.json>]");
    console.log("Reads local files, verifies SHA-256 and schema, prints redacted status. No file writes, network or DB access.");
    return;
  }
  const manifest=jsonFile(args["--manifest"]);
  const archive=localFile(args["--source"],CAPTURE_LIMIT,true);
  const digest=createHash("sha256").update(archive).digest("hex");
  const nowIso=new Date().toISOString();
  const capture=inspectManualOptionCapture({
    manifest,actualArtifactSha256:digest,nowIso,
    maxAgeMs:7*24*60*60*1000
  });
  let result=capture;
  if(capture.status==="CAPTURE_METADATA_MATCH_ONLY") {
    const review=args["--review"]?jsonFile(args["--review"]):null;
    result=prepareIndependentOptionReview({
      capture,review,nowIso,maxAgeMs:7*24*60*60*1000
    });
  }
  console.log(JSON.stringify(summary(result,digest)));
  if(!["AWAITING_INDEPENDENT_REVIEW",
        "INDEPENDENT_REVIEW_PACKET_READY_NO_WRITE",
        "REJECTION_PACKET_READY_NO_WRITE"].includes(result.status))
    process.exitCode=1;
}
try{main();}
catch(error){
  // Deliberately do not echo exception text: OS paths, capture URLs and
  // merchant/user content must not end up in public CI or support logs.
  console.error(JSON.stringify({
    stage:"D8K8_LOCAL_MANUAL_EVIDENCE_INTAKE",status:"HOLD",
    reason:typeof error?.message==="string"&&
      /^[A-Z0-9_: -]{1,110}$/.test(error.message)?
      error.message:"LOCAL_EVIDENCE_READ_OR_ARGUMENT_FAILED",
    privateDataLogged:false,dbWrites:0,productionReleaseAuthorized:false
  }));
  process.exitCode=1;
}
