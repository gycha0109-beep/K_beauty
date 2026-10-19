/**
 * Bounded, status-only diagnostics for official page request failures.
 * NEVER persist arbitrary error text, URLs, response bodies, headers or causes.
 * Error classification is observational, not proof of site policy or content.
 */
export const TRUST_P2_FETCH_DIAGNOSTIC_VERSION="trust-p2-fetch-diagnostic-v1";

const CONNECT_FAILURE=new Set([
  "ENOTFOUND","EAI_AGAIN","ECONNREFUSED","ECONNRESET",
  "EHOSTUNREACH","ENETUNREACH","ETIMEDOUT",
]);

export function diagnoseTrustP2FetchFailure(error){
  const message=String(error?.message??"");
  const http=/^(?:SOURCE_BLOCKED|TRANSIENT_FAILURE):http_(\d{3})$/u.exec(message);
  if(http){
    const status=Number(http[1]);
    const reason=status===403||status===401?"HTTP_ACCESS_REJECTED":
      status===404||status===410?"HTTP_NOT_FOUND":
      status===429?"HTTP_RATE_LIMIT":
      status>=500?"HTTP_SERVER_FAILURE":"HTTP_STATUS_FAILURE";
    return Object.freeze({version:TRUST_P2_FETCH_DIAGNOSTIC_VERSION,
      reason,httpStatus:status});
  }
  let reason="UNCLASSIFIED_FAILURE";
  if(message==="SOURCE_BLOCKED:redirect_response"||
    message==="SOURCE_BLOCKED:redirect_limit")reason="REDIRECT_REJECTED";
  else if(message==="SOURCE_BLOCKED:response_too_large")reason="BYTE_LIMIT_REJECTED";
  else if(message==="SOURCE_BLOCKED:unsupported_content_type")
    reason="CONTENT_TYPE_REJECTED";
  else if(message.startsWith("SOURCE_BLOCKED:"))reason="SOURCE_POLICY_OR_SAFETY_BLOCKED";
  else if(message==="TRANSIENT_FAILURE:fetch_error"){
    const cause=error?.cause;
    const name=String(cause?.name??"");
    const code=String(cause?.code??cause?.cause?.code??"");
    reason=name==="AbortError"||code==="ABORT_ERR"?
      "REQUEST_TIMEOUT":CONNECT_FAILURE.has(code)?
      "NETWORK_CONNECTION_FAILURE":"NETWORK_FAILURE_UNCLASSIFIED";
  }else if(message.startsWith("TRANSIENT_FAILURE:"))
    reason="TRANSIENT_FAILURE_UNCLASSIFIED";
  return Object.freeze({version:TRUST_P2_FETCH_DIAGNOSTIC_VERSION,
    reason,httpStatus:null});
}
