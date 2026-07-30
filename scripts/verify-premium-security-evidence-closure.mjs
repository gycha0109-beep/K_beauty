import assert from "node:assert/strict";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const testSecret = "test-only-premium-security-closure-secret";
const accountA = "11111111-1111-4111-8111-111111111111";
const accountB = "22222222-2222-4222-8222-222222222222";
const basePremiumReport = {
  freeResult: { summary: "fixture" },
  fullRoutine: { morning: [] }
};

const context = vm.createContext({
  Buffer,
  Date,
  console: { ...console, info() {}, warn() {}, error() {} },
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
      for (const [name, value] of Object.entries(exports)) {
        this.setExport(name, value);
      }
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

const cryptoModule = syntheticModule("crypto", {
  createHmac,
  randomBytes,
  timingSafeEqual
});
const serverOnlyModule = syntheticModule("server-only", {});

const ownerModule = await sourceModule(
  "lib/premium-report-session-owner.js",
  async (specifier) => {
    if (specifier === "crypto") return cryptoModule;
    throw new Error(`unexpected owner dependency: ${specifier}`);
  }
);

const sessions = new Map();
const sessionStore = {
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
        const query = {
          eq(field, value) {
            filters[field] = value;
            return query;
          },
          async maybeSingle() {
            const row = sessions.get(filters.session_id) || null;
            return { data: row ? structuredClone(row) : null, error: null };
          }
        };
        return query;
      },
      update(values) {
        const filters = {};
        const query = {
          eq(field, value) {
            filters[field] = value;
            return query;
          },
          gt(field, value) {
            filters[field] = value;
            return query;
          },
          select() {
            return query;
          },
          async maybeSingle() {
            const row = sessions.get(filters.session_id) || null;
            if (!row || new Date(row.expires_at).getTime() <= new Date(filters.expires_at).getTime()) {
              return { data: null, error: null };
            }
            const next = { ...row, ...structuredClone(values) };
            sessions.set(filters.session_id, next);
            return { data: structuredClone(next), error: null };
          }
        };
        return query;
      }
    };
  }
};

const sessionModule = await sourceModule(
  "lib/premium-report-session.js",
  async (specifier) => {
    if (specifier === "server-only") return serverOnlyModule;
    if (specifier === "crypto") return cryptoModule;
    if (specifier === "@/lib/supabase-admin") {
      return syntheticModule("supabase-admin", {
        createSupabaseAdminClient: () => sessionStore
      });
    }
    if (specifier === "@/lib/premium-report-session-owner") return ownerModule;
    if (specifier === "@/lib/security/error-redaction") {
      return syntheticModule("error-redaction", { writeSafeLog: () => {} });
    }
    if (specifier === "@/lib/premium-session-payload-diagnostics") {
      return syntheticModule("payload-diagnostics", {
        classifyPremiumSessionPayload: (payload) =>
          payload?.premiumReport && typeof payload.premiumReport === "object"
            ? null
            : "premium_report_missing",
        logPremiumSessionValidationFailure: () => true
      });
    }
    throw new Error(`unexpected session dependency: ${specifier}`);
  }
);

const session = sessionModule.namespace;
const validToken = await session.createPremiumReportSession(
  { premiumReport: basePremiumReport, locale: "ko" },
  { userId: accountA }
);
assert.ok(validToken);
assert.equal(validToken.includes(accountA), false);

const validRead = await session.verifyPremiumReportSession(validToken, {
  userId: accountA
});
assert.equal(validRead.ok, true);
assert.equal(validRead.payload.premiumReport.freeResult.summary, "fixture");
assert.equal(
  (await session.verifyPremiumReportSession(validToken, { userId: accountB })).code,
  "owner_mismatch"
);

const [encodedValid] = validToken.split(".");
const decodedValid = JSON.parse(Buffer.from(encodedValid, "base64url").toString("utf8"));
const legacyEnvelope = {
  scope: "premium-report",
  exp: Date.now() + 60_000,
  sid: decodedValid.sid
};
const legacyEncoded = Buffer.from(JSON.stringify(legacyEnvelope), "utf8").toString("base64url");
const legacySignature = createHmac("sha256", testSecret)
  .update(legacyEncoded)
  .digest("base64url");
assert.equal(
  (
    await session.verifyPremiumReportSession(
      `${legacyEncoded}.${legacySignature}`,
      { userId: accountA }
    )
  ).code,
  "owner_mismatch"
);

const updateResult = await session.updatePremiumReportSession(
  validToken,
  { ...basePremiumReport, updateMarker: "updated" },
  { userId: accountA }
);
assert.equal(updateResult.ok, true);
assert.equal(updateResult.payload.premiumReport.updateMarker, "updated");
assert.equal(
  (
    await session.updatePremiumReportSession(
      validToken,
      basePremiumReport,
      { userId: accountB }
    )
  ).code,
  "owner_mismatch"
);

const routePrincipal = await import(
  new URL("../lib/premium-route-principal.js", import.meta.url)
);
const cookieUser = { id: accountA };
const bearerUser = { id: accountB };
assert.equal(
  routePrincipal.selectPremiumRoutePrincipal({
    cookieUser,
    cookieClient: {},
    bearerUser,
    bearerClient: {}
  }).authError,
  "principal_conflict"
);

const analyzeRoute = read("app/api/analyze/route.js");
const fullReportRoute = read("app/api/full-report/route.js");
const sessionRoute = read("app/api/full-report/session/route.js");
const signoutRoute = read("app/api/auth/signout/route.js");

for (const [source, fragment, label] of [
  [analyzeRoute, "userId: premiumUser?.id", "analysis session creation"],
  [fullReportRoute, "userId: user?.id", "full-report session access"],
  [sessionRoute, "userId: routeContext.user.id", "session re-entry"],
  [sessionRoute, "{ userId: context.user.id }", "session rotation"],
  [signoutRoute, "PREMIUM_REPORT_COOKIE", "sign-out cookie cleanup"],
  [signoutRoute, "maxAge: 0", "sign-out cookie expiry"]
]) {
  assert.ok(source.includes(fragment), `${label} is missing ${fragment}`);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      principalScenarios: 1,
      sessionBoundaries: ["create", "read", "update", "rotate"],
      tokenScenarios: ["owner", "mismatch", "legacy"],
      sensitiveValuesPrinted: false
    },
    null,
    2
  )
);
