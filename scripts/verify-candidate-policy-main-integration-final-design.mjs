import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const designPath = path.join(
  root,
  "docs/architecture/candidate-policy-main-integration-final-design-v1.md"
);
const auditPath = path.join(
  root,
  "docs/architecture/candidate-policy-main-integration-exhaustiveness-audit-v1.md"
);
const manifestPath = path.join(
  root,
  "docs/architecture/candidate-policy-main-integration-manifest-v1.json"
);
const ledgerPath = path.join(
  root,
  "docs/architecture/candidate-policy-main-integration-path-ledger-v1.json"
);

const design = fs.readFileSync(designPath, "utf8");
const audit = fs.readFileSync(auditPath, "utf8");
const manifestText = fs.readFileSync(manifestPath, "utf8");
const ledgerText = fs.readFileSync(ledgerPath, "utf8");
const manifest = JSON.parse(manifestText);
const ledger = JSON.parse(ledgerText);
const combinedDesign = `${design}\n${audit}`;

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
  manifest.status === "final_design_complete_exhaustive_path_ledger_verified",
  "design status must include exhaustive ledger verification"
);
check(
  manifest.additionalDesignStageRequired === false,
  "additional design stages must be prohibited"
);
check(
  manifest.strategy === "curated_tree_transplant",
  "curated tree transplant must be the integration strategy"
);
check(
  manifest.integration.baseSha ===
    "647051f7feff8e23dc7b563cb7b58ffcba7e6eaf",
  "current main authority must be frozen"
);
check(
  manifest.authorities.durableFinalSource.sha ===
    "ce882aa2057a06d39d86f99a09f4264725b4161b",
  "durable source SHA must be exact"
);
check(
  manifest.authoritativeTreeComparison.mergeBaseSha ===
    "a30970b78ff2fb3f5784d947b746223a66954e44",
  "merge base must be exact"
);
check(
  manifest.authorities.routeCleanup.sha ===
    "87e3c6b8028b50b84a8bff7f2fc43087b2b78a20",
  "cleanup source SHA must be exact"
);
check(
  manifest.authorities.temporaryRouteHistoryOnly.copyAuthority === false,
  "temporary route history must not be a copy authority"
);
check(manifest.integration.pullRequestCount === 1, "one implementation PR is required");
check(manifest.integration.mergeMethod === "squash", "squash merge is required");
check(
  manifest.integration.sequentialStackMergeAllowed === false,
  "sequential stacked merges must be prohibited"
);
check(
  manifest.integration.cherryPickChainAllowed === false,
  "cherry-pick chains must be prohibited"
);

const comparison = manifest.authoritativeTreeComparison;
check(comparison.status === "diverged", "tree authority must record divergence");
check(comparison.mainAheadBy === 521, "main ahead count must be exact");
check(comparison.sourceAheadBy === 263, "source ahead count must be exact");
check(comparison.treeDiffPathCount === 127, "tree diff path count must be exact");
check(
  comparison.ledgerPath ===
    "docs/architecture/candidate-policy-main-integration-path-ledger-v1.json",
  "ledger path must be exact"
);
check(
  comparison.ledgerVerifier ===
    "scripts/verify-candidate-policy-main-integration-path-ledger.mjs",
  "ledger verifier path must be exact"
);
check(comparison.dispositionCounts.include_exact === 62, "include_exact count must be 62");
check(comparison.dispositionCounts.merge_semantic === 6, "merge_semantic count must be 6");
check(comparison.dispositionCounts.exclude === 59, "exclude count must be 59");

check(ledger.compare.baseSha === manifest.integration.baseSha, "ledger base SHA mismatch");
check(
  ledger.compare.sourceSha === manifest.authorities.durableFinalSource.sha,
  "ledger source SHA mismatch"
);
check(
  ledger.compare.mergeBaseSha === comparison.mergeBaseSha,
  "ledger merge-base mismatch"
);
check(ledger.counts.total === 127, "ledger total must be 127");
check(ledger.counts.include_exact === 62, "ledger include_exact must be 62");
check(ledger.counts.merge_semantic === 6, "ledger merge_semantic must be 6");
check(ledger.counts.exclude === 59, "ledger exclude must be 59");
check(ledger.entries.length === 127, "ledger entry count must be 127");
check(new Set(ledger.entries.map((entry) => entry.path)).size === 127, "ledger paths must be unique");

const dispositions = new Set(manifest.dispositions);
check(dispositions.size === 3, "exactly three dispositions are required");
for (const disposition of ["include_exact", "merge_semantic", "exclude"]) {
  check(dispositions.has(disposition), `missing disposition: ${disposition}`);
}

