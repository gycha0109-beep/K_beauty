#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ARTIFACT_FILE,
  MANIFEST_FILE,
  ROOT,
  STARTING_MAIN,
  buildAll,
  buildManifest,
  canonical,
  sha256
} from "./build-v21-9i-prelaunch-robustness-remediation-v1.mjs";

function bytesFor(value) {
  return Buffer.from(canonical(value), "utf8");
}

const buildA = await buildAll();
const buildB = await buildAll();
const artifactA = bytesFor(buildA);
const artifactB = bytesFor(buildB);

assert.equal(Buffer.compare(artifactA, artifactB), 0, "Build A/B artifact bytes differ");
const hashA = sha256(artifactA);
const hashB = sha256(artifactB);
assert.equal(hashA, hashB);

const manifestA = bytesFor(buildManifest(artifactA));
const manifestB = bytesFor(buildManifest(artifactB));
assert.equal(Buffer.compare(manifestA, manifestB), 0, "Build A/B manifest bytes differ");

const checkedArtifactPath = path.join(ROOT, ARTIFACT_FILE);
const checkedManifestPath = path.join(ROOT, MANIFEST_FILE);
const checkedArtifact = readFileSync(checkedArtifactPath);
const checkedManifest = readFileSync(checkedManifestPath);

assert.equal(Buffer.compare(artifactA, checkedArtifact), 0, "fresh artifact bytes != checked-in artifact bytes");
assert.equal(Buffer.compare(manifestA, checkedManifest), 0, "fresh manifest bytes != checked-in manifest bytes");

const checkedArtifactHash = sha256(checkedArtifact);
const freshArtifactHash = sha256(artifactA);
assert.equal(checkedArtifactHash, freshArtifactHash);
const parsedManifest = JSON.parse(checkedManifest.toString("utf8"));
assert.equal(parsedManifest.artifact_sha256, freshArtifactHash);

assert.equal(buildA.authority.starting_main, STARTING_MAIN);
assert.equal(buildA.authority.production_semantic_source_change_authorized, false);

assert.equal(buildA.synthetic_replay.fixture_lineage, "REMEDIATED_FIXTURE_VERSION");
assert.equal(buildA.synthetic_replay.original_worker_fixture_recovered, false);
assert.equal(buildA.synthetic_replay.contexts, 28);
assert.equal(buildA.synthetic_replay.products, 164);
assert.equal(buildA.synthetic_replay.replay_cases, 4592);
assert.equal(buildA.synthetic_replay.runtime_executions, 4592);
assert.deepEqual(buildA.synthetic_replay.action_distribution, {
  ALLOW: 28,
  CAUTION: 2,
  RESTRICT: 20,
  DEFER: 4542,
  NOT_APPLICABLE: 0
});
assert.equal(buildA.synthetic_replay.semantic_mismatch_count, 0);
assert.equal(buildA.synthetic_replay.fallback_count, 0);
assert.equal(buildA.synthetic_replay.actual_normative_exclusion_count, 0);

assert.equal(
  buildA.not_applicable_reachability.classification,
  "REACHABLE_BY_CURRENT_CONTRACT_NOT_OBSERVED_IN_REMEDIATED_28_CONTEXT_REPLAY"
);
assert.equal(buildA.not_applicable_reachability.production_consumption_gate, "NOT_APPLICABLE");
assert.equal(buildA.not_applicable_reachability.production_mapper_action, "NOT_APPLICABLE");
assert.equal(buildA.not_applicable_reachability.forced_for_coverage, false);

assert.equal(buildA.precedence_audit.total, 48);
assert.equal(buildA.precedence_audit.pass_count, 48);
assert.equal(buildA.precedence_audit.failure_count, 0);
assert.equal(buildA.precedence_audit.cases.length, 48);
assert.ok(buildA.precedence_audit.cases.every((item) => item.pass === true));

assert.equal(buildA.failure_fallback_audit.total, 13);
assert.equal(buildA.failure_fallback_audit.pass_count, 13);
assert.equal(buildA.failure_fallback_audit.failure_count, 0);
assert.equal(buildA.failure_fallback_audit.cases.length, 13);
assert.ok(buildA.failure_fallback_audit.cases.every((item) => item.pass === true));
assert.equal(
  buildA.failure_fallback_audit.fallback_principle,
  "FAIL_CLOSED_TO_POLICY_DEFER_PRESERVE_EXISTING_LEGACY_PRODUCTION_PATH"
);

