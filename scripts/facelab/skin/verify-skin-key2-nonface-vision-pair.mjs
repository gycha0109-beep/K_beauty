import assert from "node:assert/strict";
import { createNonfaceGeometricPng, runKey2NonfaceVisionPair } from "./skin-key2-nonface-vision-pair.mjs";
import { SKIN_VISIBLE_AXES } from "./skin-axis-evidence-contract-core.mjs";

const image = createNonfaceGeometricPng();
assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
assert.equal(image.readUInt32BE(16), 96);
assert.equal(image.readUInt32BE(20), 96);
assert.ok(image.length < 20000);

const secret = "KEY2-SYNTHETIC-MOCK-ONLY-NOT-A-REAL-SECRET";
const production = "DO-NOT-USE-PRODUCTION-MOCK";
const calls = [];
const stub = async (args) => {
  assert.equal(args.apiKey, secret);
  assert.equal(args.stage, "vision-observation");
  assert.equal(args.timeoutMs, 120000);
  assert.equal(args.maxResponseBytes, 256 * 1024);
  assert.equal(typeof args.logEvent, "function");
  assert.equal(args.body.max_completion_tokens, 2200);
  assert.equal(args.body.messages.length, 2);
  assert.equal(args.body.messages[1].content.length, 2);
  const content = args.body.messages[1].content;
  const url = content[1].image_url.url;
  assert.match(url, /^data:image\/png;base64,/);
  assert.deepEqual(Buffer.from(url.split(",")[1], "base64"), image);
  assert.ok(!JSON.stringify(args.body).includes("OPENAI_API_KEY"));
  assert.ok(!JSON.stringify(args.body).includes(production));
  assert.equal(args.body.response_format.type, "json_object");
  assert.equal(args.body.model, "gpt-5.6-luna");
  calls.push({url, system: args.body.messages[0].content});
  const variant = calls.length === 1 ? "v1" : "v2";
  const eligibility = {
    status: "ineligible", source: "vision", imageType: "other", humanFaceCount: 0,
    faceLabEligible: false, skinAnalysisEligible: false,
    faceLabFailureReason: "face_not_detected", skinFailureReason: "face_not_detected",
    confidence: 0.99, evidence: ["synthetic colored squares; no person"]
  };
  const observed = variant === "v1"
    ? {
      schemaVersion: "vision-observation-v1", eligibility,
      skin: { signals: Object.fromEntries([...SKIN_VISIBLE_AXES, "uv"].map(axis => [axis, 0])), observations: [] },
      face: {}
    }
    : {
      schemaVersion: "vision-observation-v2", eligibility,
      skin: { axisEvidence: [] },
      face: {}
    };
  return {
    status: 200, parsed: observed, durationMs: variant === "v1" ? 1100 : 1700,
    providerPayload: {
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(observed) } }],
      usage: { prompt_tokens: 380, completion_tokens: 190 }
    }
  };
};
const result = await runKey2NonfaceVisionPair({
  environment: { OPENAI_API_KEY2: secret, OPENAI_API_KEY: production },
  invoke: stub
});
assert.equal(calls.length, 2);
assert.equal(calls[0].url, calls[1].url);
assert.notEqual(calls[0].system, calls[1].system);
assert.match(calls[0].system, /vision-observation-v1/);
assert.match(calls[1].system, /vision-observation-v2/);
assert.equal(result.providerCallsAttempted, 2);
assert.equal(result.verdict, "NONFACE_PROVIDER_INELIGIBLE_ABSTENTION_OBSERVED_REVIEW_ONLY");
assert.equal(result.variants[0].outputTokens, 190);
assert.equal(result.variants[1].finishReason, "stop");
assert.equal(result.timingsAndCostAvailability.matchedPairs, 1);
assert.equal(result.variants[0].eligibilityStatus, "ineligible");
assert.equal(result.variants[1].eligibilityStatus, "ineligible");
assert.equal(result.variants[1].skinAnalysisEligible, false);
assert.equal(result.variants[1].nonfaceAbstentionExpected, true);
assert.equal(result.variants[1].v2AxisRowsReturned, 0);
assert.equal(result.variants[1].interpretation, "EXPECTED_INELIGIBLE_EMPTY_AXES_RESEARCH_ONLY");
assert.equal(result.variants[1].v2AbstentionAudit.nonfaceEligibilityVerified, true);
assert.equal(result.variants[1].v2AbstentionAudit.withheldPositiveOrZeroCues, true);
assert.equal(result.variants[1].v2AbstentionAudit.axisShapeValid, true);
assert.equal(result.variants[1].v2AbstentionAudit.stateCounts.unknown, 0);
assert.equal(result.variants[1].v2AbstentionAudit.productReady, false);
assert.equal(result.variants[1].v2AbstentionAudit.ownerApprovalPending, true);
assert.equal(result.variants[1].v2AbstentionAudit.releaseReady, false);
assert.equal(result.timingsAndCostAvailability.pairedTimings, 1);
assert.equal(result.timingsAndCostAvailability.pairedCosts, 0);
assert.equal(result.trustBoundary.realHumanPhotoTransmitted, false);
assert.equal(result.trustBoundary.noProductionKeyFallback, true);
assert.equal(result.trustBoundary.productReady, false);
assert.equal(result.trustBoundary.releaseReady, false);
assert.equal(JSON.stringify(result).includes(secret), false);
assert.equal(JSON.stringify(result).includes(production), false);
assert.equal(JSON.stringify(result).includes("data:image"), false);
assert.equal(JSON.stringify(result).includes("image_url"), false);

let tried = 0;
await assert.rejects(runKey2NonfaceVisionPair({
  environment: { OPENAI_API_KEY: production },
  invoke: async () => { tried++; throw Error("should not invoke"); }
}), /key2_not_injected/);
assert.equal(tried, 0);
const badCredential = await runKey2NonfaceVisionPair({
  environment: { OPENAI_API_KEY2: secret },
  invoke: async () => { tried++; throw Error("provider_http_401"); }
});
assert.equal(badCredential.providerCallsAttempted, 1);
assert.equal(badCredential.variants[0].errorClass, "provider_http_401");
assert.equal(badCredential.verdict, "NONFACE_PROVIDER_RESPONSE_INCOMPLETE");
assert.equal(badCredential.structuralPair, null);
assert.equal(badCredential.timingsAndCostAvailability.unmatchedCases, 1);
const failed = await runKey2NonfaceVisionPair({
  environment: { OPENAI_API_KEY2: secret },
  invoke: async () => { throw Error("secret backend message must never leak"); }
});
assert.equal(failed.providerCallsAttempted, 2);
assert.equal(failed.verdict, "NONFACE_PROVIDER_RESPONSE_INCOMPLETE");
assert.equal(failed.timingsAndCostAvailability.pairedTimings, 0);
assert.equal(JSON.stringify(failed).includes("secret backend"), false);
console.log("verify-skin-key2-nonface-vision-pair: PASS (synthetic only, mock-only transport, no Provider or human photo)");
