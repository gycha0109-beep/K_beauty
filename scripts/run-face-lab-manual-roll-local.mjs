import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [captureSpecPath, outputDir] = process.argv.slice(2);
assert.ok(
  captureSpecPath && outputDir,
  "Usage: node scripts/run-face-lab-manual-roll-local.mjs <capture-spec.json> <output-dir>"
);

const spec = JSON.parse(readFileSync(captureSpecPath, "utf8"));
assert.equal(spec.schemaVersion, "face-lab-manual-roll-capture-spec-v0");
assert.equal(spec.nuisanceClass, "head_roll");
assert.equal(spec.commercialResearchUseAuthorized, true);
assert.ok(
  typeof spec.usageScope === "string" &&
    spec.usageScope.trim().length > 0
);

const resolvedOutputDir = path.resolve(outputDir);
mkdirSync(resolvedOutputDir, { recursive: true });

const manifestPath = path.join(
  resolvedOutputDir,
  "manual-roll-stability-run-manifest.json"
);
const runOutputPath = path.join(
  resolvedOutputDir,
  "manual-roll-stability-run-output.json"
);
const reviewPacketPath = path.join(
  resolvedOutputDir,
  "manual-roll-stability-review-packet.json"
);
const completeReviewPacketPath = path.join(
  resolvedOutputDir,
  "real-photo-expression-yaw-pitch-roll-stability-review-packet.json"
);
const completeAdequacyContractPath = path.join(
  resolvedOutputDir,
  "real-photo-stability-adequacy.contract.json"
);

function runNode(args, { captureStdout = false } = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(
      "manual_roll_local_command_failed:" +
        args[0] +
        ":exit_" +
        result.status
    );
  }
  if (result.stderr) process.stderr.write(result.stderr);
  return captureStdout ? result.stdout : null;
}

runNode([
  "scripts/build-face-lab-manual-roll-measurement-manifest.mjs",
  captureSpecPath,
  manifestPath
]);

const runOutput = runNode(
  [
    "scripts/run-face-lab-real-photo-stability-pairs.mjs",
    manifestPath
  ],
  { captureStdout: true }
);
JSON.parse(runOutput);
writeFileSync(runOutputPath, runOutput, "utf8");

const reviewPacket = runNode(
  [
    "scripts/build-face-lab-normalization-review-packet.mjs",
    "real-photo-stability",
    runOutputPath,
    "manual-roll-stability-review-v1",
    "--packet-only"
  ],
  { captureStdout: true }
);
JSON.parse(reviewPacket);
writeFileSync(reviewPacketPath, reviewPacket, "utf8");

runNode([
  "scripts/verify-face-lab-manual-roll-measurement-evidence.mjs",
  captureSpecPath,
  runOutputPath,
  reviewPacketPath
]);

runNode([
  "scripts/build-face-lab-complete-stability-evidence.mjs",
  "evidence/facelab/photo-geometry/v0/london-set-v5-expression-stability-run-output.json",
  "evidence/facelab/photo-geometry/v0/london-set-v5-yaw-stability-run-output.json",
  "evidence/facelab/photo-geometry/v0/pointing04-pitch-stability-run-output.json",
  runOutputPath,
  "evidence/facelab/photo-geometry/v0/real-photo-stability-adequacy.contract.json",
  completeReviewPacketPath,
  completeAdequacyContractPath
]);

runNode([
  "scripts/verify-face-lab-complete-stability-evidence.mjs",
  runOutputPath,
  completeReviewPacketPath,
  completeAdequacyContractPath
]);

console.log(JSON.stringify({
  ok: true,
  subjectCount: spec.subjects.length,
  pairCount: spec.subjects.length * 2,
  manifestPath,
  runOutputPath,
  reviewPacketPath,
  completeReviewPacketPath,
  completeAdequacyContractPath,
  completeNuisanceCoverage: true,
  adequacyDecisionPresent: false,
  rawImagesPersistedInEvidence: false,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false,
  adequacyDecisionAuthority: false
}, null, 2));
