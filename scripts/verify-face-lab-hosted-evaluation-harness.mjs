import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  acquireRunLock,
  decideRetry,
  detectImageMime,
  executeFaceLabEvaluationRequest,
  parseRetryAfterBodyHint,
  parseRetryAfterHeader,
  parseSafeInteger,
  readValidatedImageFile,
  resolveFaceLabEvaluationEndpoint,
  selectRetryAfterMs
} from "../lib/face-lab-hosted-evaluation-transport.mjs";

function loadCore() {
  const source = readFileSync("lib/face-lab-hosted-evaluation.js", "utf8")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");
  return Function(`${source}\nreturn { validateHostedEvaluationManifest, buildHostedEvaluationCases, projectHostedEvaluationRecord, createNotAttemptedHostedEvaluationRecord, adaptLegacyHostedEvaluationRecord, parseHostedEvaluationJsonLines, selectLatestFinalHostedEvaluationRecords, getPendingHostedEvaluationCases, getNextHostedEvaluationAttemptSequence, auditHostedEvaluationResponse, classifyHostedEvaluationPayload, isCanonicalAnalysisValid, summarizeHostedEvaluation, renderHostedEvaluationReport, createHostedEvaluationRunManifest, jaccardSimilarity };`)();
}

const core = loadCore();
let checks = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(() => {
    checks += 1;
    process.stdout.write(`ok ${checks} - ${name}\n`);
  });
}

const analysis = {
  schemaVersion: "face-lab-observation-v1",
  status: "available",
  failureReason: null,
  quality: {
    status: "available",
    confidence: 0.9,
    unavailableReason: null,
    value: {
      faceVisibility: "clear",
      faceScale: "adequate",
      pose: { yaw: "frontal", pitch: "level", roll: "level" },
      occlusion: { forehead: "none", eyes: "none", jawline: "none" },
      sharpness: "clear",
      exposure: "balanced",
      lightingUniformity: "even",
      whiteBalance: "stable",
      filterOrEditing: "none_detected",
      makeupCoverage: "none_or_light",
      structureSuitability: "suitable",
      colorSuitability: "suitable"
    }
  },
  observations: {
    outline: {
      faceShape: {
        status: "available",
        source: "vision",
        value: "oval",
        confidence: 0.9,
        unavailableReason: null,
        evidence: ["not persisted"]
      }
    }
  },
  coverage: {
    availableGroups: ["outline"],
    partialGroups: [],
    unavailableGroups: [],
    availableFieldCount: 1,
    totalCoreFieldCount: 1
  },
  warnings: [],
  privacy: { sourceImagePersisted: false }
};

function eligiblePayload(extra = {}) {
  return {
    status: "available",
    source: "vision",
    failureReason: null,
    analyzedAt: "2026-07-17T00:00:00.000Z",
    eligibility: {
      status: "eligible",
      imageType: "photorealistic_human",
      humanFaceCount: 1,
      faceLabEligible: true,
      faceLabFailureReason: null
    },
    data: { analysis, base_data: {}, features: {}, structured: {} },
    ...extra
  };
}

function ineligiblePayload() {
  return {
    status: "unavailable",
    source: null,
    failureReason: "face_not_detected",
    analyzedAt: "2026-07-17T00:00:00.000Z",
    eligibility: {
      status: "ineligible",
      imageType: "product",
      humanFaceCount: 0,
      faceLabEligible: false,
      faceLabFailureReason: "face_not_detected"
    },
    data: null
  };
}

const baseCase = {
  caseId: "subject-a-clear:ko:1",
  fixtureId: "subject-a-clear",
  subjectId: "subject-a",
  comparisonGroup: "subject-a-structure",
  variantRole: "baseline",
  conditionTags: ["frontal", "clear"],
  expectedEligibility: "eligible",
  expectedDegradation: "none",
  locale: "ko",
  repetition: 1
};

function recordFor({
  caseDefinition = baseCase,
  sequence = 1,
  attemptSequence = 1,
  transport = { status: "success", httpStatus: 200, attemptCount: 1, retryCount: 0, retryExhausted: false, retryAfterMs: null, durationMs: 10, reasonCode: null },
  payload = eligiblePayload()
} = {}) {
  return core.projectHostedEvaluationRecord({
    runId: "run-1",
    caseDefinition,
    recordSequence: sequence,
    attemptSequence,
    transport,
    responsePayload: payload
  });
}

