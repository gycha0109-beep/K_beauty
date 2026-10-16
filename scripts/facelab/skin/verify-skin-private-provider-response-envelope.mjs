// Mock-only safe parser triage. Does not open photos, use a real key or
// call OpenAI. Tests the HTTP transport with a fabricated fetch Response.
import assert from "node:assert/strict";
import { executePrivateVisionChatJson } from "./skin-private-provider-response-envelope.mjs";

const FAKE_KEY="MOCK_PROVIDER_KEY_NOT_REAL_SECRET";
const OPTIONS={
  apiKey:FAKE_KEY,body:{model:"gpt-5.6-luna",messages:[]},
  stage:"vision-observation",timeoutMs:120000,
  maxResponseBytes:256*1024,logEvent:()=>{}
};
const envelope=(text,finish="stop",tokens=1000)=>({
  choices:[{finish_reason:finish,message:{content:text}}],
  usage:{prompt_tokens:300,completion_tokens:tokens}
});
const mockFetch=data=>async(url,config)=>{
  assert.equal(url,"https://api.openai.com/v1/chat/completions");
  assert.equal(config.method,"POST");
  assert.equal(config.redirect,"manual");
  assert.equal(config.headers.Authorization,"Bearer "+FAKE_KEY);
  return new Response(data,{status:200,
    headers:{"content-type":"application/json"}});
};
async function expectBad(content,finish,tokens,errorCode) {
  const raw=JSON.stringify(envelope(content,finish,tokens));
  const fetchImpl=mockFetch(raw);
  let caught=null;
  try {
    await executePrivateVisionChatJson({...OPTIONS,fetchImpl});
  } catch(err) {caught=err;}
  assert(caught,"malformed content must never be accepted");
  assert.equal(caught.message,errorCode);
  assert.equal(caught.privateSafeDiagnostic.finishReason,finish);
  assert.equal(caught.privateSafeDiagnostic.outputTokens,tokens);
  assert.equal(caught.privateSafeDiagnostic.nearTokenCap,tokens>=1980);
  assert.equal(JSON.stringify(caught).includes(content),false);
  assert.equal(JSON.stringify(caught.privateSafeDiagnostic).includes(FAKE_KEY),false);
  return caught;
}
await expectBad('{"skin":{"axisEvidence":[',"length",2200,"provider_output_truncated");
await expectBad('{"skin":{"axisEvidence":[',"stop",1612,"provider_content_json_invalid");
await expectBad("NOT_JSON_PRIVATE_FACE_SECRET","content_filter",2000,"provider_output_filtered");
const near=await expectBad("NOT_JSON","stop",1980,"provider_content_json_invalid");
assert.equal(near.privateSafeDiagnostic.nearTokenCap,true);

const valid=await executePrivateVisionChatJson({
  ...OPTIONS,fetchImpl:mockFetch(JSON.stringify(envelope('{"schemaVersion":"vision-observation-v2"}',"stop",1700)))
});
assert.deepEqual(valid.parsed,{schemaVersion:"vision-observation-v2"});
assert.equal(valid.providerPayload.choices[0].finish_reason,"stop");

await assert.rejects(executePrivateVisionChatJson({
  ...OPTIONS,fetchImpl:mockFetch("not an envelope json")
}),/provider_response_invalid/);
await assert.rejects(executePrivateVisionChatJson({
  ...OPTIONS,fetchImpl:mockFetch(JSON.stringify(envelope("")))
}),/provider_response_empty/);

console.log("verify-skin-private-provider-response-envelope: PASS (mock-only, safe length/content/error triage, zero API calls)");
