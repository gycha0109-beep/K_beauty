import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { validateLocalShadowRecommendationEvidence } from "../lib/shadow-boundary-dry-run-artifact-writer.js";
import { validateShadowDryRunSnapshot } from "../lib/shadow-dry-run-snapshot-contract.js";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "isolated-shadow-route-comparison.json");
const ROUTE_RUNS_ROOT = path.join(ROOT, "tmp", "isolated-shadow-route-runs");
const FORBIDDEN_FIELDS = new Set([
  "name", "brand", "purchaseurl", "url", "buylink", "price", "pricemin", "pricemax", "pricerange",
  "review", "reviewtext", "form", "rawform", "image", "imageurl", "base64", "pii", "secret", "token", "apikey", "responsebody"
]);
const ALLOWED_VERDICTS = new Set([
  "controlled_shadow_route_comparison_passed",
  "blocked_local_environment_setup",
  "blocked_test_server_start",
  "blocked_flag_off_route_execution",
  "blocked_flag_on_route_execution",
  "blocked_external_provider_isolation",
  "blocked_hosted_supabase_isolation",
  "blocked_response_contract_divergence",
  "blocked_unexpected_database_mutation",
  "blocked_unexpected_storage_mutation",
  "blocked_mutation_observer_incomplete",
  "blocked_cleanup_failure",
  "blocked_evidence_incomplete"
]);

