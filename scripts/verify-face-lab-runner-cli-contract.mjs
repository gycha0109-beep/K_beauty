import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  scaffoldRealPhotoStabilityRunManifest,
  scaffoldReferenceCorpusSourceManifest
} from "../lib/face-lab-source-manifest-scaffold.js";

function runValidateOnly(scriptPath, manifestPath) {
  const result = spawnSync(
    process.execPath,
    [scriptPath, manifestPath, "--validate-only"],
    {
      cwd: process.cwd(),
      encoding: "utf8"
    }
  );
  assert.equal(
    result.status,
    0,
    result.stderr || result.stdout || "validate-only runner failed"
  );
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "facelab-runner-cli-"));
try {
  const makeImage = (name) => {
    const filePath = join(root, name);
    writeFileSync(filePath, "fixture:" + name);
    return filePath;
  };

  const baseline = makeImage("baseline.png");
  const yaw = makeImage("yaw.png");
  const pitch = makeImage("pitch.jpg");
  const roll = makeImage("roll.jpeg");
  const expression = makeImage("expression.png");

  const realPhoto = scaffoldRealPhotoStabilityRunManifest({
    schemaVersion: "face-lab-real-photo-stability-scaffold-spec-v0",
    sourceSet: {
      kind: "manual_research_capture",
      provenanceRef: "synthetic-cli-verifier:real-photo"
    },
    pairs: [
      ["yaw", "head_yaw", yaw],
      ["pitch", "head_pitch", pitch],
      ["roll", "head_roll", roll],
      ["expression", "expression", expression]
    ].map(([id, nuisanceClass, candidatePath]) => ({
      pairGroupId: "pair_" + id,
      nuisanceClass,
      subjectLinkage: {
        method: "manual_same_subject_pair",
        evidenceRef: "synthetic-cli-verifier:" + id
      },
      reference: {
        sampleId: "baseline",
        path: baseline
      },
      candidate: {
        sampleId: id,
        path: candidatePath
      }
    }))
  });
  const realManifestPath = join(root, "real-photo-manifest.json");
  writeFileSync(
    realManifestPath,
    JSON.stringify(realPhoto.manifest, null, 2)
  );

  const realOutput = runValidateOnly(
    "scripts/run-face-lab-real-photo-stability-pairs.mjs",
    realManifestPath
  );
  assert.equal(realOutput.ok, true);
  assert.equal(realOutput.validateOnly, true);
  assert.equal(realOutput.manifestSummary.completeNuisanceCoverage, true);
  assert.equal(realOutput.authority.productionAuthority, false);
  assert.equal(realOutput.authority.normalizationAuthority, false);
  assert.equal(realOutput.authority.thresholdAuthority, false);

  const referenceFiles = [
    ["ref_a", "subject_a", "reference", "a.png", "family_a"],
    ["ref_b", "subject_b", "reference", "b.png", "family_b"],
    ["ref_c", "subject_c", "reference", "c.jpg", "family_c"],
    ["holdout_d", "subject_d", "holdout", "d.jpeg", "family_d"]
  ];
  const reference = scaffoldReferenceCorpusSourceManifest({
    schemaVersion:
      "face-space-reference-corpus-source-scaffold-spec-v0",
    samplingFrame: {
      kind: "consented_general_face_corpus",
      provenanceRef: "synthetic-cli-verifier:reference-corpus"
    },
    subjectGrouping: {
      method: "manual_research_grouping",
      evidenceRef: "synthetic-cli-verifier:subject-map"
    },
    records: referenceFiles.map(
      ([sampleId, subjectGroupId, split, name, family]) => ({
        sampleId,
        subjectGroupId,
        split,
        nearDuplicateFamilyId: family,
        provenanceRef: "synthetic-cli-verifier:" + sampleId,
        qualityStatus: "synthetic_verifier_only",
        path: makeImage(name)
      })
    )
  });
  const referenceManifestPath = join(
    root,
    "reference-corpus-manifest.json"
  );
  writeFileSync(
    referenceManifestPath,
    JSON.stringify(reference.manifest, null, 2)
  );

  const referenceOutput = runValidateOnly(
    "scripts/run-face-lab-reference-corpus-measurement.mjs",
    referenceManifestPath
  );
  assert.equal(referenceOutput.ok, true);
  assert.equal(referenceOutput.validateOnly, true);
  assert.equal(
    referenceOutput.schemaVersion,
    "face-space-reference-corpus-measurement-run-output-v0"
  );
  assert.equal(
    referenceOutput.sourceSummary.recordCount,
    4
  );
  assert.equal(referenceOutput.authority.productionAuthority, false);
  assert.equal(referenceOutput.authority.normalizationAuthority, false);
  assert.equal(referenceOutput.authority.thresholdAuthority, false);

  console.log(JSON.stringify({
    ok: true,
    realPhotoValidateOnlyCli: true,
    referenceCorpusValidateOnlyCli: true,
    undefinedOutputRegressionGuarded: true,
    productionAuthority: false,
    normalizationAuthority: false,
    thresholdAuthority: false
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