function makeResponse(status, body, headers = {}, url = "http://localhost:3001/api/face-reading") {
  const bytes = new TextEncoder().encode(body);
  return {
    status,
    url,
    headers: new Headers(headers),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      }
    })
  };
}

function queueFetch(responses, observed = []) {
  return async (_url, options) => {
    observed.push(options);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    if (typeof next === "function") return next(options);
    return next;
  };
}

const endpoint = "http://localhost:3001/api/face-reading";
const expectedOrigin = "http://localhost:3001";
const noBody = () => new FormData();

await check("1. 200 normal response", async () => {
  const result = await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: queueFetch([makeResponse(200, JSON.stringify(eligiblePayload()))]),
    maxAttemptsRemaining: 1
  });
  assert.equal(result.transport.status, "success");
  assert.equal(result.payload.status, "available");
});

await check("2. 429 numeric Retry-After retries then succeeds", async () => {
  const result = await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: queueFetch([
      makeResponse(429, JSON.stringify({ message: "limited" }), { "retry-after": "1" }),
      makeResponse(200, JSON.stringify(eligiblePayload()))
    ]),
    maxAttemptsRemaining: 2,
    maxRetriesPerCase: 1,
    sleep: async (ms) => assert.equal(ms, 1000)
  });
  assert.equal(result.transport.status, "success");
  assert.equal(result.transport.retryCount, 1);
});

await check("3. 429 HTTP-date Retry-After is parsed", () => {
  const now = Date.parse("2026-07-17T00:00:00Z");
  assert.equal(parseRetryAfterHeader("Fri, 17 Jul 2026 00:00:03 GMT", { nowMs: now }), 3000);
});

await check("4. 429 body retryAfterSeconds is parsed", () => {
  assert.equal(parseRetryAfterBodyHint({ retryAfterSeconds: 2 }), 2000);
  assert.equal(selectRetryAfterMs({ headerValue: "1", payload: { retryAfterSeconds: 3 }, nowMs: 0 }), 3000);
});

await check("5. 429 without hint does not retry by default", async () => {
  let calls = 0;
  const result = await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: async () => { calls += 1; return makeResponse(429, JSON.stringify({ message: "limited" })); },
    maxAttemptsRemaining: 2,
    maxRetriesPerCase: 1
  });
  assert.equal(calls, 1);
  assert.equal(result.transport.status, "rate_limited");
  assert.equal(result.transport.reasonCode, "rate_limit_hint_missing");
});

await check("6. repeated 429 is terminal", async () => {
  const result = await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: queueFetch([
      makeResponse(429, JSON.stringify({ retryAfterSeconds: 0 })),
      makeResponse(429, JSON.stringify({ retryAfterSeconds: 0 }))
    ]),
    maxAttemptsRemaining: 2,
    maxRetriesPerCase: 1,
    sleep: async () => {}
  });
  assert.equal(result.transport.status, "rate_limited");
  assert.equal(result.transport.attemptCount, 2);
  assert.equal(result.transport.retryExhausted, true);
});

await check("7. circuit-open cases become not_attempted", () => {
  const record = core.createNotAttemptedHostedEvaluationRecord({
    runId: "run-1", caseDefinition: baseCase, recordSequence: 1, attemptSequence: 1,
    reasonCode: "rate_limit_circuit_open"
  });
  assert.equal(record.transport.status, "not_attempted");
  assert.equal(record.transport.reasonCode, "rate_limit_circuit_open");
  assert.equal(record.evaluation.eligibilityComparison, "not_evaluable");
});

await check("8. 502 retries once then succeeds", async () => {
  const result = await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: queueFetch([makeResponse(502, "{}"), makeResponse(200, JSON.stringify(eligiblePayload()))]),
    maxAttemptsRemaining: 2,
    maxRetriesPerCase: 1,
    sleep: async () => {}
  });
  assert.equal(result.transport.status, "success");
  assert.equal(result.transport.retryCount, 1);
});

await check("9. 503 retry exhausts", async () => {
  const result = await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: queueFetch([makeResponse(503, "{}"), makeResponse(503, "{}")]),
    maxAttemptsRemaining: 2,
    maxRetriesPerCase: 1,
    sleep: async () => {}
  });
  assert.equal(result.transport.status, "server_error");
  assert.equal(result.transport.retryExhausted, true);
});

