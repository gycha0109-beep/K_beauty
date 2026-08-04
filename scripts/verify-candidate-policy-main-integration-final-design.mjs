import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const manifest = JSON.parse(
  read("docs/architecture/candidate-policy-main-integration-manifest-v1.json")
);
const ledger = JSON.parse(
  read("docs/architecture/candidate-policy-main-integration-path-ledger-v1.json")
);
const designText = [
  read("docs/architecture/candidate-policy-main-integration-final-design-v1.md"),
  read("docs/architecture/candidate-policy-main-integration-exhaustiveness-audit-v1.md")
].join("\n");

let assertions = 0;
const check = (condition, message) => {
  assertions += 1;
  assert.ok(condition, message);
};

check(
  manifest.version === "candidate-policy-main-integration-manifest-v1",
  "manifest version must be exact"
);
check(
  manifest.status === "final_design_complete_exhaustive_408_path_ledger_verified",
  "manifest must record the exhaustive 408-path design"
);
check(manifest.additionalDesignStageRequired === false, "additional design stages must be prohibited");
check(manifest.strategy === "curated_tree_transplant", "integration strategy must be curated");
check(
  manifest.integration.baseSha === "647051f7feff8e23dc7b563cb7b58ffcba7e6eaf",
  "current-main SHA must be exact"
);
check(
  manifest.authorities.durableFinalSource.sha ===
    "ce882aa2057a06d39d86f99a09f4264725b4161b",
  "durable source SHA must be exact"
);
check(
  manifest.authoritativeTreeComparison.mergeBaseSha ===
    "a30970b78ff2fb3f5784d947b746223a66954e44",
  "merge-base SHA must be exact"
);
check(manifest.integration.pullRequestCount === 1, "exactly one implementation PR is required");
check(manifest.integration.mergeMethod === "squash", "expected-head squash is required");
check(manifest.integration.sequentialStackMergeAllowed === false, "stacked merge must be prohibited");
check(manifest.integration.cherryPickChainAllowed === false, "cherry-pick chain must be prohibited");

const comparison = manifest.authoritativeTreeComparison;
check(comparison.treeDiffPathCount === 408, "manifest tree-diff count must be 408");
check(comparison.gitStatusCounts.sourceOnlyA === 100, "manifest source-only count must be 100");
check(comparison.gitStatusCounts.mainOnlyD === 278, "manifest main-only count must be 278");
check(comparison.gitStatusCounts.modifiedM === 30, "manifest modified count must be 30");
check(comparison.dispositionCounts.includeExact === 62, "manifest include-exact count must be 62");
check(comparison.dispositionCounts.mergeSemantic === 6, "manifest semantic count must be 6");
check(comparison.dispositionCounts.excludeSourceOnly === 38, "manifest source-only exclusion count must be 38");
check(comparison.dispositionCounts.excludeMainPresent === 302, "manifest main-present exclusion count must be 302");
check(comparison.dispositionCounts.excludeTotal === 340, "manifest exclusion total must be 340");
check(comparison.dispositionCounts.total === 408, "manifest disposition total must be 408");

check(ledger.status === "exhaustive_tree_diff_408_classified", "ledger status must be exhaustive");
check(ledger.compare.baseSha === manifest.integration.baseSha, "ledger base SHA mismatch");
check(
  ledger.compare.sourceSha === manifest.authorities.durableFinalSource.sha,
  "ledger source SHA mismatch"
);
check(ledger.compare.mergeBaseSha === comparison.mergeBaseSha, "ledger merge-base mismatch");
check(ledger.counts.includeExact === 62, "ledger include-exact count must be 62");
check(ledger.counts.mergeSemantic === 6, "ledger semantic count must be 6");
check(ledger.counts.excludeSourceOnly === 38, "ledger source-only exclusion count must be 38");
check(ledger.counts.excludeMainPresent === 302, "ledger main-present exclusion count must be 302");
check(ledger.counts.excludeTotal === 340, "ledger exclusion total must be 340");
check(ledger.counts.total === 408, "ledger total must be 408");

