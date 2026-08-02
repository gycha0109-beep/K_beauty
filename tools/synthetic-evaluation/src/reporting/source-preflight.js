import { createHash } from "node:crypto";
import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { PILOT_TERMINAL_OUTCOMES } from "@bejewely/face-contracts";
import {
  campaignCloseoutRelativePath,
  campaignProjectionRelativePath,
  campaignRunPlanRelativePath,
  campaignRunRelativePath,
  campaignSlotRelativePath,
  nativePath,
  readCampaignBundle,
  readJson
} from "../campaign/storage.js";
import { derivePilotCampaignProjection } from "../campaign/projection.js";
import { verifyPilotCampaignCloseoutIntegrity } from "../campaign/closeout.js";
import { candidateManifestRelativePath } from "../import/storage-layout.js";
import { readAndResolveCandidateIntent } from "../judgment/read-intent-artifacts.js";
import { readJudgmentConsensus } from "../judgment/blind-registrar.js";
import { intentAlignmentObjectRelativePath } from "../judgment/storage-layout.js";
import { verifyIntentAlignmentIntegrity } from "../judgment/alignment.js";
import { readObservationObject, readObservationRun } from "../observation/register-observation-run.js";
import { verifyObservationStageArtifacts } from "../campaign/stage-adapters.js";
import {
  verifyG4GradeRecordAgainstSources,
  verifyG4GradeRecordIntegrity,
  verifyPromotionDecisionIntegrity,
  verifyPromotionStatusEventIntegrity
} from "../promotion/decision.js";
import { verifyPromotionEvidenceBundleIntegrity } from "../promotion/evidence.js";
import { verifyPromotionReviewSubmissionIntegrity } from "../promotion/promotion-review.js";
import {
  verifyPromotionAssetPolicyReviewIntegrity,
  verifyPromotionLeakageReviewIntegrity,
  verifyPromotionOperatorReattestationIntegrity,
  verifyUsageRightsReviewIntegrity
} from "../promotion/reviews.js";
import { verifyPromotionSourceSnapshotIntegrity } from "../promotion/source-snapshot.js";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

const HEX64 = /^[a-f0-9]{64}$/;
const RUN_ID = /^crun_[a-f0-9]{24}$/;

function failure(code, pathName, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path: pathName, detail }]) });
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function relativeFromRoot(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

function entry({ track, artifactType, artifactDigest, campaignRunId, slotId = null, candidateId = null, relativeObjectPath = null }) {
  return Object.freeze({
    track,
    artifactType,
    artifactDigest,
    campaignRunId,
    slotId,
    candidateId,
    integrityStatus: "verified",
    relativeObjectPath
  });
}

function sortIndex(index) {
  const unique = new Map();
  for (const item of index) {
    const key = stableStringify(item);
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].sort((left, right) => stableStringify([
    left.track,
    left.campaignRunId,
    left.slotId || "",
    left.artifactType,
    left.artifactDigest,
    left.relativeObjectPath || ""
  ]).localeCompare(stableStringify([
    right.track,
    right.campaignRunId,
    right.slotId || "",
    right.artifactType,
    right.artifactDigest,
    right.relativeObjectPath || ""
  ])));
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
}

async function containedRealPath(root, candidate) {
  const [realRoot, realCandidate] = await Promise.all([realpath(root), realpath(candidate)]);
  const relative = path.relative(realRoot, realCandidate);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw Object.assign(new Error("source_artifact_integrity_invalid"), { code: "source_artifact_integrity_invalid" });
  }
  return realCandidate;
}

async function findDigestArtifact(dataRoot, subdirectory, digest, verifier, digestKey) {
  if (!HEX64.test(digest || "")) throw Object.assign(new Error("source_artifact_integrity_invalid"), { code: "source_artifact_integrity_invalid" });
  const root = path.join(dataRoot, ...subdirectory.split("/"));
  const matches = [];
  async function walk(directory) {
    let items;
    try {
      items = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const item of items) {
      if (item.isSymbolicLink()) throw Object.assign(new Error("source_artifact_integrity_invalid"), { code: "source_artifact_integrity_invalid" });
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) await walk(absolute);
      else if (item.isFile() && item.name === `${digest}.json`) matches.push(absolute);
    }
  }
  await walk(root);
  if (matches.length !== 1) throw Object.assign(new Error(matches.length === 0 ? "source_artifact_missing" : "upstream_reference_conflict"), { code: matches.length === 0 ? "source_artifact_missing" : "upstream_reference_conflict" });
  const absolute = await containedRealPath(dataRoot, matches[0]);
  const value = await readJson(absolute);
  if (!verifier(value) || value[digestKey] !== digest) throw Object.assign(new Error("source_artifact_integrity_invalid"), { code: "source_artifact_integrity_invalid" });
  return Object.freeze({ value, relativePath: relativeFromRoot(dataRoot, absolute) });
}

