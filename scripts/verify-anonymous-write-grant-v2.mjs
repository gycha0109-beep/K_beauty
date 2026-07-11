import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ANONYMOUS_RESULT_WRITE_OPERATION,
  ANONYMOUS_TRACK_WRITE_OPERATION,
  ANONYMOUS_RESULT_PERSISTENCE_FIELDS,
  canonicalizeAnonymousResultForPersistence,
  canonicalizeAnonymousSurveyForPersistence,
  createAnonymousResultFingerprintHash,
  createAnonymousTrackEventFingerprintHash,
  createAnonymousWriteGrantTokenSignature,
  createAnonymousWriteGrantTokens,
  createAnonymousWritePrincipalHash,
  verifyAnonymousWriteGrantToken
} from "../lib/security/anonymous-write-grant-core.js";
import { isPermanentBrowserSupabaseUser } from "../lib/supabase/browser-client.js";
import { createAnonymousResultPersistencePayload } from "../lib/write-access-client.js";

const root = process.cwd();
const secret = "verification-secret-with-enough-entropy-for-anonymous-write-grants";

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

function signPayload(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createAnonymousWriteGrantTokenSignature({ secret, encodedPayload });

  return `${encodedPayload}.${signature}`;
}

const bundle = createAnonymousWriteGrantTokens({
  secret,
  anonymousPayload: "opaque-anonymous-cookie-payload",
  locale: "ko",
  form: {
    skinType: "dry",
    sensitivityLevel: "sensitive",
    mainConcern: "redness",
    mainConcerns: ["redness"],
    cleansingFrequency: "daily",
    preferredTexture: "gel",
    postWashFeeling: "tight",
    afternoonSkinChange: "dry",
    environmentExposure: ["outdoor"],
    mostDislikedFeel: "sticky"
  },
  result: {
    summary: "summary",
    priority: { label: "redness" },
    topPick: { id: "product-1", name: "Product" },
    morning: ["cleanse"],
    night: ["cleanse"]
  },
  nowMs: 1_700_000_000_000
});

const resultVerification = verifyAnonymousWriteGrantToken({
  token: bundle.resultToken,
  secret,
  expectedOperation: ANONYMOUS_RESULT_WRITE_OPERATION,
  nowMs: 1_700_000_000_001
});
const trackVerification = verifyAnonymousWriteGrantToken({
  token: bundle.trackToken,
  secret,
  expectedOperation: ANONYMOUS_TRACK_WRITE_OPERATION,
  nowMs: 1_700_000_000_001
});

assert(resultVerification.ok, "result token should verify for result:create");
assert(trackVerification.ok, "track token should verify for track:create");
assert(
  !verifyAnonymousWriteGrantToken({
    token: bundle.resultToken,
    secret,
    expectedOperation: ANONYMOUS_TRACK_WRITE_OPERATION,
    nowMs: 1_700_000_000_001
  }).ok,
  "result token must not verify for track:create"
);
assert(
  !verifyAnonymousWriteGrantToken({
    token: bundle.trackToken,
    secret,
    expectedOperation: ANONYMOUS_RESULT_WRITE_OPERATION,
    nowMs: 1_700_000_000_001
  }).ok,
  "track token must not verify for result:create"
);
assert(
  !verifyAnonymousWriteGrantToken({
    token: `${bundle.resultToken.slice(0, -1)}x`,
    secret,
    expectedOperation: ANONYMOUS_RESULT_WRITE_OPERATION,
    nowMs: 1_700_000_000_001
  }).ok,
  "tampered token must fail"
);
assert(
  !verifyAnonymousWriteGrantToken({
    token: bundle.resultToken,
    secret,
    expectedOperation: ANONYMOUS_RESULT_WRITE_OPERATION,
    nowMs: bundle.expiresAt
  }).ok,
  "expired token must fail"
);

const legacyToken = signPayload({
  scope: "analysis-write",
  exp: 1_700_000_100_000,
  nonce: "legacy-nonce"
});
assert(
  !verifyAnonymousWriteGrantToken({
    token: legacyToken,
    secret,
    expectedOperation: ANONYMOUS_RESULT_WRITE_OPERATION,
    nowMs: 1_700_000_000_001
  }).ok,
  "v1 token must fail"
);

for (const field of ["version", "purpose", "resourceType", "operation"]) {
  const payload = { ...resultVerification.payload };
  payload[field] = field === "version" ? 99 : "unknown";
  assert(
    !verifyAnonymousWriteGrantToken({
      token: signPayload(payload),
      secret,
      expectedOperation: ANONYMOUS_RESULT_WRITE_OPERATION,
      nowMs: 1_700_000_000_001
    }).ok,
    `unknown ${field} must fail`
  );
}

