import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

function loadCore() {
  const source = readFileSync("lib/face-lab-hosted-evaluation.js", "utf8")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");
  return Function(`${source}\nreturn { validateHostedEvaluationManifest, buildHostedEvaluationCases, projectHostedEvaluationRecord, getPendingHostedEvaluationCases, jaccardSimilarity, summarizeHostedEvaluation, renderHostedEvaluationReport, createHostedEvaluationRunManifest };`)();
}

const core = loadCore();
const baseManifest = {
  schemaVersion: "face-lab-hosted-eval-manifest-v1",
  datasetId: "local-test",
  fixtures: [
    {
      fixtureId: "subject-a-clear",
      subjectId: "subject-a",
      imagePath: "private/face-lab-fixtures/subject-a/clear.jpg",
      consentConfirmed: true,
      expectedEligibility: "eligible",
      comparisonGroup: "subject-a-structure",
      variantRole: "baseline",
      conditionTags: ["frontal", "clear"],
      expectedDegradation: "none",
      plans: ["smoke", "stability", "full"]
    },
    {
      fixtureId: "control-product",
      subjectId: "control-product",
      imagePath: "private/face-lab-fixtures/controls/product.png",
      consentConfirmed: true,
      expectedEligibility: "ineligible",
      comparisonGroup: "eligibility-controls",
      variantRole: "control",
      conditionTags: ["product"],
      expectedDegradation: "eligibility_block",
      plans: ["smoke", "full"]
    }
  ]
};

const manifest = core.validateHostedEvaluationManifest(baseManifest, {
  repoRoot: path.resolve("D:/repo"),
  pathApi: path,
  fileExists: () => true,
  requireImageFiles: true
});
assert.equal(manifest.fixtures.length, 2);
assert.ok(manifest.fixtures[0].imagePath.replace(/\\/g, "/").endsWith("private/face-lab-fixtures/subject-a/clear.jpg"));

assert.throws(() => core.validateHostedEvaluationManifest({
  ...baseManifest,
  fixtures: [{ ...baseManifest.fixtures[0], consentConfirmed: false }]
}, {
  repoRoot: process.cwd(),
  pathApi: path,
  fileExists: () => true
}), /consentConfirmed/);

assert.throws(() => core.validateHostedEvaluationManifest({
  ...baseManifest,
  fixtures: [{ ...baseManifest.fixtures[0], age: 29 }]
}, {
  repoRoot: process.cwd(),
  pathApi: path,
  fileExists: () => true
}), /forbidden personal metadata/);

assert.throws(() => core.validateHostedEvaluationManifest({
  ...baseManifest,
  fixtures: [{ ...baseManifest.fixtures[0], imagePath: "../outside.jpg" }]
}, {
  repoRoot: process.cwd(),
  pathApi: path,
  fileExists: () => true
}), /private\/face-lab-fixtures/);

assert.throws(() => core.validateHostedEvaluationManifest({
  ...baseManifest,
  fixtures: [{ ...baseManifest.fixtures[0], imagePath: "C:\\photos\\face.jpg" }]
}, {
  repoRoot: process.cwd(),
  pathApi: path,
  fileExists: () => true
}), /repository-relative/);

const plan = core.buildHostedEvaluationCases(manifest, {
  plan: "smoke",
  locales: ["ko", "en"],
  repetitions: 2,
  maxCalls: 10
});
assert.equal(plan.plannedCalls, 8);
assert.equal(new Set(plan.cases.map((item) => item.caseId)).size, 8);
assert.throws(() => core.buildHostedEvaluationCases(manifest, {
  plan: "smoke",
  repetitions: 3,
  maxCalls: 2
}), /exceeds maxCalls/);

