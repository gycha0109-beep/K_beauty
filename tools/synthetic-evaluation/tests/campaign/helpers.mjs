import {
  compilePilotCampaignPlan,
  createPilotCampaignRun
} from "../../src/campaign/plan.js";
import { createPilotCampaignEvent } from "../../src/campaign/events.js";

export function makePlan(overrides = {}) {
  const result = compilePilotCampaignPlan({
    campaignId: "skin-control-pilot-001",
    campaignVersion: "1.0.0",
    comparisonGroupId: null,
    providerProfileId: "gemini-image-manual-v1",
    authoredBy: "campaign_planner",
    authoredAt: "2026-08-02T10:00:00.000Z",
    ...overrides
  });
  if (!result.ok) throw new Error(`plan_failed:${result.errors?.[0]?.code}`);
  return result.plan;
}

export function makeRun(plan = makePlan(), overrides = {}) {
  const result = createPilotCampaignRun({
    plan,
    runNonce: "run-alpha-001",
    startedBy: "campaign_operator",
    startedAt: "2026-08-02T10:10:00.000Z",
    ...overrides
  });
  if (!result.ok) throw new Error(`run_failed:${result.errors?.[0]?.code}`);
  return result;
}

export function makeInitialEvent(plan, run) {
  const result = createPilotCampaignEvent({
    campaignRunId: run.campaignRunId,
    eventType: "run_started",
    sourceRefs: [
      { track: "T7", artifactType: "campaign-plan", artifactDigest: plan.planDigest },
      { track: "T7", artifactType: "campaign-run", artifactDigest: run.runIdentityDigest }
    ],
    reasonCodes: ["campaign_plan_valid", "campaign_source_freeze_valid"],
    recordedAt: "2026-08-02T10:10:00.000Z"
  });
  if (!result.ok) throw new Error("event_failed");
  return result.event;
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
