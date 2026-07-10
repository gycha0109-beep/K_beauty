function isLoopbackUrl(value) {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function resolveLocalShadowProviderStub({ env = process.env } = {}) {
  const target = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
  const enabled =
    env.NODE_ENV === "development" &&
    env.LOCAL_SHADOW_PROVIDER_STUB === "1" &&
    env.SHADOW_ROUTE_NON_PRODUCTION_TARGET === "1" &&
    env.SHADOW_TEST_DB_DISPOSABLE === "1" &&
    isLoopbackUrl(target);

  return {
    enabled,
    mode: enabled ? "deterministic_existing_fallback_contract" : null,
    reasonCode: enabled ? "local_shadow_provider_stub_enabled" : "local_shadow_provider_stub_disabled",
    externalProviderInvocationAllowed: !enabled
  };
}
