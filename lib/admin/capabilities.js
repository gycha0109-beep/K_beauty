export const ADMIN_ROLES = Object.freeze({
  VIEWER: "admin_viewer",
  OPERATOR: "admin_operator",
  PRIVACY: "admin_privacy",
  OWNER: "admin_owner"
});

export const ADMIN_CAPABILITIES = Object.freeze({
  DASHBOARD_READ: "admin.dashboard.read",
  PRODUCTS_READ: "admin.products.read",
  PRODUCTS_REVIEW: "admin.products.review",
  ANALYSIS_READ: "admin.analysis.read",
  OPERATIONS_EXECUTE: "admin.operations.execute",
  PRIVACY_READ: "admin.privacy.read",
  PRIVACY_EXECUTE: "admin.privacy.execute",
  AUDIT_READ: "admin.audit.read",
  ROLES_MANAGE: "admin.roles.manage"
});

const ROLE_CAPABILITIES = Object.freeze({
  [ADMIN_ROLES.VIEWER]: Object.freeze([
    ADMIN_CAPABILITIES.DASHBOARD_READ,
    ADMIN_CAPABILITIES.PRODUCTS_READ,
    ADMIN_CAPABILITIES.ANALYSIS_READ
  ]),
  [ADMIN_ROLES.OPERATOR]: Object.freeze([
    ADMIN_CAPABILITIES.DASHBOARD_READ,
    ADMIN_CAPABILITIES.PRODUCTS_READ,
    ADMIN_CAPABILITIES.PRODUCTS_REVIEW,
    ADMIN_CAPABILITIES.ANALYSIS_READ,
    ADMIN_CAPABILITIES.OPERATIONS_EXECUTE
  ]),
  [ADMIN_ROLES.PRIVACY]: Object.freeze([
    ADMIN_CAPABILITIES.DASHBOARD_READ,
    ADMIN_CAPABILITIES.PRIVACY_READ,
    ADMIN_CAPABILITIES.PRIVACY_EXECUTE
  ]),
  [ADMIN_ROLES.OWNER]: Object.freeze(Object.values(ADMIN_CAPABILITIES))
});

const ADMIN_ROLE_SET = new Set(Object.values(ADMIN_ROLES));
const ADMIN_CAPABILITY_SET = new Set(Object.values(ADMIN_CAPABILITIES));

export function normalizeAdminRole(value) {
  const role = typeof value === "string" ? value.trim() : "";
  return ADMIN_ROLE_SET.has(role) ? role : null;
}

export function isKnownAdminCapability(value) {
  return ADMIN_CAPABILITY_SET.has(value);
}

export function getAdminCapabilities(role) {
  const normalizedRole = normalizeAdminRole(role);
  return normalizedRole ? [...ROLE_CAPABILITIES[normalizedRole]] : [];
}

export function adminRoleHasCapability(role, capability) {
  if (!isKnownAdminCapability(capability)) {
    return false;
  }

  return getAdminCapabilities(role).includes(capability);
}
