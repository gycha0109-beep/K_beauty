import assert from "node:assert/strict";
import test from "node:test";
import {
  appendPilotCampaignEvent,
  createPilotCampaignEvent,
  validateCampaignEventLedger
} from "../../src/campaign/events.js";
import { derivePilotCampaignProjection } from "../../src/campaign/projection.js";
import { makeInitialEvent, makePlan, makeRun } from "./helpers.mjs";

const CANDIDATE_ID = `cand_${"a".repeat(24)}`;
const OBSERVATION_RUN_ID = `obs_${"b".repeat(24)}`;

function append(events, bundle, input) {
  const result = appendPilotCampaignEvent(events, input, {
    campaignRunId: bundle.run.campaignRunId,
    slotIds: bundle.slots.map((slot) => slot.slotId)
  });
  if (!result.ok) throw new Error(`append_failed:${result.errors[0]?.detail || result.errors[0]?.code}`);
  return result.events;
}

function baseBundle() {
  const plan = makePlan();
  const { run, slots } = makeRun(plan);
  const initial = makeInitialEvent(plan, run);
  return { plan, run, slots, events: [initial] };
}

function candidateRefs(digest = "4".repeat(64), candidateId = CANDIDATE_ID, canonicalSha = "c".repeat(64)) {
  return [
    { track: "T3", artifactType: "candidate-manifest", artifactDigest: digest },
    { track: "T7", artifactType: `candidate-id-${candidateId}`, artifactDigest: "d".repeat(64) },
    { track: "T7", artifactType: "canonical-image-sha", artifactDigest: canonicalSha }
  ];
}

function observationRefs({ runDigest = "5".repeat(64), objectDigest = "6".repeat(64), runId = OBSERVATION_RUN_ID } = {}) {
  const refs = [
    { track: "T4", artifactType: "observation-run", artifactDigest: runDigest },
    { track: "T7", artifactType: `observation-run-id-${runId}`, artifactDigest: "7".repeat(64) }
  ];
  if (objectDigest) refs.push({ track: "T4", artifactType: "observation-object", artifactDigest: objectDigest });
  return refs;
}

test("event ledger rejects branches and disconnected predecessors", () => {
  const bundle = baseBundle();
  const slot = bundle.slots[0];
  const root = createPilotCampaignEvent({
    campaignRunId: bundle.run.campaignRunId,
    slotId: slot.slotId,
    eventType: "generation_packet_issued",
    sourceRefs: [{ track: "T2", artifactType: "generation-work-packet", artifactDigest: "1".repeat(64) }],
    reasonCodes: [],
    recordedAt: "2026-08-02T12:00:00.000Z"
  }).event;
  const childA = createPilotCampaignEvent({
    campaignRunId: bundle.run.campaignRunId,
    slotId: slot.slotId,
    eventType: "generation_handoff_registered",
    sourceRefs: [{ track: "T7", artifactType: "generation-handoff", artifactDigest: "2".repeat(64) }],
    reasonCodes: ["provider_no_output"],
    predecessorEventDigest: root.eventDigest,
    recordedAt: "2026-08-02T12:01:00.000Z"
  }).event;
  const childB = createPilotCampaignEvent({
    campaignRunId: bundle.run.campaignRunId,
    slotId: slot.slotId,
    eventType: "generation_handoff_registered",
    sourceRefs: [{ track: "T7", artifactType: "generation-handoff", artifactDigest: "3".repeat(64) }],
    reasonCodes: ["provider_refusal_without_asset"],
    predecessorEventDigest: root.eventDigest,
    recordedAt: "2026-08-02T12:02:00.000Z"
  }).event;
  const branched = validateCampaignEventLedger([...bundle.events, root, childA, childB], { campaignRunId: bundle.run.campaignRunId, slotIds: bundle.slots.map((item) => item.slotId) });
  assert.equal(branched.ok, false);
  assert.equal(branched.errors[0].detail, "branch");

  const disconnected = createPilotCampaignEvent({
    campaignRunId: bundle.run.campaignRunId,
    slotId: slot.slotId,
    eventType: "generation_retry_reserved",
    sourceRefs: [{ track: "T7", artifactType: "retry-reservation", artifactDigest: "4".repeat(64) }],
    reasonCodes: ["generation_retry_reserved"],
    predecessorEventDigest: "f".repeat(64),
    recordedAt: "2026-08-02T12:03:00.000Z"
  }).event;
  assert.equal(validateCampaignEventLedger([...bundle.events, root, disconnected], { campaignRunId: bundle.run.campaignRunId, slotIds: bundle.slots.map((item) => item.slotId) }).ok, false);
});

