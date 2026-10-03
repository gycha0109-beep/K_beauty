import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  buildFaceLabV2CoverageCohort
} from "../lib/face-lab-v2/evaluation/harness.js";
import {
  TARGET_STYLE_REGISTRY
} from "../lib/face-lab-v2/target-style-registry.js";

const source =
  readFileSync(
    "scripts/run-face-lab-v2-g-e3-local-wave.mjs",
    "utf8"
  );
const provider =
  readFileSync(
    "scripts/run-face-lab-v2-simulation-provider-pilot-e2e.mjs",
    "utf8"
  );

for (const required of [
  '".env.local"',
  '"FACE_LAB_E2E_EMAIL_A"',
  '"FACE_LAB_E2E_PASSWORD_A"',
  '"FACE_LAB_E2E_EMAIL_B"',
  '"FACE_LAB_E2E_PASSWORD_B"',
  "FACE_LAB_E2E_INTENT_OFFSET",
  "FACE_LAB_E2E_CAMPAIGN_ROOT",
  "FACE_LAB_E2E_CALIBRATION_STAGE",
  "FACE_LAB_E2E_WAVE_ID",
  '"face-lab-g-e3"',
  '"G-E3"',
  "current-campaign.json",
  "canary-gate.json",
  "g_e3_run_mode_required",
  "g_e3_local_base_url_required",
  "g_e3_canary_already_started",
  "g_e3_canary_hard_stop_failed",
  "g_e3_canary_approval_required",
  "g_e3_canary_approval_binding_mismatch",
  "FACE_LAB_E2E_NEW_OUTPUT_BUDGET",
  "FACE_LAB_G_E3_PRECHECK_PASS",
  "FACE_LAB_G_E3_CANARY_READY_FOR_REVIEW",
  "FACE_LAB_G_E3_CANARY_APPROVED",
  "FACE_LAB_G_E3_CANARY_REJECTED",
  "g_e3_campaign_runtime_binding_mismatch_",
  "g_e3_source_binding_mismatch",
  "FACE_LAB_G_E3_WAVE_READY_FOR_HUMAN_REVIEW"
]) {
  assert.ok(
    source.includes(
      required
    ),
    "missing G-E3 wave launcher marker: " +
      required
  );
}

assert.ok(
  provider.includes(
    'parseBoundedInt("FACE_LAB_E2E_INTENT_OFFSET", 0, 0, 11)'
  )
);
assert.ok(
  provider.includes(
    "intentOffset + intentCount > 12"
  )
);
assert.ok(
  provider.includes(
    '["face-lab-g-e2b", "face-lab-g-e3"]'
  )
);
assert.ok(
  provider.includes(
    '["G-E2B", "G-E3"]'
  )
);
assert.ok(
  provider.includes(
    "globalIndex + 1"
  )
);

assert.ok(
  source.includes(
    'newOutputBudget: 1'
  ),
  "G-E3 canary must permit exactly one new paid output"
);
assert.ok(
  source.includes(
    'providerCalls: 0'
  ),
  "precheck/approval paths must expose zero provider calls"
);
assert.ok(
  source.includes(
    'mode === "approve" ||\n  mode === "reject"'
  ),
  "G-E3 human gate transition must be explicit"
);
assert.ok(
  source.includes(
    'mode === "resume"'
  ),
  "G-E3 resume mode missing"
);
assert.ok(
  source.includes(
    "TARGET_CASE_COUNT -\n    checkpoint.cases.length"
  ),
  "resume must derive its paid budget from persisted progress"
);

for (const forbidden of [
  "console.log(credentials",
  "console.log(accountA.accessToken",
  "console.log(accountB.accessToken"
]) {
  assert.equal(
    source.includes(
      forbidden
    ),
    false
  );
}

const coverage =
  buildFaceLabV2CoverageCohort();
const distinctTargets =
  new Set(
    coverage.cases.map(
      (item) =>
        item.surveyAnswers
          .targetSelections[0]
    )
  );

assert.equal(
  Object.keys(
    TARGET_STYLE_REGISTRY
  ).length,
  12
);
assert.equal(
  distinctTargets.size,
  12
);
assert.ok(
  coverage.caseCount >= 96
);

console.log(
  "FACE_LAB_G_E3_LOCAL_WAVE_LAUNCHER=PASS"
);
