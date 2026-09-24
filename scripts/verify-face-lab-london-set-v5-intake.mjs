import assert from "node:assert/strict";
import {
  buildLondonSetV5FrontScaffoldSpecs
} from "../lib/face-lab-london-set-v5-intake.js";

function record(index) {
  const subjectId = String(index + 1).padStart(3, "0");
  return {
    subjectId,
    split: index < 82 ? "reference" : "holdout",
    qualityStatus: "pending_local_measurement_review",
    neutralFrontPath: "/tmp/london/neutral_front/" + subjectId + "_03.jpg",
    smilingFrontPath: "/tmp/london/smiling_front/" + subjectId + "_08.jpg"
  };
}

const intake = {
  schemaVersion: "face-lab-london-set-v5-front-intake-v0",
  records: Array.from({ length: 102 }, (_, index) => record(index))
};

const result = buildLondonSetV5FrontScaffoldSpecs(intake);
assert.equal(
  result.schemaVersion,
  "face-lab-london-set-v5-front-scaffold-specs-v0"
);
assert.equal(result.source.subjectCount, 102);
assert.equal(result.source.automaticSplitSelection, false);
assert.equal(result.referenceCorpusSpec.records.length, 102);
assert.equal(result.expressionStabilitySpec.pairs.length, 102);
assert.deepEqual(
  new Set(result.referenceCorpusSpec.records.map((item) => item.split)),
  new Set(["reference", "holdout"])
);
assert.equal(
  result.expressionStabilitySpec.pairs.every(
    (pair) =>
      pair.nuisanceClass === "expression" &&
      pair.subjectLinkage.method === "dataset_same_subject_provenance"
  ),
  true
);
assert.equal(result.unsupportedByFrontMirror.headYaw, true);
assert.equal(result.unsupportedByFrontMirror.headPitch, true);
assert.equal(result.unsupportedByFrontMirror.headRoll, true);
assert.equal(result.authority.productionAuthority, false);
assert.equal(result.authority.normalizationAuthority, false);
assert.equal(result.authority.thresholdAuthority, false);
assert.equal(result.authority.adequacyDecisionAuthority, false);

const duplicate = structuredClone(intake);
duplicate.records[101].subjectId = duplicate.records[100].subjectId;
duplicate.records[101].neutralFrontPath =
  "/tmp/london/neutral_front/" + duplicate.records[100].subjectId + "_03.jpg";
duplicate.records[101].smilingFrontPath =
  "/tmp/london/smiling_front/" + duplicate.records[100].subjectId + "_08.jpg";
assert.throws(
  () => buildLondonSetV5FrontScaffoldSpecs(duplicate),
  /subject_duplicate/
);

const wrongNeutral = structuredClone(intake);
wrongNeutral.records[0].neutralFrontPath =
  "/tmp/london/neutral_front/001_08.jpg";
assert.throws(
  () => buildLondonSetV5FrontScaffoldSpecs(wrongNeutral),
  /front_record_invalid/
);

const noHoldout = structuredClone(intake);
for (const item of noHoldout.records) item.split = "reference";
assert.throws(
  () => buildLondonSetV5FrontScaffoldSpecs(noHoldout),
  /subject_split_missing/
);

console.log(JSON.stringify({
  ok: true,
  subjectCountRequired: 102,
  referenceCorpusSpecGenerated: true,
  expressionPairSpecGenerated: true,
  automaticSplitSelection: false,
  headYawGenerated: false,
  headPitchGenerated: false,
  headRollGenerated: false,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false,
  adequacyDecisionAuthority: false
}, null, 2));
