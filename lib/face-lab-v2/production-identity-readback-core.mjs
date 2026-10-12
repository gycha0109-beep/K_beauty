/**
 * Face Lab P1-D2C14: server URL vs observed public bundle project reference.
 * No env reads, DB clients, network, secrets or SQL in this pure module.
 *
 * Pinned from an observed Vercel Production client JS asset (2026-10-12):
 * /_next/static/chunks/app/layout-f73c106fbe06d15d.js
 * /_next/static/chunks/7116-fef9e136407b8f85.js
 * These observations do not prove server environment or migration readiness.
 */
export const FACE_LAB_PUBLIC_BUNDLE_SUPABASE_REF = "bygrczggxfuisupcevaz";
export const FACE_LAB_PRODUCTION_IDENTITY_READBACK_VERSION =
  "face-lab-production-identity-readback-v1";

function projectRefFromUrl(value) {
  if (typeof value !== "string" || value.length > 300) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password ||
        url.port || url.search || url.hash ||
        (url.pathname !== "/" && url.pathname !== "")) return null;
    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** This evaluator never asserts that either deployment or DB is production. */
export async function inspectFaceLabProductionIdentity({
  environment,
  configuredSupabaseUrl,
  probeReadOnly
} = {}) {
  const evidence = {
    version: FACE_LAB_PRODUCTION_IDENTITY_READBACK_VERSION,
    status: "HOLD",
    source: "pinned_public_production_client_bundle",
    expectedRefVersion: "2026-10-12",
    serverProjectMatch: null,
    dbHeadReadback: "skipped",
    probeExecuted: false,
    productionProjectIdentityVerified: false,
    migrationHistoryVerified: false,
    runtimeAuthorizationVerified: false,
    productionReady: false
  };

  if (environment !== "production")
    return {...evidence,reason: "not_production_runtime"};

  const ref = projectRefFromUrl(configuredSupabaseUrl);
  if (!ref)
    return {...evidence,reason: "server_url_missing_or_invalid"};

  if (ref !== FACE_LAB_PUBLIC_BUNDLE_SUPABASE_REF)
    return {...evidence,serverProjectMatch:false,reason:"project_ref_mismatch"};

  if (typeof probeReadOnly !== "function")
    return {...evidence,serverProjectMatch:true,reason:"readback_not_available"};

  let result;
  try {result = await probeReadOnly();}
  catch {return {
    ...evidence,serverProjectMatch:true,probeExecuted:true,
    dbHeadReadback:"failed",reason:"readback_failed"
  };}
  const ok = result && result.error == null &&
    Number.isInteger(result.status) &&
    result.status >= 200 && result.status < 300;
  return {
    ...evidence,serverProjectMatch:true,probeExecuted:true,
    dbHeadReadback:ok?"ok":"failed",
    reason:ok?"observed_connection_match_still_hold":"readback_failed"
  };
}