const analysis = {
  schemaVersion: "face-lab-observation-v1",
  status: "available",
  failureReason: null,
  quality: {
    status: "available",
    confidence: 0.9,
    unavailableReason: null,
    value: {
      faceVisibility: "clear",
      faceScale: "adequate",
      pose: { yaw: "frontal", pitch: "level", roll: "level" },
      occlusion: { forehead: "none", brows: "none", eyes: "none", cheeks: "none", jawline: "none" },
      sharpness: "clear",
      exposure: "balanced",
      lightingUniformity: "even",
      whiteBalance: "stable",
      filterOrEditing: "none_detected",
      makeupCoverage: "none_or_light",
      structureSuitability: "suitable",
      colorSuitability: "suitable"
    }
  },
  observations: {
    outline: {
      faceShape: {
        status: "available",
        value: "oval",
        confidence: 0.9,
        unavailableReason: null,
        evidence: ["must not be persisted"]
      }
    },
    featureLayout: {
      focalFeatures: {
        status: "available",
        value: ["eyes", "jawline"],
        confidence: 0.9,
        unavailableReason: null,
        evidence: ["must not be persisted"]
      }
    }
  },
  coverage: {
    availableGroups: ["outline", "featureLayout"],
    partialGroups: [],
    unavailableGroups: [],
    availableFieldCount: 2,
    totalCoreFieldCount: 2
  },
  warnings: [],
  privacy: { sourceImagePersisted: false }
};
const caseDefinition = plan.cases[0];
const record = core.projectHostedEvaluationRecord({
  runId: "run-1",
  caseDefinition,
  httpStatus: 200,
  durationMs: 1200,
  responsePayload: {
    status: "available",
    source: "vision",
    failureReason: null,
    analyzedAt: "2026-07-16T00:00:00.000Z",
    eligibility: {
      status: "eligible",
      imageType: "photorealistic_human",
      humanFaceCount: 1,
      faceLabEligible: true,
      faceLabFailureReason: null
    },
    data: { analysis, base_data: {}, features: {}, structured: {} }
  }
});
assert.equal(JSON.stringify(record).includes("must not be persisted"), false);
assert.equal(record.analysis.observations.outline.faceShape.value, "oval");
assert.equal(record.privacyAudit.imagePayloadFound, false);
assert.equal(record.privacyAudit.rawObservationKeyFound, false);

const contaminated = core.projectHostedEvaluationRecord({
  runId: "run-1",
  caseDefinition,
  httpStatus: 200,
  durationMs: 1,
  responsePayload: {
    status: "available",
    source: "vision",
    data: {
      analysis,
      observation_analysis: { raw: true },
      imageUrl: "data:image/jpeg;base64,ZmFrZQ=="
    }
  }
});
assert.equal(contaminated.privacyAudit.rawObservationKeyFound, true);
assert.equal(contaminated.privacyAudit.imagePayloadFound, true);
assert.equal(contaminated.privacyAudit.unknownProviderKeyFound, true);

assert.deepEqual(
  core.getPendingHostedEvaluationCases(plan.cases, [{ caseId: plan.cases[0].caseId }]).length,
  plan.cases.length - 1
);
assert.equal(core.jaccardSimilarity(["eyes", "jawline"], ["jawline", "eyes"]), 1);
assert.equal(core.jaccardSimilarity(["eyes"], ["jawline"]), 0);

const runManifest = core.createHostedEvaluationRunManifest({
  runId: "run-1",
  datasetId: "local-test",
  plan: "smoke",
  locales: ["ko", "en"],
  repetitions: 1,
  maxCalls: 10,
  plannedCalls: 2,
  baseUrl: "http://localhost:3001/"
});
const secondRecord = structuredClone(record);
secondRecord.caseId = `${record.fixtureId}:en:1`;
secondRecord.locale = "en";
const summary = core.summarizeHostedEvaluation([record, secondRecord], runManifest);
assert.equal(summary.hardInvariantFailures, 0);
assert.equal(summary.baseline.usableRate, 1);
assert.equal(summary.localeAgreement.statusAgreement, 1);
const report = core.renderHostedEvaluationReport(summary);
assert.equal(report.includes("source images"), true);
assert.equal(report.includes("D:/repo"), false);
assert.equal(report.includes("data:image"), false);

const runnerSource = readFileSync("scripts/run-face-lab-hosted-evaluation.mjs", "utf8");
assert.equal(runnerSource.includes("--confirm RUN"), true);
assert.equal(runnerSource.includes("max-calls"), true);
assert.equal(runnerSource.includes("records.jsonl"), true);
assert.equal(runnerSource.includes("imagePath"), true);
assert.equal(runnerSource.includes("console.log(bytes"), false);

console.log("Face Lab hosted evaluation harness checks passed.");
