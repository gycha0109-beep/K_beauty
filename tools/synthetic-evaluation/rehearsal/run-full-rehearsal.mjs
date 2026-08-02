#!/usr/bin/env node
import { createHash } from "node:crypto";
import { access, lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { CANONICAL_OBSERVATION_PROFILE } from "@bejewely/face-contracts";
import {
  closePilotCampaign,
  compileAndStorePilotCampaign,
  getPilotCampaignStatus,
  registerPilotGenerationHandoff,
  reservePilotGenerationRetry
} from "../src/campaign/orchestrator.js";
import { issuePilotWave, submitPilotCheckpoint } from "../src/campaign/safe-operations.js";
import { registerPilotStage } from "../src/campaign/stage-registration.js";
import { readCampaignBundle } from "../src/campaign/storage.js";
import { observeCandidate } from "../src/observation/observe-candidate.js";
import { INELIGIBLE_PARITY_FIXTURE } from "../src/observation/parity-fixtures.js";
import { CANONICAL_OBSERVATION_SNAPSHOT } from "../src/observation/snapshot/canonical-v1.js";
import {
  confirmPromotion,
  preparePromotionConfirmation,
  preparePromotionPolicyReviewPreflight,
  preparePromotionSourcePreflight,
  revokePromotion
} from "../src/promotion/orchestrator.js";
import { projectPromotionStatus } from "../src/promotion/decision.js";
import { makeDerivedBundle } from "../tests/reporting/helpers.mjs";
import {
  approvedPolicyReviewDrafts,
  approvedPromotionReviewDraft,
  setupStoredPromotionCase
} from "../tests/promotion/helpers.mjs";
import { approvedLockReviewDraft, createSourceSnapshot, splitPlanDraft } from "../tests/dataset/helpers.mjs";
import { buildLeakageGraph } from "../src/dataset/leakage.js";
import { assignLeakageComponents, createDatasetSplitPlan } from "../src/dataset/split.js";
import { finalizeDatasetLockReview } from "../src/dataset/review.js";
import { prepareDatasetLockArtifacts } from "../src/dataset/lock.js";
import { registerDatasetActivation, registerLockedDataset } from "../src/dataset/storage.js";
import { appendDatasetVersionStatus } from "../src/dataset/status.js";
import { materializeHoldoutReferences } from "../src/dataset/orchestrator.js";
import { verifyDatasetSourceSnapshotIntegrity } from "../src/dataset/source.js";
import { bindScenariosToSlots, EXPECTED_TERMINAL_COUNTS, REHEARSAL_SCENARIO_MATRIX } from "./scenario-matrix.mjs";
import { finalizeRehearsalReport, sha256, stableStringify, verifyRehearsalReport } from "./report.mjs";

const PLAN = Object.freeze({
  campaignId: "skin-control-rehearsal-001",
  campaignVersion: "1.0.0",
  comparisonGroupId: null,
  providerProfileId: "gemini-image-manual-v1",
  authoredBy: "rehearsal_planner",
  authoredAt: "2026-08-03T00:00:00.000Z"
});

function check(condition, code, detail = null) {
  if (!condition) throw Object.assign(new Error(code), { code, detail });
}

async function exists(target) {
  try { await access(target); return true; } catch { return false; }
}

async function digestTree(root) {
  if (!(await exists(root))) return "missing";
  const entries = [];
  async function walk(current, relative = "") {
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw Object.assign(new Error("rehearsal_symlink_forbidden"), { code: "rehearsal_symlink_forbidden" });
    if (info.isFile()) {
      entries.push([relative, createHash("sha256").update(await readFile(current)).digest("hex")]);
      return;
    }
    if (!info.isDirectory()) throw Object.assign(new Error("rehearsal_path_invalid"), { code: "rehearsal_path_invalid" });
    const children = await readdir(current, { withFileTypes: true });
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      if (child.isSymbolicLink()) throw Object.assign(new Error("rehearsal_symlink_forbidden"), { code: "rehearsal_symlink_forbidden" });
      await walk(path.join(current, child.name), relative ? `${relative}/${child.name}` : child.name);
    }
  }
  await walk(root);
  return sha256(entries);
}

