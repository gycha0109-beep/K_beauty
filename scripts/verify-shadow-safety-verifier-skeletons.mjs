import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, "tmp");
const OUTPUT_PATH = path.join(TMP_DIR, "shadow-safety-verifier-skeletons.json");
const MD_OUTPUT_PATH = path.join(TMP_DIR, "shadow-safety-verifier-skeletons.md");

const SKELETONS = [
  {
    id: "no_response_change",
    script: "scripts/verify-shadow-no-response-change-skeleton.mjs",
    artifact: "tmp/shadow-no-response-change-skeleton.json",
    evidenceType: "shadow_no_response_change_skeleton"
  },
  {
    id: "no_recommendation_change",
    script: "scripts/verify-shadow-no-recommendation-change-skeleton.mjs",
    artifact: "tmp/shadow-no-recommendation-change-skeleton.json",
    evidenceType: "shadow_no_recommendation_change_skeleton"
  },
  {
    id: "no_db_write",
    script: "scripts/verify-shadow-no-db-write-skeleton.mjs",
    artifact: "tmp/shadow-no-db-write-skeleton.json",
    evidenceType: "shadow_no_db_write_skeleton"
  }
];

const FORBIDDEN_RUNTIME_FILES = [
  "app/api/analyze/route.js",
  "lib/skin-match-decision-engine.js",
  "lib/functional-ranking-contract.js",
  "lib/functional-candidate-policy.js",
  "app/page.js",
  "app/result/page.js",
  "app/result/full-report/page.js"
];

