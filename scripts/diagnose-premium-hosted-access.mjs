import { chromium } from "playwright";
import {
  LOCAL_CONFIG_PATH,
  LOCAL_PROFILE_A_PATH,
  LOCAL_STORAGE_A_PATH,
  assertGitWorktreeClean,
  ensureLocalRuntime,
  parseCliArgs,
  readJsonIfPresent,
  resolvePreviewConfiguration
} from "./premium-browser-journey-local-auth.mjs";
import { captureAccountSessionResilient } from "./premium-e2e-session-capture.mjs";

function safeAccess(body, status) {
  return {
    status,
    canCreatePremium: body?.canCreatePremium === true,
    reason: typeof body?.reason === "string" ? body.reason : null,
    releaseMode: typeof body?.releaseMode === "string" ? body.releaseMode : null,
    entitlement: typeof body?.entitlement === "string" ? body.entitlement : null,
    configurationInvalid: body?.configurationInvalid === true
  };
}

async function readAccess(context, baseUrl, headers = {}) {
  const response = await context.request.get(`${baseUrl.origin}/api/premium/access`, {
    headers
  });
  const body = await response.json().catch(() => null);
  return safeAccess(body, response.status());
}

const args = parseCliArgs();
await ensureLocalRuntime();
assertGitWorktreeClean();
const storedConfig = await readJsonIfPresent(LOCAL_CONFIG_PATH);
const { baseUrl } = resolvePreviewConfiguration({ args, storedConfig });
const previewBypassToken = String(
  args["preview-bypass-token"] || process.env.PREMIUM_E2E_PREVIEW_BYPASS_TOKEN || ""
).trim();
const extraHTTPHeaders = previewBypassToken
  ? {
      "x-vercel-protection-bypass": previewBypassToken,
      "x-vercel-set-bypass-cookie": "true"
    }
  : {};

const account = await captureAccountSessionResilient({
  label: "A",
  profilePath: LOCAL_PROFILE_A_PATH,
  storageStatePath: LOCAL_STORAGE_A_PATH,
  baseUrl,
  previewBypassToken
});

const browser = await chromium.launch({ headless: true });
try {
  const cookieOnlyContext = await browser.newContext({
    storageState: LOCAL_STORAGE_A_PATH,
    extraHTTPHeaders
  });
  const bearerOnlyContext = await browser.newContext({ extraHTTPHeaders });
  const mixedContext = await browser.newContext({
    storageState: LOCAL_STORAGE_A_PATH,
    extraHTTPHeaders
  });

  try {
    const [cookieOnly, bearerOnly, cookieAndBearer] = await Promise.all([
      readAccess(cookieOnlyContext, baseUrl),
      readAccess(bearerOnlyContext, baseUrl, {
        ...extraHTTPHeaders,
        Authorization: `Bearer ${account.accessToken}`
      }),
      readAccess(mixedContext, baseUrl, {
        ...extraHTTPHeaders,
        Authorization: `Bearer ${account.accessToken}`
      })
    ]);

    const result = {
      ok: cookieAndBearer.canCreatePremium,
      targetHost: baseUrl.hostname,
      accountHash: account.userHash,
      directSupabaseUserValidated: true,
      accessMatrix: {
        cookieOnly,
        bearerOnly,
        cookieAndBearer
      }
    };

    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } finally {
    await Promise.all([
      cookieOnlyContext.close(),
      bearerOnlyContext.close(),
      mixedContext.close()
    ]);
  }
} finally {
  await browser.close();
}