await check("10. 504 retry exhausts", async () => {
  const result = await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: queueFetch([makeResponse(504, "{}"), makeResponse(504, "{}")]),
    maxAttemptsRemaining: 2,
    maxRetriesPerCase: 1,
    sleep: async () => {}
  });
  assert.equal(result.transport.status, "server_error");
  assert.equal(result.transport.retryExhausted, true);
});

await check("11. 500 does not retry", async () => {
  let calls = 0;
  const result = await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: async () => { calls += 1; return makeResponse(500, "{}"); },
    maxAttemptsRemaining: 2,
    maxRetriesPerCase: 1
  });
  assert.equal(calls, 1);
  assert.equal(result.transport.reasonCode, "server_error_500_non_retryable");
});

await check("12. terminal client errors do not retry", async () => {
  for (const status of [400, 401, 403, 404, 413, 415, 422]) {
    let calls = 0;
    const result = await executeFaceLabEvaluationRequest({
      endpoint, expectedOrigin, formDataFactory: noBody,
      fetchImpl: async () => { calls += 1; return makeResponse(status, "{}"); },
      maxAttemptsRemaining: 2,
      maxRetriesPerCase: 1
    });
    assert.equal(calls, 1);
    assert.equal(result.transport.status, "client_error");
  }
});

await check("13. timeout does not retry by default", async () => {
  let calls = 0;
  const result = await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: async (_url, { signal }) => {
      calls += 1;
      await new Promise((_, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("abort"), { name: "AbortError" }))));
    },
    timeoutMs: 5,
    maxAttemptsRemaining: 2,
    maxRetriesPerCase: 1
  });
  assert.equal(calls, 1);
  assert.equal(result.transport.status, "timeout");
});

await check("14. network error does not retry by default", async () => {
  let calls = 0;
  const result = await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: async () => { calls += 1; throw new TypeError("socket closed"); },
    maxAttemptsRemaining: 2,
    maxRetriesPerCase: 1
  });
  assert.equal(calls, 1);
  assert.equal(result.transport.status, "network_error");
});

await check("15. ambiguous failure retries only when enabled", async () => {
  const result = await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: queueFetch([new TypeError("socket"), makeResponse(200, JSON.stringify(eligiblePayload()))]),
    maxAttemptsRemaining: 2,
    maxRetriesPerCase: 1,
    retryAmbiguousFailures: true,
    sleep: async () => {}
  });
  assert.equal(result.transport.status, "success");
  assert.equal(result.transport.retryCount, 1);
});

await check("16. max-attempts prevents retry", async () => {
  const result = await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: queueFetch([makeResponse(502, "{}")]),
    maxAttemptsRemaining: 1,
    maxRetriesPerCase: 1
  });
  assert.equal(result.transport.status, "server_error");
  assert.equal(result.transport.reasonCode, "max_attempts_reached");
});

await check("17. max retry wait blocks retry", () => {
  assert.deepEqual(decideRetry({
    status: "rate_limited", httpStatus: 429, retryCount: 0, maxRetriesPerCase: 1,
    retryAfterMs: 120001, maxRetryWaitMs: 120000
  }), { retry: false, reasonCode: "retry_wait_exceeds_limit", waitMs: 120001 });
});

await check("18. redirect following is disabled", async () => {
  const observed = [];
  await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: queueFetch([new TypeError("redirect mode is error")], observed),
    maxAttemptsRemaining: 1
  });
  assert.equal(observed[0].redirect, "error");
});

await check("19. changed response origin is rejected", async () => {
  const result = await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: queueFetch([makeResponse(200, JSON.stringify(eligiblePayload()), {}, "http://evil.example/api/face-reading")]),
    maxAttemptsRemaining: 1
  });
  assert.equal(result.transport.status, "network_error");
  assert.equal(result.transport.reasonCode, "response_origin_changed");
});

