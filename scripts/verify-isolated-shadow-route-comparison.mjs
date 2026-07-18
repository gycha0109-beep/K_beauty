import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  validateLocalActualRuntimeEvidence,
  validateLocalShadowPolicyEvidence,
  validateLocalShadowRecommendationEvidence
} from "../lib/shadow-boundary-dry-run-artifact-writer.js";
import { validateShadowDryRunSnapshot } from "../lib/shadow-dry-run-snapshot-contract.js";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "isolated-shadow-route-comparison.json");
const DURABLE_EVIDENCE_ROOT = path.join(ROOT, "tmp", "isolated-shadow-route-comparison-evidence");
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

  for (const metadata of [
    flagOff.recommendationEvidenceMetadata,
    flagOn.recommendationEvidenceMetadata
  ]) {
    assert(metadata && typeof metadata === "object", "recommendation evidence metadata is missing");
    const directory = path.resolve(ROOT, metadata.directory);
    assert(isWithinDirectory(directory, DURABLE_EVIDENCE_ROOT), "recommendation evidence path escapes durable root");
    assert.equal(path.basename(directory), "recommendations");
    assert.equal(metadata.expectedFileCount, 2);
    assert.equal(metadata.observedFileCount, 2);
    assert.deepEqual(metadata.expectedDirectories, []);
    assert.deepEqual(metadata.observedDirectories, []);
    assert.deepEqual(metadata.residualFiles, []);
    assert.deepEqual(metadata.residualDirectories, []);

    const entries = readdirSync(directory, { withFileTypes: true });
    assert.deepEqual(entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort(),
      ["recommendation-flag-off.json", "recommendation-flag-on.json"]);
    assert.deepEqual(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(), []);
    assert(entries.every((entry) => entry.isFile() || entry.isDirectory()), "comparison root contains an unsupported entry type");
  }

  return off.topPickId !== on.topPickId ||
    !sameOrdered(off.supportingProductIdsInOrder, on.supportingProductIdsInOrder) ||
    !sameOrdered(off.budgetAlternativeIdsInOrder, on.budgetAlternativeIdsInOrder);
}

function assertPolicyEvidence(flagOff, flagOn) {
  assert.equal(flagOff.policyEvidence, null, "flag-off must not emit policy shadow evidence");
  assert.equal(flagOff.policyEvidenceMetadata, null, "flag-off must not emit policy shadow metadata");
  assert(flagOn.policyEvidence, "flag-on policy shadow evidence is missing");
  assert.equal(validateLocalShadowPolicyEvidence(flagOn.policyEvidence, {
    comparisonRunId: flagOn.recommendationEvidence.comparisonRunId
  }).valid, true);
  assert.equal(flagOn.policyEvidence.runtimeConnected, false);
  assert(Number.isInteger(flagOn.policyEvidence.candidateCount));
  const comparisonDirectory = path.resolve(ROOT, flagOn.recommendationEvidenceMetadata.directory, "..");
  const policyDirectory = path.resolve(ROOT, flagOn.policyEvidenceMetadata?.directory || "");
  assert(isWithinDirectory(policyDirectory, comparisonDirectory), "policy evidence path escapes durable comparison root");
  assert.equal(path.basename(policyDirectory), "policy");
  assert.deepEqual(readdirSync(policyDirectory, { withFileTypes: true }).map((entry) => entry.name).sort(), ["policy-flag-on.json"]);
  assert.deepEqual(flagOn.policyEvidenceMetadata?.residualFiles, []);
  assert(Object.values(flagOn.policyEvidence.violationCounts).every((count) => Number(count || 0) === 0));
}