function checkpointDraft(waveOrdinal, approvedAt) {
  return {
    completedWaveOrdinal: waveOrdinal,
    checklist: {
      sourceFreezeStillValid: true,
      providerProfileStillAllowed: true,
      noRealPersonReferenceEvidence: true,
      noSystemicExternalMarkIssue: true,
      noCandidateReplacementOccurred: true,
      allRegisteredOutcomesRetained: true,
      unresolvedCriticalIntegrityFailureCount: 0
    },
    decision: "continue",
    reasonCodes: ["checkpoint_continue"],
    approvedBy: "checkpoint_reviewer",
    approvedAt
  };
}

async function png(index) {
  return sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 60 + (index * 7) % 180, g: 80 + (index * 11) % 150, b: 90 + (index * 13) % 140 }
    }
  }).png().toBuffer();
}

async function finishSlot({ dataRoot, runId, slot, scenario, index, failures }) {
  let bundle = await readCampaignBundle(dataRoot, runId);
  let packet = bundle.packets.find((item) => item.slotId === slot.slotId && item.attemptOrdinal === 1);
  check(packet, "rehearsal_packet_missing", slot.slotId);

  if (scenario.kind === "generation_technical_failure") {
    let handoff = await registerPilotGenerationHandoff({
      dataRoot,
      runId,
      slotId: slot.slotId,
      packetId: packet.packetId,
      handoffDraft: { localAssetRelativePath: null, outcome: "provider_no_output", operatorId: "operator_rehearsal", generatedAt: `2026-08-03T01:${String(index).padStart(2, "0")}:00.000Z` }
    });
    check(handoff.ok, "rehearsal_generation_handoff_failed", handoff.errors);
    const retry = await reservePilotGenerationRetry({ dataRoot, runId, slotId: slot.slotId, actorId: "rehearsal_operator" });
    check(retry.ok, "rehearsal_generation_retry_failed", retry.errors);
    packet = retry.packet;
    handoff = await registerPilotGenerationHandoff({
      dataRoot,
      runId,
      slotId: slot.slotId,
      packetId: packet.packetId,
      handoffDraft: { localAssetRelativePath: null, outcome: "provider_no_output", operatorId: "operator_rehearsal", generatedAt: `2026-08-03T02:${String(index).padStart(2, "0")}:00.000Z` }
    });
    check(handoff.ok, "rehearsal_generation_retry_handoff_failed", handoff.errors);
  } else {
    const relative = `rehearsal-assets/${slot.slotId}.png`;
    const absolute = path.join(dataRoot, ...relative.split("/"));
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, await png(index));
    const handoff = await registerPilotGenerationHandoff({
      dataRoot,
      runId,
      slotId: slot.slotId,
      packetId: packet.packetId,
      handoffDraft: { localAssetRelativePath: relative, outcome: "asset_ready", operatorId: "operator_rehearsal", generatedAt: `2026-08-03T01:${String(index).padStart(2, "0")}:00.000Z` }
    });
    check(handoff.ok, "rehearsal_asset_handoff_failed", handoff.errors);
    if (!failures.some((item) => item.id === "nontechnical_retry_rejected")) {
      const blocked = await reservePilotGenerationRetry({ dataRoot, runId, slotId: slot.slotId, actorId: "rehearsal_operator" });
      failures.push({ id: "nontechnical_retry_rejected", status: blocked.ok ? "failed" : "passed", detail: blocked.errors?.[0]?.code || null });
    }
  }

  const terminal = await registerPilotStage({
    dataRoot,
    runId,
    slotId: slot.slotId,
    stage: "terminal",
    artifacts: { outcome: scenario.terminalOutcome },
    actorId: "rehearsal_operator"
  });
  check(terminal.ok, "rehearsal_terminal_registration_failed", { slotId: slot.slotId, scenario: scenario.id, errors: terminal.errors });
}

