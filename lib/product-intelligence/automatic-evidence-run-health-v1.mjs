export const AUTOMATIC_EVIDENCE_RUN_HEALTH_VERSION="automatic-evidence-run-health-v1";
export const RUN_HEALTH_STALE_HOURS=36;
export const RUN_HEALTH_RUNNING_MINUTES=20;
const EVENTS=new Set(["started","success","failure"]);
const TABLE="automatic_product_evidence_run_events_v1";
const LIMIT=100;
const VERSION=AUTOMATIC_EVIDENCE_RUN_HEALTH_VERSION;

function fail(code){throw new Error(code);}
function isValidRunId(value) {
  return typeof value==="string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Server-side operation only. No writes to evaluation history, approvals or products. */
export async function appendAutomaticEvidenceRunEvent(client,runId,kind,result=null) {
  if(!client || typeof client.from!=="function" ||
    !isValidRunId(runId) || !EVENTS.has(kind))
    fail("AUTO_EVIDENCE_RUN_INVALID_INPUT");
  const summary=result ?? {};
  const checked=kind==="started"?0:summary.checked ?? 0;
  const recorded=kind==="started"?0:summary.recorded ?? 0;
  const duplicates=kind==="started"?0:summary.duplicates ?? 0;
  const needsReview=kind==="started"?0:summary.needsReview ?? 0;
  const failed=kind==="started"?0:summary.failed ?? 0;
  const code=kind!=="failure"?null:(
    summary.errorCode==="AUTO_EVIDENCE_UNHANDLED"
      ?"AUTO_EVIDENCE_UNHANDLED":"AUTO_EVIDENCE_EVALUATION_FAILED");
  if([checked,recorded,duplicates,needsReview,failed].some(n=>
    !Number.isInteger(n) || n<0 || n>1))
    fail("AUTO_EVIDENCE_RUN_INVALID_COUNTS");
  if(kind==="success" && (checked!==1 || failed!==0 || recorded+duplicates!==checked))
    fail("AUTO_EVIDENCE_RUN_INVALID_SUCCESS");
  if(kind==="failure" && !(checked===1 && failed===1 && recorded+duplicates<=1) &&
     !(checked===0 && failed===0 && recorded===0 && duplicates===0 && needsReview===0))
    fail("AUTO_EVIDENCE_RUN_INVALID_FAILURE");
  const {error}=await client.from(TABLE).insert({
    run_id:runId,event_kind:kind,contract_version:VERSION,
    checked_count:checked,inserted_count:recorded,
    duplicate_count:duplicates,exception_count:needsReview,
    failed_count:failed,error_code:code,
  });
  if(error) fail("AUTO_EVIDENCE_RUN_WRITE_FAILED");
  return Object.freeze({recorded:true,kind,runId});
}

/**
 * Decisions derive strictly from durable run events, not evaluation history.
 * Empty means unobserved, not healthy; a new unmatched start is interrupted
 * after 20 minutes. Last success older than 36 hours is stale.
 */
export function assessAutomaticEvidenceRunHealth(input,now=new Date()) {
  if(!Array.isArray(input) || !Number.isFinite(now.getTime()))
    fail("AUTO_EVIDENCE_RUN_INVALID_HISTORY");
  if(input.length===0) return Object.freeze({
    state:"unobserved",warning:true,lastStartedAt:null,lastSuccessAt:null,
    lastCompletedAt:null,latestEventKind:null,ageHours:null,
    reason:"NO_RUN_EVENTS",
  });
  const rows=[...input];
  if(rows.some(r=>!r || !isValidRunId(r.run_id) ||
    !EVENTS.has(r.event_kind) || !Number.isFinite(Date.parse(r.recorded_at??"")) ||
    !Number.isSafeInteger(r.event_id)))
    fail("AUTO_EVIDENCE_RUN_INVALID_HISTORY");
  rows.sort((a,b)=>b.event_id-a.event_id);
  const latest=rows[0];
  const recentStart=rows.find(r=>r.event_kind==="started");
  const recentSuccess=rows.find(r=>r.event_kind==="success");
  const recentCompleted=rows.find(r=>r.event_kind!=="started");
  const lastSuccessAt=recentSuccess?.recorded_at??null;
  const lastStartedAt=recentStart?.recorded_at??null;
  const lastCompletedAt=recentCompleted?.recorded_at??null;
  const completionForLatest=rows.find(r=>
    r.run_id===latest.run_id && r.event_kind!=="started");
  const startIsPending=latest.event_kind==="started"&&!completionForLatest;
  const ageHours=lastSuccessAt === null ? null :
    Math.max(0,(now.getTime()-Date.parse(lastSuccessAt))/3600000);
  const baseline={lastStartedAt,lastSuccessAt,lastCompletedAt,
    latestEventKind:latest.event_kind,ageHours,
    lastChecked:latest.checked_count??0,
    lastInserted:latest.inserted_count??0,
    lastDuplicates:latest.duplicate_count??0,
    lastExceptions:latest.exception_count??0};
  if(startIsPending) {
    const pendingMinutes=(now.getTime()-Date.parse(latest.recorded_at))/60000;
    if(pendingMinutes<0) return Object.freeze({...baseline,
      state:"clock_error",warning:true,reason:"FUTURE_START_TIME"});
    if(pendingMinutes>RUN_HEALTH_RUNNING_MINUTES) return Object.freeze({...baseline,
      state:"interrupted",warning:true,reason:"UNFINISHED_RUN"});
    return Object.freeze({...baseline,
      state:"running",warning:false,reason:"RUN_IN_PROGRESS"});
  }
  if(latest.event_kind==="failure") return Object.freeze({...baseline,
    state:"failed",warning:true,reason:"LATEST_RUN_FAILED"});
  if(!lastSuccessAt) return Object.freeze({...baseline,
    state:"unobserved",warning:true,reason:"NO_SUCCESSFUL_RUN"});
  if(ageHours>RUN_HEALTH_STALE_HOURS) return Object.freeze({...baseline,
    state:"stale",warning:true,reason:"LAST_SUCCESS_EXPIRED"});
  return Object.freeze({...baseline,state:"healthy",warning:false,reason:"LAST_SUCCESS_FRESH"});
}

/** Admin-only server caller. Query failure must never be shown as healthy. */
export async function readAutomaticEvidenceRunHealth(client,now=new Date()) {
  if(!client || typeof client.from!=="function")
    fail("AUTO_EVIDENCE_RUN_CLIENT_UNAVAILABLE");
  const {data,error}=await client.from(TABLE)
    .select("event_id,run_id,event_kind,recorded_at,checked_count,inserted_count,duplicate_count,exception_count,failed_count,error_code")
    .order("event_id",{ascending:false}).limit(LIMIT);
  if(error||!Array.isArray(data)) fail("AUTO_EVIDENCE_RUN_READ_FAILED");
  return Object.freeze({
    ...assessAutomaticEvidenceRunHealth(data,now),
    limitedWindow:data.length===LIMIT,
    observedEvents:data.length,
  });
}