const principalHash = createAnonymousWritePrincipalHash({
  secret,
  anonymousPayload: "opaque-anonymous-cookie-payload"
});
assert(!principalHash.includes("opaque-anonymous-cookie-payload"), "principal hash must not expose raw cookie payload");
assert(resultVerification.payload.principalHash === principalHash, "token principal hash must match grant principal hash");

assert(!isPermanentBrowserSupabaseUser(null), "missing auth user must stay on the anonymous flow");
assert(!isPermanentBrowserSupabaseUser({ is_anonymous: true }), "Supabase anonymous user must stay on the anonymous flow");
assert(isPermanentBrowserSupabaseUser({ is_anonymous: false }), "permanent Supabase user must use the account flow");
assert(!isPermanentBrowserSupabaseUser({}), "unclassified auth user must not clear anonymous grants");

const canonicalSurvey = canonicalizeAnonymousSurveyForPersistence({
  skinType: " dry ",
  sensitivityLevel: " sensitive ",
  mainConcerns: ["redness", "pores", "acne", "oiliness", "barrier", "extra"],
  environmentExposure: ["outdoor", "office", "extra-a", "extra-b", "extra-c", "extra-d", "extra-e", "extra-f", "extra-g"],
  whiteCastHate: "yes"
});
assert(canonicalSurvey.skinType === "dry", "stored anonymous survey must use normalized strings");
assert(canonicalSurvey.sensitivity === "sensitive", "survey aliases must canonicalize before persistence");
assert(canonicalSurvey.mainConcerns.length === 5, "stored anonymous survey must use fingerprinted concern bounds");
assert(canonicalSurvey.environmentExposure.length === 8, "stored anonymous survey must use fingerprinted environment bounds");
assert(canonicalSurvey.whiteCastHate === true, "stored anonymous survey must use fingerprinted boolean values");

const firstResultFingerprint = createAnonymousResultFingerprintHash({
  secret,
  locale: "ko",
  form: { skinType: "dry", mainConcern: "redness", mainConcerns: ["redness"] },
  result: { summary: "summary", priority: { a: 1, b: 2 }, topPick: { id: "p1", name: "P" } }
});
const secondResultFingerprint = createAnonymousResultFingerprintHash({
  secret,
  locale: "ko",
  form: { mainConcerns: ["redness"], mainConcern: "redness", skinType: "dry" },
  result: { topPick: { name: "P", id: "p1" }, priority: { b: 2, a: 1 }, summary: "summary" }
});
assert(firstResultFingerprint === secondResultFingerprint, "result fingerprint must be stable across field order");
assert(!firstResultFingerprint.includes("redness"), "result fingerprint must not expose raw payload values");

const anonymousPersistenceSource = {
  summary: "summary",
  priority: { label: "redness" },
  topPick: { id: "product-1", name: "Product", buy_link: "https://example.test/product" },
  morning: ["cleanse"],
  night: ["cleanse"],
  photoObservations: { source: "photo" }
};
const anonymousPersistencePayload = createAnonymousResultPersistencePayload({
  ...anonymousPersistenceSource,
  analysisRunId: bundle.analysisRunId,
  meta: { source: "analyze" },
  faceLab: { status: "available" },
  faceLabTeaser: { line: "teaser" },
  faceLabStructured: { mood: "calm" }
});
const canonicalPersistenceResult = canonicalizeAnonymousResultForPersistence(anonymousPersistencePayload);

