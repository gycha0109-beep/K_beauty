import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCampaignEvidenceSnapshot,
  deriveCampaignMetricSet,
  deriveCampaignSlotRows,
  verifyCampaignEvidenceSnapshotIntegrity,
  verifyCampaignMetricSetIntegrity,
  verifyCampaignSlotRowIntegrity
} from "../../src/reporting/derive.js";
import { clone, makeDerivedBundle, makeFakeSource } from "./helpers.mjs";

test("T8 derives exactly 20 rows with five slots per condition and preserves every terminal", async () => {
  const bundle = await makeDerivedBundle();
  assert.equal(bundle.rows.length, 20);
  for (const condition of ["A", "B", "C", "D"]) assert.equal(bundle.rows.filter((row) => row.conditionId === condition).length, 5);
  assert.equal(bundle.rows.every(verifyCampaignSlotRowIntegrity), true);
  assert.equal(Object.values(bundle.metricSet.terminalOutcomes).reduce((sum, count) => sum + count, 0), 20);
  assert.equal(Object.keys(bundle.metricSet.terminalOutcomes).length, 12);
  assert.equal(bundle.metricSet.stageMetrics.issued_primary_slots.denominator, 20);
  assert.equal(bundle.metricSet.conditionSummaries.every((summary) => summary.denominator === 5), true);
  assert.equal(verifyCampaignMetricSetIntegrity(bundle.metricSet), true);
});

test("snapshot identity excludes capturedAt but binds rows and artifact index", async () => {
  const source = await makeFakeSource();
  const rows = deriveCampaignSlotRows(source);
  assert.equal(rows.ok, true);
  const first = buildCampaignEvidenceSnapshot({ sources: [source], rows: rows.rows, capturedAt: "2026-08-03T00:10:00.000Z" });
  const second = buildCampaignEvidenceSnapshot({ sources: [source], rows: rows.rows, capturedAt: "2026-08-04T00:10:00.000Z" });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.snapshot.sourceSnapshotDigest, second.snapshot.sourceSnapshotDigest);
  assert.equal(verifyCampaignEvidenceSnapshotIntegrity(first.snapshot), true);

  const changedRows = clone(rows.rows);
  changedRows[0].warnings = ["different_warning"];
  changedRows[0].rowDigest = "f".repeat(64);
  const changed = buildCampaignEvidenceSnapshot({ sources: [source], rows: changedRows, capturedAt: "2026-08-03T00:10:00.000Z" });
  assert.equal(changed.ok, true);
  assert.notEqual(changed.snapshot.sourceSnapshotDigest, first.snapshot.sourceSnapshotDigest);
});

test("row and metric tampering fail integrity checks even with valid outer shape", async () => {
  const bundle = await makeDerivedBundle();
  const row = clone(bundle.rows.find((item) => item.promotion.terminalOutcome === "promoted_g4"));
  row.promotion.g4StatusAsOfCloseout = null;
  assert.equal(verifyCampaignSlotRowIntegrity(row), false);

  const metric = clone(bundle.metricSet);
  metric.terminalOutcomes.promoted_g4 += 1;
  assert.equal(verifyCampaignMetricSetIntegrity(metric), false);
});

test("metric derivation rejects filtered views that alter the primary denominator", async () => {
  const bundle = await makeDerivedBundle();
  const result = deriveCampaignMetricSet({ sourceSnapshot: bundle.sourceSnapshot, rows: bundle.rows.slice(1) });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "report_denominator_invalid");
});
