import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const EXPECTED_REQUIRED_CASE_COUNT = 40;
export const REQUIRED_CASE_IDS = Object.freeze([
  "E01_AUTHNAV_POST_FORM",
  "E02_SIGNOUT_GET_LINK_ABSENT",
  "E03_GET_405",
  "E04_HEAD_EXPLICIT_405",
  "E05_OPTIONS_204",
  "E06_ALLOW_POST_OPTIONS",
  "E07_SAFE_METHODS_AUTH_CALL_ZERO",
  "E08_QUERY_PREFETCH_TRANSPORT_ABSENT",
  "C01_HOSTED_PRODUCTION_TRIPLE_ORIGIN",
  "C02_PREVIEW_EXACT_ORIGIN",
  "C03_LOCAL_PRODUCTION_EXACT_ORIGIN",
  "C04_FOREIGN_ORIGIN_REJECTED",
  "C05_MISSING_ORIGIN_REJECTED",
  "C06_NULL_ORIGIN_REJECTED",
  "C07_MULTIPLE_ORIGIN_REJECTED",
  "C08_MALFORMED_ORIGIN_REJECTED",
  "C09_LOOKALIKE_ORIGIN_REJECTED",
  "C10_PROTOCOL_PORT_MISMATCH_REJECTED",
  "C11_FETCH_SITE_REJECTED",
  "C12_REFERER_ONLY_REJECTED",
  "S01_LOCAL_SCOPE",
  "S02_VALID_POST_SINGLE_SIGNOUT",
  "S03_INVALID_POST_ZERO_SIGNOUT",
  "S04_ANONYMOUS_IDEMPOTENT",
  "S05_DUPLICATE_IDEMPOTENT",
  "S06_COOKIE_DELETION_PRESERVED",
  "S07_SIGNOUT_ERROR_503",
  "S08_RETRY_AFTER_60",
  "S09_MIDDLEWARE_EXACT_BYPASS",
  "S10_NO_SESSION_RESURRECTION",
  "R01_SUCCESS_303",
  "R02_FIXED_ROOT_LOCATION",
  "R03_REDIRECT_PARAMS_IGNORED",
  "R04_SUCCESS_NO_STORE",
  "R05_FORBIDDEN_NO_STORE",
  "R06_METHOD_NO_STORE",
  "R07_OPTIONS_NO_STORE",
  "R08_UNAVAILABLE_NO_STORE",
  "R09_SECURITY_HEADERS_PRESERVED",
  "R10_CORS_NOT_EXPANDED"
]);