assert(canonicalPersistenceResult, "anonymous persistence payload must canonicalize");
assert(!("analysisRunId" in anonymousPersistencePayload), "analysisRunId must stay outside result persistence payload");
assert(!("meta" in anonymousPersistencePayload), "analyze meta must not enter anonymous result persistence");
assert(!("faceLab" in anonymousPersistencePayload), "Face Lab payload must not enter anonymous result persistence");
assert(
  ANONYMOUS_RESULT_PERSISTENCE_FIELDS.every((field) => Object.hasOwn(canonicalPersistenceResult, field)),
  "canonical result must define every persisted fingerprint field"
);
assert(
  canonicalizeAnonymousResultForPersistence({ ...anonymousPersistencePayload, meta: { source: "changed" } }) === null,
  "meta must be rejected from anonymous result persistence"
);
assert(
  canonicalizeAnonymousResultForPersistence({ ...anonymousPersistencePayload, faceLab: { status: "changed" } }) === null,
  "Face Lab must be rejected from anonymous result persistence"
);
const productExtraCanonical = canonicalizeAnonymousResultForPersistence({
  ...anonymousPersistencePayload,
  topPick: { ...anonymousPersistencePayload.topPick, unbound_field: "ignored" }
});
assert(!Object.hasOwn(productExtraCanonical.topPick, "unbound_field"), "unknown product fields must not persist");
const canonicalPersistenceFingerprint = createAnonymousResultFingerprintHash({
  secret,
  locale: "ko",
  form: { skinType: "dry" },
  result: anonymousPersistencePayload
});
const changedProductFingerprint = createAnonymousResultFingerprintHash({
  secret,
  locale: "ko",
  form: { skinType: "dry" },
  result: {
    ...anonymousPersistencePayload,
    topPick: { ...anonymousPersistencePayload.topPick, buy_link: "https://example.test/changed" }
  }
});
assert(canonicalPersistenceFingerprint !== changedProductFingerprint, "stored product field changes must change the result fingerprint");
assert(
  createAnonymousResultFingerprintHash({
    secret,
    locale: "ko",
    form: { skinType: "dry" },
    result: { ...anonymousPersistencePayload, faceLab: { status: "changed" } }
  }) === null,
  "non-canonical Face Lab payload must not receive an anonymous result fingerprint"
);

const serverDerivedOutdoorFingerprint = createAnonymousResultFingerprintHash({
  secret,
  locale: "ko",
  form: { environmentExposure: ["outdoor"], outdoorExposure: true },
  result: { summary: "summary" }
});
const clientOutdoorFingerprint = createAnonymousResultFingerprintHash({
  secret,
  locale: "ko",
  form: { environmentExposure: ["outdoor"] },
  result: { summary: "summary" }
});
assert(serverDerivedOutdoorFingerprint === clientOutdoorFingerprint, "derived outdoor exposure must remain stable");

const firstTrackFingerprint = createAnonymousTrackEventFingerprintHash({
  secret,
  analysisRunId: bundle.analysisRunId,
  payload: {
    event_name: "click_top_pick",
    timestamp: "2026-07-11T00:00:00.000Z",
    product_id: "product-1",
    meta_json: { source: "result" }
  }
});
const secondTrackFingerprint = createAnonymousTrackEventFingerprintHash({
  secret,
  analysisRunId: bundle.analysisRunId,
  payload: {
    event_name: "click_top_pick",
    timestamp: "2026-07-11T00:01:00.000Z",
    product_id: "product-1",
    meta_json: { source: "result" }
  }
});
assert(firstTrackFingerprint === secondTrackFingerprint, "track fingerprint must exclude timestamp");

const migration = read("supabase/migrations/20260711032649_sec_05_anonymous_write_grants.sql");
[
  "create table if not exists public.anonymous_write_grants",
  "create table if not exists public.anonymous_write_grant_uses",
  "jti_hash text not null unique",
  "unique (grant_id, request_fingerprint_hash)",
  "alter table public.anonymous_write_grants enable row level security",
  "alter table public.anonymous_write_grant_uses enable row level security",
  "create or replace function public.create_anonymous_write_grants",
  "create or replace function public.claim_anonymous_write_grant",
  "create or replace function public.complete_anonymous_write_grant",
  "create or replace function public.fail_anonymous_write_grant",
  "create or replace function public.cleanup_anonymous_write_grants",
  "for update",
  "set search_path = public",
  "grant execute on function public.claim_anonymous_write_grant(text, text, text, text, text, text) to service_role",
  "revoke all on function public.claim_anonymous_write_grant(text, text, text, text, text, text) from public",
  "recommendation_logs_anonymous_write_grant_use_id_key",
  "analysis_results_anonymous_write_grant_use_id_key",
  "add column if not exists anonymous_write_grant_use_id uuid",
  "if v_grant.operation = 'result:create' then",
  "return jsonb_build_object('state', 'in_progress', 'use_id', v_use.id"
].forEach((pattern) => assertIncludes(migration, pattern, "migration"));
["raw_token", "raw_jti", "raw_cookie", "raw_ip", "request_body", "base64_image"].forEach((pattern) =>
  assertNotIncludes(migration, pattern, "migration")
);
assertBefore(
  migration,
  "if v_grant.operation = 'result:create' then",
  "if v_use.attempt_count >= 3 then",
  "result grants must not enter the track retry/reclaim branch"
);

