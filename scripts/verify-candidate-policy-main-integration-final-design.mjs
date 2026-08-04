import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const designPath = path.join(
  root,
  "docs/architecture/candidate-policy-main-integration-final-design-v1.md"
);
const manifestPath = path.join(
  root,
  "docs/architecture/candidate-policy-main-integration-manifest-v1.json"
);

const design = fs.readFileSync(designPath, "utf8");
const manifestText = fs.readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestText);

let assertions = 0;
const check = (condition, message) => {
  assertions += 1;
  assert.ok(condition, message);
};

check(
  manifest.version === "candidate-policy-main-integration-manifest-v1",
  "manifest version must be exact"
);
check(manifest.status === "final_design_complete", "design must be final");
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

const semanticPaths = new Set(
  manifest.semanticMergePaths
    .map((entry) => entry.path)
    .filter((value) => typeof value === "string")
);
for (const requiredPath of [
  "app/api/analyze/route.js",
  "package.json",
  "package-lock.json",
  "scripts/run-security-closeout-verifier-suite.mjs"
]) {
  check(semanticPaths.has(requiredPath), `missing semantic merge path: ${requiredPath}`);
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

const gates = new Set(manifest.validationGates);
for (const gate of [
  "all_source_paths_classified_once",
  "unknown_overlap_zero",
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
  "TEMPORARY_DIAGNOSTIC_ROUTE_ABSENT",
  "DEPENDENCY_AUDIT_ZERO",
  "RUNTIME_DEFAULT_OFF",
  "PRODUCTION_HARD_DISABLED"
]) {
  check(design.includes(marker), `missing design marker: ${marker}`);
}

check(!manifestText.includes("RESOLVE_"), "manifest must not contain unresolved placeholders");
check(!manifestText.includes("__CURRENT_MAIN_SHA__"), "manifest must not contain SHA placeholders");
check(
  manifest.machineStatus === "ready_for_single_pr_implementation",
  "machine status must authorize direct implementation"
);

console.log(
  `verify-candidate-policy-main-integration-final-design: ok (${assertions} assertions)`
);
