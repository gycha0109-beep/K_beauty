import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const artifactRoot = path.resolve(process.env.EVAL_P5_ARTIFACT_ROOT || "artifacts/eval-p5");
const summaryPath = path.join(artifactRoot, "counterfactual-metamorphic-summary-v1.json");
const summary = JSON.parse(await readFile(summaryPath, "utf8"));

function invariant(condition, message, detail = null) {
  if (!condition) {
    const suffix = detail == null ? "" : `\n${JSON.stringify(detail, null, 2)}`;
    throw new Error(`${message}${suffix}`);
  }
}

invariant(summary.stage === "EVAL-P5", "unexpected summary stage");
invariant(summary.semantic_result === "SUCCESS", "cannot finalize a non-successful semantic evaluation");
invariant(summary.counts?.hard_violations === 0, "cannot finalize with hard metamorphic violations");
invariant(summary.acceptance?.all_relations_passed === true, "cannot finalize when a frozen relation failed");
invariant(
  summary.acceptance?.policy_fixture_projection_preserves_source_predicate_membership === true,
  "cannot finalize when policy fixture projection is not source-faithful"
);

const legacyProjectionGaps = summary.fixture_projection?.legacy_projection_gap_relations || [];
const absentPredicates = summary.fixture_projection?.source_predicate_absent_relations || [];

let terminalOutcome = "SUCCESS";
if (absentPredicates.length > 0) {
  terminalOutcome = "SUCCESS_WITH_FROZEN_FIXTURE_PRODUCT_PREDICATE_GAP";
} else if (legacyProjectionGaps.length > 0) {
  terminalOutcome = "SUCCESS_WITH_TYPED_LEGACY_FIXTURE_POLICY_METADATA_PROJECTION_GAP";
}

summary.terminal_outcome = terminalOutcome;
summary.frozen_fixture_coverage_gap = {
  classification: absentPredicates.length > 0
    ? "FROZEN_FIXTURE_PRODUCT_PREDICATE_COVERAGE_GAP"
    : "NONE",
  affected_relation_ids: absentPredicates,
  affected_relation_count: absentPredicates.length,
  meaning: absentPredicates.length > 0
    ? "The frozen 164-product historical fixture contains no product satisfying these frozen policy predicates; product-policy execution is therefore established by evaluator-only isolated probes, not by frozen-fixture target comparisons."
    : "All frozen product-policy predicates are represented in the frozen fixture.",
  p5_failure: false,
  product_fact_claim: false,
  production_catalog_claim: false,
  downstream_owner: "EVAL-P7_CATALOG_GAP_PRODUCT_GAP",
  authority: "DIAGNOSTIC_ONLY"
};
summary.acceptance.frozen_fixture_predicate_absence_typed_not_hidden = true;

await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

console.log(`EVAL-P5 terminal_outcome=${terminalOutcome}`);
console.log(`frozen_fixture_predicate_gap_relations=${absentPredicates.join(",") || "NONE"}`);
console.log(`legacy_fixture_projection_gap_relations=${legacyProjectionGaps.join(",") || "NONE"}`);
