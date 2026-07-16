import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const EXPECTED_REQUIRED_CASE_COUNT = 60;
export const REQUIRED_CASE_IDS = Object.freeze([
  "C01_GLOBAL_HEADER_SOURCE_COVERAGE",
  "C02_NOSNIFF",
  "C03_FRAME_DENY",
  "C04_REFERRER_NO_REFERRER",
  "C05_CAMERA_SELF",
  "C06_CLIPBOARD_WRITE_SELF",
  "C07_UNUSED_PERMISSIONS_BLOCKED",
  "C08_COOP_SAME_ORIGIN",
  "C09_ORIGIN_AGENT_CLUSTER",
  "C10_SCOPE_NOT_EXPANDED",
  "S01_DEFAULT_SRC_SELF",
  "S02_BASE_URI_SELF",
  "S03_OBJECT_SRC_NONE",
  "S04_FRAME_ANCESTORS_NONE",
  "S05_FORM_ACTION_SELF",
  "S06_SCRIPT_NONCE",
  "S07_STRICT_DYNAMIC",
  "S08_PRODUCTION_NO_SCRIPT_UNSAFE_INLINE",
  "S09_PRODUCTION_NO_UNSAFE_EVAL",
  "S10_DEVELOPMENT_UNSAFE_EVAL_ISOLATED",
  "S11_SCRIPT_SRC_ATTR_NONE",
  "S12_STYLE_SRC_SELF",
  "S13_STYLE_UNSAFE_INLINE_SCOPED",
  "S14_EXACT_IMG_SRC",
  "S15_NO_BROAD_HTTPS",
  "S16_NO_WILDCARD",
  "S17_FONT_SRC_SELF",
  "S18_CONNECT_SRC_SELF",
  "S19_EXACT_SUPABASE_ORIGIN",
  "S20_NO_UNUSED_REALTIME_ORIGIN",
  "S21_FRAME_SRC_NONE",
  "S22_WORKER_SRC_MINIMAL",
  "S23_MEDIA_SRC_MINIMAL",
  "S24_MANIFEST_AND_UPGRADE",
  "N01_NONCE_128_BITS",
  "N02_NONCE_CSP_SAFE_ENCODING",
  "N03_NONCE_REQUEST_UNIQUENESS",
  "N04_SPOOFED_NONCE_IGNORED",
  "N05_INTERNAL_NONCE_FORWARDING",
  "N06_CSP_NONCE_MATCH",
  "N07_LAYOUT_THEME_NONCE",
  "N08_FRAMEWORK_NONCE_WIRING",
  "N09_RESPONSE_NONCE_NOT_EXPOSED",
  "N10_REDIRECT_CSP_PRESERVED",
  "R01_ROOT_DOCUMENT_CLASSIFIED",
  "R02_RESULT_DOCUMENT_CLASSIFIED",
  "R03_FULL_REPORT_DOCUMENT_CLASSIFIED",
  "R04_SHARED_DOCUMENT_CLASSIFIED",
  "R05_MY_DOCUMENT_CLASSIFIED",
  "R06_HTML_404_DOCUMENT_CLASSIFIED",
  "R07_REDIRECT_SECURITY_HEADERS",
  "R08_API_COMMON_HEADERS",
  "R09_STATIC_COMMON_HEADERS",
  "R10_API_STATIC_DOCUMENT_CSP_EXCLUDED",
  "G01_SUPABASE_COOKIE_RESPONSE_PRESERVED",
  "G02_THEME_INITIALIZATION_PRESERVED",
  "G03_DATA_BLOB_PREVIEW_PRESERVED",
  "G04_APPROVED_PRODUCT_IMAGE_PRESERVED",
  "G05_REJECTED_IMAGE_ORIGIN_ABSENT",
  "G06_RUNTIME_CSP_CONSOLE_GATE"
]);

