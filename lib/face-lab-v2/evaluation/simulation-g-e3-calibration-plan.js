export const FACE_LAB_G_E3_CALIBRATION_PLAN_VERSION =
  "face-lab-g-e3-balanced-contrast-plan-v2";

export const FACE_LAB_G_E3_SURVEY_PROFILE_VERSION =
  "face-lab-g-e3-masculine-target-forward-survey-v1";

const FIXED_STYLING_SCOPE =
  Object.freeze([
    "hair",
    "brow_grooming",
    "makeup",
    "color",
    "eyewear",
    "accessories",
    "facial_hair"
  ]);

const FIXED_CONSTRAINTS =
  Object.freeze({
    hair: Object.freeze({
      lengthChange: "large",
      dye: "yes"
    }),
    makeup: Object.freeze({
      intensity: "medium"
    }),
    lifestyle: Object.freeze({
      dailyMinutes: 30,
      budgetBand: "standard",
      maintenanceTolerance: "medium"
    }),
    hardExclusions: Object.freeze([
      "facial_hair_disabled"
    ])
  });

const WAVE_PLANS =
  Object.freeze({
    "wave-01": Object.freeze({
      intentOffset: 0,
      targetKeys: Object.freeze([
        "natural",
        "cute_playful",
        "mature_calm",
        "defined"
      ])
    }),
    "wave-02": Object.freeze({
      intentOffset: 4,
      targetKeys: Object.freeze([
        "clear_soft",
        "sophisticated",
        "statement_glam",
        "classic"
      ])
    }),
    "wave-03": Object.freeze({
      intentOffset: 8,
      targetKeys: Object.freeze([
        "soft",
        "chic",
        "minimal",
        "trendy"
      ])
    })
  });

function cloneConstraints() {
  return {
    hair: {
      ...FIXED_CONSTRAINTS.hair
    },
    makeup: {
      ...FIXED_CONSTRAINTS.makeup
    },
    lifestyle: {
      ...FIXED_CONSTRAINTS.lifestyle
    },
    hardExclusions: [
      ...FIXED_CONSTRAINTS
        .hardExclusions
    ]
  };
}

export function getFaceLabGE3CalibrationWavePlan(
  waveId
) {
  const wave =
    WAVE_PLANS[waveId];

  if (!wave) {
    return null;
  }

  return {
    planVersion:
      FACE_LAB_G_E3_CALIBRATION_PLAN_VERSION,
    surveyProfileVersion:
      FACE_LAB_G_E3_SURVEY_PROFILE_VERSION,
    waveId,
    intentOffset:
      wave.intentOffset,
    targetKeys: [
      ...wave.targetKeys
    ],
    surveyProfile: {
      presentationPreference:
        "masculine_examples",
      stylingScope: [
        ...FIXED_STYLING_SCOPE
      ],
      changeTolerance:
        "moderate",
      contexts: [
        "daily"
      ],
      recommendationPriority:
        "target_forward",
      constraints:
        cloneConstraints()
    }
  };
}

export function applyFaceLabGE3CalibrationSurveyProfile({
  surveyAnswers,
  targetKey,
  waveId
} = {}) {
  const plan =
    getFaceLabGE3CalibrationWavePlan(
      waveId
    );

  if (
    !plan ||
    !plan.targetKeys.includes(
      targetKey
    )
  ) {
    throw new Error(
      "g_e3_calibration_target_not_in_wave_plan"
    );
  }

  return {
    ...structuredClone(
      surveyAnswers || {}
    ),
    targetSelections: [
      targetKey
    ],
    presentationPreference:
      plan.surveyProfile
        .presentationPreference,
    stylingScope: [
      ...plan.surveyProfile
        .stylingScope
    ],
    changeTolerance:
      plan.surveyProfile
        .changeTolerance,
    contexts: [
      ...plan.surveyProfile
        .contexts
    ],
    recommendationPriority:
      plan.surveyProfile
        .recommendationPriority,
    constraints:
      structuredClone(
        plan.surveyProfile
          .constraints
      )
  };
}

export function listFaceLabGE3CalibrationWavePlans() {
  return Object.keys(
    WAVE_PLANS
  ).map(
    getFaceLabGE3CalibrationWavePlan
  );
}
