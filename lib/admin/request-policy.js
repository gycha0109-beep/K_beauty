import "server-only";

import {
  getCanonicalProductionOrigin,
  getNormalizedConfiguredProductionOrigin
} from "@/lib/canonical-site-origin";
import {
  evaluateSignOutRequest,
  getSignOutRuntimeOriginContract
} from "@/lib/security/signout-request-policy";

const MAX_REFERER_LENGTH = 8192;

function hasAllowedReferer(request) {
  const referer = request?.headers?.get?.("referer");

  if (!referer) {
    return true;
  }

  if (
    referer.length > MAX_REFERER_LENGTH ||
    referer !== referer.trim() ||
    /[\u0000-\u001f\u007f]/.test(referer)
  ) {
    return false;
  }

  try {
    const source = new URL(referer);
    const target = new URL(request.url);

    return (
      !source.username &&
      !source.password &&
      source.origin === target.origin
    );
  } catch {
    return false;
  }
}

export function isAllowedAdminMutationRequest(request) {
  let runtimeContract;

  try {
    runtimeContract = getSignOutRuntimeOriginContract({
      vercelEnvironment: process.env.VERCEL_ENV,
      configuredProductionOrigin: getNormalizedConfiguredProductionOrigin(),
      canonicalProductionOrigin: getCanonicalProductionOrigin()
    });
  } catch {
    return false;
  }

  const decision = evaluateSignOutRequest({
    requestUrl: request?.url,
    requestHeaders: request?.headers,
    isHostedProduction: runtimeContract.isHostedProduction,
    canonicalProductionOrigin: runtimeContract.canonicalProductionOrigin
  });

  return decision.allowed === true && hasAllowedReferer(request);
}