function sameOrdered(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isWithinDirectory(candidate, directory) {
  const relative = path.relative(directory, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertNoForbiddenEvidence(value, currentPath = "") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenEvidence(entry, `${currentPath}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    assert(!FORBIDDEN_FIELDS.has(normalized), `forbidden evidence field: ${currentPath}.${key}`);
    assertNoForbiddenEvidence(child, currentPath ? `${currentPath}.${key}` : key);
  }
}

function assertResponseContract(contract) {
  const validation = validateShadowDryRunSnapshot(contract);
  assert.equal(validation.valid, true, validation.errors.map((error) => error.code).join(", "));
  assert.equal(contract.snapshotType, "baselineResponseShapeSnapshot");
  assert.equal(contract.valueDumped, false);
}

function assertHttpFailureConsistency(output) {
  const flagOffFailed = output.flagOff.httpStatus === 503;
  const flagOnFailed = output.flagOn.httpStatus === 503;

  for (const condition of [output.flagOff, output.flagOn]) {
    if (condition.httpStatus !== 503) continue;
    assert.equal(condition.completed, false);
    assert.equal(condition.reasonCode, "route_http_503");
    assert.deepEqual(
      Object.keys(condition.routeDiagnostic || {}).sort(),
      Object.keys(condition.routeDiagnostic || {}).filter((key) => ["status", "error", "code", "reasonCode"].includes(key)).sort(),
      "route diagnostic contains a non-allowlisted field"
    );
    assert.equal(condition.routeDiagnostic?.status, 503);
    assert(condition.serverStderr === null || typeof condition.serverStderr === "string");
    assert((condition.serverStderr?.length || 0) <= 1_500);
  }

  if (flagOffFailed) assert.equal(output.verdict, "blocked_flag_off_route_execution");
  if (!flagOffFailed && flagOnFailed) assert.equal(output.verdict, "blocked_flag_on_route_execution");
}

function responseShapeChanged(flagOff, flagOn) {
  assertResponseContract(flagOff.responseContract);
  assertResponseContract(flagOn.responseContract);
  return flagOff.httpStatus !== flagOn.httpStatus ||
    flagOff.responseContract.responseShapeHash !== flagOn.responseContract.responseShapeHash ||
    !sameOrdered(flagOff.responseContract.topLevelKeys, flagOn.responseContract.topLevelKeys);
}

function assertRecommendationEvidence(flagOff, flagOn) {
  const off = flagOff.recommendationEvidence;
  const on = flagOn.recommendationEvidence;
  assert(off && on, "recommendation evidence is missing");
  assert.equal(off.comparisonRunId, on.comparisonRunId);
  assert.equal(validateLocalShadowRecommendationEvidence(off, { comparisonRunId: off.comparisonRunId, condition: "off" }).valid, true);
  assert.equal(validateLocalShadowRecommendationEvidence(on, { comparisonRunId: off.comparisonRunId, condition: "on" }).valid, true);

  for (const [metadata, expectedFileCount] of [
    [flagOff.recommendationEvidenceMetadata, 1],
    [flagOn.recommendationEvidenceMetadata, 2]
  ]) {
    assert(metadata && typeof metadata === "object", "recommendation evidence metadata is missing");
    const directory = path.resolve(ROOT, metadata.directory);
    assert(isWithinDirectory(directory, ROUTE_RUNS_ROOT), "recommendation evidence path escapes local run root");
    assert(directory.endsWith(path.join("route-comparison", off.comparisonRunId)));
    assert.equal(metadata.expectedFileCount, expectedFileCount);
    assert.equal(metadata.observedFileCount, expectedFileCount);
    assert.deepEqual(metadata.residualFiles, []);
  }

  return off.topPickId !== on.topPickId ||
    !sameOrdered(off.supportingProductIdsInOrder, on.supportingProductIdsInOrder) ||
    !sameOrdered(off.budgetAlternativeIdsInOrder, on.budgetAlternativeIdsInOrder);
}

assert(existsSync(OUTPUT_PATH), "controlled comparison evidence is missing");
const output = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
assert.equal(output.evidenceType, "isolated_shadow_route_controlled_run");
assert(ALLOWED_VERDICTS.has(output.verdict));
assert.equal(output.secretsPrinted, false);
assert.equal(output.hostedSupabaseAccessCount, 0);
assert.equal(output.externalProviderInvocationCount, 0);
assert.equal(output.runtimeConnected, false);
assert.equal(output.evaluatorConnected, false);
assert.equal(output.candidatePolicyConnected, false);
assert(output.cleanup && typeof output.cleanup.succeeded === "boolean");
assert(output.mutationObserverCoverage && typeof output.mutationObserverCoverage.complete === "boolean");
assertNoForbiddenEvidence(output);

for (const condition of [output.flagOff, output.flagOn]) {
  assert(condition && Number.isInteger(condition.routeInvocationCount));
  assert(condition.routeInvocationCount >= 0 && condition.routeInvocationCount <= 1);
  assert.equal(condition.providerEvidence?.externalProviderInvocationCount, 0);
}
assertHttpFailureConsistency(output);

if (output.flagOff.completed && output.flagOn.completed) {
  const expectedResponseChange = responseShapeChanged(output.flagOff, output.flagOn);
  const expectedRecommendationChange = assertRecommendationEvidence(output.flagOff, output.flagOn);
  assert.equal(output.responseShapeChanged, expectedResponseChange);
  assert.equal(output.recommendationChanged, expectedRecommendationChange);
  assert.equal(output.mutationComparison.responseShapeChanged, expectedResponseChange);
  assert.equal(output.mutationComparison.recommendationChanged, expectedRecommendationChange);
  assert.equal(output.mutationComparison.completeRecommendationComparison, true);
}

if (output.verdict === "controlled_shadow_route_comparison_passed") {
  assert.equal(output.flagOff.routeInvocationCount, 1);
  assert.equal(output.flagOn.routeInvocationCount, 1);
  assert.equal(output.flagOff.providerEvidence.providerStubbed, true);
  assert.equal(output.flagOn.providerEvidence.providerStubbed, true);
  assert.equal(output.responseShapeChanged, false);
  assert.equal(output.recommendationChanged, false);
  assert.equal(output.mutationObserverCoverage.complete, true);
  assert.equal(output.cleanup.succeeded, true);
  assert(output.mutationComparison.databaseMutationClassification.every((event) => event.classification !== "unexpected_mutation"));
  assert(output.mutationComparison.tableMutationClassification.every((event) => event.classification !== "unexpected_mutation"));
  assert.notEqual(output.mutationComparison.storageMutationClassification.classification, "unexpected_mutation");
}

console.log("verify-isolated-shadow-route-comparison passed");