function expectedCloseoutRefs(projection) {
  const nonGold = [];
  const holds = [];
  for (const slot of projection.slotProjections) {
    const digest = slot.refs.promotionDecisionDigest;
    if (!digest) continue;
    if (["retained_g3_negative_control", "promotion_rejected"].includes(slot.terminalOutcome)) nonGold.push(digest);
    if (slot.terminalOutcome === "promotion_held") holds.push(digest);
  }
  return Object.freeze({
    activeG4Refs: projection.activeG4Refs.map((item) => item.gradeRecordDigest).sort(),
    splitCouplingKeyDigests: projection.activeG4Refs.map((item) => item.splitCouplingKeysDigest).sort(),
    nonGoldDecisionRefs: sortedUnique(nonGold),
    unresolvedHoldRefs: sortedUnique(holds)
  });
}

function sameArray(left, right) {
  return stableStringify([...left].sort()) === stableStringify([...right].sort());
}

function verifyCloseoutLinks(closeout, projection, ledger, checkpoints) {
  if (!verifyPilotCampaignCloseoutIntegrity(closeout) || closeout.finalProjectionDigest !== projection.projectionDigest || closeout.campaignRunId !== projection.campaignRunId || closeout.planDigest !== projection.planDigest) return false;
  const slotHeads = Object.entries(ledger.heads).filter(([key]) => key !== "__run__").map(([, digest]) => digest).sort();
  if (!sameArray(closeout.slotEventHeadDigests, slotHeads) || !sameArray(closeout.checkpointDigests, checkpoints.map((item) => item.approvalDigest))) return false;
  const expected = expectedCloseoutRefs(projection);
  return sameArray(closeout.activeG4Refs, expected.activeG4Refs) &&
    sameArray(closeout.splitCouplingKeyDigests, expected.splitCouplingKeyDigests) &&
    sameArray(closeout.nonGoldDecisionRefs, expected.nonGoldDecisionRefs) &&
    sameArray(closeout.unresolvedHoldRefs, expected.unresolvedHoldRefs);
}

function slotEvents(bundle, slotId) {
  return bundle.events.filter((event) => event.slotId === slotId);
}

function refDigest(events, artifactType) {
  for (const event of [...events].reverse()) {
    const ref = event.sourceRefs.find((item) => item.artifactType === artifactType);
    if (ref) return ref.artifactDigest;
  }
  return null;
}

