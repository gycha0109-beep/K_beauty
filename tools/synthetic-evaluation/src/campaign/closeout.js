import {
  PILOT_CAMPAIGN_CLOSEOUT_SCHEMA_VERSION,
  validatePilotCloseout
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

const TOKEN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function semantic(closeout) {
  const { closeoutDigest, closedAt, ...rest } = closeout;
  return rest;
}

export function createPilotCampaignCloseout({
  plan,
  run,
  projection,
  ledger,
  checkpointApprovals = [],
  closedBy,
  closedAt = new Date().toISOString()
}) {
  if (!TOKEN.test(closedBy || "") || !Number.isFinite(Date.parse(closedAt)) || new Date(closedAt).toISOString() !== closedAt) return failure("campaign_closeout_invalid", "$", null);
  if (projection.campaignRunId !== run.campaignRunId || projection.planDigest !== plan.planDigest) return failure("campaign_closeout_invalid", "projection", "source_mismatch");
  if (projection.denominators.terminalSlots !== plan.objective.primarySlotCount) return failure("campaign_closeout_not_ready", "projection.denominators.terminalSlots", projection.denominators.terminalSlots);
  const slotHeads = Object.entries(ledger.heads)
    .filter(([key]) => key !== "__run__")
    .map(([, digest]) => digest)
    .sort();
  if (slotHeads.length !== plan.objective.primarySlotCount) return failure("campaign_closeout_invalid", "slotEventHeadDigests", "head_count");
  const decisionRefs = [];
  const holdRefs = [];
  const nonGoldRefs = [];
  for (const slot of projection.slotProjections) {
    const decisionDigest = slot.refs.promotionDecisionDigest;
    if (!decisionDigest) continue;
    decisionRefs.push(decisionDigest);
    if (slot.terminalOutcome === "promotion_held") holdRefs.push(decisionDigest);
    if (["retained_g3_negative_control", "promotion_rejected"].includes(slot.terminalOutcome)) nonGoldRefs.push(decisionDigest);
  }
  const value = {
    schemaVersion: PILOT_CAMPAIGN_CLOSEOUT_SCHEMA_VERSION,
    campaignRunId: run.campaignRunId,
    planDigest: plan.planDigest,
    finalProjectionDigest: projection.projectionDigest,
    slotEventHeadDigests: slotHeads,
    checkpointDigests: checkpointApprovals.map((approval) => approval.approvalDigest).sort(),
    activeG4Refs: projection.activeG4Refs.map((ref) => ref.gradeRecordDigest).sort(),
    nonGoldDecisionRefs: [...new Set(nonGoldRefs)].sort(),
    unresolvedHoldRefs: [...new Set(holdRefs)].sort(),
    splitCouplingKeyDigests: projection.activeG4Refs.map((ref) => ref.splitCouplingKeysDigest).sort(),
    closedBy
  };
  const closeoutDigest = sha256Hex(stableStringify(value));
  const closeout = deepFreeze({ ...value, closedAt, closeoutDigest });
  return validatePilotCloseout(closeout).ok ? Object.freeze({ ok: true, closeout }) : failure("campaign_closeout_invalid", "$", null);
}

export function verifyPilotCampaignCloseoutIntegrity(closeout) {
  if (!validatePilotCloseout(closeout).ok) return false;
  return closeout.closeoutDigest === sha256Hex(stableStringify(semantic(closeout)));
}
