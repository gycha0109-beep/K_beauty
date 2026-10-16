// PRIVATE S1-D transport adapter. In-memory only, no logging, IO or persistence.
// The shared production HTTP runtime remains UNMODIFIED.
//
// The shared transport historically collapses JSON envelope errors and malformed
// model content into "provider_response_invalid". The research adapter returns
// a private sentinel instead of throwing on model-content JSON parse, so that
// it can read ONLY the existing envelope's closed finish_reason and bounded
// completion token counters before discarding all source text.
import { executeOpenAiChatJson } from "../../../lib/server/openai-chat-runtime.js";

const INVALID_PRIVATE_CONTENT=Object.freeze({privateInvalidContent:true});
const SAFE_FINISH=new Set(["stop","length","content_filter","tool_calls","function_call"]);
const OUTPUT_BUDGET=2200;
const cleanTokens=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000?n:null;

/** Real API requests are performed ONLY if this function is explicitly
 * invoked by the private, KEY2-gated runner. Fake fetchImpl is for tests.
 */
export async function executePrivateVisionChatJson(options={}) {
  const result=await executeOpenAiChatJson({
    ...options,
    parseContent:(text)=>{
      try {
        return JSON.parse(text);
      } catch {
        // Do not throw yet: providerPayload is still a local temporary value.
        return INVALID_PRIVATE_CONTENT;
      }
    }
  });
  if(result.parsed!==INVALID_PRIVATE_CONTENT)return result;

  const choice=result.providerPayload?.choices?.[0];
  const finishReason=SAFE_FINISH.has(choice?.finish_reason)
    ?choice.finish_reason:"unknown";
  const outputTokens=cleanTokens(result.providerPayload?.usage?.completion_tokens);
  const errorClass=finishReason==="length"?"provider_output_truncated":
    finishReason==="content_filter"?"provider_output_filtered":
    "provider_content_json_invalid";
  const e=new Error(errorClass);
  // No Provider text, face properties, identifiers, URLs or raw usage escapes.
  Object.defineProperty(e,"privateSafeDiagnostic",{
    enumerable:false,
    value:Object.freeze({
      finishReason,
      outputTokens,
      nearTokenCap:outputTokens!==null&&outputTokens*10>=OUTPUT_BUDGET*9
    })
  });
  throw e;
}