async function verifyPromotionEvidence({ dataRoot, runId, slot, slotProjection, events, artifactIndex }) {
  const decisionDigest = slotProjection.refs.promotionDecisionDigest;
  if (!decisionDigest) return Object.freeze({ decision: null, gradeRecord: null, statusEvent: null });
  const decisionFound = await findDigestArtifact(dataRoot, "promotion/decisions", decisionDigest, verifyPromotionDecisionIntegrity, "decisionDigest");
  const decision = decisionFound.value;
  if (decision.candidateId !== slotProjection.refs.candidateId) throw Object.assign(new Error("upstream_reference_conflict"), { code: "upstream_reference_conflict" });
  artifactIndex.push(entry({ track: "T6", artifactType: "promotion-decision", artifactDigest: decisionDigest, campaignRunId: runId, slotId: slot.slotId, candidateId: decision.candidateId, relativeObjectPath: decisionFound.relativePath }));

  const bundleFound = await findDigestArtifact(dataRoot, "promotion/evidence", decision.evidenceBundleDigest, verifyPromotionEvidenceBundleIntegrity, "bundleDigest");
  const evidenceBundle = bundleFound.value;
  const snapshotFound = await findDigestArtifact(dataRoot, "promotion/source-snapshots", evidenceBundle.sourceSnapshotDigest, verifyPromotionSourceSnapshotIntegrity, "sourceSnapshotDigest");
  const snapshot = snapshotFound.value;
  const operatorFound = await findDigestArtifact(dataRoot, "promotion/reattestations", evidenceBundle.operatorReattestationDigest, verifyPromotionOperatorReattestationIntegrity, "attestationDigest");
  const rightsFound = await findDigestArtifact(dataRoot, "promotion/rights", evidenceBundle.rightsReviewDigest, verifyUsageRightsReviewIntegrity, "reviewDigest");
  const assetFound = await findDigestArtifact(dataRoot, "promotion/asset-policy", evidenceBundle.assetPolicyReviewDigest, verifyPromotionAssetPolicyReviewIntegrity, "reviewDigest");
  const leakageFound = await findDigestArtifact(dataRoot, "promotion/leakage", evidenceBundle.leakageReviewDigest, verifyPromotionLeakageReviewIntegrity, "reviewDigest");
  const reviewFound = await findDigestArtifact(dataRoot, "promotion/reviews", decision.promotionReviewDigest, verifyPromotionReviewSubmissionIntegrity, "submissionDigest");
  const objects = [
    ["promotion-evidence-bundle", evidenceBundle.bundleDigest, bundleFound],
    ["promotion-source-snapshot", snapshot.sourceSnapshotDigest, snapshotFound],
    ["promotion-operator-reattestation", operatorFound.value.attestationDigest, operatorFound],
    ["promotion-rights-review", rightsFound.value.reviewDigest, rightsFound],
    ["promotion-asset-policy-review", assetFound.value.reviewDigest, assetFound],
    ["promotion-leakage-review", leakageFound.value.reviewDigest, leakageFound],
    ["promotion-review", reviewFound.value.submissionDigest, reviewFound]
  ];
  for (const [artifactType, artifactDigest, found] of objects) artifactIndex.push(entry({ track: "T6", artifactType, artifactDigest, campaignRunId: runId, slotId: slot.slotId, candidateId: decision.candidateId, relativeObjectPath: found.relativePath }));
  if (
    snapshot.candidate.candidateId !== decision.candidateId ||
    snapshot.judgment.alignmentDigest !== slotProjection.refs.alignmentDigest ||
    evidenceBundle.promotionKey !== decision.promotionKey ||
    decision.evidenceBundleDigest !== evidenceBundle.bundleDigest ||
    decision.rightsReviewDigest !== rightsFound.value.reviewDigest ||
    decision.leakageReviewDigest !== leakageFound.value.reviewDigest ||
    decision.operatorReattestationDigest !== operatorFound.value.attestationDigest ||
    decision.promotionReviewDigest !== reviewFound.value.submissionDigest
  ) throw Object.assign(new Error("upstream_reference_conflict"), { code: "upstream_reference_conflict" });

  let gradeRecord = null;
  let statusEvent = null;
  if (slotProjection.terminalOutcome === "promoted_g4") {
    const g4Digest = slotProjection.activeG4?.gradeRecordDigest;
    const statusDigest = refDigest(events, "promotion-status-event");
    if (!g4Digest || !statusDigest) throw Object.assign(new Error("source_artifact_missing"), { code: "source_artifact_missing" });
    const gradeFound = await findDigestArtifact(dataRoot, "promotion/grades", g4Digest, verifyG4GradeRecordIntegrity, "gradeRecordDigest");
    const statusFound = await findDigestArtifact(dataRoot, "promotion/status-events", statusDigest, verifyPromotionStatusEventIntegrity, "eventDigest");
    gradeRecord = gradeFound.value;
    statusEvent = statusFound.value;
    if (!verifyG4GradeRecordAgainstSources({
      gradeRecord,
      snapshot,
      bundle: evidenceBundle,
      decision,
      rightsReview: rightsFound.value,
      assetPolicyReview: assetFound.value,
      leakageReview: leakageFound.value,
      operatorReattestation: operatorFound.value,
      promotionReview: reviewFound.value
    }) || statusEvent.event !== "activated" || statusEvent.gradeRecordDigest !== gradeRecord.gradeRecordDigest || statusEvent.promotionKey !== decision.promotionKey) throw Object.assign(new Error("source_artifact_integrity_invalid"), { code: "source_artifact_integrity_invalid" });
    artifactIndex.push(entry({ track: "T6", artifactType: "g4-grade-record", artifactDigest: gradeRecord.gradeRecordDigest, campaignRunId: runId, slotId: slot.slotId, candidateId: decision.candidateId, relativeObjectPath: gradeFound.relativePath }));
    artifactIndex.push(entry({ track: "T6", artifactType: "promotion-status-event", artifactDigest: statusEvent.eventDigest, campaignRunId: runId, slotId: slot.slotId, candidateId: decision.candidateId, relativeObjectPath: statusFound.relativePath }));
  }
  const outcomeMap = Object.freeze({ promoted_g4: "promoted_g4", retained_g3_negative_control: "retained_g3_negative_control", held: "promotion_held", rejected: "promotion_rejected" });
  if (outcomeMap[decision.outcome] !== slotProjection.terminalOutcome) throw Object.assign(new Error("upstream_reference_conflict"), { code: "upstream_reference_conflict" });
  return Object.freeze({ decision, gradeRecord, statusEvent, snapshot, evidenceBundle });
}

