import { after } from "next/server";
import {
  buildV21_9LOrganicEvidenceRows,
  validateV21_9LOrganicEvidenceRows
} from "./exfoliation-normative-policy-organic-evidence-context.js";

export const V21_9L_ORGANIC_EVIDENCE_RPC =
  "record_recommendation_shadow_evidence_daily_v1";

function logPersistenceFailure(code) {
  try {
    console.warn("[v21-9l-organic-evidence]", {
      event: "organic_shadow_evidence_persistence_failed",
      code: String(code || "unknown")
    });
  } catch {
    // Observability failure must never affect Recommendation.
  }
}

export async function persistV21_9LOrganicEvidenceRows(
  rows,
  { createClient = null } = {}
) {
  const validation = validateV21_9LOrganicEvidenceRows(rows);
  if (!validation.valid) {
    return { ok: false, code: "invalid_rows" };
  }

  let clientFactory = createClient;
  if (typeof clientFactory !== "function") {
    try {
      const adminModule = await import("./supabase-admin.js");
      clientFactory = adminModule.createSupabaseAdminClient;
    } catch {
      return { ok: false, code: "admin_client_import_failed" };
    }
  }

  const supabase = clientFactory();
  if (!supabase || typeof supabase.rpc !== "function") {
    return { ok: false, code: "store_unavailable" };
  }

  try {
    const { data, error } = await supabase.rpc(V21_9L_ORGANIC_EVIDENCE_RPC, {
      p_rows: rows
    });
    if (error) {
      return { ok: false, code: "rpc_failed" };
    }
    return { ok: true, data: data || null };
  } catch {
    return { ok: false, code: "rpc_exception" };
  }
}

export function scheduleV21_9LOrganicEvidencePersistence(
  { input = {}, observation = {}, now = Date.now() } = {},
  {
    afterImpl = after,
    persistImpl = persistV21_9LOrganicEvidenceRows,
    force = false
  } = {}
) {
  if (!force && process.env.VERCEL_ENV !== "production") {
    return { scheduled: false, code: "non_production" };
  }

  const rows = buildV21_9LOrganicEvidenceRows({ input, observation, now });
  if (!rows.length) {
    return { scheduled: false, code: "no_shadow_evidence" };
  }

  try {
    afterImpl(async () => {
      try {
        const result = await persistImpl(rows);
        if (!result?.ok) {
          logPersistenceFailure(result?.code || "write_failed");
        }
      } catch {
        logPersistenceFailure("write_exception");
      }
    });
    return { scheduled: true, rowCount: rows.length };
  } catch {
    logPersistenceFailure("schedule_failed");
    return { scheduled: false, code: "schedule_failed" };
  }
}
