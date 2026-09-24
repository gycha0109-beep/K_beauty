import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  scaffoldRealPhotoStabilityRunManifest
} from "../lib/face-lab-source-manifest-scaffold.js";

const [captureSpecPath, outputPath] = process.argv.slice(2);
assert.ok(
  captureSpecPath && outputPath,
  "Usage: node scripts/build-face-lab-manual-roll-measurement-manifest.mjs <capture-spec.json> <output.json>"
);

const contract = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/manual-roll-capture.contract.json",
    "utf8"
  )
);
const spec = JSON.parse(readFileSync(captureSpecPath, "utf8"));

assert.equal(
  contract.schemaVersion,
  "face-lab-manual-roll-capture-contract-v0"
);
assert.equal(contract.nuisanceClass, "head_roll");
assert.equal(spec.schemaVersion, "face-lab-manual-roll-capture-spec-v0");
assert.equal(spec.nuisanceClass, "head_roll");
assert.ok(
  typeof spec.captureSetRef === "string" &&
    spec.captureSetRef.trim().length > 0
);
assert.ok(
  typeof spec.usageScope === "string" &&
    spec.usageScope.trim().length > 0
);
assert.equal(
  spec.commercialResearchUseAuthorized,
  true,
  "manual_roll_commercial_research_use_must_be_explicit"
);
assert.ok(Array.isArray(spec.subjects) && spec.subjects.length > 0);

const subjectIds = new Set();
const pairs = [];

for (const subject of spec.subjects) {
  assert.ok(
    typeof subject.subjectId === "string" &&
      /^[a-zA-Z0-9_-]+$/.test(subject.subjectId)
  );
  assert.equal(subjectIds.has(subject.subjectId), false);
  subjectIds.add(subject.subjectId);

  assert.ok(
    typeof subject.consentEvidenceRef === "string" &&
      subject.consentEvidenceRef.trim().length > 0
  );
  assert.ok(
    typeof subject.sessionRef === "string" &&
      subject.sessionRef.trim().length > 0
  );
  assert.equal(subject.sameSession, true);
  assert.equal(subject.explicitConsent, true);
  assert.equal(subject.biometricIdentityMatchPerformed, false);
  assert.equal(subject.syntheticRotationApplied, false);
  assert.equal(subject.warpAugmentationApplied, false);

  for (const view of ["neutralFront", "rollLeft", "rollRight"]) {
    assert.ok(subject[view]);
    assert.ok(
      typeof subject[view].path === "string" &&
        subject[view].path.trim().length > 0
    );
  }

  const reference = {
    sampleId: subject.subjectId + "_neutral_front",
    path: path.resolve(subject.neutralFront.path)
  };

  for (const [side, view] of [
    ["left", subject.rollLeft],
    ["right", subject.rollRight]
  ]) {
    pairs.push({
      pairGroupId:
        "manual_roll_" + subject.subjectId + "_" + side,
      nuisanceClass: "head_roll",
      subjectLinkage: {
        method: "manual_same_subject_pair",
        evidenceRef:
          subject.consentEvidenceRef +
          "#session-" +
          subject.sessionRef
      },
      reference,
      candidate: {
        sampleId: subject.subjectId + "_roll_" + side,
        path: path.resolve(view.path)
      }
    });
  }
}

const scaffold = scaffoldRealPhotoStabilityRunManifest({
  schemaVersion: "face-lab-real-photo-stability-scaffold-spec-v0",
  sourceSet: {
    kind: "consented_same_subject_photo_set",
    provenanceRef: spec.captureSetRef
  },
  pairs
});

assert.equal(scaffold.summary.pairCount, spec.subjects.length * 2);
assert.equal(
  scaffold.summary.opaqueSampleCount,
  spec.subjects.length * 3
);
assert.deepEqual(scaffold.summary.coveredNuisanceClasses, ["head_roll"]);
assert.deepEqual(scaffold.summary.missingNuisanceClasses, [
  "expression",
  "head_pitch",
  "head_yaw"
]);
assert.equal(scaffold.summary.completeNuisanceCoverage, false);

writeFileSync(
  outputPath,
  JSON.stringify(scaffold.manifest, null, 2) + "\n",
  "utf8"
);

console.log(JSON.stringify({
  ok: true,
  subjectCount: spec.subjects.length,
  pairCount: scaffold.summary.pairCount,
  manifestDigest: scaffold.summary.manifestDigest,
  coveredNuisanceClasses: scaffold.summary.coveredNuisanceClasses,
  missingNuisanceClasses: scaffold.summary.missingNuisanceClasses,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
}, null, 2));
