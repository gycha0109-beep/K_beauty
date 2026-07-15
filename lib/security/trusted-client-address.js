import "server-only";

import { resolveTrustedClientAddressCore } from "@/lib/security/public-result-read-guard-core";

export function isHostedVercelRuntime(env = process.env) {
  return env.VERCEL === "1" || env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview";
}

export function resolveTrustedClientAddress({ request, env = process.env, syntheticClientAddress = null } = {}) {
  return resolveTrustedClientAddressCore({ headers: request?.headers, env, syntheticClientAddress });
}
