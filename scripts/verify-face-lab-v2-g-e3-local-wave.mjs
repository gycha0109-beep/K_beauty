import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  buildFaceLabV2CoverageCohort
} from "../lib/face-lab-v2/evaluation/harness.js";
import {
  TARGET_STYLE_REGISTRY,
  getTargetStylePrototype
} from "../lib/face-lab-v2/target-style-registry.js";
import {
  FACE_LAB_G_E3_CALIBRATION_PLAN_VERSION,
  FACE_LAB_G_E3_SURVEY_PROFILE_VERSION,
  listFaceLabGE3CalibrationWavePlans
} from "../lib/face-lab-v2/evaluation/simulation-g-e3-calibration-plan.js";

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
  "FACE_LAB_G_E3_WAVE_READY_FOR_HUMAN_REVIEW",
  "evaluationPlanVersion",
  "surveyProfileVersion",
  "previousPlanCompatible",
  "g_e3_wave_case_plan_binding_invalid"
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

for (const marker of [
  "getFaceLabGE3CalibrationWavePlan",
  "applyFaceLabGE3CalibrationSurveyProfile",
  "intentPlanVersion",
  "surveyProfileVersion",
  "intentKeys",
  "presentationPreference",
  "changeTolerance"
]) {
  assert.ok(
    provider.includes(marker),
    "missing G-E3 plan binding marker: " +
      marker
  );
}

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

const plans =
  listFaceLabGE3CalibrationWavePlans();

assert.equal(
  plans.length,
  3
);
assert.equal(
  new Set(
    plans.flatMap(
      (plan) =>
        plan.targetKeys
    )
  ).size,
  12,
  "G-E3 must cover every target exactly once"
);
assert.deepEqual(
  plans.map(
    (plan) =>
      plan.targetKeys
  ),
  [
    [
      "natural",
      "cute_playful",
      "mature_calm",
      "defined"
    ],
    [
      "clear_soft",
      "sophisticated",
      "statement_glam",
      "classic"
    ],
    [
      "soft",
      "chic",
      "minimal",
      "trendy"
    ]
  ]
);

for (const plan of plans) {
  assert.equal(
    plan.planVersion,
    FACE_LAB_G_E3_CALIBRATION_PLAN_VERSION
  );
  assert.equal(
    plan.surveyProfileVersion,
    FACE_LAB_G_E3_SURVEY_PROFILE_VERSION
  );
  assert.equal(
    plan.surveyProfile
      .presentationPreference,
    "masculine_examples"
  );
  assert.equal(
    plan.surveyProfile
      .changeTolerance,
    "moderate"
  );
  assert.equal(
    plan.surveyProfile
      .recommendationPriority,
    "target_forward"
  );
  assert.deepEqual(
    plan.surveyProfile
      .stylingScope,
    [
      "hair",
      "brow_grooming",
      "makeup",
      "color",
      "eyewear",
      "accessories",
      "facial_hair"
    ]
  );

  const vectors =
    plan.targetKeys.map(
      getTargetStylePrototype
    );

  for (
    let left = 0;
    left < vectors.length;
    left += 1
  ) {
    for (
      let right =
        left + 1;
      right < vectors.length;
      right += 1
    ) {
      const axes =
        Object.keys(
          vectors[left]
        );
      const distance =
        Math.sqrt(
          axes.reduce(
            (sum, axis) =>
              sum +
              (
                vectors[left][axis] -
                vectors[right][axis]
              ) ** 2,
            0
          )
        );

      assert.ok(
        distance >= 0.4,
        `G-E3 wave contrast collapsed: ${plan.waveId} ${plan.targetKeys[left]} vs ${plan.targetKeys[right]} = ${distance}`
      );
    }
  }
}

assert.notDeepEqual(
  plans[0].targetKeys,
  Object.keys(
    TARGET_STYLE_REGISTRY
  ).slice(
    0,
    4
  ),
  "G-E3 must not regress to registry-order wave slicing"
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
