import assert from "node:assert/strict";
import test from "node:test";
import {
  compilePilotCampaignPlan,
  createPilotCampaignRun,
  verifyPilotCampaignPlanIntegrity,
  verifyPilotCampaignRunIntegrity,
  verifyPilotSlotIntegrity
} from "../../src/campaign/plan.js";
import { buildPilotSourceFreeze, verifyPilotSourceFreeze } from "../../src/campaign/source-freeze.js";
import { clone, makePlan, makeRun } from "./helpers.mjs";

test("T7 plan compiles the exact fixed 20-slot denominator policy", () => {
  const plan = makePlan();
  assert.equal(verifyPilotCampaignPlanIntegrity(plan), true);
  assert.equal(plan.objective.primarySlotCount, 20);
  assert.deepEqual(plan.matrix.map((row) => [row.conditionId, row.primarySlots, row.waveAllocation]), [
    ["A", 5, [1,2,2]],
    ["B", 5, [1,2,2]],
    ["C", 5, [1,2,2]],
    ["D", 5, [1,2,2]]
  ]);
  assert.equal(plan.outputPolicy.reportAuthority, "t8");
  assert.equal(plan.outputPolicy.splitAuthority, "t9");
});

test("plan identity excludes authoredAt but includes provider and policy freeze", () => {
  const one = makePlan({ authoredAt: "2026-08-02T10:00:00.000Z" });
  const two = makePlan({ authoredAt: "2026-08-03T10:00:00.000Z" });
  assert.equal(one.planDigest, two.planDigest);
  const otherProvider = makePlan({ providerProfileId: "gpt-image-manual-v1" });
  assert.notEqual(one.planDigest, otherProvider.planDigest);
});

test("source freeze covers fixtures, compiler, provider, observation, judgment, and promotion policies", () => {
  const built = buildPilotSourceFreeze("gemini-image-manual-v1");
  assert.equal(built.ok, true);
  const freeze = built.sourceFreeze;
  assert.equal(verifyPilotSourceFreeze(freeze), true);
  for (const field of [
    "compiledPromptSchemaVersion",
    "promptCompilerVersion",
    "providerProfileDigest",
    "providerTemplateVersion",
    "t3ImportPolicyVersion",
    "t4ObservationContractVersion",
    "t4AdapterProfileId",
    "t4AdapterProfileVersion",
    "t5JudgmentPolicyVersion",
    "t6PromotionPolicyId",
    "t6PromotionPolicyVersion"
  ]) assert.ok(freeze[field]);
  assert.deepEqual(Object.keys(freeze.fixtureObjectDigests), ["A","B","C","D"]);
  assert.deepEqual(Object.keys(freeze.finalizedSpecDigests), ["A","B","C","D"]);
});

test("source freeze drift fails closed even if outer digest is copied", () => {
  const plan = makePlan();
  const tampered = clone(plan);
  tampered.sourceFreeze.providerTemplateVersion = "changed-template";
  assert.equal(verifyPilotCampaignPlanIntegrity(tampered), false);
});

test("reference-only SDXL profile cannot become the primary pilot provider", () => {
  const result = compilePilotCampaignPlan({
    campaignId: "pilot",
    campaignVersion: "1",
    comparisonGroupId: null,
    providerProfileId: "sdxl-comfyui-reference-v1",
    authoredBy: "planner",
    authoredAt: "2026-08-02T10:00:00.000Z"
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "campaign_provider_profile_invalid");
});

test("run compiler creates exact A/B/C/D slot balance and 4/8/8 waves", () => {
  const plan = makePlan();
  const { run, slots } = makeRun(plan);
  assert.equal(verifyPilotCampaignRunIntegrity(run, plan), true);
  assert.equal(slots.length, 20);
  for (const condition of ["A","B","C","D"]) assert.equal(slots.filter((slot) => slot.conditionId === condition).length, 5);
  assert.deepEqual([1,2,3].map((wave) => slots.filter((slot) => slot.waveOrdinal === wave).length), [4,8,8]);
  assert.equal(slots.every((slot) => verifyPilotSlotIntegrity(slot, run, plan)), true);
});

test("run identity excludes startedAt and uses explicit nonce", () => {
  const plan = makePlan();
  const first = createPilotCampaignRun({ plan, runNonce: "nonce-1", startedBy: "operator", startedAt: "2026-08-02T10:00:00.000Z" });
  const second = createPilotCampaignRun({ plan, runNonce: "nonce-1", startedBy: "operator", startedAt: "2026-08-03T10:00:00.000Z" });
  const third = createPilotCampaignRun({ plan, runNonce: "nonce-2", startedBy: "operator", startedAt: "2026-08-03T10:00:00.000Z" });
  assert.equal(first.run.campaignRunId, second.run.campaignRunId);
  assert.notEqual(first.run.campaignRunId, third.run.campaignRunId);
});
