#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const EVIDENCE_PATH = new URL(
  "../evidence/facelab/face-lab-g-e2b-provider-pilot-execution-20261002-v1.json",
  import.meta.url
);

const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, "utf8"));
const HEX64 = /^[0-9a-f]{64}$/;

assert.equal(
  evidence.schemaVersion,
  "face-lab-g-e2b-provider-pilot-execution-evidence-v1"
);
assert.equal(evidence.track, "face-research");
assert.equal(evidence.gate, "G-E2B");
assert.equal(
  evidence.status,
  "provider_execution_complete_human_review_pending"
);
assert.equal(evidence.gateClosed, false);

assert.equal(evidence.execution?.conclusion, "success");
assert.equal(
  evidence.execution?.providerVerdict,
  "FACE_LAB_G_E2B_PROVIDER_E2E_PASS"
);
assert.equal(evidence.execution?.intentCount, 4);
assert.equal(evidence.execution?.generationsPerIntent, 2);
assert.equal(evidence.execution?.caseCount, 8);
assert.equal(evidence.execution?.completedGuardRows, 8);
assert.equal(evidence.execution?.reviewTemplateBindingValidatedCount, 8);
assert.equal(evidence.execution?.generatedOutputsPersisted, false);
assert.equal(evidence.execution?.generatedOutputArtifactsPublished, false);

assert.equal(
  evidence.campaignRuntime?.simulationVersion,
  "face-lab-ai-simulation-v1"
);
assert.equal(
  evidence.campaignRuntime?.instructionVersion,
  "face-lab-simulation-instruction-v1"
);
assert.equal(
  evidence.campaignRuntime?.renderSpecVersion,
  "face-lab-render-spec-v1"
);
assert.equal(
  evidence.campaignRuntime?.providerConfigVersion,
  "face-lab-simulation-provider-config-v1"
);
assert.match(
  evidence.campaignRuntime?.providerConfigFingerprint || "",
  HEX64
);

assert.equal(evidence.intents?.length, 4);
assert.deepEqual(
  evidence.intents.map((item) => item.intentGroupId),
  ["intent-01", "intent-02", "intent-03", "intent-04"]
);

const generationKeys = [];
for (const intent of evidence.intents) {
  assert.ok(typeof intent.routeId === "string" && intent.routeId);
  assert.match(intent.renderSpecSha256 || "", HEX64);
  assert.equal(intent.pairRenderSpecConsistent, true);
  assert.equal(intent.generations?.length, 2);
  assert.deepEqual(
    intent.generations.map((item) => item.generationIndex),
    [1, 2]
  );
  assert.deepEqual(
    intent.generations.map((item) => item.accountLabel),
    ["A", "B"]
  );

  for (const generation of intent.generations) {
    generationKeys.push(
      `${intent.intentGroupId}:g${generation.generationIndex}`
    );
  }
}

assert.equal(new Set(generationKeys).size, 8);
assert.equal(evidence.invariants?.distinctIntentGroups, 4);
assert.equal(evidence.invariants?.pairedRenderSpecBindingErrors, 0);
assert.equal(evidence.invariants?.campaignRuntimeBindingErrors, 0);
assert.equal(evidence.invariants?.guardFailures, 0);
assert.equal(evidence.invariants?.providerGenerationFailures, 0);
assert.equal(evidence.invariants?.reviewTemplateBindingFailures, 0);

for (const value of Object.values(evidence.privacy || {})) {
  assert.equal(value, false);
}

assert.equal(evidence.humanReview?.status, "pending");
assert.deepEqual(
  evidence.humanReview?.requiredAxes,
  [
    "identity_preservation",
    "route_adherence",
    "color_fidelity",
    "edit_scope"
  ]
);
assert.equal(
  evidence.humanReview?.hardFailureEvaluation,
  "not_evaluated"
);
assert.equal(evidence.humanReview?.calibrationCasesAdmitted, 0);
assert.equal(evidence.humanReview?.aggregateReady, false);

const forbiddenKeys = new Set([
  "caseId",
  "reviewTicket",
  "reviewerRef",
  "sourceImageSha256",
  "outputImageSha256",
  "analysisSha256",
  "faceLabStateSha256",
  "sourceImagePath",
  "outputImagePath",
  "localPath"
]);

function walk(value) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    assert.ok(!forbiddenKeys.has(key), `forbidden durable evidence key: ${key}`);
    walk(nested);
  }
}
walk(evidence);

console.log(
  "Face Lab G-E2B provider execution evidence verification passed: 8/8 provider outputs, human review pending."
);