async function verifySlotEvidence({ dataRoot, bundle, projection, slot, artifactIndex }) {
  const runId = bundle.run.campaignRunId;
  const projected = projection.slotProjections.find((item) => item.slotId === slot.slotId);
  if (!projected || !PILOT_TERMINAL_OUTCOMES.includes(projected.terminalOutcome)) throw Object.assign(new Error("report_not_ready"), { code: "report_not_ready" });
  const events = slotEvents(bundle, slot.slotId);
  const packetEvents = events.filter((event) => event.eventType === "generation_packet_issued");
  const handoffEvents = events.filter((event) => event.eventType === "generation_handoff_registered");
  const assetReady = handoffEvents.some((event) => event.reasonCodes.includes("generation_asset_ready"));
  const sourceRefDigests = events.flatMap((event) => event.sourceRefs.map((ref) => ref.artifactDigest));
  let candidateManifest = null;
  let markHint = null;
  let observationObject = null;
  let consensus = null;
  let alignment = null;

  if (projected.refs.candidateId) {
    const resolved = await readAndResolveCandidateIntent({ dataRoot, candidateId: projected.refs.candidateId });
    if (!resolved.ok || resolved.candidateManifest.candidateDigest !== projected.refs.candidateDigest || resolved.candidateManifest.asset.canonicalSha256 !== projected.refs.canonicalSha256) throw Object.assign(new Error("source_artifact_integrity_invalid"), { code: "source_artifact_integrity_invalid" });
    candidateManifest = resolved.candidateManifest;
    markHint = candidateManifest.operatorHints?.visibleExternalMark?.status ?? null;
    const manifestRelativePath = candidateManifestRelativePath(candidateManifest.candidateId);
    artifactIndex.push(entry({ track: "T3", artifactType: "candidate-manifest", artifactDigest: candidateManifest.candidateDigest, campaignRunId: runId, slotId: slot.slotId, candidateId: candidateManifest.candidateId, relativeObjectPath: manifestRelativePath }));
    artifactIndex.push(entry({ track: "T2", artifactType: "generation-spec", artifactDigest: resolved.finalizedSpec.specDigest, campaignRunId: runId, slotId: slot.slotId, candidateId: candidateManifest.candidateId, relativeObjectPath: candidateManifest.generation.artifactReferences.spec.objectRelativePath }));
    artifactIndex.push(entry({ track: "T2", artifactType: "compiled-prompt", artifactDigest: resolved.compiledPrompt.promptDigest, campaignRunId: runId, slotId: slot.slotId, candidateId: candidateManifest.candidateId, relativeObjectPath: candidateManifest.generation.artifactReferences.compiledPrompt.objectRelativePath }));
    const canonicalPath = nativePath(dataRoot, candidateManifest.asset.canonicalObjectRelativePath);
    const realCanonical = await containedRealPath(dataRoot, canonicalPath);
    if (await sha256File(realCanonical) !== candidateManifest.asset.canonicalSha256) throw Object.assign(new Error("source_artifact_integrity_invalid"), { code: "source_artifact_integrity_invalid" });
    artifactIndex.push(entry({ track: "T3", artifactType: "canonical-image", artifactDigest: candidateManifest.asset.canonicalSha256, campaignRunId: runId, slotId: slot.slotId, candidateId: candidateManifest.candidateId, relativeObjectPath: candidateManifest.asset.canonicalObjectRelativePath }));
  }

  if (projected.refs.observationRunId) {
    if (!candidateManifest) throw Object.assign(new Error("upstream_reference_conflict"), { code: "upstream_reference_conflict" });
    const observationRun = await readObservationRun(dataRoot, candidateManifest.candidateId, projected.refs.observationRunId);
    if (observationRun.manifestDigest !== projected.refs.observationRunDigest) throw Object.assign(new Error("upstream_reference_conflict"), { code: "upstream_reference_conflict" });
    observationObject = observationRun.observation ? await readObservationObject(dataRoot, observationRun.observation) : null;
    const verified = verifyObservationStageArtifacts({ run: observationRun, observationObject, candidateManifest });
    if (!verified.ok || (observationObject?.observationDigest || null) !== projected.refs.observationObjectDigest) throw Object.assign(new Error("source_artifact_integrity_invalid"), { code: "source_artifact_integrity_invalid" });
    artifactIndex.push(entry({ track: "T4", artifactType: "observation-run", artifactDigest: observationRun.manifestDigest, campaignRunId: runId, slotId: slot.slotId, candidateId: candidateManifest.candidateId, relativeObjectPath: `observation-runs/${candidateManifest.candidateId}/${observationRun.runId}/manifest.json` }));
    if (observationObject) artifactIndex.push(entry({ track: "T4", artifactType: "observation-object", artifactDigest: observationObject.observationDigest, campaignRunId: runId, slotId: slot.slotId, candidateId: candidateManifest.candidateId, relativeObjectPath: observationRun.observation.objectRelativePath }));
  }

  if (projected.refs.consensusDigest) {
    if (!candidateManifest || !observationObject) throw Object.assign(new Error("upstream_reference_conflict"), { code: "upstream_reference_conflict" });
    consensus = await readJudgmentConsensus(dataRoot, candidateManifest.candidateId, projected.refs.consensusDigest);
    if (consensus.observationDigest !== observationObject.observationDigest) throw Object.assign(new Error("upstream_reference_conflict"), { code: "upstream_reference_conflict" });
    artifactIndex.push(entry({ track: "T5", artifactType: "judgment-consensus", artifactDigest: consensus.consensusDigest, campaignRunId: runId, slotId: slot.slotId, candidateId: candidateManifest.candidateId, relativeObjectPath: `judgment/consensus/${candidateManifest.candidateId}/${consensus.consensusDigest}.json` }));
  }

  if (projected.refs.alignmentDigest) {
    const relativePath = intentAlignmentObjectRelativePath(projected.refs.alignmentDigest);
    alignment = await readJson(nativePath(dataRoot, relativePath));
    if (!verifyIntentAlignmentIntegrity(alignment) || alignment.candidate.candidateId !== candidateManifest?.candidateId || alignment.consensus.consensusDigest !== consensus?.consensusDigest) throw Object.assign(new Error("source_artifact_integrity_invalid"), { code: "source_artifact_integrity_invalid" });
    artifactIndex.push(entry({ track: "T5", artifactType: "intent-alignment", artifactDigest: alignment.alignmentDigest, campaignRunId: runId, slotId: slot.slotId, candidateId: candidateManifest.candidateId, relativeObjectPath: relativePath }));
  }

  const promotion = await verifyPromotionEvidence({ dataRoot, runId, slot, slotProjection: projected, events, artifactIndex });
  return deepFreeze({
    slot,
    projection: projected,
    evidence: {
      assetReady,
      markHint,
      candidateManifest,
      observationObject,
      consensus,
      alignment,
      promotion
    },
    sourceRefDigests: sortedUnique(sourceRefDigests)
  });
}

