import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api =
  readFileSync(
    "app/api/face-lab-simulation-private-review/route.js",
    "utf8"
  );
const page =
  readFileSync(
    "app/face-lab-test/pilot-review/page.js",
    "utf8"
  );
const client =
  readFileSync(
    "components/face-lab-test/FaceLabPilotReviewBoard.jsx",
    "utf8"
  );
const batch =
  readFileSync(
    "scripts/run-face-lab-v2-g-e2b-private-campaign.mjs",
    "utf8"
  );

for (
  const required of
  [
    'process.env.NODE_ENV === "production"',
    "buildFaceLabSimulationIdentityScopeReview",
    "buildFaceLabSimulationRouteColorReview",
    "buildFaceLabSimulationPilotCapture",
    "private_review_route_disabled",
    "changeTolerance",
    "routeSelectionState",
    '"user_selected"'
  ]
) {
  assert.ok(
    api.includes(
      required
    ),
    `private review API missing contract fragment: ${required}`
  );
}

assert.ok(
  page.includes(
    'process.env.NODE_ENV === "production"'
  ) &&
  page.includes(
    "notFound()"
  ),
  "private review page must be production-disabled"
);

for (
  const required of
  [
    "showDirectoryPicker",
    "manifest.json",
    "reviewInputFile",
    "sourceImagePath",
    "outputImagePath",
    "FaceLabSimulationReviewPanel",
    "/api/face-lab-simulation-private-review",
    "payload.capture",
    ".fileNames",
    ".sourceImage",
    ".outputImage",
    "runSpecFileName",
    "Human Review 8/8 저장 완료"
  ]
) {
  assert.ok(
    client.includes(
      required
    ),
    `private review board missing contract fragment: ${required}`
  );
}

for (
  const forbidden of
  [
    "data:image",
    "reviewTicket",
    "simulationAuthority",
    "sourceImageBytes",
    "outputImageBytes"
  ]
) {
  assert.equal(
    api.includes(
      forbidden
    ),
    false,
    `private review API must not receive or retain image/provider authority material: ${forbidden}`
  );
}

for (
  const required of
  [
    ".pilot-case-run.json",
    "run-face-lab-v2-simulation-pilot-case.mjs",
    "aggregateFaceLabSimulationCalibration",
    "buildFaceLabSimulationPilotCloseout",
    "g_e2b_requires_exactly_eight_reviewed_run_specs",
    "g_e2b_requires_four_intent_groups",
    "acceptedNotAssessableFailure",
    "FACE_LAB_G_E2B_CASE_PROCESSING_BLOCKED",
    "campaign.blockers.json",
    "campaign.closeout.json",
    "incompleteCheckId",
    "FACE_LAB_G_E2C_PILOT_CLOSEOUT_READY",
    "FACE_LAB_G_E2C_HARD_FAILURE_STOP"
  ]
) {
  assert.ok(
    batch.includes(
      required
    ),
    `private campaign batch runner missing contract fragment: ${required}`
  );
}

assert.equal(
  batch.includes("fetch("),
  false,
  "private campaign batch runner must not invoke network"
);

console.log(
  "FACE_LAB_G_E2B_PRIVATE_REVIEW_BOARD=PASS"
);
