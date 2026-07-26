import { chromium } from "playwright";
import {
  FAILURE_CATEGORIES,
  PREMIUM_COOKIE_NAME,
  loadImageFixture,
  requireCondition
} from "./premium-browser-journey-core.mjs";
import {
  LOCAL_CONFIG_PATH,
  LOCAL_PROFILE_A_PATH,
  LOCAL_STORAGE_A_PATH,
  LOCAL_SYNTHETIC_IMAGE_PATH,
  assertGitWorktreeClean,
  ensureLocalRuntime,
  parseCliArgs,
  readJsonIfPresent,
  resolvePreviewConfiguration,
  writeSyntheticImageFixture
} from "./premium-browser-journey-local-auth.mjs";
import { captureAccountSessionResilient } from "./premium-e2e-session-capture.mjs";

function getPreviewHeaders(previewBypassToken) {
  return previewBypassToken
    ? {
        "x-vercel-protection-bypass": previewBypassToken,
        "x-vercel-set-bypass-cookie": "true"
      }
    : {};
}

function parseSetCookieContract(headerValue) {
  const segments = String(headerValue || "")
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
  const pair = segments.shift() || "";
  const separator = pair.indexOf("=");
  const name = separator > 0 ? pair.slice(0, separator).trim() : "";
  const attributes = new Map();
  for (const segment of segments) {
    const index = segment.indexOf("=");
    const key = (index >= 0 ? segment.slice(0, index) : segment).trim().toLowerCase();
    const value = index >= 0 ? segment.slice(index + 1).trim() : true;
    attributes.set(key, value);
  }
  return {
    name,
    httpOnly: attributes.has("httponly"),
    secure: attributes.has("secure"),
    sameSite: String(attributes.get("samesite") || "").toLowerCase() || null,
    path: typeof attributes.get("path") === "string" ? attributes.get("path") : null,
    maxAgePresent: attributes.has("max-age"),
    expiresPresent: attributes.has("expires")
  };
}

function safeCookieContract(cookie) {
  return {
    name: cookie.name,
    domain: cookie.domain,
    path: cookie.path,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    persistent: Number(cookie.expires) > 0
  };
}

function diagnoseBoundary({ status, headerContracts, jarContracts }) {
  if (status !== 200) return "analyze_http_failure";
  if (headerContracts.length === 0) return "server_did_not_emit_premium_cookie";
  if (headerContracts.length > 1) return "duplicate_premium_set_cookie_headers";
  if (jarContracts.length === 0) return "premium_set_cookie_not_stored";
  if (jarContracts.length > 1) return "duplicate_premium_cookie_jar_entries";

  const header = headerContracts[0];
  const jar = jarContracts[0];
  const headerValid =
    header.httpOnly === true &&
    header.secure === true &&
    header.sameSite === "lax" &&
    header.path === "/api/full-report" &&
    header.maxAgePresent === true;
  const jarValid =
    jar.httpOnly === true &&
    jar.secure === true &&
    jar.sameSite === "Lax" &&
    jar.path === "/api/full-report";
  if (!headerValid || !jarValid) return "premium_cookie_contract_invalid";
  return "premium_cookie_boundary_ok";
}

const args = parseCliArgs();
await ensureLocalRuntime();
assertGitWorktreeClean();
const storedConfig = await readJsonIfPresent(LOCAL_CONFIG_PATH);
const { baseUrl } = resolvePreviewConfiguration({ args, storedConfig });
const previewBypassToken = String(
  args["preview-bypass-token"] || process.env.PREMIUM_E2E_PREVIEW_BYPASS_TOKEN || ""
).trim();
const extraHTTPHeaders = getPreviewHeaders(previewBypassToken);

await writeSyntheticImageFixture();
const imageFixture = await loadImageFixture(LOCAL_SYNTHETIC_IMAGE_PATH);
const account = await captureAccountSessionResilient({
  label: "A",
  profilePath: LOCAL_PROFILE_A_PATH,
  storageStatePath: LOCAL_STORAGE_A_PATH,
  baseUrl,
  previewBypassToken
});

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    storageState: LOCAL_STORAGE_A_PATH,
    extraHTTPHeaders
  });
  try {
    await context.clearCookies({ name: PREMIUM_COOKIE_NAME });
    const navigation = await context.request.get(baseUrl.origin, { headers: extraHTTPHeaders });
    requireCondition(
      navigation.status() < 400,
      FAILURE_CATEGORIES.INFRASTRUCTURE,
      "premium-session-cookie-diagnostic",
      "preview_navigation_failed"
    );

    const response = await context.request.post(`${baseUrl.origin}/api/analyze`, {
      headers: {
        ...extraHTTPHeaders,
        Authorization: `Bearer ${account.accessToken}`
      },
      multipart: {
        image: {
          name: imageFixture.name,
          mimeType: imageFixture.mimeType,
          buffer: imageFixture.buffer
        },
        skinType: "combination",
        sensitivityLevel: "medium",
        mainConcern: "dehydration",
        mainConcerns: JSON.stringify(["dehydration", "barrier"]),
        cleansingFrequency: "twice_daily",
        texturePreference: "gel",
        postCleanseFeel: "tight",
        afternoonState: "more_oily",
        dislikedFeel: "heavy",
        environmentExposure: JSON.stringify(["outdoor"]),
        currentProducts: JSON.stringify([]),
        locale: "ko"
      }
    });

    const body = await response.json().catch(() => null);
    const premiumHeaderContracts = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => parseSetCookieContract(header.value))
      .filter((contract) => contract.name === PREMIUM_COOKIE_NAME);
    const premiumJarContracts = (await context.cookies())
      .filter((cookie) => cookie.name === PREMIUM_COOKIE_NAME)
      .map(safeCookieContract);
    const diagnosis = diagnoseBoundary({
      status: response.status(),
      headerContracts: premiumHeaderContracts,
      jarContracts: premiumJarContracts
    });
    const result = {
      ok: diagnosis === "premium_cookie_boundary_ok",
      targetHost: baseUrl.hostname,
      accountHash: account.userHash,
      analyze: {
        status: response.status(),
        error: typeof body?.error === "string" ? body.error : null,
        responseSchemaVersion: Number.isFinite(body?.meta?.schemaVersion)
          ? body.meta.schemaVersion
          : null,
        premiumReportExposed: Object.prototype.hasOwnProperty.call(body || {}, "premiumReport")
      },
      setCookie: {
        premiumHeaderCount: premiumHeaderContracts.length,
        contracts: premiumHeaderContracts
      },
      cookieJar: {
        premiumCookieCount: premiumJarContracts.length,
        contracts: premiumJarContracts
      },
      diagnosis
    };
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
