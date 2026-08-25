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
run("Current Recommendation verifier syntax", node, ["--check", "scripts/verify-current-recommendation-health.mjs"]);
run("Repository hygiene verifier syntax", node, ["--check", "scripts/verify-current-repository-hygiene.mjs"]);
run("Document locale contract", node, ["--experimental-default-type=module", "scripts/verify-document-locale-contract.mjs"]);
run("My monthly diary data contract", node, ["--experimental-default-type=module", "scripts/verify-my-monthly-diary.mjs"]);
run("My diary day detail contract", node, ["--experimental-default-type=module", "scripts/verify-my-diary-day-detail.mjs"]);
run("My saved report history contract", node, ["--experimental-default-type=module", "scripts/verify-my-saved-report-history.mjs"]);
run("My skin profile baseline contract", node, ["--experimental-default-type=module", "scripts/verify-my-skin-profile-baseline.mjs"]);
run("Architecture guard", npm, ["run", "architecture:guard"]);
run("Shared skin decision context", npm, ["run", "verify:shared-skin-decision-context"]);
run("Premium integrated deterministic evaluation", npm, ["run", "verify:premium-integrated-evaluation-v2"]);
run("Unified Vision pipeline", npm, ["run", "verify:unified-vision-pipeline"]);
run("Skin decision persistence and reentry", npm, ["run", "verify:skin-decision-persistence-reentry"]);
run("Canonical 164x12 current Recommendation semantic health", node, ["scripts/verify-current-recommendation-health.mjs"]);

run("CandidatePolicy current semantic invariant", npm, ["run", "verify:candidate-exposure-policy-shadow"]);
run("Current Product Decision Axis contract", node, ["scripts/product-evidence/verify-exfoliation-non-numeric-pda-contract-v1.mjs"]);
run("Current Production SHADOW wiring", node, ["--experimental-default-type=module", "scripts/product-evidence/verify-exfoliation-normative-policy-production-shadow-wiring-v1.mjs"]);
run(
  "Current Production activation/runtime safety",
  node,
  ["scripts/product-evidence/verify-exfoliation-normative-policy-activation-authorization-runtime-safety-v1.mjs"],
  { V21_9D_REQUIRE_CHECKED_IN: "1" },
);
run("G2 initial admission grant contract", node, ["scripts/product-evidence/verify-initial-admission-grant-policy-v1.mjs"]);
run("G3A Product Fact authority read contract", node, ["scripts/verify-v21-admission-g3a-pf-authority-reader-v1.mjs"]);
run("G3 production candidate admission contract", node, ["scripts/verify-v21-admission-g3-production-candidate-gate-v1.mjs"]);

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

run("Analysis RLS boundary", node, ["scripts/verify-analysis-rls-contract.mjs"]);
run("Anonymous write-grant boundary", node, ["scripts/verify-anonymous-write-grant-v2.mjs"]);
run("Image upload boundary", node, ["scripts/verify-sec08-image-upload-boundary.mjs"]);
run("Public result read boundary", node, ["scripts/verify-sec09-public-result-read-boundary.mjs"]);
run("Security headers and purchase-anchor boundary", node, ["scripts/verify-sec10-security-headers.mjs"]);
run("Admin/security boundary", npm, ["run", "verify:admin-access-foundation"]);
run("SEC-11 origin normalization", npm, ["run", "check:sec11-origin-normalization"]);
run("Repository hygiene, secret and authority shortcut scan", npm, ["run", "verify:current-repository-hygiene"]);
run("Production build", npm, ["run", "build"]);

console.log("\nBEJEWELY Current Main Health: PASS");