const root = process.cwd();
const require = createRequire(import.meta.url);
const { createServerClient } = require("@supabase/ssr");
const policy = await import(
  pathToFileURL(resolve(root, "lib/security/signout-request-policy.js")).href
);
const authNavSource = read("components/auth/AuthNav.jsx");
const routeSource = read("app/api/auth/signout/route.js");
const middlewareSource = read("lib/supabase/middleware.js");
const securityHeaderSource = read("lib/security/security-headers.js");
const VALID_ORIGIN = "https://app.example.com";
const VALID_URL = `${VALID_ORIGIN}/api/auth/signout`;

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8").replace(/\r\n?/g, "\n");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertExactSet(actualValues, expectedValues, label) {
  const actual = [...new Set(actualValues)].sort();
  const expected = [...new Set(expectedValues)].sort();
  assert(actual.length === actualValues.length, `${label}: duplicate ID`);
  assert(expected.length === expectedValues.length, `${label}: required manifest duplicate ID`);
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label}: exact set mismatch`);
}

function encodeJsonBase64Url(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function createRequest({
  url = VALID_URL,
  method = "POST",
  origin = VALID_ORIGIN,
  fetchSite = "same-origin",
  referer
} = {}) {
  const headers = new Headers();

  if (origin !== undefined) {
    headers.set("Origin", origin);
  }
  if (fetchSite !== undefined) {
    headers.set("Sec-Fetch-Site", fetchSite);
  }
  if (referer !== undefined) {
    headers.set("Referer", referer);
  }

  return new Request(url, { method, headers });
}

function createHarness({
  isHostedProduction = false,
  canonicalProductionOrigin = null,
  signOutError = null,
  throwOnSignOut = false
} = {}) {
  const tracker = {
    clientCalls: 0,
    signOutCalls: 0,
    scopes: []
  };
  const handlers = policy.createSignOutRouteHandlers({
    async createSupabaseClient() {
      tracker.clientCalls += 1;
      return {
        auth: {
          async signOut(options) {
            tracker.signOutCalls += 1;
            tracker.scopes.push(options?.scope);
            if (throwOnSignOut) {
              throw new Error("synthetic_signout_failure");
            }
            return { error: signOutError };
          }
        }
      };
    },
    getRuntimeOriginContract() {
      return { isHostedProduction, canonicalProductionOrigin };
    }
  });

  return { handlers, tracker };
}

function getDecision({
  requestUrl = VALID_URL,
  origin = VALID_ORIGIN,
  fetchSite = "same-origin",
  isHostedProduction = false,
  canonicalProductionOrigin = null,
  originPresent = true,
  fetchSitePresent = true
} = {}) {
  const headers = {};
  if (originPresent) headers.origin = origin;
  if (fetchSitePresent) headers["sec-fetch-site"] = fetchSite;
  return policy.evaluateSignOutRequest({
    requestUrl,
    requestHeaders: headers,
    isHostedProduction,
    canonicalProductionOrigin
  });
}

function assertNoStore(response, label) {
  assert(response.headers.get("cache-control") === "private, no-store, max-age=0", `${label}: Cache-Control mismatch`);
  assert(response.headers.get("cdn-cache-control") === "no-store", `${label}: CDN-Cache-Control mismatch`);
  assert(response.headers.get("vercel-cdn-cache-control") === "no-store", `${label}: Vercel-CDN-Cache-Control mismatch`);
}

async function responseJson(response) {
  return JSON.parse(await response.text());
}

async function runInstalledSdkSignOut({ withSession = true, responseStatus = 200 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: "00000000-0000-4000-8000-000000000011",
    aud: "authenticated",
    role: "authenticated",
    email: "sec11@example.invalid",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date(0).toISOString()
  };
  const accessToken = `${encodeJsonBase64Url({ alg: "HS256", typ: "JWT" })}.${encodeJsonBase64Url({
    sub: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    exp: now + 3600,
    iat: now
  })}.synthetic-signature`;
  const cookieName = "sb-project-ref-auth-token";
  const cookieValue = `base64-${encodeJsonBase64Url({
    access_token: accessToken,
    refresh_token: "synthetic-refresh-token",
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: "bearer",
    user
  })}`;
  const cookieWrites = [];
  const fetchCalls = [];
  const supabase = createServerClient(
    "https://project-ref.supabase.co",
    "synthetic-anon-key",
    {
      global: {
        fetch: async (input, init) => {
          fetchCalls.push({ url: String(input), method: init?.method || "GET" });
          return new Response(
            JSON.stringify(responseStatus === 200 ? {} : { message: "synthetic_failure" }),
            {
              status: responseStatus,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
      },
      cookies: {
        getAll() {
          return withSession ? [{ name: cookieName, value: cookieValue }] : [];
        },
        setAll(cookies) {
          cookieWrites.push(...cookies);
        }
      }
    }
  );
  const result = await supabase.auth.signOut({ scope: "local" });

  return { result, fetchCalls, cookieWrites, cookieName };
}

const catalog = Object.freeze([
  { id: "E01_AUTHNAV_POST_FORM", async run() {
    assert(/<form\s+method="post"\s+action="\/api\/auth\/signout">/.test(authNavSource), "AuthNav exact POST form missing");
    assert(/<button\s+type="submit"/.test(authNavSource), "AuthNav submit button missing");
  } },
  { id: "E02_SIGNOUT_GET_LINK_ABSENT", async run() {
    assert(!/<a[^>]+href="\/api\/auth\/signout"/.test(authNavSource), "GET signout anchor remains");
    assert(!/<Link[^>]+href="\/api\/auth\/signout"/.test(authNavSource), "Next Link signout remains");
    assert(!authNavSource.includes("router.push(\"/api/auth/signout\")") && !authNavSource.includes("window.location"), "client GET signout transport remains");
    assert(!authNavSource.includes("auth.signOut("), "client signout was added");
  } },
  { id: "E03_GET_405", async run() {
    const { handlers, tracker } = createHarness();
    const response = await handlers.GET();
    assert(response.status === 405 && (await responseJson(response)).error === "method_not_allowed", "GET contract mismatch");
    assert(tracker.clientCalls === 0 && tracker.signOutCalls === 0, "GET touched auth");
  } },
  { id: "E04_HEAD_EXPLICIT_405", async run() {
    const { handlers, tracker } = createHarness();
    const response = await handlers.HEAD();
    assert(routeSource.includes("export const HEAD = signOutHandlers.HEAD"), "HEAD is not explicitly exported");
    assert(response.status === 405 && (await response.text()) === "", "HEAD contract mismatch");
    assert(tracker.clientCalls === 0 && tracker.signOutCalls === 0, "HEAD touched auth");
  } },
  { id: "E05_OPTIONS_204", async run() {
    const { handlers, tracker } = createHarness();
    const response = await handlers.OPTIONS();
    assert(response.status === 204 && (await response.text()) === "", "OPTIONS contract mismatch");
    assert(tracker.clientCalls === 0 && tracker.signOutCalls === 0, "OPTIONS touched auth");
  } },
  { id: "E06_ALLOW_POST_OPTIONS", async run() {
    const { handlers } = createHarness();
    for (const response of [await handlers.GET(), await handlers.HEAD(), await handlers.OPTIONS()]) {
      assert(response.headers.get("allow") === "POST, OPTIONS", "Allow header mismatch");
    }
  } },
  { id: "E07_SAFE_METHODS_AUTH_CALL_ZERO", async run() {
    const { handlers, tracker } = createHarness();
    await Promise.all([handlers.GET(), handlers.HEAD(), handlers.OPTIONS()]);
    assert(tracker.clientCalls === 0 && tracker.signOutCalls === 0, "safe methods created an auth client");
  } },
  { id: "E08_QUERY_PREFETCH_TRANSPORT_ABSENT", async run() {
    assert(!/href="\/api\/auth\/signout(?:\?|#)/.test(authNavSource), "query-triggered signout link present");
    assert(!authNavSource.includes("prefetch"), "signout prefetch transport present");
    assert(!routeSource.includes("searchParams") && !routeSource.includes("request.nextUrl"), "route reads query-controlled signout input");
  } },
  { id: "C01_HOSTED_PRODUCTION_TRIPLE_ORIGIN", async run() {
    const runtimeContract = policy.getSignOutRuntimeOriginContract({
      vercelEnvironment: "production",
      configuredProductionOrigin: VALID_ORIGIN,
      canonicalProductionOrigin: VALID_ORIGIN
    });
    assert(runtimeContract.isHostedProduction && runtimeContract.canonicalProductionOrigin === VALID_ORIGIN, "exact hosted production origin contract rejected");
    for (const configuredProductionOrigin of [`${VALID_ORIGIN}/`, `${VALID_ORIGIN}/path`, `${VALID_ORIGIN}?query=1`, `${VALID_ORIGIN}#fragment`, "http://app.example.com", "https://app.example.com:443"]) {
      assert(policy.getSignOutRuntimeOriginContract({
        vercelEnvironment: "production",
        configuredProductionOrigin,
        canonicalProductionOrigin: VALID_ORIGIN
      }).canonicalProductionOrigin === null, `malformed configured production origin accepted: ${configuredProductionOrigin}`);
    }
    assert(getDecision({ isHostedProduction: true, canonicalProductionOrigin: VALID_ORIGIN }).allowed, "hosted production exact triple origin rejected");
    assert(!getDecision({ isHostedProduction: true, canonicalProductionOrigin: "https://canonical.example.com" }).allowed, "hosted production canonical mismatch accepted");
    assert(!getDecision({ isHostedProduction: true, canonicalProductionOrigin: null }).allowed, "missing production canonical origin accepted");
  } },
  { id: "C02_PREVIEW_EXACT_ORIGIN", async run() {
    const previewOrigin = "https://feature-example.vercel.app";
    assert(getDecision({ requestUrl: `${previewOrigin}/api/auth/signout`, origin: previewOrigin }).allowed, "preview exact origin rejected");
  } },
  { id: "C03_LOCAL_PRODUCTION_EXACT_ORIGIN", async run() {
    const localOrigin = "http://127.0.0.1:3001";
    assert(getDecision({ requestUrl: `${localOrigin}/api/auth/signout`, origin: localOrigin }).allowed, "local production server exact origin rejected");
    const runtimeContract = policy.getSignOutRuntimeOriginContract({
      vercelEnvironment: undefined,
      configuredProductionOrigin: "https://app.example.com/path",
      canonicalProductionOrigin: VALID_ORIGIN
    });
    assert(!runtimeContract.isHostedProduction && runtimeContract.canonicalProductionOrigin === null, "local next start was treated as hosted production");
    assert(routeSource.includes("getSignOutRuntimeOriginContract({"), "route is not wired to the strict runtime origin contract");
  } },
  { id: "C04_FOREIGN_ORIGIN_REJECTED", async run() {
    assert(!getDecision({ origin: "https://evil.example" }).allowed, "foreign Origin accepted");
  } },
  { id: "C05_MISSING_ORIGIN_REJECTED", async run() {
    assert(!getDecision({ originPresent: false }).allowed, "missing Origin accepted");
  } },
  { id: "C06_NULL_ORIGIN_REJECTED", async run() {
    assert(!getDecision({ origin: "null" }).allowed, "null Origin accepted");
  } },
  { id: "C07_MULTIPLE_ORIGIN_REJECTED", async run() {
    for (const origin of [`${VALID_ORIGIN}, https://evil.example`, `${VALID_ORIGIN} https://evil.example`, ` ${VALID_ORIGIN}`, `${VALID_ORIGIN} `]) {
      assert(!getDecision({ origin }).allowed, `multiple or whitespace-obfuscated Origin accepted: ${origin}`);
    }
  } },
  { id: "C08_MALFORMED_ORIGIN_REJECTED", async run() {
    for (const origin of ["//app.example.com", "https://user@app.example.com", "https://user:pass@app.example.com", `${VALID_ORIGIN}/path`, `${VALID_ORIGIN}?x=1`, `${VALID_ORIGIN}#x`, "https://app.example.com\n.evil.example", "https://app.example.com%00.evil.example"]) {
      assert(!getDecision({ origin }).allowed, `malformed Origin accepted: ${JSON.stringify(origin)}`);
    }
  } },
  { id: "C09_LOOKALIKE_ORIGIN_REJECTED", async run() {
    for (const origin of ["https://app.example.com.evil.example", "https://evil-app.example.com", "https://app.example.co", "https://xn--pp-eka.example.com", "https://app.example.com."]) {
      assert(!getDecision({ origin }).allowed, `lookalike Origin accepted: ${origin}`);
    }
  } },
  { id: "C10_PROTOCOL_PORT_MISMATCH_REJECTED", async run() {
    for (const origin of ["http://app.example.com", "https://app.example.com:444", "https://app.example.com:443"]) {
      assert(!getDecision({ origin }).allowed, `protocol or port mismatch accepted: ${origin}`);
    }
  } },
  { id: "C11_FETCH_SITE_REJECTED", async run() {
    for (const fetchSite of ["cross-site", "same-site", "none", "SAME-ORIGIN", "same-origin, cross-site", ""]) {
      assert(!getDecision({ fetchSite }).allowed, `unsafe Sec-Fetch-Site accepted: ${fetchSite}`);
    }
    assert(getDecision({ fetchSitePresent: false }).allowed, "absent Sec-Fetch-Site should defer to exact Origin");
  } },
  { id: "C12_REFERER_ONLY_REJECTED", async run() {
    const { handlers, tracker } = createHarness();
    const response = await handlers.POST(new Request(VALID_URL, {
      method: "POST",
      headers: { Referer: `${VALID_ORIGIN}/my` }
    }));
    assert(response.status === 403 && tracker.signOutCalls === 0, "Referer-only request accepted");
  } },
  { id: "S01_LOCAL_SCOPE", async run() {
    const { handlers, tracker } = createHarness();
    await handlers.POST(createRequest());
    assert(JSON.stringify(tracker.scopes) === JSON.stringify(["local"]), "signOut scope must be explicit local");
  } },
  { id: "S02_VALID_POST_SINGLE_SIGNOUT", async run() {
    const { handlers, tracker } = createHarness();
    const response = await handlers.POST(createRequest());
    assert(response.status === 303 && tracker.clientCalls === 1 && tracker.signOutCalls === 1, "valid POST must sign out exactly once");
  } },
  { id: "S03_INVALID_POST_ZERO_SIGNOUT", async run() {
    const { handlers, tracker } = createHarness();
    const response = await handlers.POST(createRequest({ origin: "https://evil.example" }));
    assert(response.status === 403 && tracker.clientCalls === 0 && tracker.signOutCalls === 0, "invalid POST touched Supabase");
  } },
  { id: "S04_ANONYMOUS_IDEMPOTENT", async run() {
    const sdk = await runInstalledSdkSignOut({ withSession: false });
    assert(sdk.result.error === null && sdk.fetchCalls.length === 0, "installed SDK did not normalize missing session to local success");
    const { handlers } = createHarness();
    assert((await handlers.POST(createRequest())).status === 303, "anonymous route success must remain generic 303");
  } },
  { id: "S05_DUPLICATE_IDEMPOTENT", async run() {
    const { handlers, tracker } = createHarness();
    const responses = await Promise.all([handlers.POST(createRequest()), handlers.POST(createRequest())]);
    assert(responses.every((response) => response.status === 303 && response.headers.get("location") === "/"), "duplicate POST contract changed");
    assert(tracker.signOutCalls === 2 && tracker.scopes.every((scope) => scope === "local"), "duplicate POST did not remain local and idempotent");
  } },
  { id: "S06_COOKIE_DELETION_PRESERVED", async run() {
    const sdk = await runInstalledSdkSignOut();
    assert(sdk.result.error === null, "installed Supabase local signout returned an error");
    assert(sdk.fetchCalls.length === 1 && sdk.fetchCalls[0].method === "POST" && sdk.fetchCalls[0].url === "https://project-ref.supabase.co/auth/v1/logout?scope=local", "installed SDK did not call local logout exactly once");
    assert(sdk.cookieWrites.some((cookie) => cookie.name === sdk.cookieName && cookie.value === "" && cookie.options?.maxAge === 0), "installed SSR adapter did not emit auth-cookie deletion");
  } },
  { id: "S07_SIGNOUT_ERROR_503", async run() {
    const sdk = await runInstalledSdkSignOut({ responseStatus: 500 });
    assert(sdk.result.error && sdk.cookieWrites.length === 0, "backend failure partially deleted the installed SDK cookie state");
    const { handlers } = createHarness({ signOutError: new Error("synthetic") });
    const response = await handlers.POST(createRequest());
    const body = await responseJson(response);
    assert(response.status === 503 && body.error === "signout_unavailable" && !JSON.stringify(body).includes("synthetic"), "Supabase error must be generalized as 503");
    assert(!response.headers.has("location"), "failed signout must not redirect");
  } },
  { id: "S08_RETRY_AFTER_60", async run() {
    const { handlers } = createHarness({ throwOnSignOut: true });
    const response = await handlers.POST(createRequest());
    assert(response.status === 503 && response.headers.get("retry-after") === "60", "signout failure Retry-After mismatch");
  } },
  { id: "S09_MIDDLEWARE_EXACT_BYPASS", async run() {
    assert(policy.shouldBypassSupabaseSessionRefresh("/api/auth/signout"), "exact signout path is not bypassed");
    assert(policy.shouldBypassSupabaseSessionRefresh("/auth/callback"), "existing callback bypass regressed");
    assert(!policy.shouldBypassSupabaseSessionRefresh("/api/auth/signout-evil"), "prefix lookalike bypassed refresh");
    assert(!policy.shouldBypassSupabaseSessionRefresh("/api/auth/signout/extra"), "nested lookalike bypassed refresh");
    assert(middlewareSource.includes("if (shouldBypassSupabaseSessionRefresh(request.nextUrl.pathname))"), "middleware is not wired to exact bypass predicate");
  } },
  { id: "S10_NO_SESSION_RESURRECTION", async run() {
    const bypassIndex = middlewareSource.indexOf("if (shouldBypassSupabaseSessionRefresh(request.nextUrl.pathname))");
    const clientIndex = middlewareSource.indexOf("const supabase = createServerClient");
    const claimsIndex = middlewareSource.indexOf("await supabase.auth.getClaims()");
    assert(bypassIndex >= 0 && bypassIndex < clientIndex && bypassIndex < claimsIndex, "signout bypass must precede refresh and getClaims");
    assert(routeSource.includes("createSupabaseClient: createServerSupabaseClient"), "route must remain the sole signout auth client");
  } },
  { id: "R01_SUCCESS_303", async run() {
    const { handlers } = createHarness();
    assert((await handlers.POST(createRequest())).status === 303, "success must use 303");
  } },
  { id: "R02_FIXED_ROOT_LOCATION", async run() {
    const { handlers } = createHarness();
    assert((await handlers.POST(createRequest())).headers.get("location") === "/", "success Location must be fixed root");
  } },
  { id: "R03_REDIRECT_PARAMS_IGNORED", async run() {
    const { handlers } = createHarness();
    for (const key of ["next", "returnTo", "callbackUrl", "redirectTo", "continue", "url"]) {
      const response = await handlers.POST(createRequest({ url: `${VALID_URL}?${key}=https://evil.example` }));
      assert(response.status === 303 && response.headers.get("location") === "/", `redirect parameter consumed: ${key}`);
    }
  } },
  { id: "R04_SUCCESS_NO_STORE", async run() {
    const { handlers } = createHarness();
    assertNoStore(await handlers.POST(createRequest()), "success");
  } },
  { id: "R05_FORBIDDEN_NO_STORE", async run() {
    const { handlers } = createHarness();
    const response = await handlers.POST(createRequest({ origin: "https://evil.example" }));
    assert(response.status === 403 && (await responseJson(response)).error === "invalid_request_origin", "invalid Origin response mismatch");
    assertNoStore(response, "forbidden");
  } },
  { id: "R06_METHOD_NO_STORE", async run() {
    const { handlers } = createHarness();
    assertNoStore(await handlers.GET(), "GET 405");
    assertNoStore(await handlers.HEAD(), "HEAD 405");
  } },
  { id: "R07_OPTIONS_NO_STORE", async run() {
    const { handlers } = createHarness();
    assertNoStore(await handlers.OPTIONS(), "OPTIONS");
  } },
  { id: "R08_UNAVAILABLE_NO_STORE", async run() {
    const { handlers } = createHarness({ signOutError: new Error("synthetic") });
    assertNoStore(await handlers.POST(createRequest()), "unavailable");
  } },
  { id: "R09_SECURITY_HEADERS_PRESERVED", async run() {
    for (const required of [
      '{ key: "X-Content-Type-Options", value: "nosniff" }',
      '{ key: "X-Frame-Options", value: "DENY" }',
      '{ key: "Referrer-Policy", value: "same-origin" }',
      '{ key: "Cross-Origin-Opener-Policy", value: "same-origin" }',
      '{ key: "Origin-Agent-Cluster", value: "?1" }'
    ]) {
      assert(securityHeaderSource.includes(required), `SEC-10 header missing: ${required}`);
    }
  } },
  { id: "R10_CORS_NOT_EXPANDED", async run() {
    const { handlers } = createHarness();
    const responses = [
      await handlers.GET(),
      await handlers.HEAD(),
      await handlers.OPTIONS(),
      await handlers.POST(createRequest()),
      await handlers.POST(createRequest({ origin: "https://evil.example" }))
    ];
    for (const response of responses) {
      assert(!response.headers.has("access-control-allow-origin"), "CORS origin was added");
      assert(!response.headers.has("access-control-allow-credentials"), "CORS credentials were added");
    }
  } }
]);

