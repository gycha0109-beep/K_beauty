import { evaluateAutomaticEvidenceFromLiveDB } from "./automatic-product-evidence-db-reader-v1.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{64}$/;
const MODES = new Set(["inserted", "duplicate"]);
const EVENTS = new Set(["first_observation", "evidence_refresh", "evaluation_version_change", "assessment_changed"]);

function fail(code) { throw new Error(code); }

/**
 * Server-only trusted service-role operation. The caller supplies only a product
 * identifier; evaluation and provenance are always rebuilt from live DB reads.
 * The RPC is the sole history write path, and cannot update other product tables.
 */
export async function recordAutomaticEvidenceFromLiveDB(
  serviceClient, productId, context = {}, nowDate, evaluatedAt = new Date().toISOString()
) {
  if (!serviceClient || typeof serviceClient.rpc !== "function" ||
      !UUID.test(String(productId))) fail("AUTOMATIC_HISTORY_STORE_INVALID_REQUEST");
  const snapshot = await evaluateAutomaticEvidenceFromLiveDB(
    serviceClient, productId, context, nowDate, evaluatedAt
  );
  const candidate = snapshot.historyPreview;
  if (candidate.writeState !== "NOT_SAVED" || candidate.productId !== productId ||
      candidate.databaseWrites !== 0 || candidate.adminReviewWrites !== 0 ||
      candidate.recommendationWrites !== 0 || !SHA.test(candidate.idempotencyKey))
    fail("AUTOMATIC_HISTORY_STORE_UNTRUSTED_PREVIEW");
  const { data, error } = await serviceClient.rpc("record_automatic_product_evidence_history_v1", {
    p_candidate: candidate,
  });
  if (error || !data || !MODES.has(data.status) ||
      !EVENTS.has(data.eventKind) || !Array.isArray(data.changedFields) ||
      !Number.isSafeInteger(data.historyId) || data.historyId <= 0)
    fail("AUTOMATIC_HISTORY_STORE_FAILED");
  return Object.freeze({
    mode:"자동 평가 이력 기록", writeState:"SAVED",
    historyId:data.historyId, status:data.status,
    eventKind:data.eventKind, changedFields:Object.freeze([...data.changedFields]),
    productId,subjectId:candidate.subjectId,
    idempotencyKey:candidate.idempotencyKey,
    adminReviewsCreated:0, recommendationWrites:0,
    rankingChanged:false, admissionGranted:false,
  });
}