await check("20-23. non-success is not evaluable and not mismatch/privacy", () => {
  const record = recordFor({
    transport: { status: "rate_limited", httpStatus: 429, attemptCount: 1, retryCount: 0, retryExhausted: false, retryAfterMs: 1000, durationMs: 5, reasonCode: "rate_limit_hint_missing" },
    payload: { message: "limited", retryAfterSeconds: 1 }
  });
  assert.equal(record.evaluation.canonicalStatus, "not_evaluable");
  assert.equal(record.evaluation.eligibilityComparison, "not_evaluable");
  assert.equal(record.evaluation.privacyStatus, "pass");
  assert.equal(record.evaluation.unexpectedResponseShape, false);
});

await check("24. malformed HTTP 200 canonical fails", () => {
  const record = recordFor({ payload: { status: "available", eligibility: eligiblePayload().eligibility, data: { analysis: { schemaVersion: "wrong" } } } });
  assert.equal(record.evaluation.canonicalStatus, "invalid");
});

await check("25. expected ineligible unavailable response matches", () => {
  const ineligibleCase = { ...baseCase, caseId: "control-product:ko:1", fixtureId: "control-product", subjectId: "control-product", expectedEligibility: "ineligible", variantRole: "control", expectedDegradation: "eligibility_block" };
  const record = recordFor({ caseDefinition: ineligibleCase, payload: ineligiblePayload() });
  assert.equal(record.evaluation.canonicalStatus, "valid");
  assert.equal(record.evaluation.eligibilityComparison, "match");
});

await check("26. expected eligible actual ineligible mismatches", () => {
  const record = recordFor({ payload: ineligiblePayload() });
  assert.equal(record.evaluation.eligibilityComparison, "mismatch");
});

await check("27-29. raw observation/image/source persistence violate privacy", () => {
  for (const payload of [
    { ...eligiblePayload(), data: { ...eligiblePayload().data, observation_analysis: { raw: true } } },
    { ...eligiblePayload(), imageUrl: "data:image/jpeg;base64,ZmFrZQ==" },
    { ...eligiblePayload(), data: { ...eligiblePayload().data, analysis: { ...analysis, privacy: { sourceImagePersisted: true } } } }
  ]) {
    assert.equal(core.auditHostedEvaluationResponse(payload).privacyStatus, "violation");
  }
});

await check("30-31. error message is not privacy; unknown key is shape diagnostic", () => {
  const ordinary = core.auditHostedEvaluationResponse({ message: "too many requests", retryAfterSeconds: 3 });
  assert.equal(ordinary.privacyStatus, "pass");
  assert.equal(ordinary.unexpectedResponseShape, false);
  const unknown = core.auditHostedEvaluationResponse({ message: "x", vendorTrace: "y" });
  assert.equal(unknown.privacyStatus, "pass");
  assert.equal(unknown.unexpectedResponseShape, true);
});

await check("32. actual contract failure yields FAIL", () => {
  const bad = recordFor({ payload: { ...eligiblePayload(), imageUrl: "data:image/png;base64,AA==" } });
  const summary = core.summarizeHostedEvaluation([bad], { runId: "run-1", datasetId: "d", plan: "smoke", plannedCalls: 1 }, { valid: true, errors: [] });
  assert.equal(summary.gateStatus, "FAIL");
});

await check("33. no contract failure plus unevaluable yields INCONCLUSIVE", () => {
  const limited = recordFor({ transport: { status: "rate_limited", httpStatus: 429, attemptCount: 1, retryCount: 0, retryExhausted: false, retryAfterMs: null, durationMs: 2, reasonCode: "rate_limit_hint_missing" }, payload: { message: "limited" } });
  const summary = core.summarizeHostedEvaluation([limited], { plannedCalls: 1 }, { valid: true, errors: [] });
  assert.equal(summary.gateStatus, "INCONCLUSIVE");
});

await check("34. complete clean evaluation yields PASS", () => {
  const summary = core.summarizeHostedEvaluation([recordFor()], { plannedCalls: 1 }, { valid: true, errors: [] });
  assert.equal(summary.gateStatus, "PASS");
  assert.equal(summary.evaluationComplete, true);
});

await check("35. failure plus incomplete is FAIL and incomplete", () => {
  const bad = recordFor({ payload: { ...eligiblePayload(), data: { analysis: { schemaVersion: "wrong" } } } });
  const summary = core.summarizeHostedEvaluation([bad], { plannedCalls: 2 }, { valid: true, errors: [] });
  assert.equal(summary.gateStatus, "FAIL");
  assert.equal(summary.evaluationComplete, false);
});