const FORBIDDEN_VALUE_PATTERNS = [
  /data:image\//i,
  /base64,[A-Za-z0-9+/=]{20,}/i,
  /"product_name"\s*:\s*"[^"]+"/i,
  /"productName"\s*:\s*"[^"]+"/i,
  /"name"\s*:\s*"[^"]+"/i,
  /"brand"\s*:\s*"[^"]+"/i,
  /"purchase_url"\s*:\s*"[^"]+"/i,
  /"purchaseUrl"\s*:\s*"[^"]+"/i,
  /"buy_link"\s*:\s*"[^"]+"/i,
  /"review_text"\s*:\s*"[^"]+"/i,
  /"reviewText"\s*:\s*"[^"]+"/i,
  /"raw_form"\s*:\s*\{/i,
  /"rawForm"\s*:\s*\{/i,
  /"image"\s*:\s*"[^"]+"/i,
  /"image_url"\s*:\s*"[^"]+"/i,
  /"pii"\s*:\s*"[^"]+"/i,
  /"email"\s*:\s*"[^"]+"/i,
  /"cookie"\s*:\s*"[^"]+"/i,
  /"full_api_response_body"\s*:\s*\{/i,
  /"fullApiResponseBody"\s*:\s*\{/i,
  /"apiResponseBody"\s*:\s*\{/i,
  /"responseBody"\s*:\s*\{/i,
  /https?:\/\/[^\s")]+/i,
  /Bearer\s+[A-Za-z0-9._-]+/i,
  /SUPABASE_[A-Z_]*=\S+/i,
  /NEXT_PUBLIC_SUPABASE_[A-Z_]*=\S+/i,
  /(?:secret|token|api[_-]?key)\s*[:=]\s*[A-Za-z0-9._-]{8,}/i
];

function runSkeleton(script) {
  const stdout = execFileSync(process.execPath, [script], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });
  assert(stdout.includes("passed"), `${script} should report passed`);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function stripVolatile(value) {
  if (Array.isArray(value)) {
    return value.map(stripVolatile);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, key === "generatedAt" ? "<stable>" : stripVolatile(child)])
    );
  }
  return value;
}

function runtimeFileCheck() {
  const phase39Guard = execFileSync(process.execPath, ["scripts/verify-shadow-dry-run-route-static-guard.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });
  assert(phase39Guard.includes("verify-shadow-dry-run-route-static-guard passed"));
  const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const changedFiles = status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  const forbiddenChangedFiles = changedFiles.filter((file) =>
    (FORBIDDEN_RUNTIME_FILES.includes(file) && file !== "app/api/analyze/route.js") ||
    file.startsWith("data/") ||
    file.startsWith("supabase/")
  );

  return {
    changedFiles,
    forbiddenChangedFiles,
    passed: forbiddenChangedFiles.length === 0
  };
}

function assertSkeletonArtifact(spec, artifact) {
  assert.equal(artifact.evidenceType, spec.evidenceType);
  assert.equal(artifact.runtimeConnected, false);
  assert.equal(artifact.dryRunOnly, true);
  assert.equal(artifact.routeInvoked, false);
  assert.equal(artifact.supabaseWriteExecuted, false);
  assert.equal(artifact.runtimeMutation, false);
  assert.equal(artifact.syntheticSkeletonSampleUsed, true);
  assert.equal(artifact.syntheticTreatedAsActualEvidence, false);
  assert.equal(artifact.phase31SchemaCompatible, true);
}

function assertNoForbiddenLeakage(files) {
  const serialized = files.map((file) => readFileSync(path.join(ROOT, file), "utf8")).join("\n");
  for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
    assert(!pattern.test(serialized), `shadow safety skeleton output leaked forbidden pattern: ${pattern}`);
  }
}

for (const skeleton of SKELETONS) {
  runSkeleton(skeleton.script);
}

const firstArtifacts = Object.fromEntries(
  SKELETONS.map((skeleton) => {
    assert(existsSync(path.join(ROOT, skeleton.artifact)), `${skeleton.artifact} should exist`);
    const artifact = readJson(skeleton.artifact);
    assertSkeletonArtifact(skeleton, artifact);
    return [skeleton.id, artifact];
  })
);

for (const skeleton of SKELETONS) {
  runSkeleton(skeleton.script);
}

const secondArtifacts = Object.fromEntries(SKELETONS.map((skeleton) => [skeleton.id, readJson(skeleton.artifact)]));
assert.deepEqual(
  stripVolatile(firstArtifacts),
  stripVolatile(secondArtifacts),
  "safety skeleton artifacts should be deterministic apart from generatedAt"
);

assert.equal(firstArtifacts.no_db_write.supabaseWriteExecuted, false);
assert.equal(firstArtifacts.no_response_change.sampleValidation.fullResponseBodyDumpSampleFailed, true);
assert.equal(firstArtifacts.no_recommendation_change.sampleComparison.changedTopPickSampleFailed, true);
assert.equal(firstArtifacts.no_recommendation_change.sampleComparison.changedOrderSampleFailed, true);
assert.equal(firstArtifacts.no_db_write.sampleValidation.dbWriteSampleFailed, true);

const runtimeCheck = runtimeFileCheck();
assert.equal(runtimeCheck.passed, true, `forbidden runtime/data files changed: ${runtimeCheck.forbiddenChangedFiles.join(", ")}`);

assertNoForbiddenLeakage(SKELETONS.map((skeleton) => skeleton.artifact));

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "shadow_safety_verifier_skeletons",
  runtimeConnected: false,
  dryRunOnly: true,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  syntheticSkeletonSampleUsed: true,
  syntheticTreatedAsActualEvidence: false,
  actualEvidenceUsed: false,
  phase31SchemaCompatible: true,
  skeletons: {
    noResponseChange: {
      artifact: "tmp/shadow-no-response-change-skeleton.json",
      passed: firstArtifacts.no_response_change.sampleValidation.validSamplePassed,
      apiAnalyzeInvoked: firstArtifacts.no_response_change.apiAnalyzeInvoked,
      responseFixtureCreated: firstArtifacts.no_response_change.responseFixtureCreated
    },
    noRecommendationChange: {
      artifact: "tmp/shadow-no-recommendation-change-skeleton.json",
      passed: firstArtifacts.no_recommendation_change.sampleComparison.unchangedSamplePassed,
      recommendationEngineInvoked: firstArtifacts.no_recommendation_change.recommendationEngineInvoked,
      changedTopPickSampleFailed: firstArtifacts.no_recommendation_change.sampleComparison.changedTopPickSampleFailed,
      changedOrderSampleFailed: firstArtifacts.no_recommendation_change.sampleComparison.changedOrderSampleFailed
    },
    noDbWrite: {
      artifact: "tmp/shadow-no-db-write-skeleton.json",
      passed: firstArtifacts.no_db_write.sampleValidation.validWriteSummaryPassed,
      supabaseInvoked: firstArtifacts.no_db_write.supabaseInvoked,
      dbWriteSampleFailed: firstArtifacts.no_db_write.sampleValidation.dbWriteSampleFailed,
      rpcMutationSampleFailed: firstArtifacts.no_db_write.sampleValidation.rpcMutationSampleFailed,
      storageWriteSampleFailed: firstArtifacts.no_db_write.sampleValidation.storageWriteSampleFailed
    }
  },
  runtimeIsolationCheck: runtimeCheck,
  forbiddenFieldValidation: {
    forbiddenLeakageDetected: false,
    fullApiResponseBodyDumpDetected: false,
    productDisplayFieldsDetected: false,
    envSecretValuesDetected: false
  },
  allowedNextStep: [
    "disabled_by_default_shadow_dry_run_implementation_plan",
    "dry_run_snapshot_contract_design",
    "future_baseline_after_snapshot_verifier_design"
  ],
  prohibitedNextStep: [
    "evaluator_runtime_connection",
    "candidate_policy_runtime_connection",
    "api_response_change",
    "recommendation_result_change",
    "db_or_supabase_write"
  ],
  limitations: [
    "skeleton_only_no_runtime_dry_run_execution",
    "synthetic_samples_are_not_actual_response_recommendation_or_db_evidence",
    "future_phase_must_supply_real_baseline_after_snapshots_before_runtime_approval"
  ]
};

await mkdir(TMP_DIR, { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
await writeFile(
  MD_OUTPUT_PATH,
  [
    "# Shadow Safety Verifier Skeletons",
    "",
    "This artifact summarizes Phase 32 verifier skeletons only. It does not connect runtime code.",
    "",
    `- evidenceType: ${output.evidenceType}`,
    `- runtimeConnected: ${output.runtimeConnected}`,
    `- routeInvoked: ${output.routeInvoked}`,
    `- supabaseWriteExecuted: ${output.supabaseWriteExecuted}`,
    `- runtimeMutation: ${output.runtimeMutation}`,
    "",
    "## Skeletons",
    `- no-response-change: ${output.skeletons.noResponseChange.passed}`,
    `- no-recommendation-change: ${output.skeletons.noRecommendationChange.passed}`,
    `- no-DB-write: ${output.skeletons.noDbWrite.passed}`,
    "",
    "## Runtime Isolation",
    `- forbidden runtime/data files changed: ${output.runtimeIsolationCheck.forbiddenChangedFiles.length}`,
    "",
    "## Next Scope",
    ...output.allowedNextStep.map((item) => `- allowed: ${item}`),
    ...output.prohibitedNextStep.map((item) => `- prohibited: ${item}`)
  ].join("\n")
);

console.log("verify-shadow-safety-verifier-skeletons passed");