const root = process.cwd();
const require = createRequire(import.meta.url);
const policy = require(resolve(root, "lib/security/security-headers.js"));
const imagePolicy = await import(
  pathToFileURL(resolve(root, "lib/security/image-source-policy.js")).href
);
const SUPABASE_URL = "https://project-ref.supabase.co";
const REQUEST_URL = "https://app.example.test/";
const FIXED_NONCE = policy.createCspNonce((bytes) => {
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = index;
  }
});
const PRODUCTION_CSP = policy.buildContentSecurityPolicy({
  nonce: FIXED_NONCE,
  supabaseUrl: SUPABASE_URL,
  requestUrl: REQUEST_URL
});
const DEVELOPMENT_CSP = policy.buildContentSecurityPolicy({
  nonce: FIXED_NONCE,
  supabaseUrl: SUPABASE_URL,
  isDevelopment: true,
  requestUrl: "http://127.0.0.1:3001/"
});
const GLOBAL_HEADERS = new Map(
  policy.GLOBAL_SECURITY_HEADERS.map(({ key, value }) => [key.toLowerCase(), value])
);

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

function parseCsp(value) {
  const directives = new Map();

  for (const segment of value.split(";")) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);

    if (!tokens.length) {
      continue;
    }

    const [name, ...sources] = tokens;
    assert(!directives.has(name), `duplicate directive: ${name}`);
    assert(new Set(sources).size === sources.length, `duplicate source: ${name}`);
    directives.set(name, sources);
  }

  return directives;
}

function sources(name, csp = PRODUCTION_CSP) {
  return parseCsp(csp).get(name) || [];
}

function documentRequest(pathname, extraHeaders = {}, method = "GET") {
  return {
    method,
    url: `https://app.example.test${pathname}`,
    nextUrl: { pathname },
    headers: new Headers({
      accept: "text/html",
      "sec-fetch-dest": "document",
      ...extraHeaders
    })
  };
}

function createSyntheticResponse(status = 200) {
  return {
    status,
    headers: new Headers()
  };
}

function createFixedContext(incomingNonce = "AAAAAAAAAAAAAAAAAAAAAA==") {
  return policy.createDocumentSecurityContext({
    requestHeaders: new Headers({ "x-nonce": incomingNonce }),
    supabaseUrl: SUPABASE_URL,
    requestUrl: REQUEST_URL,
    randomFill(bytes) {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = index + 1;
      }
    }
  });
}