const expectedExclusions = new Set([
  "app/api/internal/candidate-exposure-policy-diagnostic/route.js",
  "lib/candidate-exposure-policy-hosted-diagnostic-auth.js",
  "lib/candidate-exposure-policy-hosted-diagnostic-contract.js",
  "lib/candidate-exposure-policy-hosted-diagnostic-execution.js",
  "scripts/check-candidate-exposure-policy-hosted-diagnostic-route.mjs"
]);
const actualExclusions = new Set(manifest.requiredExactExclusions);
check(actualExclusions.size === expectedExclusions.size, "exclusion count must be exact");
for (const exclusion of expectedExclusions) {
  check(actualExclusions.has(exclusion), `missing exact exclusion: ${exclusion}`);
}

const semanticPaths = manifest.semanticMergePaths.map((entry) => entry.path).sort();
const expectedSemanticPaths = [
  "app/api/analyze/route.js",
  "lib/evaluator-boundary-policy-shadow.js",
  "package-lock.json",
  "package.json",
  "scripts/run-security-closeout-verifier-suite.mjs",
  "scripts/verify-evaluator-boundary-readiness-review.mjs"
].sort();
check(
  semanticPaths.length === expectedSemanticPaths.length &&
    semanticPaths.every((value, index) => value === expectedSemanticPaths[index]),
  "semantic merge paths must be exact"
);

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
check(closure.literalStaticImportsResolve, "static import closure must be required");
check(closure.literalDynamicImportsResolve, "dynamic import closure must be required");
check(closure.packageScriptTargetsResolve, "package script closure must be required");
check(closure.spawnedScriptTargetsResolve, "spawned script closure must be required");
check(closure.securityVerifierManifestFilesResolve, "security manifest closure must be required");
check(
  closure.includedOrSemanticPathMayNotDependOnExcludedSourceOnlyPath,
  "included paths must not depend on excluded source-only paths"
);

const gates = new Set(manifest.validationGates);
for (const gate of [
  "authoritative_tree_diff_equals_ledger_127_of_127",
  "all_source_paths_classified_once",
  "path_disposition_counts_62_6_59",
  "unknown_overlap_zero",
  "duplicate_path_zero",
  "include_exact_blob_parity",
  "exclude_exact_main_blob_or_absence_parity",
  "semantic_merge_expected_digest_match",
  "literal_import_closure_pass",
  "package_script_target_closure_pass",
  "security_manifest_file_closure_pass",
  "excluded_source_only_dependency_count_zero",
  "temporary_route_files_absent",
  "npm_audit_total_zero",
  "candidate_policy_focused_verifiers_pass",
  "security_closeout_expected_equals_executed_equals_passed",
  "current_main_regression_suite_pass",
  "exact_head_vercel_preview_ready",
  "production_alias_absent"
]) {
  check(gates.has(gate), `missing validation gate: ${gate}`);
}

for (const marker of [
  "FINAL_DESIGN_COMPLETE",
  "IMPLEMENT_IN_ONE_CURATED_PR",
  "stacked PR 순차 병합은 금지",
  "추가 설계 PR",
  "READY_FOR_SINGLE_PR_IMPLEMENTATION",
  "NO_ADDITIONAL_DESIGN_STAGE",
  "TREE_DIFF_127_OF_127_CLASSIFIED",
  "INCLUDE_EXACT_62",
  "MERGE_SEMANTIC_6",
  "EXCLUDE_59",
  "TRANSITIVE_CLOSURE_REQUIRED"
]) {
  check(combinedDesign.includes(marker), `missing design marker: ${marker}`);
}

check(!manifestText.includes("RESOLVE_"), "manifest must not contain unresolved placeholders");
check(!manifestText.includes("__CURRENT_MAIN_SHA__"), "manifest must not contain SHA placeholders");
check(!ledgerText.includes("RESOLVE_"), "ledger must not contain unresolved placeholders");
check(
  manifest.machineStatus ===
    "ready_for_single_pr_implementation_after_exhaustive_127_path_design_audit",
  "machine status must authorize direct implementation after exhaustive audit"
);

const ledgerVerifierOutput = execFileSync(
  process.execPath,
  ["scripts/verify-candidate-policy-main-integration-path-ledger.mjs"],
  {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  }
);
check(
  ledgerVerifierOutput.includes("127/127 paths"),
  "authoritative ledger verifier must pass"
);

console.log(
  `verify-candidate-policy-main-integration-final-design: ok (${assertions} assertions, exhaustive ledger PASS)`
);
