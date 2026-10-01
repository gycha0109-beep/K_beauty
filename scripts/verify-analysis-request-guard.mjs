import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ANALYSIS_GUARD_POLICIES,
  createGuardHmac,
  createPrincipalHash,
  createRequestFingerprintHash,
  createSignedAnonymousCookie,
  getAnalysisGuardPolicy,
  isGuardHash,
  stableSerialize,
  validateIdempotencyKey,
  verifySignedAnonymousCookie
} from "../lib/security/analysis-request-guard-core.js";
import {
  FACE_LAB_PRODUCTION_DAILY_LIMIT,
  FACE_LAB_USAGE_POLICY
} from "../lib/face-lab-usage-policy.js";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(text, pattern, label) {
  assert(text.includes(pattern), `${label} missing: ${pattern}`);
}

function assertNotIncludes(text, pattern, label) {
  assert(!text.includes(pattern), `${label} unexpectedly contains: ${pattern}`);
}

function assertBefore(text, earlier, later, label) {
  const earlierIndex = text.indexOf(earlier);
  const laterIndex = text.indexOf(later);

  assert(earlierIndex >= 0, `${label} missing earlier marker: ${earlier}`);
  assert(laterIndex >= 0, `${label} missing later marker: ${later}`);
  assert(earlierIndex < laterIndex, `${label} expected ${earlier} before ${later}`);
}

const secret = "verification-secret-with-enough-entropy";
const signedCookie = createSignedAnonymousCookie(secret);
const verifiedCookie = verifySignedAnonymousCookie(signedCookie, secret);
const tamperedCookie = `${signedCookie.slice(0, -1)}x`;

assert(verifiedCookie.ok, "valid signed anonymous cookie should verify");
assert(!verifySignedAnonymousCookie(tamperedCookie, secret).ok, "tampered anonymous cookie should not verify");

const userHash = createPrincipalHash({
  scope: "user",
  value: "user-1234",
  secret
});
const ipHash = createPrincipalHash({
  scope: "ip",
  value: "203.0.113.7",
  secret
});

assert(isGuardHash(userHash), "principal hash should be hex sha256");
assert(isGuardHash(ipHash), "ip hash should be hex sha256");
assert(!userHash.includes("user-1234"), "principal hash should not contain raw user id");
assert(!ipHash.includes("203.0.113.7"), "ip hash should not contain raw ip");

assert(validateIdempotencyKey("550e8400-e29b-41d4-a716-446655440000").ok, "uuid idempotency key should pass");
assert(validateIdempotencyKey("").missing, "missing idempotency key should be allowed");
assert(!validateIdempotencyKey("short").ok, "short idempotency key should fail");
assert(!validateIdempotencyKey("x".repeat(129)).ok, "long idempotency key should fail");
assert(!validateIdempotencyKey("550e8400-e29b-41d4-a716-446655440000,other").ok, "multi-value idempotency key should fail");

const firstFingerprint = createRequestFingerprintHash({
  endpoint: "analyze",
  secret,
  input: {
    form: { skinType: "dry", mainConcern: "redness" },
    image: { size: 1234, type: "image/jpeg" }
  }
});
const secondFingerprint = createRequestFingerprintHash({
  endpoint: "analyze",
  secret,
  input: {
    image: { type: "image/jpeg", size: 1234 },
    form: { mainConcern: "redness", skinType: "dry" }
  }
});

assert(firstFingerprint === secondFingerprint, "fingerprint should be stable across object field order");
assert(isGuardHash(firstFingerprint), "fingerprint should be hex sha256");
assert(!firstFingerprint.includes("redness"), "fingerprint should not expose raw request values");
assert(stableSerialize({ b: 1, a: 2 }) === '{"a":2,"b":1}', "stableSerialize should sort object keys");

