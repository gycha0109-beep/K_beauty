// D8K-4B: offline consistency check between actually rendered Product IDs
// and the canonical *recommendation* admission decision envelope.
// This is NOT commerce admission: NO RPC execution, privileges, price or CTA.
import {
  ACTIVE_RECOMMENDATION_OFFER_SLOTS_VERSION,
  ACTIVE_RECOMMENDATION_SURFACES
} from "./active-recommendation-offer-slots-v1.mjs";
import { planProductOfferAuthorityReads } from "./product-offer-authority-read-v1.mjs";

export const ACTIVE_OFFER_ADMISSION_RECONCILIATION_VERSION =
  "d8k4b-active-offer-admission-reconciliation-v1";
const RECOMMENDATION_CONTRACT = "production-recommendation-candidate-admission-v1";
const LEGACY = "LEGACY_COMPATIBILITY_ADMISSION";
const INITIAL = "INITIAL_ADMISSION_GRANT";
const REJECTED = "REJECTED";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PRIVATE_SLOTS = new Set(["F-01","P-01","P-02","P-03","P-04","P-05"]);
const ALL_SLOTS = new Set(ACTIVE_RECOMMENDATION_SURFACES);
const MAX_SLOT_ROWS = 2048;
const MAX_ADMISSION_DECISIONS = 4096;

function blocked(reason, examined = 0) {
  return {
    version: ACTIVE_OFFER_ADMISSION_RECONCILIATION_VERSION,
    status: "HOLD", reason, examinedSlotRows: examined,
    admissionAlignedCandidateIds: [], rpcBatchSizesPreview: [],
    recommendationDecisionTypes: { legacy: 0, initialGrant: 0 },
    // These MUST remain false even if the provided snapshots are fabricated.
    actualRuntimeAdmissionProven: false, privateRpcReadAuthorized: false,
    privateRpcReadInvoked: false, optionEvidenceVerified: false,
    sellerPriceAuthorized: false, directCtaAuthorized: false,
    liveUiEnabled: false, productionReleaseAuthorized: false
  };
}
const integer = n => Number.isSafeInteger(n) && n >= 0;

function validateSlots(slots) {
  if (!slots || slots.version !== ACTIVE_RECOMMENDATION_OFFER_SLOTS_VERSION ||
      !Array.isArray(slots.slotKinds) ||
      slots.slotKinds.length !== ACTIVE_RECOMMENDATION_SURFACES.length ||
      !slots.slotKinds.every((v,i) => v === ACTIVE_RECOMMENDATION_SURFACES[i]) ||
      !Array.isArray(slots.rows) || slots.rows.length > MAX_SLOT_ROWS ||
      !Array.isArray(slots.candidateIdsForLaterPrivateAdmission) ||
      slots.identityEvidenceOnly !== true ||
      slots.privateReadAuthorized !== false ||
      slots.sellerPriceAuthority !== false ||
      slots.selectedOptionAuthority !== false ||
      slots.directCtaAuthority !== false ||
      slots.publicShareReadAuthorized !== false ||
      slots.productionReleaseAuthorized !== false) {
    return { reason: "SLOT_CONTRACT_INVALID" };
  }
  const candidates = new Set();
  const positions = new Set();
  for (const row of slots.rows) {
    if (!row || !ALL_SLOTS.has(row.slot) || !integer(row.index) ||
        row.index > MAX_SLOT_ROWS ||
        row.commerceReadAuthorized !== false ||
        row.comparisonAuthorized !== false ||
        row.directCtaAuthorized !== false) {
      return { reason: "SLOT_ROW_INVALID" };
    }
    const position = row.slot + "::" + row.index;
    if (positions.has(position)) return { reason: "DUPLICATE_SLOT_POSITION" };
    positions.add(position);
    if (row.identityState === "CANDIDATE_ID_ONLY") {
      if (!PRIVATE_SLOTS.has(row.slot) || typeof row.productId !== "string" ||
          !UUID.test(row.productId)) return { reason: "CANDIDATE_IDENTITY_INVALID" };
      candidates.add(row.productId);
    } else if (!["HOLD_IDENTITY","HOLD_EXPOSURE_AUTHORITY"].includes(row.identityState) ||
               (row.productId !== null && (typeof row.productId !== "string" ||
               !UUID.test(row.productId)))) {
      return { reason: "HOLD_ROW_INVALID" };
    }
  }
  const ids = [...candidates].sort();
  if (slots.candidateIdsForLaterPrivateAdmission.length !== ids.length ||
      !slots.candidateIdsForLaterPrivateAdmission.every((id,i) => id === ids[i])) {
    return { reason: "CANDIDATE_LIST_DRIFT" };
  }
  return { ids };
}