async function runCampaignDrill(dataRoot, failures) {
  const compiled = await compileAndStorePilotCampaign({
    dataRoot,
    planDraft: PLAN,
    runNonce: "rehearsal-run-001",
    startedBy: "rehearsal_operator",
    startedAt: "2026-08-03T00:10:00.000Z"
  });
  check(compiled.ok, "rehearsal_campaign_compile_failed", compiled.errors);
  const runId = compiled.run.campaignRunId;
  const bindings = bindScenariosToSlots(compiled.slots);

  const first = await issuePilotWave({ dataRoot, runId, waveOrdinal: 1, actorId: "rehearsal_operator" });
  check(first.ok && first.packetsIssued === 4, "rehearsal_wave1_issue_failed", first.errors);
  const repeated = await issuePilotWave({ dataRoot, runId, waveOrdinal: 1, actorId: "rehearsal_operator" });
  failures.push({ id: "wave_issue_idempotent", status: repeated.ok && repeated.packetsIssued === 0 ? "passed" : "failed", detail: repeated.packetsIssued });
  const premature = await issuePilotWave({ dataRoot, runId, waveOrdinal: 2, actorId: "rehearsal_operator" });
  failures.push({ id: "wave2_before_checkpoint_rejected", status: premature.ok ? "failed" : "passed", detail: premature.errors?.[0]?.code || null });

  let ordinal = 0;
  for (let wave = 1; wave <= 3; wave += 1) {
    if (wave > 1) {
      const issued = await issuePilotWave({ dataRoot, runId, waveOrdinal: wave, actorId: "rehearsal_operator" });
      check(issued.ok && issued.packetsIssued === 8, "rehearsal_wave_issue_failed", { wave, errors: issued.errors });
    }
    for (const binding of bindings.filter((item) => item.slot.waveOrdinal === wave)) {
      ordinal += 1;
      await finishSlot({ dataRoot, runId, ...binding, index: ordinal, failures });
    }
    if (wave < 3) {
      const checkpoint = await submitPilotCheckpoint({
        dataRoot,
        runId,
        checkpointDraft: checkpointDraft(wave, `2026-08-03T0${3 + wave}:00:00.000Z`),
        actorId: "checkpoint_reviewer"
      });
      check(checkpoint.ok, "rehearsal_checkpoint_failed", checkpoint.errors);
    }
  }

  const closed = await closePilotCampaign({ dataRoot, runId, closedBy: "rehearsal_operator", closedAt: "2026-08-03T07:00:00.000Z" });
  check(closed.ok, "rehearsal_campaign_close_failed", closed.errors);
  const status = await getPilotCampaignStatus({ dataRoot, runId });
  check(status.ok && status.projection.denominators.terminalSlots === 20, "rehearsal_campaign_denominator_failed", status.errors);
  const nonzero = Object.fromEntries(Object.entries(status.projection.terminalOutcomeCounts).filter(([, count]) => count > 0));
  check(stableStringify(nonzero) === stableStringify(EXPECTED_TERMINAL_COUNTS), "rehearsal_terminal_counts_mismatch", nonzero);
  const conditionCounts = compiled.slots.reduce((counts, slot) => ({ ...counts, [slot.conditionId]: (counts[slot.conditionId] || 0) + 1 }), {});
  return { runId, conditionCounts, terminalOutcomeCounts: nonzero };
}

function observationRequest(stored, replicateOrdinal) {
  return {
    schemaVersion: "observation-run-request-v1",
    candidate: {
      candidateId: stored.candidateManifest.candidateId,
      canonicalAsset: {
        sha256: stored.candidateManifest.asset.canonicalSha256,
        objectRelativePath: stored.candidateManifest.asset.canonicalObjectRelativePath,
        transformPolicyVersion: "canonical-image-v1"
      }
    },
    adapterProfile: { id: CANONICAL_OBSERVATION_PROFILE.id, version: CANONICAL_OBSERVATION_PROFILE.version },
    contractSnapshotId: CANONICAL_OBSERVATION_SNAPSHOT.snapshotId,
    execution: { mode: "provider_bounded", requestedModel: CANONICAL_OBSERVATION_PROFILE.providerModel, replicateOrdinal }
  };
}

function clock(seed) {
  let value = Date.parse(seed);
  return () => new Date(value += 1000);
}

