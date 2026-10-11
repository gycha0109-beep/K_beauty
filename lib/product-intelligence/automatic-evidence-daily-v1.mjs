import { recordAutomaticEvidenceFromLiveDB } from "./automatic-evidence-history-store-v1.mjs";

// Deliberately restricted to the verified BUSHMAN pilot. Widening product scope
// requires source-readiness evidence and a separately reviewed rollout.
export const AUTOMATIC_EVIDENCE_DAILY_PILOT_PRODUCTS = Object.freeze([
  "4608b3b4-8b51-4464-b46e-380b05c1a3d7",
]);
export const AUTOMATIC_EVIDENCE_DAILY_VERSION = "automatic-evidence-daily-pilot-v1";
const CORE_FIELDS = new Set(["category_slot", "uv_filter_type"]);
const CRITICAL_EXCEPTIONS = new Set([
  "SUBJECT_IDENTITY_UNRESOLVED",
  "EVIDENCE_IDENTITY_SCOPE_MISMATCH",
  "AUTHORITATIVE_FACT_CONFLICT",
]);

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function fail(message) { throw new Error(message); }

/**
 * An exception-only operational view of a stored, trusted evaluation.
 * Ordinary insufficient fields and reviewer signals NEVER create tasks.
 * A core field losing verification creates attention only after a preceding
 * recorded assessment, not when a new product is first evaluated.
 */
export function classifyAutomaticEvidenceAttention(row) {
  if (!object(row)) fail("AUTO_DAILY_INVALID_HISTORY_ROW");
  const exceptions = Array.isArray(row.exceptions) ? row.exceptions : [];
  const critical = [...new Set(exceptions
    .filter(x => object(x) && CRITICAL_EXCEPTIONS.has(x.code))
    .map(x => x.code))].sort();
  const changed = Array.isArray(row.changed_fields) ? row.changed_fields : [];
  const degraded = changed.filter(field =>
    CORE_FIELDS.has(field) && row.event_kind === "assessment_changed" &&
    object(row.fields?.[field]) && row.fields[field].status !== "verified_fact"
  ).sort();
  if (!critical.length && !degraded.length) return null;
  return Object.freeze({
    historyId: row.history_id,
    productId: row.product_id,
    subjectId: row.subject_id,
    evaluatedAt: row.evaluated_at,
    severity: "needs_review",
    reasonCodes: Object.freeze([...critical,
      ...degraded.map(x => "CORE_EVIDENCE_LOST:" + x)]),
  });
}

/**
 * Run once per scheduled invocation. Every candidate is recomputed inside
 * the trusted server reader. DB RPC is the only write and is idempotent.
 * No recommendation, field confirmation or admin review mutation is created.
 */
export async function runDailyAutomaticEvidencePilot(client, options = {}) {
  if (!client || typeof client.from !== "function" || typeof client.rpc !== "function")
    fail("AUTO_DAILY_SERVICE_CLIENT_REQUIRED");
  const nowDate = options.nowDate;
  const evaluatedAt = options.evaluatedAt;
  const summary = { version:AUTOMATIC_EVIDENCE_DAILY_VERSION,
    scope:"BUSHMAN_VERIFIED_PILOT_ONLY", checked:0, recorded:0, duplicates:0,
    needsReview:0, failed:0, failures:[], attention:[] };
  for (const productId of AUTOMATIC_EVIDENCE_DAILY_PILOT_PRODUCTS) {
    summary.checked++;
    try {
      const result = await recordAutomaticEvidenceFromLiveDB(
        client,productId,{},nowDate,evaluatedAt
      );
      if (result.status === "duplicate") {
        summary.duplicates++;
        continue;
      }
      summary.recorded++;
      const {data,error} = await client.from("automatic_product_evidence_history_v1")
        .select("history_id,product_id,subject_id,evaluated_at,event_kind,changed_fields,fields,exceptions")
        .eq("history_id",result.historyId)
        .eq("product_id",productId)
        .single();
      if (error || !data || data.history_id !== result.historyId)
        fail("AUTO_DAILY_SAVED_HISTORY_READBACK_FAILED");
      const attention = classifyAutomaticEvidenceAttention(data);
      if (attention) {
        summary.needsReview++;
        summary.attention.push(attention);
      }
    } catch {
      summary.failed++;
      summary.failures.push({productId,code:"AUTO_DAILY_EVALUATION_FAILED"});
    }
  }
  return Object.freeze(summary);
}
