import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const evidence = JSON.parse(
  readFileSync(
    "evidence/facelab/face-lab-g-e2c-protocol-freeze-20261002-v1.json",
    "utf8"
  )
);

assert.equal(
  evidence.schemaVersion,
  "face-lab-g-e2c-protocol-freeze-evidence-v1"
);
assert.equal(
  evidence.status,
  "protocol_frozen_ready_for_g_e3"
);
assert.equal(
  evidence.pilot.reviewedCaseCount,
  8
);
assert.equal(
  evidence.pilot.admittedCalibrationCaseCount,
  6
);
assert.equal(
  evidence.pilot.acceptedNotAssessableCaseCount,
  2
);
assert.equal(
  evidence.calibration.hardFailureCaseCount,
  0
);
assert.deepEqual(
  evidence.calibration.verdictCounts,
  {
    pass: 4,
    review: 2
  }
);
assert.equal(
  evidence.calibration.findingCodeCounts.OVER_EDITED,
  3
);
assert.equal(
  evidence.calibration.repeatVariance.routeResponseVarianceGroupCount,
  0
);
assert.equal(
  evidence.calibration.repeatVariance.colorResponseVarianceGroupCount,
  0
);
assert.equal(
  evidence.freeze.requiredAxes.length,
  4
);
assert.equal(
  evidence.freeze.notAssessablePolicy,
  "retain_human_observation_exclude_from_calibration_case"
);
assert.equal(
  evidence.freeze.thresholdPolicy,
  "no_numeric_promotion_thresholds_frozen"
);
assert.equal(
  evidence.decision.hardFailureStop,
  false
);
assert.equal(
  evidence.decision.nextStage,
  "G-E3_FULL_CALIBRATION"
);
assert.deepEqual(
  evidence.decision.fullCalibrationShape,
  {
    intentCount: 12,
    generationsPerIntent: 2,
    outputCount: 24,
    waveCount: 3,
    intentsPerWave: 4,
    outputsPerWave: 8
  }
);

const serialized =
  JSON.stringify(evidence);

for (const forbidden of [
  "qualityThreshold",
  "promotionThreshold",
  "productionFidelity",
  "face-lab-review:",
  "reviewerRef",
  "sourceImageSha256",
  "outputImageSha256"
]) {
  assert.equal(
    serialized.includes(forbidden),
    false,
    "protocol freeze contains forbidden detail: " +
      forbidden
  );
}

console.log(
  "FACE_LAB_G_E2C_PROTOCOL_FREEZE=PASS"
);