async function promotionInput(stored, overrides = {}) {
  const source = await preparePromotionSourcePreflight({
    dataRoot: stored.dataRoot,
    candidateId: stored.candidateManifest.candidateId,
    alignmentDigest: stored.alignment.alignmentDigest,
    assembledAt: "2026-08-03T09:00:00.000Z"
  });
  check(source.ok, "rehearsal_promotion_source_failed", source.errors);
  return {
    dataRoot: stored.dataRoot,
    candidateId: stored.candidateManifest.candidateId,
    alignmentDigest: stored.alignment.alignmentDigest,
    reviewDrafts: approvedPolicyReviewDrafts(source.snapshot, overrides),
    promotionReviewDraft: approvedPromotionReviewDraft(source.snapshot),
    sourceAssembledAt: "2026-08-03T09:00:00.000Z",
    bundleAssembledAt: "2026-08-03T09:10:00.000Z",
    decidedAt: "2026-08-03T09:20:00.000Z",
    recordedAt: "2026-08-03T09:30:00.000Z"
  };
}

async function runEvidenceDrill(roots, failures) {
  const results = [];
  const make = async (options = {}) => {
    const stored = await setupStoredPromotionCase(options);
    roots.add(stored.dataRoot);
    return stored;
  };

  for (let index = 0; index < 8; index += 1) {
    const stored = await make({ fixture: "D" });
    const input = await promotionInput(stored);
    const prepared = await preparePromotionConfirmation(input);
    check(prepared.ok && prepared.gradeRecord?.grade === "G4_SYNTHETIC_GOLD", "rehearsal_g4_prepare_failed", prepared.errors);
    results.push({ scenario: `aligned_${index + 1}`, status: "passed", outcome: "g4_prepared_not_registered" });
    if (index === 0) {
      const again = await preparePromotionConfirmation({ ...input, decidedAt: "2026-08-04T09:20:00.000Z", recordedAt: "2026-08-04T09:30:00.000Z" });
      failures.push({ id: "promotion_prepare_idempotent", status: again.ok && again.gradeRecord.gradeRecordDigest === prepared.gradeRecord.gradeRecordDigest ? "passed" : "failed", detail: again.errors?.[0]?.code || null });
    }
  }

  for (let index = 0; index < 3; index += 1) {
    const stored = await make({ fixture: "D" });
    const fakeFetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(INELIGIBLE_PARITY_FIXTURE) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200, headers: { "content-type": "application/json" } });
    const observed = await observeCandidate({ request: observationRequest(stored, 2), action: "execute", dataRoot: stored.dataRoot, apiKey: "rehearsal-key", fetchImpl: fakeFetch, now: clock(`2026-08-03T1${index}:00:00.000Z`) });
    check(observed.ok && observed.run.outcome === "observed_bundle", "rehearsal_ineligible_observation_failed", observed);
    results.push({ scenario: `ineligible_${index + 1}`, status: "passed", outcome: "provider_bounded_ineligible" });
  }

  {
    const stored = await make({ fixture: "D" });
    const failingFetch = async () => new Response("temporary failure", { status: 500, headers: { "content-type": "text/plain" } });
    const observed = await observeCandidate({ request: observationRequest(stored, 3), action: "execute", dataRoot: stored.dataRoot, apiKey: "rehearsal-key", fetchImpl: failingFetch, now: clock("2026-08-03T14:00:00.000Z") });
    check(!observed.ok && observed.state === "registered_failure", "rehearsal_observation_failure_probe_failed", observed);
    results.push({ scenario: "observation_failure_1", status: "passed", outcome: "provider_failure_registered" });
  }

  for (let index = 0; index < 2; index += 1) {
    const stored = await make({ fixture: "B", overrides: { "skin.redness.presence": { value: "moderate_or_higher" } } });
    const preflight = await preparePromotionPolicyReviewPreflight(await promotionInput(stored));
    check(preflight.ok && preflight.preflight.status === "retained_g3_negative_control", "rehearsal_negative_control_failed", preflight.errors);
    results.push({ scenario: `misaligned_${index + 1}`, status: "passed", outcome: preflight.preflight.status });
  }

  const policyCases = [
    { scenario: "rights_hold_1", options: {}, overrides: { rightsReview: { status: "uncertain" } }, expected: "held_policy_review" },
    { scenario: "external_mark_block_1", options: { markStatus: "unknown" }, overrides: { assetPolicyReview: { visibleExternalMark: "present" } }, expected: "blocked" },
    { scenario: "exact_duplicate_alias_1", options: { exactDuplicates: ["cand_aaaaaaaaaaaaaaaaaaaaaaaa"] }, overrides: { leakageReview: { exactCanonicalDisposition: "alias_retained_non_gold" } }, expected: "retained_g3_negative_control" },
    { scenario: "perceptual_hold_1", options: { perceptualNeighbors: [{ candidateId: "cand_bbbbbbbbbbbbbbbbbbbbbbbb", hammingDistance: 4 }] }, overrides: { leakageReview: { perceptualDisposition: "uncertain", splitCouplingKeys: [] } }, expected: "held_policy_review" }
  ];
  for (const item of policyCases) {
    const stored = await make(item.options);
    const preflight = await preparePromotionPolicyReviewPreflight(await promotionInput(stored, item.overrides));
    check(preflight.ok && preflight.preflight.status === item.expected, "rehearsal_policy_case_failed", { scenario: item.scenario, errors: preflight.errors, status: preflight.preflight?.status });
    results.push({ scenario: item.scenario, status: "passed", outcome: item.expected });
  }

  {
    const stored = await make({ fixture: "D" });
    const confirmed = await confirmPromotion(await promotionInput(stored));
    check(confirmed.ok, "rehearsal_revocation_setup_failed", confirmed.errors);
    const revoked = await revokePromotion({
      dataRoot: stored.dataRoot,
      candidateId: stored.candidateManifest.candidateId,
      promotionKey: confirmed.activationEvent.promotionKey,
      gradeRecordDigest: confirmed.gradeRecord.gradeRecordDigest,
      reasonCodes: ["newer_evidence_requires_review"],
      predecessorEventDigest: confirmed.activationEvent.eventDigest,
      recordedAt: "2026-08-03T10:00:00.000Z"
    });
    const projection = revoked.ok ? projectPromotionStatus([confirmed.activationEvent, revoked.statusEvent]) : null;
    failures.push({ id: "current_g4_revocation_detected", status: revoked.ok && projection?.ok && projection.active === false ? "passed" : "failed", detail: revoked.errors?.[0]?.code || projection?.latestEvent?.event || null });
  }

  check(results.length === 18, "rehearsal_evidence_probe_count_invalid", results.length);
  return results;
}