await check("36-38. resume skips success/nonretryable and reruns retryable/not_attempted", () => {
  const cases = [baseCase];
  const success = recordFor();
  assert.equal(core.getPendingHostedEvaluationCases(cases, [success]).length, 0);
  const client = recordFor({ transport: { status: "client_error", httpStatus: 400, attemptCount: 1, retryCount: 0, retryExhausted: false, retryAfterMs: null, durationMs: 1, reasonCode: "client_error_non_retryable" }, payload: {} });
  assert.equal(core.getPendingHostedEvaluationCases(cases, [client]).length, 0);
  const limited = recordFor({ transport: { status: "rate_limited", httpStatus: 429, attemptCount: 1, retryCount: 0, retryExhausted: false, retryAfterMs: null, durationMs: 1, reasonCode: "rate_limit_hint_missing" }, payload: {} });
  assert.equal(core.getPendingHostedEvaluationCases(cases, [limited]).length, 1);
  const notAttempted = core.createNotAttemptedHostedEvaluationRecord({ runId: "run-1", caseDefinition: baseCase, recordSequence: 1, attemptSequence: 1, reasonCode: "rate_limit_circuit_open" });
  assert.equal(core.getPendingHostedEvaluationCases(cases, [notAttempted]).length, 1);
});

await check("38a. 500 final is not resume-retryable", () => {
  const server500 = recordFor({ transport: { status: "server_error", httpStatus: 500, attemptCount: 1, retryCount: 0, retryExhausted: false, retryAfterMs: null, durationMs: 1, reasonCode: "server_error_500_non_retryable" }, payload: {} });
  assert.equal(core.getPendingHostedEvaluationCases([baseCase], [server500]).length, 0);
});

await check("38b. missing eligibility prevents complete PASS", () => {
  const missingEligibility = recordFor({ payload: { status: "available", data: { analysis } } });
  const summary = core.summarizeHostedEvaluation([missingEligibility], { plannedCalls: 1 }, { valid: true, errors: [] });
  assert.equal(summary.gateStatus, "INCONCLUSIVE");
  assert.equal(summary.evaluationComplete, false);
});

await check("39-40. latest final drives summary and history stays separate", () => {
  const limited = recordFor({ sequence: 1, transport: { status: "rate_limited", httpStatus: 429, attemptCount: 1, retryCount: 0, retryExhausted: false, retryAfterMs: null, durationMs: 1, reasonCode: "rate_limit_hint_missing" }, payload: {} });
  const success = recordFor({ sequence: 2, attemptSequence: 2 });
  const latest = core.selectLatestFinalHostedEvaluationRecords([limited, success]);
  assert.equal(latest.get(baseCase.caseId).recordSequence, 2);
  const summary = core.summarizeHostedEvaluation([limited, success], { plannedCalls: 1 }, { valid: true, errors: [] });
  assert.equal(summary.gateStatus, "PASS");
  assert.equal(summary.historicalAttempts, 1);
  assert.equal(summary.recoveredCases, 1);
});

await check("41. duplicate recordSequence invalidates JSONL", () => {
  const one = JSON.stringify(recordFor({ sequence: 1 }));
  const two = JSON.stringify(recordFor({ sequence: 1, attemptSequence: 2 }));
  const parsed = core.parseHostedEvaluationJsonLines(`${one}\n${two}\n`);
  assert.equal(parsed.integrity.valid, false);
  assert.equal(parsed.integrity.errors.some((item) => item.code === "duplicate_record_sequence"), true);
});

await check("42. malformed middle row invalidates JSONL", () => {
  const line = JSON.stringify(recordFor({ sequence: 1 }));
  const parsed = core.parseHostedEvaluationJsonLines(`${line}\n{bad}\n${JSON.stringify(recordFor({ sequence: 3, attemptSequence: 2 }))}\n`);
  assert.equal(parsed.integrity.errors.some((item) => item.code === "malformed_jsonl_row"), true);
});

await check("43. last partial line makes summary INCONCLUSIVE", () => {
  const parsed = core.parseHostedEvaluationJsonLines(JSON.stringify(recordFor({ sequence: 1 })));
  assert.equal(parsed.integrity.errors.some((item) => item.code === "last_partial_jsonl_row"), true);
  const summary = core.summarizeHostedEvaluation(parsed.records, { plannedCalls: 1 }, parsed.integrity);
  assert.equal(summary.gateStatus, "INCONCLUSIVE");
});