assert.equal(buildA.historical_replay.lineage, "PRIVACY_SAFE_REPOSITORY_HISTORICAL_EVIDENCE_PROJECTION");
assert.equal(buildA.historical_replay.original_worker_corpus_recovered, false);
assert.equal(buildA.historical_replay.privacy_classification, "PRIVACY_SAFE_HISTORICAL_REPLAY");
assert.equal(buildA.historical_replay.organic_evidence, false);
assert.equal(buildA.historical_replay.live_user_evidence, false);
assert.equal(buildA.historical_replay.raw_personal_data_committed, false);
assert.equal(buildA.historical_replay.contexts, 40);
assert.equal(buildA.historical_replay.products, 164);
assert.equal(buildA.historical_replay.replay_cases, 6560);
assert.equal(buildA.historical_replay.runtime_executions, 6560);
assert.equal(
  Object.values(buildA.historical_replay.action_distribution).reduce((sum, value) => sum + value, 0),
  6560
);
assert.equal(buildA.historical_replay.context_manifest.length, 40);

for (const mode of ["OFF", "SHADOW"]) {
  const row = buildA.canonical_invariance[mode];
  assert.equal(row.status, "PASS");
  assert.equal(row.eligibility_delta, 0);
  assert.equal(row.score_delta, 0);
  assert.equal(row.ranking_delta, 0);
  assert.equal(row.candidate_set_delta, 0);
  assert.equal(row.top1_delta, 0);
  assert.equal(row.top3_delta, 0);
  assert.equal(row.public_response_delta, 0);
  assert.equal(row.persistence_delta, 0);
  assert.equal(row.actual_normative_exclusion_count, 0);
  assert.equal(row.legacy_path_preserved, true);
}

assert.equal(buildA.regressions.historical_9e_wiring, "PASS");
assert.equal(buildA.regressions.historical_9d_activation_safety, "PASS");
assert.equal(buildA.regressions.v21_9i_sr_source_contract, "PASS");

assert.equal(buildA.semantic_invariants.enforce_authorized, false);
assert.equal(buildA.semantic_invariants.enforce_active, false);
assert.equal(buildA.semantic_invariants.restrict_canonical_exclusion_active, false);
assert.equal(buildA.semantic_invariants.scorer_mutation, false);
assert.equal(buildA.semantic_invariants.ranker_mutation, false);
assert.equal(buildA.semantic_invariants.product_fact_write, 0);
assert.equal(buildA.semantic_invariants.registry_delta, 0);
assert.equal(buildA.semantic_invariants.organic_evidence_claimed, false);

const rawArtifact = checkedArtifact.toString("utf8").toLowerCase();
for (const forbidden of [
  "\"user_id\"",
  "\"session_id\"",
  "\"email\"",
  "\"raw_image\"",
  "\"raw_survey\"",
  "\"free_text\"",
  "\"token\"",
  "\"secret\""
]) {
  assert.equal(rawArtifact.includes(forbidden), false, `privacy forbidden field persisted: ${forbidden}`);
}

console.log(JSON.stringify({
  stage: "V2.1-9I",
  verifier: "verify-v21-9i-prelaunch-robustness-remediation-v1",
  build_a_sha256: hashA,
  build_b_sha256: hashB,
  build_a_equals_build_b: true,
  checked_in_artifact_sha256: checkedArtifactHash,
  fresh_generated_sha256: freshArtifactHash,
  checked_in_equals_fresh_generated: true,
  synthetic: {
    contexts: buildA.synthetic_replay.contexts,
    products: buildA.synthetic_replay.products,
    replay_cases: buildA.synthetic_replay.replay_cases,
    runtime_executions: buildA.synthetic_replay.runtime_executions,
    action_distribution: buildA.synthetic_replay.action_distribution,
    semantic_mismatch_count: buildA.synthetic_replay.semantic_mismatch_count,
    fallback_count: buildA.synthetic_replay.fallback_count,
    actual_normative_exclusion_count: buildA.synthetic_replay.actual_normative_exclusion_count
  },
  not_applicable_reachability: buildA.not_applicable_reachability.classification,
  precedence: { total: 48, pass: 48, fail: 0 },
  failure_fallback: { total: 13, pass: 13, fail: 0 },
  historical: {
    lineage: buildA.historical_replay.lineage,
    contexts: 40,
    products: 164,
    replay_cases: 6560,
    action_distribution: buildA.historical_replay.action_distribution,
    organic_evidence: false
  },
  off_invariance: "PASS",
  shadow_invariance: "PASS",
  status: "PASS"
}, null, 2));
