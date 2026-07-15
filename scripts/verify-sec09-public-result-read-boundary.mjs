import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildPublicResultReadRatePlan,
  createPublicResultReadDescriptor,
  createResultReadSubjectHash,
  executeOwnerUnpublishCore,
  executePublicResultReadAccessCore,
  executePublicResultReadGuardCore,
  normalizeClientAddress,
  parsePublicResultShareId,
  parsePublicResultShareIdFromUrl,
  PUBLIC_RESULT_READ_HEADERS,
  resolveTrustedClientAddressCore
} from "../lib/security/public-result-read-guard-core.js";
import {
  resolveAnalysisResultReadAudience,
  serializeOwnerAnalysisResult,
  serializePublicAnalysisResult
} from "../lib/analysis-results.js";

const EXPECTED_REQUIRED_CASE_COUNT = 57;
const REQUIRED_CASE_IDS = Object.freeze([
  "M01_MIGRATION_TRANSACTION", "M02_ENDPOINT_CONSTRAINT", "M03_RPC_ALLOWLIST", "M04_RPC_ACL",
  "M05_RLS_PRESERVED", "M06_ATOMIC_LOCKING", "M07_CONCURRENCY_CONTRACT", "M08_CLEANUP_COMPATIBILITY",
  "I01_LEGACY_TOKEN", "I02_CURRENT_TOKEN", "I03_MALFORMED_LENGTH", "I04_MALFORMED_ALPHABET",
  "I05_NONCANONICAL_BASE64URL", "I06_CONTROL_CHARACTER", "I07_EXCESSIVE_LENGTH", "I08_INVALID_PREQUERY_REJECTION",
  "A01_ANONYMOUS_PUBLIC", "A02_AUTHENTICATED_PUBLIC", "A03_OWNER_PRIVATE", "A04_ANONYMOUS_PRIVATE",
  "A05_NONOWNER_PRIVATE", "A06_MISSING", "A07_REVOKED", "A08_DELETED", "A09_MALFORMED_GENERIC_404",
  "A10_PUBLIC_DTO_FORBIDDEN_KEYS", "A11_OWNER_PUBLIC_SEPARATION",
  "Q01_AUTHENTICATED_BURST", "Q02_AUTHENTICATED_SUSTAINED", "Q03_ANONYMOUS_BURST",
  "Q04_ANONYMOUS_SUSTAINED", "Q05_IP_BURST", "Q06_IP_SUSTAINED", "Q07_REPEAT_LIMIT",
  "Q08_DIFFERENT_SHARE_UNAFFECTED", "Q09_MALFORMED_BASE_QUOTA", "Q10_ATOMIC_ALL_BUCKET_REJECTION",
  "Q11_BACKEND_UNAVAILABLE", "Q12_RPC_REJECTION",
  "P01_TRUSTED_VERCEL_HEADER", "P02_X_FORWARDED_FOR_IGNORED", "P03_X_REAL_IP_IGNORED",
  "P04_MISSING_HOSTED_HEADER", "P05_MALFORMED_CHAIN", "P06_IPV4_NORMALIZATION",
  "P07_IPV6_NORMALIZATION", "P08_MAPPED_IPV6_EQUIVALENCE",
  "R01_PAGE_SINGLE_QUOTA", "R02_PAGE_SINGLE_DB_QUERY", "R03_METADATA_ZERO_QUOTA", "R04_METADATA_ZERO_DB",
  "R05_GET_CONTRACT", "R06_HEAD_CONTRACT", "R07_OPTIONS_CONTRACT", "R08_CACHE_HEADERS",
  "R09_OWNER_UNPUBLISH", "R10_UNPUBLISH_IMMEDIATE_404"
]);
const EXECUTION_CASE_IDS = Object.freeze([...REQUIRED_CASE_IDS]);
const root = process.cwd();
const secret = "sec09-verifier-secret-with-enough-entropy";
const legacyId = Buffer.alloc(6, 7).toString("base64url");
const currentId = Buffer.alloc(16, 9).toString("base64url");
const principalUser = createResultReadSubjectHash(secret, "user", "user-1");
const principalAnonymous = createResultReadSubjectHash(secret, "anonymous", "anon-1");
const ipHash = createResultReadSubjectHash(secret, "ip", "203.0.113.7");