async function runReportingDrill(dataRoot) {
  const bundle = await makeDerivedBundle({ dataRoot });
  check(bundle.rows.length === 20, "rehearsal_reporting_denominator_failed");
  const conditionCounts = bundle.rows.reduce((counts, row) => ({ ...counts, [row.conditionId]: (counts[row.conditionId] || 0) + 1 }), {});
  check(Object.values(conditionCounts).every((count) => count === 5), "rehearsal_reporting_condition_balance_failed", conditionCounts);
  return { rows: bundle.rows.length, conditionCounts, metricSetDigest: bundle.metricSet.metricSetDigest };
}

async function runDatasetDrill(dataRoot, failures) {
  const { snapshot, exposure } = createSourceSnapshot({ count: 5 });
  const graph = buildLeakageGraph(snapshot);
  check(graph.ok, "rehearsal_dataset_graph_failed", graph.errors);
  const plan = createDatasetSplitPlan({ sourceSnapshot: snapshot, leakageGraph: graph.graph, draft: splitPlanDraft(5), authoredAt: "2026-08-03T11:00:00.000Z" });
  check(plan.ok, "rehearsal_dataset_plan_failed", plan.errors);
  const assignment = assignLeakageComponents({ sourceSnapshot: snapshot, leakageGraph: graph.graph, splitPlan: plan.plan, exposureRegistry: exposure, assignedAt: "2026-08-03T11:10:00.000Z" });
  check(assignment.ok, "rehearsal_dataset_assignment_failed", assignment.errors);
  const review = finalizeDatasetLockReview({ sourceSnapshot: snapshot, leakageGraph: graph.graph, splitPlan: plan.plan, assignment: assignment.assignment, draft: approvedLockReviewDraft() });
  check(review.ok, "rehearsal_dataset_review_failed", review.errors);
  const artifacts = prepareDatasetLockArtifacts({ sourceSnapshot: snapshot, leakageGraph: graph.graph, splitPlan: plan.plan, assignment: assignment.assignment, lockReview: review.submission, exposureRegistry: exposure, lockedAt: "2026-08-03T11:20:00.000Z", activatedAt: "2026-08-03T11:30:00.000Z" });
  check(artifacts.ok, "rehearsal_dataset_artifacts_failed", artifacts.errors);
  const locked = await registerLockedDataset({ dataRoot, sourceSnapshot: snapshot, leakageGraph: graph.graph, splitPlan: plan.plan, assignment: assignment.assignment, lockReview: review.submission, artifacts });
  check(locked.ok && locked.state === "locked_incomplete", "rehearsal_dataset_lock_failed", locked.errors);
  const activated = await registerDatasetActivation({ dataRoot, artifacts });
  check(activated.ok && activated.state === "active", "rehearsal_dataset_activation_failed", activated.errors);
  const repeated = await registerDatasetActivation({ dataRoot, artifacts });
  failures.push({ id: "dataset_activation_idempotent", status: repeated.ok && repeated.state === "existing_active" ? "passed" : "failed", detail: repeated.state || repeated.errors?.[0]?.code || null });

  const tampered = JSON.parse(JSON.stringify(snapshot));
  tampered.members[0].canonicalSha256 = "f".repeat(64);
  failures.push({ id: "tampered_source_digest_rejected", status: verifyDatasetSourceSnapshotIntegrity(tampered) ? "failed" : "passed", detail: null });

  const coupled = createSourceSnapshot({ count: 5, coupledPairs: [[1, 2, "visual-group-rehearsal"]] });
  const coupledGraph = buildLeakageGraph(coupled.snapshot);
  const coupledPlan = createDatasetSplitPlan({ sourceSnapshot: coupled.snapshot, leakageGraph: coupledGraph.graph, draft: splitPlanDraft(5), authoredAt: "2026-08-03T12:00:00.000Z" });
  const coupledAssignment = assignLeakageComponents({ sourceSnapshot: coupled.snapshot, leakageGraph: coupledGraph.graph, splitPlan: coupledPlan.plan, exposureRegistry: coupled.exposure, assignedAt: "2026-08-03T12:10:00.000Z" });
  failures.push({ id: "leakage_component_split_rejected", status: coupledAssignment.ok ? "failed" : "passed", detail: coupledAssignment.errors?.[0]?.code || null });

  const unauthorized = await materializeHoldoutReferences({ dataRoot, datasetLineageId: artifacts.datasetVersion.datasetLineageId, datasetVersionId: artifacts.datasetVersion.datasetVersionId, request: {} });
  failures.push({ id: "holdout_without_authorization_rejected", status: unauthorized.ok ? "failed" : "passed", detail: unauthorized.errors?.[0]?.code || null });

  const retired = await appendDatasetVersionStatus({ dataRoot, datasetLineageId: artifacts.datasetVersion.datasetLineageId, datasetVersionId: artifacts.datasetVersion.datasetVersionId, event: "retired", reasonCodes: ["manual_retirement"], recordedAt: "2026-08-03T13:00:00.000Z" });
  check(retired.ok, "rehearsal_dataset_retire_failed", retired.errors);
  const second = await appendDatasetVersionStatus({ dataRoot, datasetLineageId: artifacts.datasetVersion.datasetLineageId, datasetVersionId: artifacts.datasetVersion.datasetVersionId, event: "invalidated", reasonCodes: ["leakage_conflict"], recordedAt: "2026-08-03T13:10:00.000Z" });
  failures.push({ id: "inactive_dataset_transition_rejected", status: second.ok ? "failed" : "passed", detail: second.errors?.[0]?.code || null });
  return { members: artifacts.members.length, g5Records: artifacts.g5Records.length };
}