const catalogIds = catalog.map((item) => item.id);

assert(REQUIRED_CASE_IDS.length === EXPECTED_REQUIRED_CASE_COUNT, "required case count mismatch");
assert(catalog.length === EXPECTED_REQUIRED_CASE_COUNT, "implemented case count mismatch");
assertExactSet(REQUIRED_CASE_IDS, REQUIRED_CASE_IDS, "manifest");
assertExactSet(catalogIds, REQUIRED_CASE_IDS, "catalog");

const observed = new Map();
let failed = false;

for (const item of catalog) {
  if (observed.has(item.id)) {
    throw new Error(`duplicate observed case: ${item.id}`);
  }

  try {
    await item.run();
    observed.set(item.id, "PASS");
    console.log(`SEC11_CASE_RESULT=${JSON.stringify({ id: item.id, result: "PASS" })}`);
  } catch (error) {
    failed = true;
    observed.set(item.id, "FAIL");
    console.error(`SEC11_CASE_RESULT=${JSON.stringify({ id: item.id, result: "FAIL", error: error?.message || "case_failed" })}`);
  }
}

assert(observed.size === EXPECTED_REQUIRED_CASE_COUNT, "observed case count mismatch");
assertExactSet([...observed.keys()], REQUIRED_CASE_IDS, "observed");
assert([...observed.values()].every((value) => value === "PASS") && !failed, "one or more SEC-11 cases failed");

console.log(`SEC11_SIGNOUT_CASES=${observed.size}/${EXPECTED_REQUIRED_CASE_COUNT}`);
console.log("SEC11_SIGNOUT_BOUNDARY=PASS");