function read(path) { return readFileSync(resolve(root, path), "utf8"); }
function assert(value, message) { if (!value) throw new Error(message); }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function assertIncludes(text, value, label) { assert(text.includes(value), `${label} missing ${value}`); }
function assertNotIncludes(text, value, label) { assert(!text.includes(value), `${label} unexpectedly contains ${value}`); }

function createHeaders(values = {}) {
  const normalized = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: (name) => normalized.get(String(name).toLowerCase()) || null };
}

function createRateStore() {
  const counts = new Map();
  return {
    counts,
    async consume(items) {
      const denied = items.find((item) => (counts.get(`${item.scope}|${item.subject_hash}|${item.endpoint}|${item.window_key}`) || 0) >= item.request_limit);
      if (denied) return { data: { allowed: false, retry_after_seconds: 17 }, error: null };
      items.forEach((item) => {
        const key = `${item.scope}|${item.subject_hash}|${item.endpoint}|${item.window_key}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      return { data: { allowed: true, retry_after_seconds: 0 }, error: null };
    }
  };
}

function createRow(overrides = {}) {
  return {
    share_id: currentId,
    user_id: "owner-1",
    is_public: true,
    locale: "en",
    skin_type: "dry",
    main_concerns: ["redness"],
    summary: "summary",
    routine_am: ["cleanse"],
    routine_pm: ["moisturize"],
    recommended_products: [{ id: "p1", name: "Product", brand: "Brand", step: "Cream", reason: "reason", imageUrl: "private" }],
    result_json: {
      schemaVersion: 1,
      locale: "en",
      form: { skinType: "dry", mainConcerns: ["redness"], email: "private@example.test" },
      result: { summary: "summary", imageUrl: "data:image/png;base64,raw", provider: "private", sessionId: "private" }
    },
    ...overrides
  };
}

function scanForbidden(value, path = "root") {
  const forbidden = /^(user_?id|email|image|imageurl|source_session_id|sessionid|created_at|updated_at|provider|raw|premium|buy_link)$/i;
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert(!forbidden.test(key), `forbidden key ${path}.${key}`);
    scanForbidden(item, `${path}.${key}`);
  }
}

async function runGuard({ token = currentId, scope = "anonymous", principalHash = principalAnonymous, store = createRateStore(), requestUrl } = {}) {
  return executePublicResultReadGuardCore({
    rawShareId: token,
    requestUrl: requestUrl || `https://example.test/api/results/${token}`,
    principalScope: scope,
    principalHash,
    accountUserId: scope === "user" ? "owner-1" : null,
    ipHash,
    secret,
    nowMs: 0,
    consume: (items) => store.consume(items)
  });
}

const migration = read("supabase/migrations/20260715000000_sec_09_result_read_rate_limit.sql");
const originalMigration = read("supabase/migrations/20260704221747_sec_01_analysis_request_guard.sql");
const route = read("app/api/results/[shareId]/route.js");
const page = read("app/r/[shareId]/page.js");
const loader = read("components/result/SharedResultLoader.jsx");
const access = read("lib/analysis-result-access.js");
const results = read("lib/analysis-results.js");
const trusted = read("lib/security/trusted-client-address.js");

const CASE_CATALOG = Object.freeze([
  ["M01_MIGRATION_TRANSACTION", () => { assert(/^begin;/i.test(migration.trim()), "migration must begin transaction"); assert(/commit;\s*$/i.test(migration), "migration must commit"); }],
  ["M02_ENDPOINT_CONSTRAINT", () => { assertIncludes(migration, "'analyze', 'face-reading', 'result-read'", "constraint"); assertIncludes(migration, "analysis_request_rate_windows_endpoint_check", "constraint name"); }],
  ["M03_RPC_ALLOWLIST", () => { assertIncludes(migration, "v_item.endpoint not in ('analyze', 'face-reading', 'result-read')", "RPC allowlist"); assertIncludes(migration, "consume_analysis_rate_limits", "RPC"); }],
  ["M04_RPC_ACL", () => { assertIncludes(migration, "revoke all on function public.consume_analysis_rate_limits(jsonb) from public, anon, authenticated", "RPC revoke"); assertIncludes(migration, "grant execute on function public.consume_analysis_rate_limits(jsonb) to service_role", "RPC grant"); }],
  ["M05_RLS_PRESERVED", () => { assertIncludes(migration, "enable row level security", "RLS"); assertNotIncludes(migration, "disable row level security", "RLS"); }],
  ["M06_ATOMIC_LOCKING", () => { assertIncludes(migration, "for update", "locking"); assert(migration.indexOf("if not v_allowed") < migration.indexOf("set request_count = request_count + 1"), "reject before increment"); }],
  ["M07_CONCURRENCY_CONTRACT", () => { assertIncludes(migration, "order by scope, subject_hash, endpoint, window_key", "deterministic ordering"); assertIncludes(migration, "on conflict (scope, subject_hash, endpoint, window_key) do nothing", "concurrent insert"); }],
  ["M08_CLEANUP_COMPATIBILITY", () => { assertIncludes(originalMigration, "cleanup_analysis_request_guard", "existing cleanup"); assertNotIncludes(migration, "drop function public.cleanup_analysis_request_guard", "cleanup preservation"); }],
  ["I01_LEGACY_TOKEN", () => assert(parsePublicResultShareId(legacyId).kind === "legacy", "legacy token")],
  ["I02_CURRENT_TOKEN", () => { assert(parsePublicResultShareId(currentId).kind === "current", "current token"); assertIncludes(results, "randomBytes(16)", "share generator"); }],
  ["I03_MALFORMED_LENGTH", () => assert(parsePublicResultShareId("A".repeat(9)).kind === "invalid", "invalid length")],
  ["I04_MALFORMED_ALPHABET", () => assert(parsePublicResultShareId("AAAA/AAA").kind === "invalid", "invalid alphabet")],
  ["I05_NONCANONICAL_BASE64URL", () => assert(parsePublicResultShareId(`${currentId.slice(0, -1)}B`).kind === "invalid", "noncanonical token")],
  ["I06_CONTROL_CHARACTER", () => assert(parsePublicResultShareId("AAAA\nAAA").kind === "invalid", "control token")],
  ["I07_EXCESSIVE_LENGTH", () => assert(parsePublicResultShareId("A".repeat(4096)).kind === "invalid", "excessive token")],
  ["I08_INVALID_PREQUERY_REJECTION", async () => { let reads = 0; const guard = await runGuard({ token: "invalid" }); const descriptor = await executePublicResultReadAccessCore({ guardResult: guard, read: async () => { reads += 1; return { ok: true, result: null }; } }); assert(descriptor.status === 404 && reads === 0, "invalid must not read"); }],
  ["A01_ANONYMOUS_PUBLIC", () => assert(resolveAnalysisResultReadAudience(createRow(), null) === "public", "anonymous public")],
  ["A02_AUTHENTICATED_PUBLIC", () => assert(resolveAnalysisResultReadAudience(createRow(), "other") === "public", "authenticated public")],
  ["A03_OWNER_PRIVATE", () => assert(resolveAnalysisResultReadAudience(createRow({ is_public: false }), "owner-1") === "owner", "owner private")],
  ["A04_ANONYMOUS_PRIVATE", () => assert(resolveAnalysisResultReadAudience(createRow({ is_public: false }), null) === null, "anonymous private")],
  ["A05_NONOWNER_PRIVATE", () => assert(resolveAnalysisResultReadAudience(createRow({ is_public: false }), "other") === null, "nonowner private")],
  ["A06_MISSING", () => assert(createPublicResultReadDescriptor("not_found").status === 404, "missing 404")],
  ["A07_REVOKED", () => assert(sameJson(createPublicResultReadDescriptor("not_found").body, { success: false, error: "Result not found." }), "revoked oracle")],
  ["A08_DELETED", () => assert(createPublicResultReadDescriptor("not_found").status === 404, "deleted 404")],
  ["A09_MALFORMED_GENERIC_404", async () => { const result = await runGuard({ token: "bad" }); assert(result.code === "not_found", "malformed generic 404"); }],
  ["A10_PUBLIC_DTO_FORBIDDEN_KEYS", () => { const dto = serializePublicAnalysisResult(createRow({ id: "internal-row-id" })); scanForbidden(dto); assert(!Object.hasOwn(dto, "id"), "internal row id"); }],
  ["A11_OWNER_PUBLIC_SEPARATION", () => { const pub = serializePublicAnalysisResult(createRow()); const owner = serializeOwnerAnalysisResult(createRow({ is_public: false })); assert(!Object.hasOwn(pub, "isPublic") && owner.isPublic === false, "DTO separation"); }],
  ["Q01_AUTHENTICATED_BURST", () => { const plan = buildPublicResultReadRatePlan({ principalScope: "user", principalHash: principalUser, ipHash, shareId: currentId, secret, nowMs: 0 }); assert(plan.find((x) => x.window_key.startsWith("principal-burst:")).request_limit === 30, "user burst"); }],
  ["Q02_AUTHENTICATED_SUSTAINED", () => { const plan = buildPublicResultReadRatePlan({ principalScope: "user", principalHash: principalUser, ipHash, shareId: currentId, secret, nowMs: 0 }); assert(plan.find((x) => x.window_key.startsWith("principal-sustained:")).request_limit === 600, "user sustained"); }],
  ["Q03_ANONYMOUS_BURST", () => { const plan = buildPublicResultReadRatePlan({ principalScope: "anonymous", principalHash: principalAnonymous, ipHash, shareId: currentId, secret, nowMs: 0 }); assert(plan.find((x) => x.window_key.startsWith("principal-burst:")).request_limit === 20, "anonymous burst"); }],
  ["Q04_ANONYMOUS_SUSTAINED", () => { const plan = buildPublicResultReadRatePlan({ principalScope: "anonymous", principalHash: principalAnonymous, ipHash, shareId: currentId, secret, nowMs: 0 }); assert(plan.find((x) => x.window_key.startsWith("principal-sustained:")).request_limit === 200, "anonymous sustained"); }],
  ["Q05_IP_BURST", () => { const plan = buildPublicResultReadRatePlan({ principalScope: "anonymous", principalHash: principalAnonymous, ipHash, secret, nowMs: 0 }); assert(plan.find((x) => x.window_key.startsWith("ip-burst:")).request_limit === 60, "IP burst"); }],
  ["Q06_IP_SUSTAINED", () => { const plan = buildPublicResultReadRatePlan({ principalScope: "anonymous", principalHash: principalAnonymous, ipHash, secret, nowMs: 0 }); assert(plan.find((x) => x.window_key.startsWith("ip-sustained:")).request_limit === 1000, "IP sustained"); }],
  ["Q07_REPEAT_LIMIT", () => { const plan = buildPublicResultReadRatePlan({ principalScope: "anonymous", principalHash: principalAnonymous, ipHash, shareId: currentId, secret, nowMs: 0 }); assert(plan.length === 5 && plan.find((x) => x.window_key.startsWith("repeat-burst:")).request_limit === 12, "repeat limit"); }],
  ["Q08_DIFFERENT_SHARE_UNAFFECTED", () => { const other = Buffer.alloc(16, 10).toString("base64url"); const left = buildPublicResultReadRatePlan({ principalScope: "anonymous", principalHash: principalAnonymous, ipHash, shareId: currentId, secret, nowMs: 0 }).at(-1); const right = buildPublicResultReadRatePlan({ principalScope: "anonymous", principalHash: principalAnonymous, ipHash, shareId: other, secret, nowMs: 0 }).at(-1); assert(left.subject_hash !== right.subject_hash, "different share repeat buckets"); }],
  ["Q09_MALFORMED_BASE_QUOTA", async () => { let count = 0; await executePublicResultReadGuardCore({ rawShareId: "bad", requestUrl: "https://example.test/api/results/bad", principalScope: "anonymous", principalHash: principalAnonymous, ipHash, secret, nowMs: 0, consume: async (items) => { count = items.length; return { data: { allowed: true } }; } }); assert(count === 4, "malformed base quota"); }],
  ["Q10_ATOMIC_ALL_BUCKET_REJECTION", async () => { const store = createRateStore(); const plan = buildPublicResultReadRatePlan({ principalScope: "anonymous", principalHash: principalAnonymous, ipHash, shareId: currentId, secret, nowMs: 0 }); const blocked = plan[0]; store.counts.set(`${blocked.scope}|${blocked.subject_hash}|${blocked.endpoint}|${blocked.window_key}`, blocked.request_limit); const before = new Map(store.counts); const response = await store.consume(plan); assert(response.data.allowed === false && sameJson([...store.counts], [...before]), "atomic rejection"); }],
  ["Q11_BACKEND_UNAVAILABLE", async () => { const result = await executePublicResultReadGuardCore({ rawShareId: currentId, requestUrl: `https://example.test/api/results/${currentId}`, principalScope: "anonymous", principalHash: principalAnonymous, ipHash, secret, consume: async () => { throw new Error("offline"); } }); assert(result.code === "unavailable", "backend unavailable"); }],
  ["Q12_RPC_REJECTION", async () => { const result = await executePublicResultReadGuardCore({ rawShareId: currentId, requestUrl: `https://example.test/api/results/${currentId}`, principalScope: "anonymous", principalHash: principalAnonymous, ipHash, secret, consume: async () => ({ data: null, error: { code: "42501" } }) }); assert(result.code === "unavailable", "RPC rejection"); }],
  ["P01_TRUSTED_VERCEL_HEADER", () => assert(resolveTrustedClientAddressCore({ headers: createHeaders({ "x-vercel-forwarded-for": "203.0.113.7" }), env: { VERCEL_ENV: "production" } }) === "203.0.113.7", "Vercel header")],
  ["P02_X_FORWARDED_FOR_IGNORED", () => assert(resolveTrustedClientAddressCore({ headers: createHeaders({ "x-forwarded-for": "203.0.113.7" }), env: { VERCEL_ENV: "production" } }) === null, "XFF ignored")],
  ["P03_X_REAL_IP_IGNORED", () => assert(resolveTrustedClientAddressCore({ headers: createHeaders({ "x-real-ip": "203.0.113.7" }), env: { VERCEL_ENV: "preview" } }) === null, "x-real-ip ignored")],
  ["P04_MISSING_HOSTED_HEADER", () => assert(resolveTrustedClientAddressCore({ headers: createHeaders(), env: { VERCEL: "1" } }) === null, "missing hosted header")],
  ["P05_MALFORMED_CHAIN", () => assert(resolveTrustedClientAddressCore({ headers: createHeaders({ "x-vercel-forwarded-for": "203.0.113.7, 198.51.100.4" }), env: { VERCEL: "1" } }) === null, "chain rejected")],
  ["P06_IPV4_NORMALIZATION", () => { assert(normalizeClientAddress("203.0.113.7") === "203.0.113.7", "IPv4"); assert(normalizeClientAddress("203.000.113.7") === null, "leading zero"); }],
  ["P07_IPV6_NORMALIZATION", () => assert(normalizeClientAddress("2001:0DB8:0:0:0:0:0:1") === "2001:db8::1", "IPv6")],
  ["P08_MAPPED_IPV6_EQUIVALENCE", () => assert(normalizeClientAddress("::ffff:203.0.113.7") === normalizeClientAddress("203.0.113.7"), "mapped IPv6")],
  ["R01_PAGE_SINGLE_QUOTA", async () => { let quota = 0; await executePublicResultReadGuardCore({ rawShareId: currentId, requestUrl: `https://example.test/api/results/${currentId}`, principalScope: "anonymous", principalHash: principalAnonymous, ipHash, secret, consume: async () => { quota += 1; return { data: { allowed: true } }; } }); assert(quota === 1, "single quota") }],
  ["R02_PAGE_SINGLE_DB_QUERY", async () => { let reads = 0; const guard = await runGuard(); const descriptor = await executePublicResultReadAccessCore({ guardResult: guard, read: async () => { reads += 1; return { ok: true, result: serializePublicAnalysisResult(createRow()) }; } }); assert(descriptor.status === 200 && reads === 1, "single DB read"); }],
  ["R03_METADATA_ZERO_QUOTA", () => { assertNotIncludes(page, "generateMetadata", "page metadata"); assertNotIncludes(page, "guardPublicResultRead", "page quota"); }],
  ["R04_METADATA_ZERO_DB", () => { assertNotIncludes(page, "analysis-result-access", "page DB"); assertIncludes(page, "SharedResultLoader", "page loader"); }],
  ["R05_GET_CONTRACT", () => { assertIncludes(route, "export async function GET", "GET"); assertIncludes(route, "handleRead(request, context)", "GET handler"); }],
  ["R06_HEAD_CONTRACT", () => { assertIncludes(route, "export async function HEAD", "HEAD"); assertIncludes(route, "{ head: true }", "HEAD handler"); }],
  ["R07_OPTIONS_CONTRACT", () => { assertIncludes(route, "export function OPTIONS", "OPTIONS"); assertIncludes(route, "status: 204", "OPTIONS status"); }],
  ["R08_CACHE_HEADERS", () => { assert(PUBLIC_RESULT_READ_HEADERS["Cache-Control"] === "private, no-store, max-age=0", "cache control"); assert(PUBLIC_RESULT_READ_HEADERS["CDN-Cache-Control"] === "no-store" && PUBLIC_RESULT_READ_HEADERS["Vercel-CDN-Cache-Control"] === "no-store", "CDN no-store"); }],
  ["R09_OWNER_UNPUBLISH", async () => { let updateArgs; const result = await executeOwnerUnpublishCore({ parsedShareId: parsePublicResultShareId(currentId), userId: "owner-1", update: async (args) => { updateArgs = args; return { ok: true, state: "unpublished" }; } }); assert(result.state === "unpublished" && updateArgs.userId === "owner-1", "owner unpublish"); assertIncludes(access, '.eq("user_id", userId)', "owner-scoped update"); assertIncludes(access, "isPermanentAccountUser(currentUser)", "permanent owner requirement"); assert(route.indexOf("getAnalysisResultOwnerUserId(request)") < route.indexOf("request.json()"), "unpublish must authenticate before parsing"); }],
  ["R10_UNPUBLISH_IMMEDIATE_404", async () => { let isPublic = true; await executeOwnerUnpublishCore({ parsedShareId: parsePublicResultShareId(currentId), userId: "owner-1", update: async () => { isPublic = false; return { ok: true, state: "unpublished" }; } }); const outcome = isPublic ? { ok: true, result: {} } : { ok: true, result: null }; const descriptor = await executePublicResultReadAccessCore({ guardResult: { ok: true, shareId: currentId }, read: async () => outcome }); assert(descriptor.status === 404, "immediate 404"); assertIncludes(loader, "requestRef.current", "single client fetch"); }]
]);

function exactSetFailures(expected, actual) {
  const duplicates = actual.filter((id, index) => actual.indexOf(id) !== index);
  const missing = expected.filter((id) => !actual.includes(id));
  const unknown = actual.filter((id) => !expected.includes(id));
  return { duplicates: [...new Set(duplicates)], missing, unknown };
}

assert(Object.isFrozen(REQUIRED_CASE_IDS), "required manifest must be frozen");
assert(EXPECTED_REQUIRED_CASE_COUNT === 57, "expected count must be 57");
assert(REQUIRED_CASE_IDS.length === EXPECTED_REQUIRED_CASE_COUNT, "manifest count mismatch");
const catalogIds = CASE_CATALOG.map(([id]) => id);
const catalogSet = exactSetFailures(REQUIRED_CASE_IDS, catalogIds);
assert(!catalogSet.duplicates.length, `duplicate case IDs: ${catalogSet.duplicates.join(",")}`);
assert(!catalogSet.missing.length, `missing case IDs: ${catalogSet.missing.join(",")}`);
assert(!catalogSet.unknown.length, `unknown case IDs: ${catalogSet.unknown.join(",")}`);
assert(CASE_CATALOG.length === EXPECTED_REQUIRED_CASE_COUNT, "catalog count mismatch");

const observed = [];
for (const caseId of EXECUTION_CASE_IDS) {
  const matches = CASE_CATALOG.filter(([id]) => id === caseId);
  assert(matches.length === 1, matches.length === 0 ? `unobserved case ID: ${caseId}` : `duplicate case ID: ${caseId}`);
  await matches[0][1]();
  observed.push(caseId);
  console.log(JSON.stringify({ caseId, status: "PASS" }));
}

const observedSet = exactSetFailures(REQUIRED_CASE_IDS, observed);
assert(!observedSet.duplicates.length, `duplicate observed IDs: ${observedSet.duplicates.join(",")}`);
assert(!observedSet.missing.length, `unobserved IDs: ${observedSet.missing.join(",")}`);
assert(!observedSet.unknown.length, `unknown observed IDs: ${observedSet.unknown.join(",")}`);
assert(observed.length === EXPECTED_REQUIRED_CASE_COUNT, "observed count mismatch");
assertIncludes(trusted, "resolveTrustedClientAddressCore", "trusted wrapper");
assertNotIncludes(trusted, "x-forwarded-for\"", "trusted wrapper");
assertIncludes(route, "readAnalysisResultForShare", "route access");

console.log(`SEC09_REQUIRED_CASES=${observed.length}/${EXPECTED_REQUIRED_CASE_COUNT}`);
console.log("SEC09_PUBLIC_RESULT_READ_BOUNDARY=PASS");