function assertActualRuntimeEvidence(flagOff, flagOn) {
  const off = flagOff.actualRuntimeEvidence;
  const on = flagOn.actualRuntimeEvidence;
  assert(off && on, "actual runtime evidence is missing");
  assert.equal(validateLocalActualRuntimeEvidence(off, { comparisonRunId: off.comparisonRunId, condition: "off" }).valid, true);
  assert.equal(validateLocalActualRuntimeEvidence(on, { comparisonRunId: off.comparisonRunId, condition: "on" }).valid, true);
  assert.equal(off.runtimeEnabled, false);
  assert.equal(off.runtimeExecuted, false);
  assert.equal(off.runtimeConnected, false);
  assert.equal(on.runtimeEnabled, true);
  assert.equal(on.runtimeExecuted, true);
  assert.equal(on.runtimeConnected, true);
  assert.equal(on.unexpectedReceiverCount, 0);
  assert.deepEqual(off.visibleCandidateIdsInOrder, off.inputCandidateIdsInOrder);
  assert.deepEqual(on.recommendation, {
    topPickId: flagOn.recommendationEvidence.topPickId,
    supportingProductIdsInOrder: flagOn.recommendationEvidence.supportingProductIdsInOrder,
    budgetAlternativeIdsInOrder: flagOn.recommendationEvidence.budgetAlternativeIdsInOrder
  });
  for (const rows of Object.values(on.excludedCandidates)) {
    for (const row of rows) {
      assert.equal(
        new Map([
          ["accept_collapsed_candidate_hint", "collapsed_candidate"],
          ["preserve_hidden_candidate", "hidden_candidate"],
          ["route_to_insufficient_evidence", "insufficient_evidence_candidate"]
        ]).get(row.receiverDecision),
        Object.entries(on.excludedCandidates).find(([, candidates]) => candidates.includes(row))?.[0]
      );
    }
  }
  assert(Object.values(on.safetyViolationCounts).every((count) => Number(count || 0) === 0));
}

function assertRuntimeRecommendationDelta(output) {
  const excludedIds = new Set(
    Object.values(output.flagOn.actualRuntimeEvidence.excludedCandidates).flat().map((row) => row.productId)
  );
  const visibleIds = new Set(output.flagOn.actualRuntimeEvidence.visibleCandidateIdsInOrder);
  const isPolicyDriven = (before, after) =>
    before.filter((id) => !after.includes(id)).every((id) => excludedIds.has(id)) &&
    after.every((id) => visibleIds.has(id));
  const off = output.flagOff.recommendationEvidence;
  const on = output.flagOn.recommendationEvidence;
  const expected = isPolicyDriven([off.topPickId].filter(Boolean), [on.topPickId].filter(Boolean)) &&
    isPolicyDriven(off.supportingProductIdsInOrder, on.supportingProductIdsInOrder) &&
    isPolicyDriven(off.budgetAlternativeIdsInOrder, on.budgetAlternativeIdsInOrder);
  assert.equal(output.mutationComparison.expectedRecommendationDelta, expected);
  assert.equal(output.mutationComparison.unexpectedRecommendationDelta, output.recommendationChanged && !expected);
}