const catalog = Object.freeze([
  { id: "C01_GLOBAL_HEADER_SOURCE_COVERAGE", run() {
    const config = require(resolve(root, "next.config.js"))("phase-production-build");
    return config.headers().then((entries) => {
      assert(entries.length === 1 && entries[0].source === "/:path*", "global header source must cover every path");
      assert(entries[0].headers === policy.GLOBAL_SECURITY_HEADERS, "next config must use the shared header registry");
    });
  } },
  { id: "C02_NOSNIFF", run() { assert(GLOBAL_HEADERS.get("x-content-type-options") === "nosniff", "nosniff missing"); } },
  { id: "C03_FRAME_DENY", run() { assert(GLOBAL_HEADERS.get("x-frame-options") === "DENY", "X-Frame-Options must be DENY"); } },
  { id: "C04_REFERRER_NO_REFERRER", run() { assert(GLOBAL_HEADERS.get("referrer-policy") === "no-referrer", "referrer policy mismatch"); } },
  { id: "C05_CAMERA_SELF", run() { assert(policy.PERMISSIONS_POLICY.includes("camera=(self)"), "camera self permission missing"); } },
  { id: "C06_CLIPBOARD_WRITE_SELF", run() { assert(policy.PERMISSIONS_POLICY.includes("clipboard-write=(self)"), "clipboard-write self permission missing"); } },
  { id: "C07_UNUSED_PERMISSIONS_BLOCKED", run() {
    ["microphone", "geolocation", "payment", "usb", "serial", "bluetooth", "clipboard-read", "fullscreen", "picture-in-picture"].forEach((name) => {
      assert(policy.PERMISSIONS_POLICY.includes(`${name}=()`), `${name} must be disabled`);
    });
  } },
  { id: "C08_COOP_SAME_ORIGIN", run() { assert(GLOBAL_HEADERS.get("cross-origin-opener-policy") === "same-origin", "COOP mismatch"); } },
  { id: "C09_ORIGIN_AGENT_CLUSTER", run() { assert(GLOBAL_HEADERS.get("origin-agent-cluster") === "?1", "Origin-Agent-Cluster missing"); } },
  { id: "C10_SCOPE_NOT_EXPANDED", run() {
    assert(!GLOBAL_HEADERS.has("cross-origin-embedder-policy"), "COEP must remain excluded");
    assert(!GLOBAL_HEADERS.has("cross-origin-resource-policy"), "global CORP must remain excluded");
    assert(!GLOBAL_HEADERS.has("strict-transport-security"), "application HSTS must remain deferred");
    assert(!GLOBAL_HEADERS.has("access-control-allow-origin"), "CORS must not be widened");
  } },
  { id: "S01_DEFAULT_SRC_SELF", run() { assert(JSON.stringify(sources("default-src")) === JSON.stringify(["'self'"]), "default-src mismatch"); } },
  { id: "S02_BASE_URI_SELF", run() { assert(JSON.stringify(sources("base-uri")) === JSON.stringify(["'self'"]), "base-uri mismatch"); } },
  { id: "S03_OBJECT_SRC_NONE", run() { assert(JSON.stringify(sources("object-src")) === JSON.stringify(["'none'"]), "object-src mismatch"); } },
  { id: "S04_FRAME_ANCESTORS_NONE", run() { assert(JSON.stringify(sources("frame-ancestors")) === JSON.stringify(["'none'"]), "frame-ancestors mismatch"); } },
  { id: "S05_FORM_ACTION_SELF", run() { assert(JSON.stringify(sources("form-action")) === JSON.stringify(["'self'"]), "form-action mismatch"); } },
  { id: "S06_SCRIPT_NONCE", run() { assert(sources("script-src").includes(`'nonce-${FIXED_NONCE}'`), "script nonce missing"); } },
  { id: "S07_STRICT_DYNAMIC", run() { assert(sources("script-src").includes("'strict-dynamic'"), "strict-dynamic missing"); } },
  { id: "S08_PRODUCTION_NO_SCRIPT_UNSAFE_INLINE", run() { assert(!sources("script-src").includes("'unsafe-inline'"), "production script unsafe-inline present"); } },
  { id: "S09_PRODUCTION_NO_UNSAFE_EVAL", run() { assert(!sources("script-src").includes("'unsafe-eval'"), "production unsafe-eval present"); } },
  { id: "S10_DEVELOPMENT_UNSAFE_EVAL_ISOLATED", run() {
    assert(sources("script-src", DEVELOPMENT_CSP).includes("'unsafe-eval'"), "development unsafe-eval missing");
    assert(!sources("script-src").includes("'unsafe-eval'"), "development exception leaked to production");
    assert(sources("connect-src", DEVELOPMENT_CSP).includes("ws://127.0.0.1:3001"), "exact development HMR websocket missing");
  } },
  { id: "S11_SCRIPT_SRC_ATTR_NONE", run() { assert(JSON.stringify(sources("script-src-attr")) === JSON.stringify(["'none'"]), "script-src-attr mismatch"); } },
  { id: "S12_STYLE_SRC_SELF", run() { assert(sources("style-src").includes("'self'"), "style-src self missing"); } },
  { id: "S13_STYLE_UNSAFE_INLINE_SCOPED", run() {
    assert(sources("style-src").includes("'unsafe-inline'"), "style compatibility exception missing");
    assert(!sources("script-src").includes("'unsafe-inline'"), "style exception leaked into script policy");
  } },
  { id: "S14_EXACT_IMG_SRC", run() {
    assert(JSON.stringify(sources("img-src")) === JSON.stringify(["'self'", "data:", "blob:", "https://img.hwahae.co.kr"]), "img-src mismatch");
    assert(imagePolicy.PRODUCT_IMAGE_CSP_DIRECTIVE === `img-src ${sources("img-src").join(" ")};`, "image registry and CSP diverged");
  } },
  { id: "S15_NO_BROAD_HTTPS", run() { assert(!PRODUCTION_CSP.split(/\s+/).includes("https:"), "broad https source present"); } },
  { id: "S16_NO_WILDCARD", run() { assert(!PRODUCTION_CSP.includes("*"), "wildcard CSP source present"); } },
  { id: "S17_FONT_SRC_SELF", run() { assert(JSON.stringify(sources("font-src")) === JSON.stringify(["'self'"]), "font-src mismatch"); } },
  { id: "S18_CONNECT_SRC_SELF", run() { assert(sources("connect-src")[0] === "'self'", "connect-src self missing"); } },
  { id: "S19_EXACT_SUPABASE_ORIGIN", run() {
    assert(policy.parseSupabaseConnectOrigin(`${SUPABASE_URL}/rest/v1`) === SUPABASE_URL, "Supabase origin parser failed");
    assert(JSON.stringify(sources("connect-src")) === JSON.stringify(["'self'", SUPABASE_URL]), "connect-src exact origin mismatch");
    ["http://project-ref.supabase.co", "https://user@project-ref.supabase.co", "https://127.0.0.1", "https://project-ref.supabase.co?x=1"].forEach((value) => assert(policy.parseSupabaseConnectOrigin(value) === null, `unsafe Supabase origin accepted: ${value}`));
  } },
  { id: "S20_NO_UNUSED_REALTIME_ORIGIN", run() { assert(!sources("connect-src").some((value) => value.startsWith("wss:")), "unused production realtime origin present"); } },
  { id: "S21_FRAME_SRC_NONE", run() { assert(JSON.stringify(sources("frame-src")) === JSON.stringify(["'none'"]), "frame-src mismatch"); } },
  { id: "S22_WORKER_SRC_MINIMAL", run() { assert(JSON.stringify(sources("worker-src")) === JSON.stringify(["'none'"]), "worker-src mismatch"); } },
  { id: "S23_MEDIA_SRC_MINIMAL", run() { assert(JSON.stringify(sources("media-src")) === JSON.stringify(["'self'", "blob:"]), "media-src mismatch"); } },
  { id: "S24_MANIFEST_AND_UPGRADE", run() {
    const directives = parseCsp(PRODUCTION_CSP);
    assert(JSON.stringify(directives.get("manifest-src")) === JSON.stringify(["'self'"]), "manifest-src mismatch");
    assert(directives.has("upgrade-insecure-requests"), "production upgrade-insecure-requests missing");
    assert(!parseCsp(DEVELOPMENT_CSP).has("upgrade-insecure-requests"), "upgrade-insecure-requests must not affect local development");
  } },
  { id: "N01_NONCE_128_BITS", run() {
    let byteLength = 0;
    policy.createCspNonce((bytes) => { byteLength = bytes.length; bytes.fill(1); });
    assert(byteLength === 16 && policy.NONCE_BYTE_LENGTH === 16, "nonce must use 128 bits");
  } },
  { id: "N02_NONCE_CSP_SAFE_ENCODING", run() { assert(policy.isValidCspNonce(FIXED_NONCE) && !/[<>&\r\n]/.test(FIXED_NONCE), "nonce encoding is not CSP-safe"); } },
  { id: "N03_NONCE_REQUEST_UNIQUENESS", run() {
    const values = new Set(Array.from({ length: 32 }, () => policy.createCspNonce()));
    assert(values.size === 32, "request nonces were reused");
  } },
  { id: "N04_SPOOFED_NONCE_IGNORED", run() {
    const spoofed = "AAAAAAAAAAAAAAAAAAAAAA==";
    const context = createFixedContext(spoofed);
    assert(context.nonce !== spoofed && context.requestHeaders.get("x-nonce") === context.nonce, "incoming nonce was trusted");
  } },
  { id: "N05_INTERNAL_NONCE_FORWARDING", run() {
    const context = createFixedContext();
    assert(context.requestHeaders.get("x-nonce") === context.nonce, "internal nonce header missing");
    assert(context.requestHeaders.get("content-security-policy") === context.contentSecurityPolicy, "request CSP header missing");
  } },
  { id: "N06_CSP_NONCE_MATCH", run() {
    const context = createFixedContext();
    assert(sources("script-src", context.contentSecurityPolicy).includes(`'nonce-${context.nonce}'`), "CSP nonce and request nonce differ");
  } },
  { id: "N07_LAYOUT_THEME_NONCE", run() {
    const layout = read("app/layout.js");
    assert(layout.includes("const requestHeaders = await headers()"), "layout does not use async request headers");
    assert(
      /<script\s+nonce=\{nonce\}\s+dangerouslySetInnerHTML=\{\{ __html: themeInitScript \}\}\s*\/>/.test(layout) &&
        layout.includes("isValidCspNonce(requestNonce)"),
      "theme script nonce wiring missing"
    );
  } },
  { id: "N08_FRAMEWORK_NONCE_WIRING", run() {
    const middleware = read("middleware.js");
    assert(middleware.includes("createDocumentSecurityContext({") && middleware.includes("requestHeaders: securityContext.requestHeaders"), "framework request nonce wiring missing");
  } },
  { id: "N09_RESPONSE_NONCE_NOT_EXPOSED", run() {
    const response = createSyntheticResponse();
    response.headers.set("x-nonce", "attacker-value");
    policy.applyDocumentSecurityHeaders(response, PRODUCTION_CSP);
    assert(!response.headers.has("x-nonce") && response.headers.get("content-security-policy") === PRODUCTION_CSP, "response exposed x-nonce");
  } },
  { id: "N10_REDIRECT_CSP_PRESERVED", run() {
    const response = createSyntheticResponse(307);
    response.headers.set("location", "https://canonical.example/path");
    policy.applyDocumentSecurityHeaders(response, PRODUCTION_CSP);
    assert(response.status === 307 && response.headers.get("location") === "https://canonical.example/path" && response.headers.get("content-security-policy") === PRODUCTION_CSP, "redirect contract changed");
  } },
  { id: "R01_ROOT_DOCUMENT_CLASSIFIED", run() { assert(policy.isDocumentRequest(documentRequest("/")), "root document excluded"); } },
  { id: "R02_RESULT_DOCUMENT_CLASSIFIED", run() { assert(policy.isDocumentRequest(documentRequest("/result")), "result document excluded"); } },
  { id: "R03_FULL_REPORT_DOCUMENT_CLASSIFIED", run() { assert(policy.isDocumentRequest(documentRequest("/result/full-report")), "full-report document excluded"); } },
  { id: "R04_SHARED_DOCUMENT_CLASSIFIED", run() { assert(policy.isDocumentRequest(documentRequest("/r/AgICAgICAgICAgICAgICAg")), "shared result document excluded"); } },
  { id: "R05_MY_DOCUMENT_CLASSIFIED", run() { assert(policy.isDocumentRequest(documentRequest("/my")), "My document excluded"); } },
  { id: "R06_HTML_404_DOCUMENT_CLASSIFIED", run() { assert(policy.isDocumentRequest(documentRequest("/definitely-missing")), "HTML 404 request excluded"); } },
  { id: "R07_REDIRECT_SECURITY_HEADERS", run() {
    const middleware = read("middleware.js");
    assert(
      /if \(canonicalUrl\) \{\s*return applyDocumentSecurityHeaders\(\s*NextResponse\.redirect\(canonicalUrl, 307\),\s*securityContext\.contentSecurityPolicy\s*\);\s*\}/.test(middleware),
      "canonical redirect CSP wiring missing"
    );
  } },
  { id: "R08_API_COMMON_HEADERS", run() { assert(GLOBAL_HEADERS.get("x-content-type-options") === "nosniff" && GLOBAL_HEADERS.get("permissions-policy") === policy.PERMISSIONS_POLICY, "API common headers missing"); } },
  { id: "R09_STATIC_COMMON_HEADERS", run() { assert(GLOBAL_HEADERS.get("referrer-policy") === "no-referrer" && GLOBAL_HEADERS.get("cross-origin-opener-policy") === "same-origin", "static common headers missing"); } },
  { id: "R10_API_STATIC_DOCUMENT_CSP_EXCLUDED", run() {
    assert(!policy.isDocumentRequest(documentRequest("/api/analyze")), "API classified as document");
    assert(!policy.isDocumentRequest(documentRequest("/_next/static/chunk.js")), "Next static classified as document");
    assert(!policy.isDocumentRequest(documentRequest("/icon.png")), "public asset classified as document");
    assert(!policy.isDocumentRequest(documentRequest("/result", { rsc: "1" })), "RSC request classified as document");
    assert(!policy.isDocumentRequest(documentRequest("/result", { "next-router-prefetch": "1" })), "prefetch classified as document");
  } },
  { id: "G01_SUPABASE_COOKIE_RESPONSE_PRESERVED", run() {
    const source = read("lib/supabase/middleware.js");
    const mergedHeaders = policy.mergeForwardedRequestHeaders(
      new Headers({ cookie: "session=refreshed" }),
      new Headers({ cookie: "session=stale", "x-nonce": FIXED_NONCE, "content-security-policy": PRODUCTION_CSP })
    );
    assert(mergedHeaders.get("cookie") === "session=refreshed", "refreshed request cookie was not preserved");
    assert(mergedHeaders.get("x-nonce") === FIXED_NONCE && mergedHeaders.get("content-security-policy") === PRODUCTION_CSP, "nonce/CSP request headers were not preserved");
    assert(source.includes("mergeForwardedRequestHeaders(") && source.includes("response.cookies.set(name, value, options)"), "Supabase cookie preservation wiring missing");
    assert(source.includes("createPassThroughResponse()"), "pass-through response factory missing");
  } },
  { id: "G02_THEME_INITIALIZATION_PRESERVED", run() {
    const layout = read("app/layout.js");
    assert(layout.includes('const storageKey = "bejewely-theme"') && layout.includes("root.dataset.theme = theme") && layout.includes("dangerouslySetInnerHTML={{ __html: themeInitScript }}"), "theme initialization changed");
  } },
  { id: "G03_DATA_BLOB_PREVIEW_PRESERVED", run() {
    assert(sources("img-src").includes("data:") && sources("img-src").includes("blob:"), "image preview CSP sources missing");
    assert(read("app/page.js").includes("URL.createObjectURL(file)"), "blob preview path missing");
  } },
  { id: "G04_APPROVED_PRODUCT_IMAGE_PRESERVED", run() {
    const validUrl = "https://img.hwahae.co.kr/products/12345/12345_20260715123456.jpg";
    assert(imagePolicy.resolveSafeProductImage(validUrl) === validUrl, "approved image resolver regressed");
    assert(sources("img-src").includes(policy.PRODUCT_IMAGE_ORIGIN), "approved image origin absent from CSP");
  } },
  { id: "G05_REJECTED_IMAGE_ORIGIN_ABSENT", run() {
    ["https://manyo.us/image.png", "https://d1flfk77wl2xk4.cloudfront.net/image.png", "https://lh3.googleusercontent.com/avatar"].forEach((value) => {
      assert(!PRODUCTION_CSP.includes(new URL(value).origin), `rejected image origin present: ${value}`);
    });
  } },
  { id: "G06_RUNTIME_CSP_CONSOLE_GATE", run() {
    const testSource = read("tests/e2e/visuali-mvp.spec.ts");
    assert(testSource.includes("@sec10-security-headers") && testSource.includes("securitypolicyviolation") && testSource.includes("hydrationErrors"), "runtime CSP console gate missing");
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
    console.log(`SEC10_HEADER_CASE_RESULT=${JSON.stringify({ id: item.id, result: "PASS" })}`);
  } catch (error) {
    failed = true;
    observed.set(item.id, "FAIL");
    console.error(`SEC10_HEADER_CASE_RESULT=${JSON.stringify({ id: item.id, result: "FAIL", error: error?.message || "case_failed" })}`);
  }
}

assert(observed.size === EXPECTED_REQUIRED_CASE_COUNT, "observed case count mismatch");
assertExactSet([...observed.keys()], REQUIRED_CASE_IDS, "observed");
assert([...observed.values()].every((value) => value === "PASS") && !failed, "one or more SEC-10 header cases failed");

console.log(`SEC10_SECURITY_HEADER_CASES=${observed.size}/${EXPECTED_REQUIRED_CASE_COUNT}`);
console.log("SEC10_SECURITY_HEADERS=PASS");
