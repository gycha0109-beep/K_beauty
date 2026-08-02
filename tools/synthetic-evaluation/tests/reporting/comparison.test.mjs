import assert from "node:assert/strict";
import test from "node:test";
import { buildProviderComparisonKey, verifyProviderComparisonKey } from "../../src/reporting/comparison.js";
import { buildCampaignEvidenceSnapshot, deriveCampaignMetricSet, deriveCampaignSlotRows, verifyCampaignMetricSetIntegrity } from "../../src/reporting/derive.js";
import { sha256Hex, stableStringify } from "../../src/shared/canonical-json.js";
import { clone, makeFakeSource } from "./helpers.mjs";

test("provider-only variation passes the strict T8 comparison gate", async () => {
  const left = await makeFakeSource({ providerProfileId: "gemini-image-manual-v1", comparisonGroupId: "provider-pair-001", runNonce: "left-run" });
  const right = await makeFakeSource({ providerProfileId: "gpt-image-manual-v1", comparisonGroupId: "provider-pair-001", runNonce: "right-run" });
  const key = buildProviderComparisonKey(left, right);
  assert.equal(key.ok, true);
  assert.equal(verifyProviderComparisonKey(key.comparisonKey), true);

  const leftRows = deriveCampaignSlotRows(left);
  const rightRows = deriveCampaignSlotRows(right);
  const rows = [...leftRows.rows, ...rightRows.rows].sort((a, b) => `${a.campaignRunId}:${a.slotId}`.localeCompare(`${b.campaignRunId}:${b.slotId}`));
  const snapshot = buildCampaignEvidenceSnapshot({ sources: [left, right], rows, comparisonKey: key.comparisonKey, capturedAt: "2026-08-03T01:00:00.000Z" });
  assert.equal(snapshot.ok, true);
  const metrics = deriveCampaignMetricSet({ sourceSnapshot: snapshot.snapshot, rows });
  assert.equal(metrics.ok, true);
  assert.equal(metrics.metricSet.runCount, 2);
  assert.equal(metrics.metricSet.stageMetrics.issued_primary_slots.denominator, 40);
  assert.equal(metrics.metricSet.comparison.ranking, null);
  assert.equal(metrics.metricSet.comparison.significance, null);
  assert.equal(metrics.metricSet.comparison.causalAttribution, null);
  assert.equal(verifyCampaignMetricSetIntegrity(metrics.metricSet), true);

  const forged = clone(metrics.metricSet);
  forged.comparison.ranking = "provider_a";
  const { metricSetDigest, ...semantic } = forged;
  forged.metricSetDigest = sha256Hex(stableStringify(semantic));
  assert.equal(verifyCampaignMetricSetIntegrity(forged), false);
});

test("comparison rejects missing group, identical provider, and non-provider drift", async () => {
  const left = await makeFakeSource({ providerProfileId: "gemini-image-manual-v1", comparisonGroupId: "provider-pair-001", runNonce: "left-run" });
  const noGroup = await makeFakeSource({ providerProfileId: "gpt-image-manual-v1", comparisonGroupId: null, runNonce: "right-run" });
  assert.equal(buildProviderComparisonKey(left, noGroup).ok, false);

  const sameProvider = await makeFakeSource({ providerProfileId: "gemini-image-manual-v1", comparisonGroupId: "provider-pair-001", runNonce: "same-provider" });
  assert.equal(buildProviderComparisonKey(left, sameProvider).ok, false);

  const drifted = clone(await makeFakeSource({ providerProfileId: "gpt-image-manual-v1", comparisonGroupId: "provider-pair-001", runNonce: "drifted" }));
  drifted.plan.objective.questionId = "different-question";
  const result = buildProviderComparisonKey(left, drifted);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].detail, "non_provider_drift");
});