function assertDurableEvidence(output) {
  const durable = output.durableEvidence;
  assert(durable && typeof durable === "object", "durable comparison evidence is missing");
  assert.equal(durable.comparisonRunId, output.flagOff.recommendationEvidence.comparisonRunId);
  const directory = path.resolve(ROOT, durable.directory);
  assert(isWithinDirectory(directory, DURABLE_EVIDENCE_ROOT), "durable comparison directory escapes durable root");
  assert.equal(path.resolve(ROOT, durable.recommendationDirectory), path.join(directory, "recommendations"));
  assert.equal(path.resolve(ROOT, durable.policyDirectory), path.join(directory, "policy"));
  assert.equal(path.resolve(ROOT, durable.runtimeDirectory), path.join(directory, "runtime"));
  const rootEntries = readdirSync(directory, { withFileTypes: true });
  assert.deepEqual(rootEntries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort(), []);
  assert.deepEqual(rootEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(), ["policy", "recommendations", "runtime"]);
  assert(rootEntries.every((entry) => entry.isFile() || entry.isDirectory()), "durable comparison root contains an unsupported entry type");
  assert.deepEqual(durable.files, [
    "recommendations/recommendation-flag-off.json",
    "recommendations/recommendation-flag-on.json",
    "policy/policy-flag-on.json",
    "runtime/runtime-flag-off.json",
    "runtime/runtime-flag-on.json"
  ]);
  const readDurable = (relativePath) => JSON.parse(readFileSync(path.join(directory, relativePath), "utf8"));
  assert.deepEqual(readDurable(durable.files[0]), output.flagOff.recommendationEvidence);
  assert.deepEqual(readDurable(durable.files[1]), output.flagOn.recommendationEvidence);
  assert.deepEqual(readDurable(durable.files[2]), output.flagOn.policyEvidence);
  assert.deepEqual(readDurable(durable.files[3]), output.flagOff.actualRuntimeEvidence);
  assert.deepEqual(readDurable(durable.files[4]), output.flagOn.actualRuntimeEvidence);
}

if (!existsSync(OUTPUT_PATH)) {
  execFileSync(process.execPath, ["scripts/run-isolated-shadow-route-comparison.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });
}
assert(existsSync(OUTPUT_PATH), "controlled comparison evidence is missing after producer execution");
const output = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
assert.equal(output.evidenceType, "isolated_shadow_route_controlled_run");
assert(ALLOWED_VERDICTS.has(output.verdict));
assert.equal(output.secretsPrinted, false);
assert.equal(output.hostedSupabaseAccessCount, 0);
assert.equal(output.externalProviderInvocationCount, 0);
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
  assertDurableEvidence(output);
  const expectedResponseChange = responseShapeChanged(output.flagOff, output.flagOn);
  const expectedRecommendationChange = assertRecommendationEvidence(output.flagOff, output.flagOn);
  assertPolicyEvidence(output.flagOff, output.flagOn);
  assertActualRuntimeEvidence(output.flagOff, output.flagOn);
  assertRuntimeRecommendationDelta(output);
  assert.equal(output.responseShapeChanged, expectedResponseChange);
  assert.equal(output.recommendationChanged, expectedRecommendationChange);
  assert.equal(output.mutationComparison.responseShapeChanged, expectedResponseChange);
  assert.equal(output.mutationComparison.recommendationChanged, expectedRecommendationChange);
  assert.equal(output.mutationComparison.completeRecommendationComparison, true);
  assert.equal(output.mutationComparison.policyViolationDetected, false);
}

if (output.verdict === "controlled_shadow_route_comparison_passed") {
  assert.equal(output.flagOff.routeInvocationCount, 1);
  assert.equal(output.flagOn.routeInvocationCount, 1);
  assert.equal(output.flagOff.providerEvidence.providerStubbed, true);
  assert.equal(output.flagOn.providerEvidence.providerStubbed, true);
  assert.equal(output.responseShapeChanged, false);
  assert.equal(output.mutationObserverCoverage.complete, true);
  assert.equal(output.cleanup.succeeded, true);
  assert.equal(output.runtimeConnected, true);
  assert.equal(output.evaluatorConnected, true);
  assert.equal(output.candidatePolicyConnected, true);
  assertPolicyEvidence(output.flagOff, output.flagOn);
  assertActualRuntimeEvidence(output.flagOff, output.flagOn);
  assertRuntimeRecommendationDelta(output);
  assert.equal(output.mutationComparison.unexpectedRecommendationDelta, false);
  assert(output.mutationComparison.databaseMutationClassification.every((event) => event.classification !== "unexpected_mutation"));
  assert(output.mutationComparison.tableMutationClassification.every((event) => event.classification !== "unexpected_mutation"));
  assert.notEqual(output.mutationComparison.storageMutationClassification.classification, "unexpected_mutation");
}

console.log("verify-isolated-shadow-route-comparison passed");
