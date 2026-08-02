import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { appendPilotCampaignEvent } from "../../src/campaign/events.js";
import { derivePilotCampaignProjection } from "../../src/campaign/projection.js";
import { createPilotCampaignCloseout } from "../../src/campaign/closeout.js";
import {
  campaignProjectionRelativePath,
  nativePath,
  saveCampaignEvent,
  saveCloseout,
  saveCompiledCampaign,
  saveProjection
} from "../../src/campaign/storage.js";
import { preflightCampaignReportSource } from "../../src/reporting/source-preflight.js";
import { makeInitialEvent, makePlan, makeRun } from "../campaign/helpers.mjs";

async function createClosedTechnicalCampaign() {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "t8-source-"));
  const plan = makePlan();
  const runResult = makeRun(plan, { runNonce: "t8-source-run" });
  const run = runResult.run;
  const slots = runResult.slots;
  const initial = makeInitialEvent(plan, run);
  await saveCompiledCampaign({ dataRoot, plan, run, slots, initialEvent: initial });
  let events = [initial];
  const context = { campaignRunId: run.campaignRunId, slotIds: slots.map((slot) => slot.slotId) };
  for (let index = 0; index < slots.length; index += 1) {
    const appended = appendPilotCampaignEvent(events, {
      campaignRunId: run.campaignRunId,
      slotId: slots[index].slotId,
      eventType: "slot_terminal",
      sourceRefs: [],
      reasonCodes: ["cancelled_operator"],
      recordedAt: new Date(Date.parse("2026-08-03T01:00:00.000Z") + index * 1000).toISOString()
    }, context);
    assert.equal(appended.ok, true);
    events = [...appended.events];
    await saveCampaignEvent(dataRoot, appended.event);
  }
  const closed = appendPilotCampaignEvent(events, {
    campaignRunId: run.campaignRunId,
    slotId: null,
    eventType: "run_closed",
    sourceRefs: [],
    reasonCodes: ["campaign_closed_complete"],
    recordedAt: "2026-08-03T02:00:00.000Z"
  }, context);
  assert.equal(closed.ok, true);
  events = [...closed.events];
  await saveCampaignEvent(dataRoot, closed.event);
  const projected = derivePilotCampaignProjection({ plan, run, slots, events });
  assert.equal(projected.ok, true);
  assert.equal(projected.projection.denominators.terminalSlots, 20);
  assert.equal(projected.projection.runStatus, "closed");
  await saveProjection(dataRoot, projected.projection);
  const closeoutResult = createPilotCampaignCloseout({ plan, run, projection: projected.projection, ledger: projected.ledger, checkpointApprovals: [], closedBy: "campaign_operator", closedAt: "2026-08-03T02:00:00.000Z" });
  assert.equal(closeoutResult.ok, true);
  await saveCloseout(dataRoot, closeoutResult.closeout);
  return { dataRoot, plan, run, projection: projected.projection, closeout: closeoutResult.closeout };
}

test("T8 source preflight accepts a complete technical closeout without inventing T3-T6 evidence", async () => {
  const value = await createClosedTechnicalCampaign();
  const result = await preflightCampaignReportSource({ dataRoot: value.dataRoot, campaignRunId: value.run.campaignRunId, closeoutDigest: value.closeout.closeoutDigest });
  assert.equal(result.ok, true);
  assert.equal(result.source.slotEvidence.length, 20);
  assert.equal(result.source.slotEvidence.every((item) => item.projection.terminalOutcome === "cancelled_operator"), true);
  assert.equal(result.source.artifactIndex.some((entry) => entry.track === "T3"), false);
  assert.equal(result.source.artifactIndex.some((entry) => entry.track === "T4"), false);
  assert.equal(result.source.artifactIndex.some((entry) => entry.track === "T5"), false);
  assert.equal(result.source.artifactIndex.some((entry) => entry.track === "T6"), false);
});

test("T8 source preflight rejects a stored projection that no longer matches the closeout", async () => {
  const value = await createClosedTechnicalCampaign();
  const tampered = JSON.parse(JSON.stringify(value.projection));
  tampered.denominators.terminalSlots = 19;
  await writeFile(nativePath(value.dataRoot, campaignProjectionRelativePath(value.run.campaignRunId, value.projection.projectionDigest)), `${JSON.stringify(tampered)}\n`, "utf8");
  const result = await preflightCampaignReportSource({ dataRoot: value.dataRoot, campaignRunId: value.run.campaignRunId, closeoutDigest: value.closeout.closeoutDigest });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "closeout_projection_mismatch");
});