const expectedSemanticPaths = [
  "app/api/analyze/route.js",
  "lib/evaluator-boundary-policy-shadow.js",
  "package-lock.json",
  "package.json",
  "scripts/run-security-closeout-verifier-suite.mjs",
  "scripts/verify-evaluator-boundary-readiness-review.mjs"
].sort();
check(
  [...manifest.semanticMergePaths].sort().every(
    (value, index) => value === expectedSemanticPaths[index]
  ),
  "manifest semantic path set drift"
);
check(
  Object.keys(ledger.semanticContracts).sort().every(
    (value, index) => value === expectedSemanticPaths[index]
  ),
  "ledger semantic contract set drift"
);

for (const relativePath of manifest.requiredImplementationArtifacts.slice(0, -2)) {
  check(fs.existsSync(path.join(root, relativePath)), `required design artifact missing: ${relativePath}`);
}

const invariants = manifest.runtimeInvariants;
check(invariants.candidateExposurePolicyContractPresent, "policy contract must remain present");
check(invariants.shadowRuntimePresent, "shadow runtime must remain present");
check(invariants.defaultEnabled === false, "runtime must remain default-off");
check(invariants.productionHardDisabled, "Production hard-disable must remain enabled");
check(invariants.runtimeFilterConnected === false, "runtime filtering must remain disconnected");
check(invariants.recommendationOutputChanged === false, "recommendation output must remain unchanged");
check(invariants.candidateOrderChanged === false, "candidate order must remain unchanged");
check(invariants.responseSchemaChanged === false, "response schema must remain unchanged");
check(invariants.storageSchemaChanged === false, "storage schema must remain unchanged");
check(invariants.databaseChanged === false, "database must remain unchanged");
check(invariants.productionChanged === false, "Production must remain unchanged");

const closure = manifest.closureRequirements;
for (const [key, value] of Object.entries(closure)) {
  check(value === true, `closure requirement must be enabled: ${key}`);
}

const gates = new Set(manifest.validationGates);
for (const gate of [
  "authoritative_tree_diff_equals_ledger_408_of_408",
  "git_status_counts_equal_100_278_30",
  "path_disposition_counts_equal_62_6_38_302",
  "all_source_paths_classified_once",
  "unknown_path_zero",
  "duplicate_path_zero",
  "include_exact_blob_parity_62_of_62",
  "exclude_source_only_absence_38_of_38",
  "exclude_main_present_blob_parity_302_of_302",
  "semantic_merge_contracts_6_of_6",
  "excluded_source_only_dependency_count_zero",
  "temporary_route_files_absent",
  "npm_audit_total_zero",
  "security_closeout_expected_equals_executed_equals_passed",
  "current_main_regression_suite_pass",
  "exact_head_vercel_preview_ready",
  "production_alias_absent"
]) {
  check(gates.has(gate), `missing validation gate: ${gate}`);
}

for (const marker of [
  "TREE_DIFF_408_OF_408_CLASSIFIED",
  "SOURCE_ONLY_100",
  "MAIN_ONLY_278",
  "MODIFIED_30",
  "INCLUDE_EXACT_62",
  "MERGE_SEMANTIC_6",
  "EXCLUDE_SOURCE_ONLY_38",
  "EXCLUDE_MAIN_PRESENT_302",
  "UNKNOWN_PATH_ZERO",
  "DUPLICATE_PATH_ZERO",
  "TRANSITIVE_CLOSURE_REQUIRED",
  "READY_FOR_SINGLE_PR_IMPLEMENTATION",
  "NO_ADDITIONAL_DESIGN_STAGE"
]) {
  check(designText.includes(marker), `missing design marker: ${marker}`);
}

check(
  manifest.machineStatus ===
    "ready_for_single_pr_implementation_after_exhaustive_408_path_design_audit",
  "machine status must authorize direct implementation"
);

const ledgerVerifierOutput = execFileSync(
  process.execPath,
  ["scripts/verify-candidate-policy-main-integration-path-ledger.mjs"],
  {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024
  }
);
check(ledgerVerifierOutput.includes("408/408 paths"), "authoritative path-ledger verifier must pass");

console.log(
  `verify-candidate-policy-main-integration-final-design: ok (${assertions} assertions, exhaustive 408-path ledger PASS)`
);
