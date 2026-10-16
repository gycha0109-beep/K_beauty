// S1-D research-only PRIVATE runner for user-attested facial photos.
// Do NOT invoke inside GitHub Actions/CI, share facial pixels with GitHub,
// save raw Provider responses, repeat requests, or deploy this into the app.
// The source and output contain only bounded metadata; the manifest lives off-repo.
import { readFileSync, lstatSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, basename, sep } from "node:path";
import { executeOpenAiChatJson } from "../../../lib/server/openai-chat-runtime.js";
import { createVisionObservationPrompt } from "../../../lib/vision-observation-contract.js";
import {
  OPENAI_RUNTIME_MODEL, OPENAI_RUNTIME_REASONING_EFFORT, OPENAI_RUNTIME_IMAGE_DETAIL
} from "../../../lib/ai-model-policy.js";
import { createSkinVisionV2CandidatePrompt, evaluateSkinVisionV2Candidate } from "./skin-vision-v2-candidate-core.mjs";
import { inspectSkinVisionTrial, summarizeSkinVisionTrials } from "./skin-vision-v2-provider-evidence-gate.mjs";

export const PRIVATE_V1V2_VERSION = "skin-private-v1v2-cohort-v1";
export const PRIVATE_V1V2_MAX_CALLS = 10;
const EXPECTED_CASE_IDS = ["TC-01","TC-02","TC-03","TC-04","TC-05"];
const EXPECTED_KEY = "OPENAI_API_KEY2";
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_COMPLETION_TOKENS = 2200;
const ALLOWED_STATUS = new Set(["eligible","ineligible","insufficient_evidence"]);
const ALLOWED_FACE = new Set(["unavailable","insufficient_evidence","partial","available"]);
const ALLOWED_ERRORS = new Set([
  "provider_http_400","provider_http_401","provider_http_403","provider_http_404",
  "provider_http_408","provider_http_409","provider_http_422","provider_http_429",
  "provider_http_500","provider_http_502","provider_http_503","provider_http_504",
  "provider_response_invalid","provider_response_empty","provider_redirect_rejected",
  "response_too_large","key2_not_available"
]);
const OWN_KEYS = o => o && typeof o === "object" && !Array.isArray(o) ? Object.keys(o) : [];
function exactKeys(obj,expected,code) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj) ||
      OWN_KEYS(obj).length !== expected.length ||
      !expected.every(key=>Object.hasOwn(obj,key))) throw new Error(code);
}
function assertAllowedEnvironment(env, live) {
  if (!live) return null;
  // Fail closed in CI, including inadvertent secret injection through GitHub Actions.
  const CI_MARKERS = [
    "GITHUB_ACTIONS", "CI", "GITLAB_CI", "CIRCLECI", "TRAVIS",
    "TF_BUILD", "BUILD_BUILDID", "BUILDKITE", "JENKINS_URL", "TEAMCITY_VERSION"
  ];
  const isActive = value => value !== undefined && value !== null &&
    !["", "0", "false", "off", "no"].includes(String(value).trim().toLowerCase());
  if (CI_MARKERS.some(name => isActive(env[name])))
    throw new Error("ci_face_photo_execution_forbidden");
  const key = env[EXPECTED_KEY];
  if (typeof key !== "string" || !key.trim()) throw new Error("key2_not_available");
  return key.trim();
}
export function validatePrivateCohortManifest(input) {
  exactKeys(input,["schemaVersion","studyId","attestation","executionPolicy","cases"],"manifest_shape_invalid");
  if (input.schemaVersion!==PRIVATE_V1V2_VERSION || !/^[A-Za-z0-9_-]{1,64}$/.test(input.studyId))
    throw new Error("manifest_header_invalid");
  exactKeys(input.attestation,["sourceRights","depictedPersonConsent","openAiTransferConsent","attestedOn"],"attestation_shape_invalid");
  for (const k of ["sourceRights","depictedPersonConsent","openAiTransferConsent"]) {
    if (input.attestation[k] !== "user_attested") throw new Error("consent_not_attested");
  }
  if (!/^2026-\d\d-\d\d$/.test(input.attestation.attestedOn))
    throw new Error("attestation_date_invalid");
  exactKeys(input.executionPolicy,["privateOnly","gitHubActionsForbidden","rawResponsesPersisted","imagesPersistedByRunner","providerKeyEnv","maxCalls"],"execution_policy_invalid");
  const p=input.executionPolicy;
  if (p.privateOnly!==true || p.gitHubActionsForbidden!==true ||
      p.rawResponsesPersisted!==false || p.imagesPersistedByRunner!==false ||
      p.providerKeyEnv!==EXPECTED_KEY || p.maxCalls!==PRIVATE_V1V2_MAX_CALLS)
    throw new Error("execution_policy_rejected");
  if (!Array.isArray(input.cases)||input.cases.length!==EXPECTED_CASE_IDS.length)
    throw new Error("five_cases_required");
  const seen=new Set(),seenFiles=new Set();
  for (const c of input.cases) {
    exactKeys(c,["caseId","filename","expectedWidth","expectedHeight"],"case_shape_invalid");
    if (!EXPECTED_CASE_IDS.includes(c.caseId)||seen.has(c.caseId)) throw new Error("case_id_invalid");
    seen.add(c.caseId);
    if (typeof c.filename!=="string" || c.filename.length>180 ||
        c.filename==="." || c.filename===".." || c.filename.startsWith(".") ||
        c.filename.includes("/") || c.filename.includes("\\") ||
        basename(c.filename)!==c.filename || c.filename.includes("\0") ||
        !/\.jpe?g$/i.test(c.filename))
      throw new Error("private_filename_invalid");
    if(seenFiles.has(c.filename))throw new Error("duplicate_private_source_file");
    seenFiles.add(c.filename);
    if (![c.expectedWidth,c.expectedHeight].every(n=>Number.isSafeInteger(n)&&n>=1&&n<=8192))
      throw new Error("case_dimensions_invalid");
  }
  return input;
}
function jpegDimensions(buffer) {
  if (!Buffer.isBuffer(buffer)||buffer.length<20||buffer[0]!==255||buffer[1]!==216||
      buffer[buffer.length-2]!==255||buffer[buffer.length-1]!==217)
    throw new Error("photo_jpeg_invalid");
  let at=2;
  while(at+4<buffer.length) {
    if(buffer[at]!==255) throw new Error("photo_jpeg_marker_invalid");
    while(buffer[at]===255)at++;
    const marker=buffer[at++];
    if(marker===217||marker===218)break;
    if(marker===1||(marker>=208&&marker<=215))continue;
    if(at+2>buffer.length)throw new Error("photo_jpeg_segment_invalid");
    const size=buffer.readUInt16BE(at);
    if(size<2||at+size>buffer.length)throw new Error("photo_jpeg_segment_invalid");
    if([192,193,194,195,198,199,201,202,203,205,206,207].includes(marker)) {
      if(size<7)throw new Error("photo_jpeg_frame_invalid");
      return {height:buffer.readUInt16BE(at+3),width:buffer.readUInt16BE(at+5)};
    }
    at+=size;
  }
  throw new Error("photo_dimensions_missing");
}
function stripJpegPrivateMetadata(buffer) {
  // Retain image compression, JFIF, ICC profile and Adobe color transform.
  // Remove free-text COM and application markers carrying side-channel metadata.
  // Avoid silently altering orientation when an Exif metadata source exists.
  let at=2;
  const pieces=[buffer.subarray(0,2)];
  while(at<buffer.length){
    const start=at;
    if(buffer[at]!==255)throw new Error("jpeg_segment_invalid");
    while(buffer[at]===255)at++;
    if(at>=buffer.length)throw new Error("jpeg_marker_truncated");
    const marker=buffer[at++];
    if(marker===218 || marker===217) {
      pieces.push(buffer.subarray(start));
      return Buffer.concat(pieces);
    }
    if(marker===1 || (marker>=208&&marker<=215)) {
      pieces.push(buffer.subarray(start,at));
      continue;
    }
    if(at+2>buffer.length)throw new Error("jpeg_segment_truncated");
    const len=buffer.readUInt16BE(at);
    if(len<2||at+len>buffer.length)throw new Error("jpeg_segment_overrun");
    const segment=buffer.subarray(at+2,at+len);
    const isExif=marker===225 &&
      segment.length>=6 && segment.subarray(0,6).equals(Buffer.from([69,120,105,102,0,0]));
    if(isExif)throw new Error("jpeg_exif_orientation_requires_review");
    const isMetadata=marker===254 ||
      (marker>=225&&marker<=239 &&
        !(marker===226 && segment.subarray(0,11).toString("latin1")==="ICC_PROFILE") &&
        marker!==238);
    if(!isMetadata)pieces.push(buffer.subarray(start,at+len));
    at+=len;
  }
  throw new Error("jpeg_scan_missing");
}
function readPrivatePhoto(photoDir,filename,w,h){
  const root=realpathSync(resolve(photoDir));
  const rootStat=lstatSync(root);
  if(!rootStat.isDirectory())throw new Error("photo_directory_invalid");
  const target=resolve(root,filename);
  if(!target.startsWith(root+sep))throw new Error("photo_path_outside_private_root");
  const stat=lstatSync(target);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<20||stat.size>MAX_BYTES)
    throw new Error("photo_file_rejected");
  if(realpathSync(target)!==target)throw new Error("photo_file_link_rejected");
  const data=readFileSync(target);
  if(data.length!==stat.size)throw new Error("photo_size_changed");
  const dimensions=jpegDimensions(data);
  if(dimensions.width!==w||dimensions.height!==h)throw new Error("photo_dimensions_changed");
  const stripped=stripJpegPrivateMetadata(data);
  const contentFingerprint = createHash("sha256").update(stripped).digest("hex");
  // Fingerprint is for same-content exclusion only; NEVER return it to callers.
  return {imageUrl:"data:image/jpeg;base64,"+stripped.toString("base64"),
    contentFingerprint,bytes:stripped.length,
    width:dimensions.width,height:dimensions.height};
}
const safeNumber=n=>Number.isSafeInteger(n)&&n>=0?n:null;
const safeStatus=(x,allowed,fallback)=>allowed.has(x)?x:fallback;
function requestBody(variant,imageUrl){
  return {
    model:OPENAI_RUNTIME_MODEL,reasoning_effort:OPENAI_RUNTIME_REASONING_EFFORT,
    temperature:0,max_completion_tokens:MAX_COMPLETION_TOKENS,
    response_format:{type:"json_object"},
    messages:[
      {role:"system",content:variant==="v1"?createVisionObservationPrompt():createSkinVisionV2CandidatePrompt()},
      {role:"user",content:[
        {type:"text",text:"Extract the canonical locale-neutral observation bundle from this photo. Treat unsuitable photo conditions as uncertainty, without diagnosis or treatment advice."},
        {type:"image_url",image_url:{url:imageUrl,detail:OPENAI_RUNTIME_IMAGE_DETAIL}}
      ]}
    ]
  };
}
function safeFailure(error) {
  return ALLOWED_ERRORS.has(error?.message)?error.message:"provider_request_failed";
}
function sanitizedTrial(caseId,variant,response) {
  const metrics=inspectSkinVisionTrial({
    caseId,variant,providerEnvelope:response.providerPayload
  });
  const evald=evaluateSkinVisionV2Candidate(response.parsed);
  const eligible=evald.eligibility;
  const rawRows=variant==="v2"&&Array.isArray(response.parsed?.skin?.axisEvidence)
    ?response.parsed.skin.axisEvidence:null;
  // The existing eligible-photo gate is stricter than ineligible-photo
  // abstention. Missing skin axes are never treated as normal/healthy.
  const eligibilityStatus=safeStatus(eligible?.status,ALLOWED_STATUS,"insufficient_evidence");
  const status=safeStatus(metrics.faceStatus,ALLOWED_FACE,"unavailable");
  const skinEligible=eligible?.skinAnalysisEligible===true;
  const faceEligible=eligible?.faceLabEligible===true;
  const v2AxisCount=rawRows?rawRows.length:null;
  const v2ContractStatus=variant!=="v2"?"not_applicable":
    skinEligible
      ? (v2AxisCount===7&&metrics.skinStatus==="ready"&&metrics.result==="STRUCTURALLY_VALID"
          ?"ELIGIBLE_SEVEN_VALIDATED":"ELIGIBLE_SKIN_EVIDENCE_HOLD")
      : (v2AxisCount===0?"EXPECTED_INELIGIBLE_EMPTY":"INELIGIBLE_NONEMPTY_OR_MISSING_HOLD");
  return {
    caseId,variant,responseComplete:metrics.responseComplete,finishReason:metrics.finishReason,
    inputTokens:metrics.inputTokens,outputTokens:metrics.outputTokens,
    elapsedMs:safeNumber(response.durationMs),nearTokenCap:metrics.nearTokenCap,
    structuralResult:metrics.result,faceStatus:status,
    faceAvailableFieldCount:safeNumber(metrics.faceAvailableFieldCount),
    eligibilityStatus,skinAnalysisEligible:skinEligible,faceLabEligible:faceEligible,
    skinStatus:metrics.skinStatus,skinAxisStates:metrics.skinAxisStates,
    v2AxisCount,v2ContractStatus,
    metadataOnly:true
  };
}
export async function runPrivatePhotoCohort({
  manifest,photoDir,environment=process.env,invoke=executeOpenAiChatJson,live=false,
  onPrivateProgress=()=>{}
}={}) {
  validatePrivateCohortManifest(manifest);
  const key=assertAllowedEnvironment(environment,live); // before any photo reads.
  const output=[],summaryRows=[],validated=[];
  const seenImageContent=new Set();
  let requests=0;
  // Preflight the ENTIRE 5-photo cohort before sending the first Provider
  // request; malformed/missing files never cause a partial live send.
  for(const item of manifest.cases) {
    try {
      const image=readPrivatePhoto(photoDir,item.filename,item.expectedWidth,item.expectedHeight);
      if(seenImageContent.has(image.contentFingerprint))
        throw new Error("duplicate_private_photo_content");
      seenImageContent.add(image.contentFingerprint);
      validated.push({caseId:item.caseId,image});
    } catch {
      return {
        version:PRIVATE_V1V2_VERSION,studyId:manifest.studyId,
        outcome:"HOLD_PRIVATE_PHOTO_INPUT",providerCallsAttempted:0,
        cases:[{caseId:item.caseId,verdict:"PRIVATE_PHOTO_INPUT_HOLD"}],
        pairedSummary:null,
        privacy:{humanPhotoSentToProvider:false,rawOutputsPersisted:false,
          photosSavedByRunner:false,gitHubActionsUsed:false},
        authority:{independentHumanEvaluationDone:false,photoAccuracyCertified:false,
          scoringOrDeploymentAuthorized:false,productReady:false,releaseReady:false}
      };
    }
  }
  for(const {caseId,image} of validated){
    if(!live){
      output.push({caseId,verdict:"PRIVATE_LOCAL_PRECHECK_ONLY",
        width:image.width,height:image.height,shortSidePx:Math.min(image.width,image.height),
        inputLowResolution:Math.min(image.width,image.height)<320});
      continue;
    }
    const rows=[];
    for(const variant of ["v1","v2"]) {
      if(requests>=PRIVATE_V1V2_MAX_CALLS)throw new Error("call_budget_exceeded");
      requests++;
      try{
        const response=await invoke({
          apiKey:key,body:requestBody(variant,image.imageUrl),
          stage:"vision-observation",timeoutMs:120000,
          maxResponseBytes:256*1024,logEvent:()=>{}
        });
        const trial=sanitizedTrial(caseId,variant,response);
        rows.push(trial);
        summaryRows.push({
          caseId:caseId,variant,
          result:trial.structuralResult,finishReason:trial.finishReason,
          outputTokens:trial.outputTokens,
          faceStatus:trial.faceStatus,
          faceAvailableFieldCount:trial.faceAvailableFieldCount,
          nearTokenCap:trial.nearTokenCap
        });
        onPrivateProgress({caseId:caseId,variant,completed:true,
          outputTokens:trial.outputTokens,finishReason:trial.finishReason});
      } catch(e) {
        rows.push({caseId:caseId,variant,verdict:"PROVIDER_ERROR_HOLD",
          errorClass:safeFailure(e)});
        output.push({caseId,verdict:"INCOMPLETE_PROVIDER_PAIR",variants:rows});
        return {
          version:PRIVATE_V1V2_VERSION,studyId:manifest.studyId,
          outcome:"HOLD_INCOMPLETE_PROVIDER_DATA",providerCallsAttempted:requests,
          cases:output,pairedSummary:null,
          privacy:{humanPhotoSentToProvider:true,rawOutputsPersisted:false,
            photosSavedByRunner:false,gitHubActionsUsed:false},
          authority:{independentHumanEvaluationDone:false,photoAccuracyCertified:false,
            scoringOrDeploymentAuthorized:false,productReady:false,releaseReady:false}
        };
      }
    }
    const trials=summaryRows.filter(row=>row.caseId===caseId);
    const paired=summarizeSkinVisionTrials(trials,{evidenceOrigin:"operator_review_pending"});
    const v2=rows.find(x=>x.variant==="v2");
    output.push({caseId,verdict:paired.structuralCandidatePass &&
      v2.v2ContractStatus==="ELIGIBLE_SEVEN_VALIDATED"
      ?"STRUCTURAL_PREFLIGHT_ONLY":"FACE_OR_SKIN_REVIEW_REQUIRED",
      photoShortSidePx:Math.min(image.width,image.height),variants:rows,
      faceParityStatus:paired.faceBaselineUnassessable
        ?"UNVERIFIABLE_FACE_BASELINE"
        :paired.faceStatusDegraded||paired.faceCoverageDegraded
          ?"DEGRADATION_REVIEW":"NO_COUNT_OR_STATUS_DEGRADATION_OBSERVED",
      faceStatusDegraded:paired.faceStatusDegraded>0,
      faceCoverageDegraded:paired.faceCoverageDegraded>0});
  }
  const pairedSummary=summaryRows.length? summarizeSkinVisionTrials(summaryRows,
    {evidenceOrigin:"operator_review_pending"}):null;
  return {
    version:PRIVATE_V1V2_VERSION,studyId:manifest.studyId,
    outcome:live?"PRIVATE_REAL_PHOTO_STRUCTURAL_REVIEW_ONLY":"PRIVATE_LOCAL_PRECHECK_ONLY",
    providerCallsAttempted:requests,cases:output,pairedSummary,
    privacy:{humanPhotoSentToProvider:live&&requests>0,
      rawOutputsPersisted:false,photosSavedByRunner:false,gitHubActionsUsed:false},
    authority:{userRightsAndTransferAttested:true,documentsIndependentlyVerified:false,
      independentHumanEvaluationDone:false,photoAccuracyCertified:false,
      scoringOrDeploymentAuthorized:false,productReady:false,releaseReady:false}
  };
}