await check("44-45. run lock is exclusive and recovery is explicit", () => {
  const dir = path.join(tmpdir(), `face-lab-lock-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const first = acquireRunLock(dir);
  assert.throws(() => acquireRunLock(dir), /run lock already exists/);
  const recovered = acquireRunLock(dir, { recoverStaleLock: true });
  recovered.release();
  first.release();
});

await check("46-49. realpath boundary blocks symlink escape, absolute, outside, and directories", async () => {
  const root = path.join(tmpdir(), `face-lab-path-${process.pid}-${Date.now()}`);
  const fixtureRoot = path.join(root, "private", "face-lab-fixtures");
  mkdirSync(fixtureRoot, { recursive: true });
  const outside = path.join(root, "outside.jpg");
  writeFileSync(outside, Buffer.from([0xff, 0xd8, 0xff]));
  const link = path.join(fixtureRoot, "escape.jpg");
  symlinkSync(outside, link);
  const manifest = {
    schemaVersion: "face-lab-hosted-eval-manifest-v1",
    datasetId: "local",
    fixtures: [{ fixtureId: "a", subjectId: "s", imagePath: "private/face-lab-fixtures/escape.jpg", consentConfirmed: true, expectedEligibility: "eligible", comparisonGroup: "g", variantRole: "baseline", conditionTags: ["clear"], expectedDegradation: "none", plans: ["smoke"] }]
  };
  const fsApi = await import("node:fs");
  assert.throws(() => core.validateHostedEvaluationManifest(manifest, { repoRoot: root, pathApi: path, fsApi, requireImageFiles: true }), /realpath escapes/);
  assert.throws(() => core.validateHostedEvaluationManifest({ ...manifest, fixtures: [{ ...manifest.fixtures[0], imagePath: outside }] }, { repoRoot: root, pathApi: path, fsApi, requireImageFiles: true }), /repository-relative/);
  assert.throws(() => core.validateHostedEvaluationManifest({ ...manifest, fixtures: [{ ...manifest.fixtures[0], imagePath: "private/outside.jpg" }] }, { repoRoot: root, pathApi: path, fsApi, requireImageFiles: false }), /private\/face-lab-fixtures/);
  assert.throws(() => readValidatedImageFile(fixtureRoot), /regular file/);
});

await check("50-51. magic mismatch blocks and JPEG/PNG/WEBP pass", () => {
  const dir = path.join(tmpdir(), `face-lab-mime-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const files = [
    ["a.jpg", Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"],
    ["b.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"],
    ["c.webp", Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP")]), "image/webp"]
  ];
  for (const [name, bytes, mime] of files) {
    const file = path.join(dir, name); writeFileSync(file, bytes);
    assert.equal(detectImageMime(bytes), mime);
    assert.equal(readValidatedImageFile(file).mimeType, mime);
  }
  const mismatch = path.join(dir, "wrong.jpg"); writeFileSync(mismatch, files[1][1]);
  assert.throws(() => readValidatedImageFile(mismatch), /do not match/);
});

await check("52. image size cap blocks oversized file", () => {
  const file = path.join(tmpdir(), `oversize-${process.pid}.jpg`);
  writeFileSync(file, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(20)]));
  assert.throws(() => readValidatedImageFile(file, { maxImageBytes: 10 }), /max-image-bytes/);
});

await check("53. response size cap blocks actual bytes", async () => {
  const result = await executeFaceLabEvaluationRequest({
    endpoint, expectedOrigin, formDataFactory: noBody,
    fetchImpl: queueFetch([makeResponse(200, "x".repeat(100))]),
    maxResponseBytes: 10,
    maxAttemptsRemaining: 1
  });
  assert.equal(result.transport.reasonCode, "response_size_exceeded");
});

await check("54. manifest size cap is enforced by runner", () => {
  const dir = path.join(tmpdir(), `face-lab-large-manifest-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const manifest = path.join(dir, "manifest.json");
  writeFileSync(manifest, "x".repeat(1024 * 1024 + 1));
  const result = spawnSync(process.execPath, ["scripts/run-face-lab-hosted-evaluation.mjs", "--manifest", manifest], { cwd: process.cwd(), encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /manifest_size_exceeded/);
});

await check("55. records row size cap is enforced", () => {
  const parsed = core.parseHostedEvaluationJsonLines(`${"x".repeat(300)}\n`, { maxRowBytes: 256 });
  assert.equal(parsed.integrity.errors.some((item) => item.code === "records_row_size_exceeded"), true);
});

await check("56-58. v1 records read partially and cannot auto-PASS", () => {
  const legacy = {
    schemaVersion: "face-lab-hosted-eval-record-v1", runId: "legacy", caseId: "a:ko:1", fixtureId: "a", subjectId: "s", locale: "ko", repetition: 1,
    expectedEligibility: "eligible", expectedDegradation: "none", httpStatus: 429, requestError: null,
    privacyAudit: { unknownProviderKeyFound: true }, eligibility: null, analysis: null
  };
  const parsed = core.parseHostedEvaluationJsonLines(`${JSON.stringify(legacy)}\n`);
  assert.equal(parsed.records[0].legacyClassification, true);
  assert.equal(parsed.records[0].evaluation.eligibilityComparison, "not_evaluable");
  const summary = core.summarizeHostedEvaluation(parsed.records, { plannedCalls: 1 }, parsed.integrity);
  assert.equal(summary.gateStatus, "INCONCLUSIVE");
  assert.equal(summary.classificationConfidence, "partial");
});

await check("59-60. v2 report regenerates and legacy warning remains", () => {
  const legacy = core.adaptLegacyHostedEvaluationRecord({ schemaVersion: "face-lab-hosted-eval-record-v1", runId: "legacy", caseId: "a:ko:1", fixtureId: "a", subjectId: "s", locale: "ko", repetition: 1, expectedEligibility: "eligible", expectedDegradation: "none", httpStatus: 429, privacyAudit: {} }, { recordSequence: 1 });
  const summary = core.summarizeHostedEvaluation([legacy], { plannedCalls: 1 }, { valid: true, errors: [] });
  const report = core.renderHostedEvaluationReport(summary);
  assert.match(report, /Gate status: INCONCLUSIVE/);
  assert.match(report, /Legacy v1 records were only partially reclassified/);
});

await check("61-64. persisted projection excludes image/path/raw/evidence", () => {
  const record = recordFor();
  const text = JSON.stringify(record);
  assert.equal(text.includes("data:image"), false);
  assert.equal(text.includes("private/face-lab-fixtures"), false);
  assert.equal(text.includes("observation_analysis"), false);
  assert.equal(text.includes("not persisted"), false);
});

await check("65-67. call cap, confirm, and local URL safeguards remain", () => {
  assert.throws(() => core.buildHostedEvaluationCases({ fixtures: [{ ...baseCase, plans: ["smoke"], imagePath: "x" }] }, { plan: "smoke", locales: ["ko", "en"], repetitions: 2, maxCalls: 1 }), /exceeds maxCalls/);
  const runner = readFileSync("scripts/run-face-lab-hosted-evaluation.mjs", "utf8");
  assert.match(runner, /--confirm RUN/);
  assert.deepEqual(resolveFaceLabEvaluationEndpoint("http://127.0.0.1:3001"), { baseUrl: "http://127.0.0.1:3001", endpoint: "http://127.0.0.1:3001/api/face-reading", origin: "http://127.0.0.1:3001" });
  assert.throws(() => resolveFaceLabEvaluationEndpoint("http://localhost:3001/path"), /only the local origin/);
  assert.throws(() => resolveFaceLabEvaluationEndpoint("https://localhost:3001"), /must use HTTP/);
});

await check("68-70. numeric validation, module boundary, and array agreement", () => {
  for (const bad of [-1, NaN, Infinity, 1.5, true, "1.5"]) {
    assert.throws(() => parseSafeInteger(bad, "value", { min: 0, max: 10 }));
  }
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(Object.hasOwn(packageJson, "type"), false);
  assert.equal(core.jaccardSimilarity(["eyes", "jawline"], ["jawline", "eyes"]), 1);
});

assert.ok(checks >= 48, `expected at least 48 executed check groups, got ${checks}`);
console.log(`Face Lab hosted evaluation v2 harness checks passed (${checks} groups covering the 70-item matrix).`);
