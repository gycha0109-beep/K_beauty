import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const baselineRoot = path.resolve(process.env.EVAL_P6_BASELINE_ARTIFACT_ROOT || "artifacts/eval-p6/baseline");
const candidateRoot = path.resolve(process.env.EVAL_P6_CANDIDATE_ARTIFACT_ROOT || "artifacts/eval-p6/candidate");
const outputRoot = path.resolve(process.env.EVAL_P6_COMPARISON_ARTIFACT_ROOT || "artifacts/eval-p6/comparison");
const expectZeroDelta = process.env.EVAL_P6_EXPECT_ZERO_DELTA === "1";
const readJson = (filePath) => readFile(filePath, "utf8").then(JSON.parse);

const [baselineSummary, candidateSummary, baselineSnapshots, candidateSnapshots] = await Promise.all([
  readJson(path.join(baselineRoot, "eval-p6-run-summary-v1.json")),
  readJson(path.join(candidateRoot, "eval-p6-run-summary-v1.json")),
  readJson(path.join(baselineRoot, "eval-p6-persona-snapshots-v1.json")),
  readJson(path.join(candidateRoot, "eval-p6-persona-snapshots-v1.json"))
]);

for (const summary of [baselineSummary, candidateSummary]) {
  assert.equal(summary.schema_version, "eval-p6-persona-regression-run-summary-v1");
  assert.equal(summary.stage, "EVAL-P6");
  assert.equal(summary.persona_count, 37);
  assert.equal(summary.harness_equivalence_count, 37);
  assert.equal(summary.authority_ceiling.evidence_class, "SYNTHETIC_SIMULATION_EVIDENCE");
  assert.equal(summary.authority_ceiling.enforce_authority, false);
}
assert.equal(baselineSummary.run_role, "BASELINE");
assert.equal(candidateSummary.run_role, "CANDIDATE");
assert.notEqual(baselineSummary.engine_sha, "UNSPECIFIED_ENGINE_SHA");
assert.notEqual(candidateSummary.engine_sha, "UNSPECIFIED_ENGINE_SHA");
assert.equal(baselineSnapshots.cohort_id, candidateSnapshots.cohort_id);
assert.equal(baselineSnapshots.cohort_hash, candidateSnapshots.cohort_hash);
assert.equal(baselineSnapshots.persona_snapshots.length, 37);
assert.equal(candidateSnapshots.persona_snapshots.length, 37);
assert.deepEqual(baselineSummary.deterministic_context, candidateSummary.deterministic_context, "non-engine deterministic comparison context must match");

const baselineById = new Map(baselineSnapshots.persona_snapshots.map((item) => [item.persona_id, item]));
const candidateById = new Map(candidateSnapshots.persona_snapshots.map((item) => [item.persona_id, item]));
assert.deepEqual([...baselineById.keys()], [...candidateById.keys()], "locked persona order and membership");

const componentKeys = ["projection_hash", "response_hash", "ranking_hash", "score_hash", "explanation_hash", "candidate_policy_fingerprint", "survey_derived_hash"];
const changedPersonas = [];
const componentDeltaCounts = Object.fromEntries([
  ...componentKeys.map((key) => `domain_core.${key}`),
  ...componentKeys.map((key) => `contract_integration.${key}`),
  "persona_regression_hash"
].map((key) => [key, 0]));

for (const [personaId, baseline] of baselineById) {
  const candidate = candidateById.get(personaId);
  assert(candidate, `${personaId}: candidate snapshot`);
  assert.equal(candidate.source_cohort_type, baseline.source_cohort_type);
  assert.equal(candidate.source_persona_hash, baseline.source_persona_hash);
  assert.equal(candidate.domain_hash, baseline.domain_hash);
  assert.equal(candidate.harness_equivalence, true);
  assert.equal(baseline.harness_equivalence, true);
  const changedComponents = [];
  for (const harness of ["domain_core", "contract_integration"]) {
    for (const key of componentKeys) {
      if (baseline[harness][key] !== candidate[harness][key]) {
        const component = `${harness}.${key}`;
        changedComponents.push(component);
        componentDeltaCounts[component] += 1;
      }
    }
  }
  if (baseline.persona_regression_hash !== candidate.persona_regression_hash) {
    changedComponents.push("persona_regression_hash");
    componentDeltaCounts.persona_regression_hash += 1;
  }
  if (changedComponents.length > 0) {
    changedPersonas.push({
      persona_id: personaId,
      source_cohort_type: baseline.source_cohort_type,
      changed_components: changedComponents,
      baseline_top_ranked_ids: baseline.domain_core.top_ranked_ids,
      candidate_top_ranked_ids: candidate.domain_core.top_ranked_ids
    });
  }
}

const engineFileDeltas = Object.fromEntries(Object.keys(baselineSummary.engine_file_hashes).sort((a, b) => a.localeCompare(b, "en")).map((key) => [key, {
  baseline: baselineSummary.engine_file_hashes[key],
  candidate: candidateSummary.engine_file_hashes[key],
  changed: baselineSummary.engine_file_hashes[key] !== candidateSummary.engine_file_hashes[key]
}]));

const report = {
  schema_version: "eval-p6-persona-regression-delta-report-v1",
  stage: "EVAL-P6",
  comparator_version: "eval-p6-persona-regression-comparator-v1",
  cohort_id: baselineSnapshots.cohort_id,
  cohort_hash: baselineSnapshots.cohort_hash,
  persona_count: 37,
  baseline_engine_sha: baselineSummary.engine_sha,
  candidate_engine_sha: candidateSummary.engine_sha,
  deterministic_context_hash: baselineSummary.deterministic_context_hash,
  baseline_output_semantic_hash: baselineSummary.output_semantic_hash,
  candidate_output_semantic_hash: candidateSummary.output_semantic_hash,
  changed_persona_count: changedPersonas.length,
  unchanged_persona_count: 37 - changedPersonas.length,
  component_delta_counts: componentDeltaCounts,
  engine_file_deltas: engineFileDeltas,
  changed_personas: changedPersonas,
  terminal_classification: changedPersonas.length === 0 ? "NO_SEMANTIC_DELTA" : "SEMANTIC_DELTA_REQUIRES_EXPLICIT_REVIEW",
  automatic_quality_direction_inference: "FORBIDDEN",
  cross_cohort_raw_rate_comparison: "FORBIDDEN",
  evidence_class: "SYNTHETIC_SIMULATION_EVIDENCE",
  enforce_authority: "NONE"
};

if (expectZeroDelta) {
  assert.equal(report.changed_persona_count, 0, "P6 baseline establishment requires zero semantic delta");
  assert.equal(report.baseline_output_semantic_hash, report.candidate_output_semantic_hash, "P6 baseline establishment output semantic hash");
  for (const [key, value] of Object.entries(engineFileDeltas)) assert.equal(value.changed, false, `${key}: no Production engine file delta`);
}

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "eval-p6-regression-delta-report-v1.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`EVAL-P6 regression compare PASS baseline=${baselineSummary.engine_sha} candidate=${candidateSummary.engine_sha} changed=${changedPersonas.length} classification=${report.terminal_classification}`);