test("registered candidate cannot be replaced and technical retry cannot follow asset-ready", () => {
  const bundle = baseBundle();
  const slot = bundle.slots[0];
  let events = bundle.events;
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "generation_packet_issued", sourceRefs: [{ track: "T2", artifactType: "generation-work-packet", artifactDigest: "1".repeat(64) }], reasonCodes: [] });
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "generation_handoff_registered", sourceRefs: [{ track: "T7", artifactType: "generation-handoff", artifactDigest: "2".repeat(64) }], reasonCodes: ["generation_asset_ready"] });
  const illegalRetry = appendPilotCampaignEvent(events, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "generation_retry_reserved", sourceRefs: [{ track: "T7", artifactType: "retry-reservation", artifactDigest: "3".repeat(64) }], reasonCodes: ["generation_retry_reserved"] }, { campaignRunId: bundle.run.campaignRunId, slotIds: bundle.slots.map((item) => item.slotId) });
  assert.equal(derivePilotCampaignProjection({ ...bundle, events: illegalRetry.events }).ok, false);

  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "candidate_registered", sourceRefs: candidateRefs(), reasonCodes: ["candidate_registered_to_slot"] });
  const second = appendPilotCampaignEvent(events, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "candidate_registered", sourceRefs: candidateRefs("8".repeat(64), `cand_${"e".repeat(24)}`, "f".repeat(64)), reasonCodes: ["candidate_registered_to_slot"] }, { campaignRunId: bundle.run.campaignRunId, slotIds: bundle.slots.map((item) => item.slotId) });
  assert.equal(derivePilotCampaignProjection({ ...bundle, events: second.events }).ok, false);
});

test("technical retry loop allows at most two packet attempts and terminal failure requires exhaustion", () => {
  const bundle = baseBundle();
  const slot = bundle.slots[0];
  let events = bundle.events;
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "generation_packet_issued", sourceRefs: [{ track: "T2", artifactType: "generation-work-packet", artifactDigest: "1".repeat(64) }], reasonCodes: [] });
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "generation_handoff_registered", sourceRefs: [{ track: "T7", artifactType: "generation-handoff", artifactDigest: "2".repeat(64) }], reasonCodes: ["provider_no_output"] });
  const prematureTerminal = appendPilotCampaignEvent(events, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "slot_terminal", sourceRefs: [{ track: "T7", artifactType: "terminal-outcome", artifactDigest: "9".repeat(64) }], reasonCodes: ["generation_failed_no_asset", "slot_terminal_recorded"] }, { campaignRunId: bundle.run.campaignRunId, slotIds: bundle.slots.map((item) => item.slotId) });
  assert.equal(derivePilotCampaignProjection({ ...bundle, events: prematureTerminal.events }).ok, false);

  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "generation_retry_reserved", sourceRefs: [{ track: "T7", artifactType: "retry-reservation", artifactDigest: "3".repeat(64) }], reasonCodes: ["generation_retry_reserved"] });
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "generation_packet_issued", sourceRefs: [{ track: "T2", artifactType: "generation-work-packet", artifactDigest: "4".repeat(64) }], reasonCodes: [] });
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "generation_handoff_registered", sourceRefs: [{ track: "T7", artifactType: "generation-handoff", artifactDigest: "5".repeat(64) }], reasonCodes: ["provider_no_output"] });
  const projection = derivePilotCampaignProjection({ ...bundle, events });
  assert.equal(projection.ok, true);
  const projectedSlot = projection.projection.slotProjections.find((item) => item.slotId === slot.slotId);
  assert.equal(projectedSlot.generationAttempts, 2);
  assert.equal(projectedSlot.generationRetries, 1);

  const thirdRetry = appendPilotCampaignEvent(events, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "generation_retry_reserved", sourceRefs: [{ track: "T7", artifactType: "retry-reservation", artifactDigest: "6".repeat(64) }], reasonCodes: ["generation_retry_reserved"] }, { campaignRunId: bundle.run.campaignRunId, slotIds: bundle.slots.map((item) => item.slotId) });
  assert.equal(derivePilotCampaignProjection({ ...bundle, events: thirdRetry.events }).ok, false);
});