export async function preflightCampaignReportSource({ dataRoot, campaignRunId, closeoutDigest = null }) {
  if (!RUN_ID.test(campaignRunId || "")) return failure("report_not_ready", "campaignRunId");
  let bundle;
  try {
    bundle = await readCampaignBundle(dataRoot, campaignRunId);
  } catch (error) {
    return failure(error?.code || "source_artifact_integrity_invalid", "campaignBundle", error?.detail || null);
  }
  const projected = derivePilotCampaignProjection({ plan: bundle.plan, run: bundle.run, slots: bundle.slots, events: bundle.events });
  if (!projected.ok || projected.projection.runStatus !== "closed" || projected.projection.denominators.terminalSlots !== 20) return failure("report_not_ready", "projection");
  const selectedCloseouts = closeoutDigest ? bundle.closeouts.filter((item) => item.closeoutDigest === closeoutDigest) : bundle.closeouts;
  if (selectedCloseouts.length !== 1) return failure(selectedCloseouts.length === 0 ? "source_artifact_missing" : "upstream_reference_conflict", "closeout");
  const closeout = selectedCloseouts[0];
  const projectionPath = nativePath(dataRoot, campaignProjectionRelativePath(campaignRunId, closeout.finalProjectionDigest));
  let storedProjection;
  try {
    storedProjection = await readJson(projectionPath);
  } catch (error) {
    return failure(error?.code === "ENOENT" ? "source_artifact_missing" : "source_artifact_integrity_invalid", "projection");
  }
  if (storedProjection.projectionDigest !== projected.projection.projectionDigest || stableStringify(storedProjection) !== stableStringify(projected.projection) || !verifyCloseoutLinks(closeout, storedProjection, projected.ledger, bundle.checkpoints)) return failure("closeout_projection_mismatch", "closeout");

  const artifactIndex = [
    entry({ track: "T7", artifactType: "campaign-plan", artifactDigest: bundle.plan.planDigest, campaignRunId, relativeObjectPath: campaignRunPlanRelativePath(campaignRunId) }),
    entry({ track: "T7", artifactType: "campaign-run", artifactDigest: bundle.run.runIdentityDigest, campaignRunId, relativeObjectPath: campaignRunRelativePath(campaignRunId) }),
    entry({ track: "T7", artifactType: "campaign-projection", artifactDigest: storedProjection.projectionDigest, campaignRunId, relativeObjectPath: campaignProjectionRelativePath(campaignRunId, storedProjection.projectionDigest) }),
    entry({ track: "T7", artifactType: "campaign-closeout", artifactDigest: closeout.closeoutDigest, campaignRunId, relativeObjectPath: campaignCloseoutRelativePath(campaignRunId, closeout.closeoutDigest) })
  ];
  for (const slot of bundle.slots) artifactIndex.push(entry({ track: "T7", artifactType: "campaign-slot", artifactDigest: slot.slotIdentityDigest, campaignRunId, slotId: slot.slotId, relativeObjectPath: campaignSlotRelativePath(campaignRunId, slot.slotId) }));
  for (const event of bundle.events) artifactIndex.push(entry({ track: "T7", artifactType: "campaign-event", artifactDigest: event.eventDigest, campaignRunId, slotId: event.slotId, relativeObjectPath: `campaigns/runs/${campaignRunId}/events/${event.slotId || "run"}/${event.eventDigest}.json` }));
  for (const checkpoint of bundle.checkpoints) artifactIndex.push(entry({ track: "T7", artifactType: "campaign-checkpoint", artifactDigest: checkpoint.approvalDigest, campaignRunId, relativeObjectPath: `campaigns/runs/${campaignRunId}/checkpoints/${checkpoint.approvalDigest}.json` }));

  const slotEvidence = [];
  try {
    for (const slot of bundle.slots) slotEvidence.push(await verifySlotEvidence({ dataRoot, bundle, projection: storedProjection, slot, artifactIndex }));
  } catch (error) {
    return failure(error?.code || "source_artifact_integrity_invalid", "slotEvidence", error?.message || null);
  }
  const sortedIndex = sortIndex(artifactIndex);
  const artifactIndexDigest = sha256Hex(stableStringify(sortedIndex));
  return Object.freeze({
    ok: true,
    source: deepFreeze({
      plan: bundle.plan,
      run: bundle.run,
      slots: bundle.slots,
      events: bundle.events,
      checkpoints: bundle.checkpoints,
      projection: storedProjection,
      closeout,
      slotEvidence: slotEvidence.sort((left, right) => left.slot.slotId.localeCompare(right.slot.slotId)),
      artifactIndex: sortedIndex,
      artifactIndexDigest
    })
  });
}
