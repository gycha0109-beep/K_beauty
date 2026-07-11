import "server-only";

import { createRouteSupabaseAuthClient } from "@/lib/supabase/server-client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const RELEASE_MODES = new Set(["coming_soon", "beta_open", "paid_only"]);
const PAID_ENTITLEMENTS = new Set(["paid", "admin_override"]);
const CLOSED_RELEASE_MODE = "coming_soon";
let didLogInvalidReleaseMode = false;

export function resolvePremiumReleaseMode(raw) {
  const releaseMode = typeof raw === "string" ? raw.trim() : "";
  const configurationInvalid = !RELEASE_MODES.has(releaseMode);

  return {
    releaseMode: configurationInvalid ? CLOSED_RELEASE_MODE : releaseMode,
    configurationInvalid
  };
}

function getPremiumReleaseModeConfig() {
  const config = resolvePremiumReleaseMode(process.env.PREMIUM_RELEASE_MODE);

  if (config.configurationInvalid && !didLogInvalidReleaseMode) {
    didLogInvalidReleaseMode = true;
    console.warn("[premium-access] premium_release_mode_invalid");
  }

  return config;
}

export function getPremiumReleaseMode() {
  return getPremiumReleaseModeConfig().releaseMode;
}

export function isAccountUser(user) {
  return Boolean(user) && !user.is_anonymous && user.app_metadata?.provider !== "anonymous";
}

function getStringSet(value) {
  if (Array.isArray(value)) {
    return new Set(value.map((item) => String(item || "").trim()).filter(Boolean));
  }

  const text = String(value || "").trim();
  return text ? new Set([text]) : new Set();
}

export function resolvePremiumEntitlement(user) {
  if (!isAccountUser(user)) {
    return "none";
  }

  const appMetadata = user.app_metadata || {};
  const roles = new Set([
    ...getStringSet(appMetadata.role),
    ...getStringSet(appMetadata.roles)
  ]);
  const entitlement =
    String(appMetadata.premium_entitlement || appMetadata.premiumEntitlement || "").trim();

  if (
    entitlement === "admin_override" ||
    roles.has("admin") ||
    roles.has("owner") ||
    appMetadata.admin === true ||
    appMetadata.is_admin === true
  ) {
    return "admin_override";
  }

  if (entitlement === "paid" || appMetadata.premium_paid === true || appMetadata.is_paid === true) {
    return "paid";
  }

  return "none";
}

export function resolvePremiumAccessForUser(user, options = {}) {
  const releaseConfig = Object.hasOwn(options, "releaseMode")
    ? resolvePremiumReleaseMode(options.releaseMode)
    : getPremiumReleaseModeConfig();
  const { releaseMode, configurationInvalid } = releaseConfig;
  const entitlement = resolvePremiumEntitlement(user);

  if (configurationInvalid || releaseMode === CLOSED_RELEASE_MODE) {
    return {
      canCreatePremium: false,
      reason: "premium_unavailable",
      releaseMode,
      entitlement,
      configurationInvalid
    };
  }

  if (!isAccountUser(user)) {
    return {
      canCreatePremium: false,
      reason: "login_required",
      releaseMode,
      entitlement: "none",
      configurationInvalid
    };
  }

  if (entitlement === "admin_override") {
    return {
      canCreatePremium: true,
      reason: "admin_override",
      releaseMode,
      entitlement,
      configurationInvalid
    };
  }

  if (releaseMode === "beta_open") {
    return {
      canCreatePremium: true,
      reason: "beta_open",
      releaseMode,
      entitlement,
      configurationInvalid
    };
  }

  if (PAID_ENTITLEMENTS.has(entitlement)) {
    return {
      canCreatePremium: true,
      reason: "paid",
      releaseMode,
      entitlement,
      configurationInvalid
    };
  }

  return {
    canCreatePremium: false,
    reason: "payment_required",
    releaseMode,
    entitlement,
    configurationInvalid
  };
}

export function canPreparePremiumReportSession(access) {
  return Boolean(
    access &&
      !access.configurationInvalid &&
      (access.releaseMode === "beta_open" || access.canCreatePremium)
  );
}

function getBearerToken(request) {
  const authorizationHeader = request.headers.get("authorization");

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token.trim() : null;
}

export async function getPremiumRequestUser(request) {
  const accessToken = getBearerToken(request);

  if (accessToken) {
    const routeSupabase = createRouteSupabaseAuthClient(accessToken);
    const {
      data: { user },
      error
    } = routeSupabase
      ? await routeSupabase.auth.getUser()
      : { data: { user: null }, error: null };

    if (!error && user) {
      return user;
    }
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  return error ? null : user || null;
}

export async function resolvePremiumAccessForRequest(request) {
  const user = await getPremiumRequestUser(request);

  return {
    user,
    access: resolvePremiumAccessForUser(user)
  };
}
