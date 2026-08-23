#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const node = process.execPath;
const artifactPath = "tmp/current-main-recommendation-semantic-invariance.json";
const engineSha = process.env.GITHUB_SHA || "CURRENT_WORKTREE";

const result = spawnSync(
  node,
  ["scripts/verify-skin-decision-recommendation-invariance.mjs"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      RECOMMENDATION_ENGINE_ROOT: ".",
      RECOMMENDATION_REFERENCE_ROOT: ".",
      RECOMMENDATION_ENGINE_SHA: engineSha,
      RECOMMENDATION_SEMANTIC_ARTIFACT_PATH: artifactPath,
      // Existing verifier compatibility mode: materialize current semantics without
      // enforcing historical Stage score/presentation hashes.
      V21_9E_BASE_MAIN_SHA: "CURRENT_MAIN_COMPATIBILITY_MODE",
      EXFOLIATION_NORMATIVE_POLICY_MODE: "OFF",
    },
  },
);

if (result.error) throw result.error;
assert.equal(result.status, 0, "current Recommendation 164x12 materialization must pass");

const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
assert.equal(artifact.deterministic?.byte_semantic_equality, true, "current Recommendation replay must be deterministic");
assert.equal(artifact.self_tests?.presentation_only_projection_invariant, "PASS", "presentation-only changes must not alter Recommendation semantic projection");
assert.equal(artifact.self_tests?.real_semantic_delta_detected, "DETECTED", "real Recommendation semantic mutation self-test must be detected");
assert.equal(artifact.scenarios?.length, 12, "canonical current Recommendation scenario count");
for (const scenario of artifact.scenarios) {
  assert.equal(scenario.eligible_product_count, 164, `${scenario.id}: current candidate count`);
}

console.log(
  `verify-current-recommendation-health: PASS products=164 scenarios=12 semantic_hash=${artifact.semantic_hash}`
);
