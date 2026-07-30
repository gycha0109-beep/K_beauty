import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { writeSafeLog } from "@/lib/security/error-redaction";
import {
  ADMIN_CAPABILITIES,
  adminRoleHasCapability,
  getAdminCapabilities,
  isKnownAdminCapability,
  normalizeAdminRole
} from "@/lib/admin/capabilities";

function createDeniedAccess(reason, overrides = {}) {
  return {
    authenticated: false,
    accountUser: false,
    isAdmin: false,
    allowed: false,
    role: null,
    capabilities: [],
    reason,
    ...overrides
  };
}

function isAccountUser(user) {
  return Boolean(user) && !user.is_anonymous && user.app_metadata?.provider !== "anonymous";
}

function logAdminAccessFailure(category) {
  writeSafeLog("warn", {
    event: "admin_access_lookup_failed",
    category,
    operation: "admin_access_lookup",
    dependency: category === "configuration_unavailable" ? "application" : "supabase",
    retryable: category !== "access_denied"
  });
}

export async function resolveCurrentAdminAccess() {
  let supabase;

  try {
    supabase = await createServerSupabaseClient();
  } catch {
    logAdminAccessFailure("configuration_unavailable");
    return createDeniedAccess("configuration_unavailable");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return createDeniedAccess("login_required");
  }

  if (!isAccountUser(user)) {
    return createDeniedAccess("account_required", {
      authenticated: true
    });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("admin_memberships")
    .select("role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError) {
    logAdminAccessFailure("database_unavailable");
    return createDeniedAccess("membership_unavailable", {
      authenticated: true,
      accountUser: true
    });
  }

  const role = normalizeAdminRole(membership?.role);

  if (!role || membership?.is_active !== true) {
    return createDeniedAccess("admin_membership_required", {
      authenticated: true,
      accountUser: true
    });
  }

  return {
    authenticated: true,
    accountUser: true,
    isAdmin: true,
    allowed: true,
    role,
    capabilities: getAdminCapabilities(role),
    reason: "admin_access_granted"
  };
}

export async function requireAdminCapability(
  capability = ADMIN_CAPABILITIES.DASHBOARD_READ
) {
  if (!isKnownAdminCapability(capability)) {
    throw new Error("Unknown admin capability");
  }

  const access = await resolveCurrentAdminAccess();

  if (!access.isAdmin) {
    return access;
  }

  return {
    ...access,
    allowed: adminRoleHasCapability(access.role, capability),
    reason: adminRoleHasCapability(access.role, capability)
      ? "admin_access_granted"
      : "admin_capability_required"
  };
}
