import assert from "node:assert/strict";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const testSecret = "test-only-premium-security-closure-secret";
const quietConsole = {
  ...console,
  info() {},
  warn() {},
  error() {}
};
const context = vm.createContext({
  Buffer,
  Date,
  URL,
  console: quietConsole,
  process: {
    env: {
      NODE_ENV: "production",
      WRITE_ACCESS_TOKEN_SECRET: testSecret
    }
  }
});

function syntheticModule(identifier, exports) {
  return new vm.SyntheticModule(
    Object.keys(exports),
    function initialize() {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    },
    { context, identifier }
  );
}

async function sourceModule(relativePath, link) {
  const module = new vm.SourceTextModule(read(relativePath), {
    context,
    identifier: relativePath
  });
  await module.link(link);
  await module.evaluate();
  return module;
}

const cryptoModule = syntheticModule("node:crypto", {
  createHmac,
  randomBytes,
  timingSafeEqual
});
const serverOnlyModule = syntheticModule("server-only", {});
const ownerModule = await sourceModule("lib/premium-report-session-owner.js", async (specifier) => {
  if (specifier === "crypto") return cryptoModule;
  throw new Error(`unexpected owner dependency: ${specifier}`);
});

const sessions = new Map();
function createSessionStore() {
  return {
    from(table) {
      assert.equal(table, "premium_report_sessions");
      return {
        delete() {
          return {
            async lt(_field, iso) {
              for (const [sessionId, row] of sessions) {
                if (new Date(row.expires_at).getTime() < new Date(iso).getTime()) {
                  sessions.delete(sessionId);
                }
              }
              return { error: null };
            },
            async eq(field, value) {
              assert.equal(field, "session_id");
              sessions.delete(value);
              return { error: null };
            }
          };
        },
        async insert(row) {
          sessions.set(row.session_id, structuredClone(row));
          return { error: null };
        },
        select() {
          const filters = {};
          return {
            eq(field, value) {
              filters[field] = value;
              return this;
            },
            async maybeSingle() {
              const row = sessions.get(filters.session_id) || null;
              return { data: row ? structuredClone(row) : null, error: null };
            }
          };
        },
        update(values) {
          return {
            async eq(field, value) {
              assert.equal(field, "session_id");
              const row = sessions.get(value);
              if (row) sessions.set(value, { ...row, ...structuredClone(values) });
              return { error: null };
            }
          };
        }
      };
    }
  };
}

const sessionStore = createSessionStore();
const adminModule = syntheticModule("@/lib/supabase-admin", {
  createSupabaseAdminClient: () => sessionStore
});
const sessionModule = await sourceModule("lib/premium-report-session.js", async (specifier) => {
  if (specifier === "server-only") return serverOnlyModule;
  if (specifier === "crypto") return cryptoModule;
  if (specifier === "@/lib/supabase-admin") return adminModule;
  if (specifier === "@/lib/premium-report-session-owner") return ownerModule;
  throw new Error(`unexpected session dependency: ${specifier}`);
});

const owner = sessionModule.namespace;
const ownerBinding = ownerModule.namespace;
const accountA = "11111111-1111-4111-8111-111111111111";
const accountB = "22222222-2222-4222-8222-222222222222";
const basePremiumReport = { freeResult: { summary: "fixture" }, fullRoutine: { morning: [] } };