assert(Object.keys(ANALYSIS_GUARD_POLICIES).length === 4, "four guarded endpoint policies should exist");
assert(getAnalysisGuardPolicy("analyze")?.path === "/api/analyze", "analyze policy should exist");
assert(getAnalysisGuardPolicy("face-reading")?.path === "/api/face-reading", "face-reading policy should exist");
assert(getAnalysisGuardPolicy("face-reading-test")?.path === "/api/face-reading-test", "face-reading test policy should exist");
assert(getAnalysisGuardPolicy("face-lab-simulation-test")?.path === "/api/face-lab-simulation-test", "Face Lab simulation test policy should exist");
assert(FACE_LAB_PRODUCTION_DAILY_LIMIT === 5, "production Face Lab daily limit should be explicit");
assert(FACE_LAB_USAGE_POLICY.production.consumesProductionQuota === true, "production Face Lab should consume production quota");
assert(FACE_LAB_USAGE_POLICY.test.consumesProductionQuota === false, "Face Lab UAT should not consume production quota");
assert(FACE_LAB_USAGE_POLICY.simulationTest.consumesProductionQuota === false, "Face Lab simulation UAT should not consume production quota");
assert(FACE_LAB_USAGE_POLICY.simulationTest.requireIdempotency === true, "Face Lab simulation UAT should require idempotency");
assert(getAnalysisGuardPolicy("face-reading")?.refundOnFailure === true, "production Face Lab failures should refund quota");
assert(getAnalysisGuardPolicy("face-reading-test")?.refundOnFailure === true, "Face Lab UAT failures should refund quota");
assert(getAnalysisGuardPolicy("face-lab-simulation-test")?.refundOnFailure === true, "Face Lab simulation UAT failures should refund quota");
assert(getAnalysisGuardPolicy("face-lab-simulation-test")?.requireIdempotency === true, "Face Lab simulation UAT guard should require idempotency");
assert(getAnalysisGuardPolicy("analyze")?.refundOnFailure !== true, "general analyze quota semantics must remain unchanged");
assert(
  getAnalysisGuardPolicy("face-reading")?.limits.anonymous.find((item) => item.name === "day")?.limit === 5,
  "production anonymous Face Lab daily quota should be 5"
);
assert(
  getAnalysisGuardPolicy("face-reading")?.limits.user.find((item) => item.name === "day")?.limit === 5,
  "production user Face Lab daily quota should be 5"
);
assert(
  getAnalysisGuardPolicy("face-reading-test")?.limits.anonymous.find((item) => item.name === "day")?.limit === 50,
  "Face Lab UAT should use its own bounded daily quota"
);
assert(!getAnalysisGuardPolicy("full-report"), "unrelated endpoint policy should not exist");

assert(createGuardHmac(secret, "purpose", "value") !== createGuardHmac(secret, "other", "value"), "hmac purpose should partition hashes");

const migration = read("supabase/migrations/20260704221747_sec_01_analysis_request_guard.sql");
[
  "create table if not exists public.analysis_request_rate_windows",
  "create table if not exists public.analysis_request_idempotency",
  "alter table public.analysis_request_rate_windows enable row level security",
  "alter table public.analysis_request_idempotency enable row level security",
  "create or replace function public.consume_analysis_rate_limits",
  "for update",
  "create or replace function public.claim_analysis_idempotency",
  "create or replace function public.complete_analysis_idempotency",
  "create or replace function public.fail_analysis_idempotency",
  "create or replace function public.cleanup_analysis_request_guard",
  "set search_path = public",
  "revoke all on function public.consume_analysis_rate_limits(jsonb) from public",
  "grant execute on function public.consume_analysis_rate_limits(jsonb) to service_role",
  "expires_at",
  "primary key (scope, subject_hash, endpoint, window_key)",
  "primary key (scope, subject_hash, endpoint, idempotency_key_hash)"
].forEach((pattern) => assertIncludes(migration, pattern, "migration"));
["raw_ip", "raw_user", "raw_cookie", "raw_idempotency", "request_body", "base64"].forEach((pattern) =>
  assertNotIncludes(migration, pattern, "migration")
);

const resultReadMigration = read("supabase/migrations/20260715000000_sec_09_result_read_rate_limit.sql");
[
  "analysis_request_rate_windows_endpoint_check",
  "'analyze', 'face-reading', 'result-read'",
  "security invoker",
  "for update",
  "revoke all on function public.consume_analysis_rate_limits(jsonb) from public, anon, authenticated",
  "grant execute on function public.consume_analysis_rate_limits(jsonb) to service_role"
].forEach((pattern) => assertIncludes(resultReadMigration, pattern, "SEC-09 additive rate migration"));
assertNotIncludes(resultReadMigration, "analysis_request_idempotency", "SEC-09 additive rate migration");

