import "server-only";

import {
  getCanonicalProductionOrigin,
  getNormalizedConfiguredProductionOrigin
} from "@/lib/canonical-site-origin";
import {
  evaluateSignOutRequest,
  getSignOutRuntimeOriginContract
} from "@/lib/security/signout-request-policy";

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

  return decision.allowed === true;
}