test("valid ineligible observation remains a distinct terminal denominator", () => {
  const bundle = baseBundle();
  const slot = bundle.slots[0];
  let events = bundle.events;
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "generation_packet_issued", sourceRefs: [{ track: "T2", artifactType: "generation-work-packet", artifactDigest: "1".repeat(64) }], reasonCodes: [] });
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "generation_handoff_registered", sourceRefs: [{ track: "T7", artifactType: "generation-handoff", artifactDigest: "2".repeat(64) }], reasonCodes: ["generation_asset_ready"] });
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "candidate_registered", sourceRefs: candidateRefs(), reasonCodes: ["candidate_registered_to_slot"] });
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "observation_authorization_recorded", sourceRefs: [{ track: "T7", artifactType: "observation-authorization", artifactDigest: "4".repeat(64) }], reasonCodes: [] });
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "observation_registered", sourceRefs: observationRefs(), reasonCodes: ["observation_valid_ineligible"] });
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "slot_terminal", sourceRefs: [{ track: "T7", artifactType: "terminal-outcome", artifactDigest: "8".repeat(64) }], reasonCodes: ["observation_valid_ineligible", "slot_terminal_recorded"] });
  const projection = derivePilotCampaignProjection({ ...bundle, events });
  assert.equal(projection.ok, true);
  assert.equal(projection.projection.terminalOutcomeCounts.observation_valid_ineligible, 1);
  assert.equal(projection.projection.terminalOutcomeCounts.observation_failed, 0);
  assert.equal(projection.projection.denominators.authoritativeObservations, 1);
  assert.equal("successScore" in projection.projection, false);
  assert.equal("providerRank" in projection.projection, false);
});

test("technical T4 failure consumes recovery budget but cannot become authoritative", () => {
  const bundle = baseBundle();
  const slot = bundle.slots[0];
  let events = bundle.events;
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "generation_packet_issued", sourceRefs: [{ track: "T2", artifactType: "generation-work-packet", artifactDigest: "1".repeat(64) }], reasonCodes: [] });
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "generation_handoff_registered", sourceRefs: [{ track: "T7", artifactType: "generation-handoff", artifactDigest: "2".repeat(64) }], reasonCodes: ["generation_asset_ready"] });
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "candidate_registered", sourceRefs: candidateRefs(), reasonCodes: ["candidate_registered_to_slot"] });
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "observation_authorization_recorded", sourceRefs: [{ track: "T7", artifactType: "observation-authorization", artifactDigest: "4".repeat(64) }], reasonCodes: [] });
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "observation_registered", sourceRefs: observationRefs({ objectDigest: null }), reasonCodes: ["provider_transport_failure"] });
  let projection = derivePilotCampaignProjection({ ...bundle, events });
  assert.equal(projection.ok, true);
  assert.equal(projection.projection.denominators.authoritativeObservations, 0);
  assert.equal(projection.projection.budget.observationRunsUsed, 1);
  events = append(events, bundle, { campaignRunId: bundle.run.campaignRunId, slotId: slot.slotId, eventType: "observation_authorization_recorded", sourceRefs: [{ track: "T7", artifactType: "observation-authorization", artifactDigest: "9".repeat(64) }], reasonCodes: ["observation_recovery_reserved"] });
  projection = derivePilotCampaignProjection({ ...bundle, events });
  assert.equal(projection.ok, true);
  assert.equal(projection.projection.budget.observationRecoveryRunsUsed, 1);
});