export async function runFullRehearsal({ reportPath = null, sourceHeadSha = process.env.GITHUB_SHA || "local-source" } = {}) {
  const localRoot = path.resolve(process.cwd(), ".synthetic-local");
  const localBefore = await digestTree(localRoot);
  const mainRoot = await mkdtemp(path.join(os.tmpdir(), "bejewely-t10-rehearsal-"));
  const roots = new Set([mainRoot]);
  const failures = [];
  const modules = [];
  let networkAttempts = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    networkAttempts += 1;
    throw Object.assign(new Error("rehearsal_network_forbidden"), { code: "rehearsal_network_forbidden" });
  };

  let draft = null;
  let runError = null;
  try {
    const campaign = await runCampaignDrill(path.join(mainRoot, "campaign"), failures);
    modules.push({ id: "t7_campaign", status: "passed", detail: { runId: campaign.runId, terminalCounts: campaign.terminalOutcomeCounts } });
    const evidence = await runEvidenceDrill(roots, failures);
    modules.push({ id: "t3_t6_evidence_domains", status: "passed", detail: { probes: evidence.length, g4Mode: "prepared_only_except_revocation_probe" } });
    modules.push({ id: "t8_reporting", status: "passed", detail: await runReportingDrill(path.join(mainRoot, "reporting")) });
    const dataset = await runDatasetDrill(path.join(mainRoot, "dataset"), failures);
    modules.push({ id: "t9_dataset", status: "passed", detail: { members: dataset.members, temporaryG5Records: dataset.g5Records } });
    check(failures.length >= 10 && failures.every((item) => item.status === "passed"), "rehearsal_failure_matrix_failed", failures);
    check(await digestTree(localRoot) === localBefore, "rehearsal_local_boundary_changed_during_run");
    draft = { campaign, modules, failures, rootCount: roots.size };
  } catch (error) {
    runError = error;
  } finally {
    globalThis.fetch = originalFetch;
    for (const root of [...roots].sort((a, b) => b.length - a.length)) await rm(root, { recursive: true, force: true });
  }

  const deleted = (await Promise.all([...roots].map(async (root) => !(await exists(root))))).every(Boolean);
  const localUnchanged = await digestTree(localRoot) === localBefore;
  if (runError) throw runError;
  check(deleted, "rehearsal_cleanup_failed");
  check(localUnchanged, "rehearsal_local_boundary_changed");

  const report = finalizeRehearsalReport({
    sourceHeadSha,
    scenarioMatrixDigest: sha256(REHEARSAL_SCENARIO_MATRIX),
    slotsTotal: 20,
    conditionCounts: draft.campaign.conditionCounts,
    waveSchedule: [4, 8, 8],
    expectedTerminalCounts: EXPECTED_TERMINAL_COUNTS,
    actualTerminalCounts: draft.campaign.terminalOutcomeCounts,
    moduleResults: draft.modules,
    failureInjectionResults: draft.failures,
    providerCalls: 0,
    networkAttempts,
    productionWrites: 0,
    authoritativeHumanReviews: 0,
    persistentAuthoritativeG4Created: 0,
    persistentAuthoritativeG5Created: 0,
    temporaryRootsCreated: draft.rootCount,
    temporaryRootsDeleted: draft.rootCount,
    cleanupVerified: deleted,
    localDataBoundaryUnchanged: localUnchanged,
    completedAt: "2026-08-03T14:00:00.000Z"
  });
  check(verifyRehearsalReport(report), "rehearsal_report_invalid");
  if (reportPath) {
    const absolute = path.resolve(reportPath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, `${stableStringify(report)}\n`, "utf8");
  }
  return report;
}

function parseArgs(argv) {
  const result = { reportPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--report") result.reportPath = argv[++index] || null;
    else if (!["--full", "--failure-matrix"].includes(argv[index])) throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return result;
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  runFullRehearsal(parseArgs(process.argv.slice(2)))
    .then((value) => process.stdout.write(`${stableStringify(value)}\n`))
    .catch((error) => {
      process.stderr.write(`${stableStringify({ ok: false, code: error?.code || "rehearsal_failed", detail: error?.detail || null })}\n`);
      process.exitCode = 1;
    });
}
