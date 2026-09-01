import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const CUSTOMER_DATA_PURGE_STEPS = Object.freeze([
  Object.freeze({ table: "analysis_results", column: "user_id" }),
  Object.freeze({ table: "recommendation_logs", column: "user_id" }),
  Object.freeze({ table: "analysis_requests", column: "user_id" }),
  Object.freeze({ table: "profiles", column: "id" })
]);

// These production FK references currently use RESTRICT against auth.users.
// Preflight them before deleting any consumer data so privileged operational
// audit history cannot turn account deletion into a silent partial delete.
const OPERATIONAL_DELETE_BLOCKERS = Object.freeze([
  Object.freeze({ table: "admin_product_review_confirmations", column: "actor_user_id" }),
  Object.freeze({ table: "admin_product_review_import_confirmations", column: "actor_user_id" }),
  Object.freeze({ table: "admin_product_review_import_v2_confirmations", column: "actor_user_id" }),
  Object.freeze({ table: "crawler_canonical_adoption_requests", column: "actor_user_id" }),
  Object.freeze({ table: "product_evidence_source_subject_bindings", column: "reviewed_by" }),
  Object.freeze({ table: "product_fact_confirmations", column: "actor_user_id" }),
  Object.freeze({ table: "product_fact_review_assignments", column: "assigned_to" }),
  Object.freeze({ table: "product_fact_review_events", column: "actor_user_id" }),
  Object.freeze({ table: "product_metadata_field_reviews", column: "reviewed_by" })
]);

export class AccountDeletionError extends Error {
  constructor(code, cause = null) {
    super(code);
    this.name = "AccountDeletionError";
    this.code = code;
    this.cause = cause;
  }
}

function requireVerifiedUserId(userId) {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new AccountDeletionError("account_deletion_invalid_user");
  }

  return userId.trim();
}

async function assertNoOperationalDeleteBlockers(admin, userId) {
  for (const blocker of OPERATIONAL_DELETE_BLOCKERS) {
    const { data, error } = await admin
      .from(blocker.table)
      .select(blocker.column)
      .eq(blocker.column, userId)
      .limit(1);

    if (error) {
      throw new AccountDeletionError("account_deletion_preflight_failed", error);
    }

    if (Array.isArray(data) && data.length > 0) {
      throw new AccountDeletionError("account_deletion_requires_support");
    }
  }
}

async function purgeCustomerData(admin, userId) {
  for (const step of CUSTOMER_DATA_PURGE_STEPS) {
    const { error } = await admin
      .from(step.table)
      .delete()
      .eq(step.column, userId);

    if (error) {
      throw new AccountDeletionError("account_data_deletion_failed", error);
    }
  }
}

export async function deleteVerifiedAccount(userId) {
  const verifiedUserId = requireVerifiedUserId(userId);
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new AccountDeletionError("account_deletion_not_configured");
  }

  await assertNoOperationalDeleteBlockers(admin, verifiedUserId);
  await purgeCustomerData(admin, verifiedUserId);

  const { error } = await admin.auth.admin.deleteUser(verifiedUserId, false);

  if (error) {
    throw new AccountDeletionError("account_auth_deletion_failed", error);
  }

  return Object.freeze({ deleted: true });
}

export function getAccountDeletionContract() {
  return Object.freeze({
    customerDataPurgeSteps: CUSTOMER_DATA_PURGE_STEPS,
    operationalDeleteBlockers: OPERATIONAL_DELETE_BLOCKERS,
    authDeleteMode: "hard"
  });
}