function validateAdmission(snapshot) {
  if (!snapshot || snapshot.contractVersion !== RECOMMENDATION_CONTRACT ||
      !Array.isArray(snapshot.decisions) ||
      snapshot.decisions.length > MAX_ADMISSION_DECISIONS ||
      !snapshot.summary || typeof snapshot.summary !== "object") {
    return { reason: "ADMISSION_SNAPSHOT_INVALID" };
  }
  const s = snapshot.summary;
  for (const key of ["enumeratedCount","legacyAdmittedCount","nonlegacyCheckedCount",
    "nonlegacyGrantedCount","nonlegacyRejectedCount","authorityFailureCount"]) {
    if (!integer(s[key])) return { reason: "ADMISSION_SUMMARY_INVALID" };
  }
  if (s.authorityFailureCount !== 0 ||
      s.enumeratedCount !== snapshot.decisions.length ||
      s.legacyAdmittedCount + s.nonlegacyCheckedCount !== s.enumeratedCount ||
      s.nonlegacyGrantedCount + s.nonlegacyRejectedCount !== s.nonlegacyCheckedCount) {
    return { reason: "ADMISSION_SUMMARY_INCONSISTENT" };
  }

  const decisions = new Map();
  const counts = { legacy: 0, initialGrant: 0, rejected: 0 };
  for (const decision of snapshot.decisions) {
    const id = decision?.product?.id;
    if (decision?.contractVersion !== RECOMMENDATION_CONTRACT ||
        typeof id !== "string" || !UUID.test(id) ||
        decisions.has(id) || !Array.isArray(decision.reasonCodes)) {
      return { reason: "ADMISSION_DECISION_IDENTITY_INVALID" };
    }
    if (decision.admissionType === LEGACY) {
      if (!decision.reasonCodes.includes("EXACT_FROZEN_LEGACY_CORPUS_MEMBER")) {
        return { reason: "LEGACY_LINEAGE_NOT_ATTESTED_IN_SNAPSHOT" };
      }
      counts.legacy++;
    } else if (decision.admissionType === INITIAL) {
      if (!decision.reasonCodes.includes("INITIAL_ADMISSION_GRANT_CONFIRMED") ||
          decision.g2?.decision !== INITIAL || decision.g2?.grant !== true) {
        return { reason: "INITIAL_GRANT_SNAPSHOT_INCOMPLETE" };
      }
      counts.initialGrant++;
    } else if (decision.admissionType === REJECTED) {
      counts.rejected++;
    } else {
      return { reason: "UNKNOWN_ADMISSION_DECISION" };
    }
    decisions.set(id, decision.admissionType);
  }
  if (counts.legacy !== s.legacyAdmittedCount ||
      counts.initialGrant !== s.nonlegacyGrantedCount ||
      counts.rejected !== s.nonlegacyRejectedCount) {
    return { reason: "ADMISSION_COUNT_DRIFT" };
  }
  return { decisions, counts };
}

/**
 * Deliberately accepts *snapshots*, not a DB role or reader callback.
 * Even a perfect match is a diagnostic preview, NOT a permission.
 * A separate approved server runtime must establish trusted provenance,
 * current subject/option evidence and database role before any RPC.
 */
export function reconcileActiveRecommendationAdmissionForOfferRead({
  slots = null, admissionResult = null
} = {}) {
  const source = validateSlots(slots);
  if (source.reason) return blocked(source.reason);
  const examined = slots.rows.length;
  if (!source.ids.length) {
    return { ...blocked("NO_PRIVATE_RECOMMENDATION_CANDIDATES", examined),
      status: "EMPTY" };
  }
  const admission = validateAdmission(admissionResult);
  if (admission.reason) return blocked(admission.reason, examined);
  const types = { legacy: 0, initialGrant: 0 };
  for (const id of source.ids) {
    const decision = admission.decisions.get(id);
    if (decision !== LEGACY && decision !== INITIAL) {
      return blocked(decision === REJECTED
        ? "RECOMMENDATION_ADMISSION_REJECTED"
        : "RECOMMENDATION_ADMISSION_MISSING", examined);
    }
    if (decision === LEGACY) types.legacy++;
    else types.initialGrant++;
  }
  const plan = planProductOfferAuthorityReads(source.ids);
  if (plan.status !== "READY") return blocked("RPC_BATCH_PLAN_" + plan.reason, examined);
  return {
    ...blocked("SERVER_RUNTIME_AND_SELECTED_OPTION_AUTHORITY_REQUIRED", examined),
    status: "DIAGNOSTIC_MATCH_ONLY",
    admissionAlignedCandidateIds: plan.productIds,
    rpcBatchSizesPreview: plan.batches.map(batch => batch.length),
    recommendationDecisionTypes: types
  };
}
