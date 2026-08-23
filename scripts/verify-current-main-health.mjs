#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const node = process.execPath;

function run(label, command, args, env = {}) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

run("Current verifier syntax", node, ["--check", "scripts/verify-current-main-health.mjs"]);
run("Repository hygiene verifier syntax", node, ["--check", "scripts/verify-current-repository-hygiene.mjs"]);
run("Architecture guard", npm, ["run", "architecture:guard"]);
run("Shared skin decision context", npm, ["run", "verify:shared-skin-decision-context"]);
run("Premium integrated deterministic evaluation", npm, ["run", "verify:premium-integrated-evaluation-v2"]);
run("Unified Vision pipeline", npm, ["run", "verify:unified-vision-pipeline"]);
run("Skin decision persistence and reentry", npm, ["run", "verify:skin-decision-persistence-reentry"]);

run(
  "Canonical 164x12 Recommendation semantic invariance",
  node,
  ["scripts/verify-skin-decision-recommendation-invariance.mjs"],
  {
    RECOMMENDATION_ENGINE_ROOT: ".",
    RECOMMENDATION_REFERENCE_ROOT: ".",
    RECOMMENDATION_ENGINE_SHA: process.env.GITHUB_SHA || "CURRENT_WORKTREE",
    RECOMMENDATION_SEMANTIC_ARTIFACT_PATH: "tmp/current-main-recommendation-semantic-invariance.json",
  },
);

run("CandidatePolicy current semantic invariant", npm, ["run", "verify:candidate-exposure-policy-shadow"]);
run("Current Product Decision Axis contract", node, ["scripts/product-evidence/verify-exfoliation-non-numeric-pda-contract-v1.mjs"]);
run("G2 initial admission grant contract", node, ["scripts/product-evidence/verify-initial-admission-grant-policy-v1.mjs"]);
run("G3A Product Fact authority read contract", node, ["scripts/verify-v21-admission-g3a-pf-authority-reader-v1.mjs"]);
run("G3 production candidate admission contract", node, ["scripts/verify-v21-admission-g3-production-candidate-gate-v1.mjs"]);
run("G3 fail-closed admission boundaries", node, ["scripts/verify-v21-admission-g3-failclosed-boundaries-v1.mjs"]);

run("Crawler TypeScript boundary", npm, ["--prefix", "crawler", "run", "typecheck"]);
run("Crawler canonical adoption authority / no-auto-adoption", node, ["scripts/verify-crawler-canonical-adoption-authority-remediation-v1.mjs"]);

run("Face Lab archetype scoring contract", npm, ["run", "verify:face-lab-archetype-scoring"]);
run("Face Lab target-axis contract", npm, ["run", "verify:face-lab-target-axis-definitions"]);
run("Face Lab independent Human cue protocol", npm, ["run", "verify:face-lab-independent-human-cue-protocol"]);

run(
  "Persona EVAL-R1 current grounding regression probes",
  node,
  ["scripts/verify-eval-r1-grounding-probes-v1.mjs"],
  {
    EVAL_R1_P3_REFERENCE_ROOT: ".",
    EVAL_R1_RECOMMENDATION_REFERENCE_ROOT: ".",
  },
);

run("Admin/security boundary", npm, ["run", "verify:admin-access-foundation"]);
run("SEC-11 origin normalization", npm, ["run", "check:sec11-origin-normalization"]);
run("Repository hygiene, secret and authority shortcut scan", npm, ["run", "verify:current-repository-hygiene"]);
run("Production build", npm, ["run", "build"]);

console.log("\nBEJEWELY Current Main Health: PASS");
