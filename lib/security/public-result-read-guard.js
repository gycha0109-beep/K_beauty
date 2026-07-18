import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getAnalysisRequestGuardSecret,
  resolveAnalysisGuardPrincipal
} from "@/lib/security/analysis-request-guard";
import {
  createResultReadSubjectHash,
  executePublicResultReadGuardCore
} from "@/lib/security/public-result-read-guard-core";
import {
  isHostedVercelRuntime,
  resolveTrustedClientAddress
} from "@/lib/security/trusted-client-address";

const LOCAL_SYNTHETIC_CLIENT_ADDRESS = "127.0.0.1";

function denied(code, options = {}) {
  return {
    ok: false,
    code,
    retryAfterSeconds: options.retryAfterSeconds || null,
    cookiesToSet: options.cookiesToSet || []
  };
}

export async function guardPublicResultRead({ request, shareId, nowMs = Date.now(), dependencies = {} } = {}) {
  const env = dependencies.env || process.env;
  const secret = dependencies.secret || getAnalysisRequestGuardSecret();
  if (!secret) return denied("unavailable", { retryAfterSeconds: 60 });

  const syntheticClientAddress = Object.hasOwn(dependencies, "syntheticClientAddress")
    ? dependencies.syntheticClientAddress
    : isHostedVercelRuntime(env) || env.NODE_ENV === "production"
      ? null
      : LOCAL_SYNTHETIC_CLIENT_ADDRESS;
  const clientAddress = resolveTrustedClientAddress({ request, env, syntheticClientAddress });
  if (!clientAddress) return denied("unavailable", { retryAfterSeconds: 60 });

  let principal;
  try {
    principal = dependencies.resolvePrincipal
      ? await dependencies.resolvePrincipal(request, secret)
      : await resolveAnalysisGuardPrincipal(request, secret, { purposePrefix: "result-read" });
  } catch {
    return denied("unavailable", { retryAfterSeconds: 60 });
  }

  if (!principal || !["user", "anonymous"].includes(principal.scope) || !principal.subjectHash) {
    return denied("unavailable", { retryAfterSeconds: 60 });
  }

  const ipHash = createResultReadSubjectHash(secret, "ip", clientAddress);
  const supabase = dependencies.supabase || createSupabaseAdminClient();
  if (!supabase) return denied("unavailable", { retryAfterSeconds: 60, cookiesToSet: principal.cookiesToSet });

  const coreResult = await executePublicResultReadGuardCore({
    rawShareId: shareId,
    requestUrl: request?.url,
    principalScope: principal.scope,
    principalHash: principal.subjectHash,
    accountUserId: principal.accountUserId || null,
    ipHash,
    secret,
    nowMs,
    consume: dependencies.consume || ((ratePlan) => supabase.rpc("consume_analysis_rate_limits", { p_limits: ratePlan }))
  });
  if (!coreResult.ok) return denied(coreResult.code, { retryAfterSeconds: coreResult.retryAfterSeconds, cookiesToSet: principal.cookiesToSet });

  return {
    ok: true,
    shareId: coreResult.shareId,
    shareIdKind: coreResult.shareIdKind,
    viewerUserId: coreResult.viewerUserId,
    supabase,
    cookiesToSet: principal.cookiesToSet || []
  };
}