const analyzeRoute = read("app/api/analyze/route.js");
const analyzePost = analyzeRoute.slice(analyzeRoute.indexOf("export async function POST"));
assertBefore(analyzePost, "issueAnonymousWriteGrants({", "response.headers.set(ANONYMOUS_RESULT_WRITE_HEADER", "analyze grant before result token response");
assertIncludes(analyzeRoute, "anonymous_write_grant_unavailable", "analyze fail-closed response");
assertIncludes(analyzeRoute, "canonicalizeAnonymousResultForPersistence(publicDecision)", "analyze canonical anonymous result");
assertNotIncludes(analyzeRoute, "x-kbeauty-write-token", "analyze legacy header");

const resultsRoute = read("app/api/results/route.js");
const resultsPost = resultsRoute.slice(resultsRoute.indexOf("export async function POST"));
assertBefore(resultsPost, "claimAnonymousWriteGrant({", ".from(\"analysis_requests\")", "results claim before request insert");
assertIncludes(resultsRoute, "ANONYMOUS_RESULT_WRITE_HEADER", "results result header");
assertIncludes(resultsRoute, "LEGACY_ANONYMOUS_WRITE_HEADER", "results legacy rejection");
assertIncludes(resultsRoute, "canonicalizeAnonymousResultForPersistence(result)", "results canonical anonymous persistence");
assertIncludes(resultsRoute, "canonicalizeAnonymousSurveyForPersistence(form)", "results canonical anonymous survey persistence");
assertIncludes(resultsRoute, "anonymousWriteGrantUseId: anonymousClaimUseId", "results grant use linkage");
assertIncludes(resultsRoute, "findAnonymousResultForGrantUse", "results canonical replay recovery");
assertNotIncludes(resultsRoute, "sessionId: anonymousGrant?.payload.resourceId", "results must not reuse analysis session_id");
assertNotIncludes(resultsRoute, "findAnonymousResultForRun", "results must not recover by analysis session_id");

const trackRoute = read("app/api/track/route.js");
const trackPost = trackRoute.slice(trackRoute.indexOf("export async function POST"));
assertBefore(trackPost, "claimAnonymousWriteGrant({", ".from(\"recommendation_logs\")", "track claim before log insert");
assertIncludes(trackRoute, "ANONYMOUS_TRACK_WRITE_HEADER", "track tracking header");
assertIncludes(trackRoute, "anonymous_write_grant_use_id", "track idempotent log reference");
assertIncludes(trackRoute, "LEGACY_ANONYMOUS_WRITE_HEADER", "track legacy rejection");

const clientStorage = read("lib/write-access-client.js");
assertIncludes(clientStorage, "skinTestResultWriteAccessToken", "result token session key");
assertIncludes(clientStorage, "skinTestTrackWriteAccessToken", "track token session key");
assertIncludes(clientStorage, "skinTestAnonymousAnalysisRunId", "analysis run session key");
assertIncludes(clientStorage, "removeItem(LEGACY_WRITE_ACCESS_SESSION_KEY)", "legacy token cleanup");
assertIncludes(clientStorage, "createAnonymousResultPersistencePayload", "anonymous result transport split");

const shareActions = read("components/result/ResultShareActions.jsx");
assertIncludes(shareActions, "x-kbeauty-result-write-token", "result client header");
assertIncludes(shareActions, "clearResultWriteAccessToken", "result token cleanup after save");
assertIncludes(shareActions, "getBrowserPermanentSupabaseAccessToken", "result client permanent-account token helper");
assertIncludes(shareActions, "createAnonymousResultPersistencePayload(result)", "result client persistence payload split");
assertIncludes(shareActions, "return getBrowserPermanentSupabaseAccessToken();", "result share must not treat anonymous auth as an account");

const resultPage = read("app/result/page.js");
const fullReportPage = read("app/result/full-report/page.js");
[resultPage, fullReportPage].forEach((text, index) => {
  assertIncludes(text, "x-kbeauty-track-write-token", `tracking client ${index}`);
  assertIncludes(text, "analysisRunId", `tracking analysis run ${index}`);
  assertIncludes(text, "getBrowserPermanentSupabaseAccessToken", `tracking client ${index} permanent-account token helper`);
});
assertIncludes(resultPage, "return getBrowserPermanentSupabaseAccessToken();", "result tracking must preserve grants for anonymous auth");
assertIncludes(fullReportPage, "await getFullReportTrackingAccessToken()", "full-report tracking must preserve grants for anonymous auth");

const analysisResults = read("lib/analysis-results.js");
assertIncludes(analysisResults, "anonymousWriteGrantUseId = null", "account result nullable grant-use compatibility");
assertIncludes(analysisResults, "anonymous_write_grant_use_id", "analysis result grant-use persistence column");

console.log("anonymous write grant v2 verification passed");