function signEnvelope(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", testSecret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

const validToken = await owner.createPremiumReportSession(
  { premiumReport: basePremiumReport, locale: "ko" },
  { userId: accountA }
);
assert.ok(validToken);
assert.equal(validToken.includes(accountA), false, "raw owner UUID must not be present in the token");

const validRead = await owner.verifyPremiumReportSession(validToken, { userId: accountA });
assert.equal(validRead.ok, true);
assert.equal(validRead.payload.premiumReport.freeResult.summary, "fixture");
assert.equal(JSON.stringify(validRead).includes(accountA), false, "raw owner UUID must not be returned");

const mismatchRead = await owner.verifyPremiumReportSession(validToken, { userId: accountB });
assert.deepEqual(
  { ok: mismatchRead.ok, code: mismatchRead.code },
  { ok: false, code: "owner_mismatch" }
);

const [encodedValid, signatureValid] = validToken.split(".");
const decodedValid = JSON.parse(Buffer.from(encodedValid, "base64url").toString("utf8"));
const legacyToken = signEnvelope({ scope: "premium-report", exp: Date.now() + 60_000, sid: decodedValid.sid });
const legacyRead = await owner.verifyPremiumReportSession(legacyToken, { userId: accountA });
assert.deepEqual(
  { ok: legacyRead.ok, code: legacyRead.code },
  { ok: false, code: "owner_mismatch" },
  "legacy unbound tokens must fail closed"
);

const tamperedSignature = `${encodedValid}.${signatureValid.slice(0, -1)}${signatureValid.endsWith("A") ? "B" : "A"}`;
const tamperedSignatureRead = await owner.verifyPremiumReportSession(tamperedSignature, { userId: accountA });
assert.deepEqual(
  { ok: tamperedSignatureRead.ok, code: tamperedSignatureRead.code },
  { ok: false, code: "invalid_signature" }
);

const tamperedPayloadObject = { ...decodedValid, sid: `${decodedValid.sid}-tampered` };
const tamperedPayload = `${Buffer.from(JSON.stringify(tamperedPayloadObject), "utf8").toString("base64url")}.${signatureValid}`;
const tamperedPayloadRead = await owner.verifyPremiumReportSession(tamperedPayload, { userId: accountA });
assert.deepEqual(
  { ok: tamperedPayloadRead.ok, code: tamperedPayloadRead.code },
  { ok: false, code: "invalid_signature" }
);

assert.equal((await owner.verifyPremiumReportSession(null, { userId: accountA })).code, "missing");
assert.equal((await owner.verifyPremiumReportSession("malformed", { userId: accountA })).code, "missing");
assert.equal((await owner.verifyPremiumReportSession(".", { userId: accountA })).code, "malformed");

const missingSessionToken = signEnvelope({
  scope: "premium-report",
  exp: Date.now() + 60_000,
  sid: "missing-session",
  owner: ownerBinding.createPremiumReportOwnerBinding(accountA, testSecret)
});
const missingSessionRead = await owner.verifyPremiumReportSession(missingSessionToken, { userId: accountA });
assert.deepEqual(
  { ok: missingSessionRead.ok, code: missingSessionRead.code },
  { ok: false, code: "missing_session" }
);

const expiredToken = await owner.createPremiumReportSession(
  { premiumReport: basePremiumReport, locale: "ko" },
  { userId: accountA, ttlMs: -1 }
);
const expiredRead = await owner.verifyPremiumReportSession(expiredToken, { userId: accountA });
assert.deepEqual({ ok: expiredRead.ok, code: expiredRead.code }, { ok: false, code: "expired" });

const updateResult = await owner.updatePremiumReportSession(
  validToken,
  { ...basePremiumReport, updateMarker: "updated" },
  { userId: accountA }
);
assert.equal(updateResult.ok, true);
assert.equal(
  (await owner.verifyPremiumReportSession(validToken, { userId: accountA })).payload.premiumReport.updateMarker,
  "updated"
);
assert.equal(
  (await owner.updatePremiumReportSession(validToken, basePremiumReport, { userId: accountB })).code,
  "owner_mismatch"
);
assert.equal(
  (await owner.updatePremiumReportSession(tamperedSignature, basePremiumReport, { userId: accountA })).code,
  "invalid_signature"
);

const rotatedToken = await owner.createPremiumReportSession(
  { premiumReport: { ...basePremiumReport, rotated: true }, locale: "ko" },
  { userId: accountA }
);
assert.notEqual(rotatedToken, validToken);
const rotatedRead = await owner.verifyPremiumReportSession(rotatedToken, { userId: accountA });
assert.equal(rotatedRead.ok, true);
assert.equal(rotatedRead.payload.premiumReport.rotated, true);
assert.equal(rotatedToken.includes(accountA), false);

let cookieUser = null;
function userClient(user, error = null) {
  return {
    auth: {
      async getUser() {
        return error ? { data: null, error } : { data: { user }, error: null };
      }
    }
  };
}
const cookieClient = userClient(accountA ? { id: accountA } : null);
const bearerClients = new Map([
  ["account-a", userClient({ id: accountA })],
  ["account-b", userClient({ id: accountB })],
  ["stale", userClient(null, { message: "stale" })],
  ["malformed", userClient(null, { message: "malformed" })]
]);
const principalModule = await sourceModule("lib/premium-route-principal.js", async (specifier) => {
  throw new Error(`unexpected principal dependency: ${specifier}`);
});
const premiumAccessModule = syntheticModule("@/lib/premium-access", {
  resolvePremiumAccessForUser: (user) => ({
    canCreatePremium: Boolean(user),
    reason: user ? null : "login_required"
  })
});
const serverClientModule = syntheticModule("@/lib/supabase/server-client", {
  createRouteSupabaseAuthClient: (token) => bearerClients.get(token) || userClient(null, { message: "invalid" })
});
const serverModule = syntheticModule("@/lib/supabase/server", {
  createServerSupabaseClient: async () => userClient(cookieUser)
});
const routeContextModule = await sourceModule("lib/premium-route-context.js", async (specifier) => {
  if (specifier === "server-only") return serverOnlyModule;
  if (specifier === "@/lib/premium-access") return premiumAccessModule;
  if (specifier === "@/lib/premium-route-principal") return principalModule;
  if (specifier === "@/lib/supabase/server-client") return serverClientModule;
  if (specifier === "@/lib/supabase/server") return serverModule;
  throw new Error(`unexpected route-context dependency: ${specifier}`);
});

function requestWithAuthorization(authorization = null, userId = "client-supplied-user") {
  return {
    headers: {
      get(name) {
        return name.toLowerCase() === "authorization" ? authorization : null;
      }
    },
    cookies: {
      get() {
        return { value: "opaque-premium-cookie" };
      }
    },
    async json() {
      return { user_id: userId, locale: "ko" };
    }
  };
}

const resolveContext = routeContextModule.namespace.resolvePremiumRouteContext;
async function principalCase(cookieId, authorization) {
  cookieUser = cookieId ? { id: cookieId } : null;
  return resolveContext(requestWithAuthorization(authorization));
}

const conflictAB = await principalCase(accountA, "Bearer account-b");
assert.equal(conflictAB.authError, "principal_conflict");
assert.equal(conflictAB.user, null);
const conflictBA = await principalCase(accountB, "Bearer account-a");
assert.equal(conflictBA.authError, "principal_conflict");
const staleBearer = await principalCase(accountA, "Bearer stale");
assert.equal(staleBearer.authSource, "cookie");
assert.equal(staleBearer.user.id, accountA);
const malformedBearer = await principalCase(accountA, "Bearer malformed");
assert.equal(malformedBearer.authSource, "cookie");
assert.equal(malformedBearer.user.id, accountA);
const malformedScheme = await principalCase(accountA, "Basic malformed");
assert.equal(malformedScheme.authSource, "cookie");
const bearerOnly = await principalCase(null, "Bearer account-b");
assert.equal(bearerOnly.authSource, "bearer");
assert.equal(bearerOnly.user.id, accountB);
const aligned = await principalCase(accountA, "Bearer account-a");
assert.equal(aligned.authSource, "cookie");
assert.equal(aligned.user.id, accountA);
assert.notEqual(aligned.user.id, "client-supplied-user");

function jsonResponse(body, init = {}) {
  const cookies = [];
  return {
    body,
    status: init.status || 200,
    headers: init.headers || {},
    cookies: {
      set(...args) {
        cookies.push(args);
      }
    },
    cookieWrites: cookies
  };
}
const nextServerModule = syntheticModule("next/server", {
  NextResponse: {
    json: jsonResponse,
    redirect: (url, init = {}) => jsonResponse(null, { ...init, status: init.status || 307, headers: { location: String(url), ...(init.headers || {}) } })
  }
});
const fullRouteMocks = new Map([
  ["next/server", nextServerModule],
  ["@/lib/openai-env-diagnostics", syntheticModule("openai-env", { getOpenAiEnvDiagnostics: () => ({}) })],
  ["@/lib/auth/profile-upsert", syntheticModule("profile-upsert", { upsertProfileForUser: async () => {}, serializeSupabaseError: () => ({ code: "redacted" }) })],
  ["@/lib/product-fit-gauges", syntheticModule("fit-gauges", { buildProductFitGauges: () => null })],
  ["@/lib/premium-access", syntheticModule("premium-access-route", { isAccountUser: (user) => Boolean(user?.id) })],
  ["@/lib/premium-current-products", syntheticModule("current-products", { buildPremiumCurrentProductsSnapshot: async () => null, enrichPremiumReportWithCurrentProducts: (report) => report })],
  ["@/lib/premium-face-lab", syntheticModule("face-lab", { buildPremiumFaceLabSummary: () => null, sanitizePremiumFaceLabSummary: () => null })],
  ["@/lib/premium-report-session", syntheticModule("session-route-mock", {
    getPremiumReportCookieOptions: () => ({ path: "/api/full-report" }),
    PREMIUM_REPORT_COOKIE: "kbeauty_premium_report",
    updatePremiumReportSession: async () => ({ ok: false, code: "not_reached" }),
    verifyPremiumReportSession: async () => ({ ok: false, code: "missing" })
  })],
  ["@/lib/premium-route-context", syntheticModule("route-context-route", { resolvePremiumRouteContext: resolveContext })],
  ["@/lib/premium-saved-report-access", syntheticModule("saved-access", { canReadSavedPremiumReport: () => false, hasSavedPremiumReportEntitlement: () => false })],
  ["@/lib/premium-report-snapshot", syntheticModule("snapshot", { buildPremiumReportSnapshot: () => null, classifyPremiumSnapshotReplay: () => ({ status: "conflict" }), resolvePremiumReportLocale: (_report, locale) => locale })]
]);
const fullRouteModule = await sourceModule("app/api/full-report/route.js", async (specifier) => {
  const dependency = fullRouteMocks.get(specifier);
  if (dependency) return dependency;
  throw new Error(`unexpected full-report dependency: ${specifier}`);
});

async function fullReportResult(cookieId, authorization, clientUserId = "client-supplied-user") {
  cookieUser = cookieId ? { id: cookieId } : null;
  return fullRouteModule.namespace.POST(requestWithAuthorization(authorization, clientUserId));
}

const routeConflictAB = await fullReportResult(accountA, "Bearer account-b", accountA);
assert.equal(routeConflictAB.status, 401);
assert.equal(routeConflictAB.body.error, "premium_principal_conflict");
assert.equal(routeConflictAB.headers["Cache-Control"], "private, no-store, max-age=0, must-revalidate");
const routeConflictBA = await fullReportResult(accountB, "Bearer account-a", accountB);
assert.equal(routeConflictBA.status, 401);
assert.equal(routeConflictBA.body.error, "premium_principal_conflict");
const routeStale = await fullReportResult(accountA, "Bearer stale", accountB);
assert.equal(routeStale.status, 401);
assert.equal(routeStale.body.error, "premium_session_missing_or_expired");
const routeMalformed = await fullReportResult(accountA, "Bearer malformed", accountB);
assert.equal(routeMalformed.status, 401);
assert.equal(routeMalformed.body.error, "premium_session_missing_or_expired");
const routeBearerOnly = await fullReportResult(null, "Bearer account-b", accountA);
assert.equal(routeBearerOnly.status, 401);
assert.equal(routeBearerOnly.body.error, "premium_session_missing_or_expired");
const routeAligned = await fullReportResult(accountA, "Bearer account-a", accountB);
assert.equal(routeAligned.status, 401);
assert.equal(routeAligned.body.error, "premium_session_missing_or_expired");

console.log(JSON.stringify({
  status: "passed",
  principalScenarios: 6,
  routeScenarios: 6,
  tokenScenarios: 10,
  sessionBoundaries: ["create", "read", "update", "rotate"],
  sensitiveValuesPrinted: false
}, null, 2));