const faceLabQuotaMigration = read("supabase/migrations/20260930133000_face_lab_test_quota_partition_v1.sql");
[
  "'analyze', 'face-reading', 'face-reading-test', 'result-read'",
  "create or replace function public.refund_analysis_rate_limits",
  "greatest(request_count - 1, 0)",
  "revoke all on function public.refund_analysis_rate_limits(jsonb) from public, anon, authenticated",
  "grant execute on function public.refund_analysis_rate_limits(jsonb) to service_role"
].forEach((pattern) => assertIncludes(faceLabQuotaMigration, pattern, "Face Lab quota partition migration"));

const faceLabSimulationGuardMigration = read("supabase/migrations/20261001043000_face_lab_simulation_test_guard_v1.sql");
[
  "analysis_request_rate_windows_endpoint_check",
  "'analyze', 'face-reading', 'face-reading-test', 'face-lab-simulation-test', 'result-read'",
  "analysis_request_idempotency_endpoint_check",
  "'analyze', 'face-reading', 'face-lab-simulation-test'",
  "create or replace function public.claim_analysis_idempotency",
  "p_endpoint not in ('analyze', 'face-reading', 'face-lab-simulation-test')",
  "security invoker",
  "revoke all on table public.analysis_request_idempotency from public, anon, authenticated",
  "grant select, insert, update, delete on table public.analysis_request_idempotency to service_role"
].forEach((pattern) => assertIncludes(faceLabSimulationGuardMigration, pattern, "Face Lab simulation guard migration"));

const guard = read("lib/security/analysis-request-guard.js");
assertIncludes(guard, "analysis_guard_unavailable", "guard fail closed code");
assertIncludes(guard, "if (!secret)", "guard secret check");
assertIncludes(guard, "if (!supabase)", "guard db check");
assertIncludes(guard, "claim_analysis_idempotency", "guard claim rpc");
assertIncludes(guard, "consume_analysis_rate_limits", "guard consume rpc");
assertIncludes(guard, "refund_analysis_rate_limits", "guard refund rpc");
assertIncludes(guard, "rateLimitItems", "guard tracks consumed windows for refund");
assertIncludes(guard, "Retry-After", "guard retry-after response");

const analyzeRoute = read("app/api/analyze/route.js");
const analyzePost = analyzeRoute.slice(analyzeRoute.indexOf("export async function POST"));
assertBefore(analyzePost, "guardAnalysisRequest({", "resolveOpenAiApiKey()", "analyze guard before api key");
assertBefore(analyzePost, "guardAnalysisRequest({", "image.arrayBuffer", "analyze guard before image buffer");
assertBefore(analyzePost, "guardAnalysisRequest({", "fetchCurrentProductSnapshotsByIds", "analyze guard before product db read");
assertBefore(analyzePost, "guardAnalysisRequest({", "analyzeVisionObservation({", "analyze guard before canonical Vision call");
assertIncludes(analyzeRoute, "completeAnalysisRequestGuard(analysisGuard)", "analyze complete");
assertIncludes(analyzeRoute, "failAnalysisRequestGuard(analysisGuard)", "analyze fail");

const faceRoute = read("app/api/face-reading/route.js");
const facePost = faceRoute.slice(faceRoute.indexOf("export async function POST"));
assertBefore(facePost, "guardAnalysisRequest({", "resolveOpenAiApiKey()", "face guard before api key");
assertBefore(facePost, "guardAnalysisRequest({", "const imageBuffer = Buffer.from(await image.arrayBuffer())", "face guard before image buffer");
assertBefore(facePost, "guardAnalysisRequest({", "analyzeVisionObservation({", "face guard before canonical Vision call");
assertIncludes(faceRoute, "completeGuardedResponse", "face complete helper");
assertIncludes(faceRoute, "failGuardedResponse", "face fail helper");
assertIncludes(faceRoute, 'context?.guardEndpoint === "face-reading-test"', "face test quota partition");
assertBefore(facePost, "guardAnalysisRequest({", "resolveOpenAiApiKey()", "face guard remains before provider resolution");

const page = read("app/page.js");
assertIncludes(page, "Idempotency-Key", "client idempotency header");
assertIncludes(page, "crypto.randomUUID", "client secure uuid");
assertIncludes(page, "crypto.getRandomValues", "client secure fallback");
assertNotIncludes(page, "Math.random", "client random");
assertIncludes(page, "analysis_rate_limited", "client rate limit handling");
assertIncludes(page, "analysis_guard_unavailable", "client guard unavailable handling");

console.log("analysis request guard verification passed");
