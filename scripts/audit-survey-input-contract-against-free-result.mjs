import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSurveyInputContract } from "../lib/survey-input-contract.js";

const OUTPUT_DIR = path.join(process.cwd(), "tmp", "survey-input-contract-audit");
const GENERATED_AT = "2026-07-02T00:00:00.000Z";
const CONCERN_AXES = [
  "barrier",
  "dehydration",
  "oiliness",
  "redness",
  "acne",
  "pores",
  "uneven_tone",
  "uv"
];
const PRIORITY_TIEBREAKER = [
  "uv",
  "barrier",
  "redness",
  "dehydration",
  "acne",
  "pores",
  "oiliness",
  "uneven_tone"
];
const FUNCTIONAL_LANE_BY_CONCERN = {
  oiliness: "oil_acne",
  acne: "oil_acne",
  pores: "pores_texture",
  dehydration: "hydration",
  redness: "barrier_redness",
  barrier: "barrier_redness",
  uneven_tone: "tone_care",
  uv: "uv_protection"
};

const DEFAULT_FORM = {
  skinType: "combination",
  sensitivity: "medium",
  mainConcerns: [],
  primaryConcern: "",
  recentSkinChange: "no",
  recentlyChangedProduct: "no",
  postWashFeeling: "comfortable",
  afternoonSkinChange: "mostly_same",
  cleansingFrequency: "twice",
  environmentExposure: [],
  preferredTexture: "lotion",
  mostDislikedFeel: "sticky",
  whiteCastHate: false,
  toneUpWanted: false,
  makeupUse: false,
  eyeSensitive: false,
  sunscreenPreferenceState: "answered",
  genderPreference: "unspecified"
};

const FIXTURES = [
  {
    id: "oily-oiliness-pores",
    label: "Oily skin with oiliness and pores",
    form: {
      skinType: "oily",
      mainConcerns: ["oiliness", "pores"],
      primaryConcern: "oiliness",
      afternoonSkinChange: "more_oily"
    },
    expect: {
      primaryConcern: "oiliness",
      lane: "oil_acne"
    }
  },
  {
    id: "dry-dehydration",
    label: "Dry skin with dehydration",
    form: {
      skinType: "dry",
      mainConcerns: ["dehydration"],
      primaryConcern: "dehydration",
      postWashFeeling: "tight",
      afternoonSkinChange: "more_dry"
    },
    expect: {
      primaryConcern: "dehydration",
      lane: "hydration",
      drynessRisk: "high"
    }
  },
  {
    id: "sensitive-redness-barrier",
    label: "Sensitive skin with redness and barrier",
    form: {
      sensitivity: "high",
      mainConcerns: ["redness", "barrier"],
      primaryConcern: "redness",
      afternoonSkinChange: "red_or_irritated"
    },
    expect: {
      primaryConcern: "redness",
      lane: "barrier_redness",
      sensitivityRisk: "high",
      rednessRisk: "high"
    }
  },
  {
    id: "combination-acne-oiliness",
    label: "Combination skin with acne and oiliness",
    form: {
      skinType: "combination",
      mainConcerns: ["acne", "oiliness"],
      primaryConcern: "acne",
      afternoonSkinChange: "more_oily"
    },
    expect: {
      primaryConcern: "acne",
      lane: "oil_acne"
    }
  },
  {
    id: "uneven-tone-only",
    label: "Uneven tone only",
    form: {
      mainConcerns: ["uneven_tone"],
      primaryConcern: "uneven_tone"
    },
    expect: {
      primaryConcern: "uneven_tone",
      lane: "tone_care"
    }
  },
  {
    id: "empty-main-concerns",
    label: "Empty mainConcerns",
    form: {
      skinType: "not_sure",
      mainConcerns: [],
      primaryConcern: ""
    },
    expect: {
      unresolvedPrimaryConcern: true,
      warning: "primaryConcern_missing"
    }
  },
  {
    id: "invalid-concern",
    label: "Invalid concern excluded",
    form: {
      mainConcerns: ["redness", "invalid_concern", "barrier"],
      primaryConcern: "redness"
    },
    expect: {
      primaryConcern: "redness",
      warning: "mainConcerns_invalid_values_excluded"
    }
  },
  {
    id: "sunscreen-false-only",
    label: "Sunscreen booleans false only",
    form: {
      mainConcerns: ["uv"],
      primaryConcern: "uv",
      sunscreenPreferenceState: undefined,
      whiteCastHate: false,
      toneUpWanted: false,
      makeupUse: false,
      eyeSensitive: false
    },
    expect: {
      warning: "sunscreen_boolean_false_ambiguous",
      sourceCompleteness: "ambiguous_boolean_defaults"
    }
  },
  {
    id: "sunscreen-answered-false-only",
    label: "Sunscreen answered with all booleans false",
    form: {
      mainConcerns: ["uv"],
      primaryConcern: "uv",
      sunscreenPreferenceState: "answered",
      whiteCastHate: false,
      toneUpWanted: false,
      makeupUse: false,
      eyeSensitive: false
    },
    expect: {
      sourceCompleteness: "answered"
    }
  },
  {
    id: "future-recent-change",
    label: "Future recent skin and product change fields",
    form: {
      mainConcerns: ["barrier", "redness"],
      primaryConcern: "barrier",
      recentSkinChange: "yes",
      recentlyChangedProduct: "yes"
    },
    expect: {
      recentSkinChange: "yes",
      recentlyChangedProduct: "yes"
    }
  },
  {
    id: "preference-conflict",
    label: "Preference texture and disliked feel conflict",
    form: {
      mainConcerns: ["dehydration"],
      primaryConcern: "dehydration",
      preferredTexture: "cream",
      mostDislikedFeel: "heavy"
    },
    expect: {
      primaryConcern: "dehydration",
      preferredTexture: "cream",
      mostDislikedFeel: "heavy"
    }
  }
];

function createScoreCard() {
  return Object.fromEntries(
    CONCERN_AXES.map((axis) => [axis, { total: 0, survey: 0, photo: 0, environment: 0 }])
  );
}

function addScore(scoreCard, axis, source, value) {
  if (!scoreCard[axis]) {
    return;
  }

  scoreCard[axis][source] += value;
  scoreCard[axis].total += value;
}

function applySurveyWeights(scoreCard, form) {
  const mainConcerns = Array.isArray(form.mainConcerns) && form.mainConcerns.length
    ? form.mainConcerns.filter((axis) => CONCERN_AXES.includes(axis))
    : form.mainConcern && CONCERN_AXES.includes(form.mainConcern)
      ? [form.mainConcern]
      : [];

  mainConcerns.forEach((axis, index) => {
    addScore(scoreCard, axis, "survey", index === 0 ? 22 : 10);
  });

  switch (form.skinType) {
    case "dry":
      addScore(scoreCard, "dehydration", "survey", 8);
      addScore(scoreCard, "barrier", "survey", 5);
      break;
    case "oily":
      addScore(scoreCard, "oiliness", "survey", 8);
      addScore(scoreCard, "pores", "survey", 5);
      addScore(scoreCard, "acne", "survey", 3);
      break;
    case "combination":
      addScore(scoreCard, "oiliness", "survey", 4);
      addScore(scoreCard, "dehydration", "survey", 3);
      addScore(scoreCard, "pores", "survey", 3);
      break;
    default:
      break;
  }

  if (form.sensitivity === "high") {
    addScore(scoreCard, "barrier", "survey", 8);
    addScore(scoreCard, "redness", "survey", 7);
  } else if (form.sensitivity === "medium") {
    addScore(scoreCard, "barrier", "survey", 4);
    addScore(scoreCard, "redness", "survey", 3);
  }

  if (form.postWashFeeling === "tight") {
    addScore(scoreCard, "dehydration", "survey", 8);
    addScore(scoreCard, "barrier", "survey", 5);
    addScore(scoreCard, "redness", "survey", 2);
  }

  if (form.postWashFeeling === "still_oily") {
    addScore(scoreCard, "oiliness", "survey", 8);
    addScore(scoreCard, "pores", "survey", 5);
    addScore(scoreCard, "acne", "survey", 3);
  }

  if (form.afternoonSkinChange === "more_oily") {
    addScore(scoreCard, "oiliness", "survey", 7);
    addScore(scoreCard, "pores", "survey", 4);
    addScore(scoreCard, "acne", "survey", 2);
  }

  if (form.afternoonSkinChange === "more_dry") {
    addScore(scoreCard, "dehydration", "survey", 7);
    addScore(scoreCard, "barrier", "survey", 4);
  }

  if (form.afternoonSkinChange === "red_or_irritated") {
    addScore(scoreCard, "redness", "survey", 8);
    addScore(scoreCard, "barrier", "survey", 5);
  }

  if (form.cleansingFrequency === "3_plus") {
    addScore(scoreCard, "barrier", "survey", 3);
    addScore(scoreCard, "dehydration", "survey", 2);
  }

  if (form.whiteCastHate) {
    addScore(scoreCard, "uv", "survey", 3);
  }

  if (form.toneUpWanted) {
    addScore(scoreCard, "uv", "survey", 2);
    addScore(scoreCard, "uneven_tone", "survey", 1);
  }

  if (form.makeupUse) {
    addScore(scoreCard, "pores", "survey", 2);
    addScore(scoreCard, "uv", "survey", 1);
  }

  if (form.eyeSensitive) {
    addScore(scoreCard, "redness", "survey", 2);
    addScore(scoreCard, "barrier", "survey", 1);
    addScore(scoreCard, "uv", "survey", 1);
  }
}

function applyEnvironmentWeights(scoreCard, form) {
  const exposureList = Array.isArray(form.environmentExposure) ? form.environmentExposure : [];

  exposureList.forEach((exposure) => {
    switch (exposure) {
      case "heat":
        addScore(scoreCard, "oiliness", "environment", 4);
        addScore(scoreCard, "redness", "environment", 2);
        addScore(scoreCard, "uv", "environment", 2);
        break;
      case "humidity":
        addScore(scoreCard, "oiliness", "environment", 4);
        addScore(scoreCard, "pores", "environment", 2);
        addScore(scoreCard, "acne", "environment", 2);
        break;
      case "mask":
        addScore(scoreCard, "redness", "environment", 4);
        addScore(scoreCard, "acne", "environment", 4);
        addScore(scoreCard, "barrier", "environment", 2);
        break;
      case "kitchen":
        addScore(scoreCard, "redness", "environment", 3);
        addScore(scoreCard, "oiliness", "environment", 3);
        addScore(scoreCard, "uv", "environment", 1);
        break;
      case "outdoor":
        addScore(scoreCard, "uv", "environment", 8);
        addScore(scoreCard, "redness", "environment", 2);
        addScore(scoreCard, "oiliness", "environment", 1);
        break;
      case "aircon":
        addScore(scoreCard, "dehydration", "environment", 4);
        addScore(scoreCard, "barrier", "environment", 2);
        addScore(scoreCard, "redness", "environment", 1);
        break;
      default:
        break;
    }
  });
}

function sortConcernScores(items) {
  return [...items].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return PRIORITY_TIEBREAKER.indexOf(left.axis) - PRIORITY_TIEBREAKER.indexOf(right.axis);
  });
}

function getPriority(scoreCard, form) {
  const ranked = sortConcernScores(
    CONCERN_AXES.map((axis) => ({ axis, score: scoreCard[axis].total }))
  );
  const top = ranked[0];

  if (!top || top.axis !== "oiliness") {
    return top || { axis: null, score: 0 };
  }

  const isDrySkin = form.skinType === "dry";
  const isOilEligibleSkin = form.skinType === "oily" || form.skinType === "combination";
  const barrierScore = scoreCard.barrier.total;
  const rednessScore = scoreCard.redness.total;
  const dehydrationScore = scoreCard.dehydration.total;
  const sensitiveOverride = form.sensitivity === "high" || barrierScore >= 18 || rednessScore >= 18;
  const hydrationFamilyCandidate = sortConcernScores([
    { axis: "barrier", score: barrierScore },
    { axis: "redness", score: rednessScore },
    { axis: "dehydration", score: dehydrationScore }
  ])[0];
  const barrierOrRednessCandidate = sortConcernScores([
    { axis: "barrier", score: barrierScore },
    { axis: "redness", score: rednessScore }
  ])[0];

  if (sensitiveOverride && barrierOrRednessCandidate?.score > 0) {
    return barrierOrRednessCandidate;
  }

  if ((isDrySkin || !isOilEligibleSkin) && hydrationFamilyCandidate?.score > 0) {
    return hydrationFamilyCandidate;
  }

  if ((dehydrationScore >= 18 || barrierScore >= 16 || rednessScore >= 16) && hydrationFamilyCandidate?.score > 0) {
    return hydrationFamilyCandidate;
  }

  return top;
}

function buildLegacyFreeResultFixture(form) {
  const scoreCard = createScoreCard();
  applySurveyWeights(scoreCard, form);
  applyEnvironmentWeights(scoreCard, form);
  const priority = getPriority(scoreCard, form);

  return {
    priority: {
      axis: priority.axis,
      score: priority.score
    },
    scoring: {
      concernScores: Object.fromEntries(
        CONCERN_AXES.map((axis) => [
          axis,
          { total: scoreCard[axis].total }
        ])
      )
    }
  };
}

function getTopScoredAxis(freeResult) {
  const entries = Object.entries(freeResult.scoring.concernScores).map(([axis, value]) => ({
    axis,
    score: Number(value.total || 0)
  }));
  return sortConcernScores(entries)[0] || { axis: null, score: 0 };
}

function getContractLane(contract) {
  return FUNCTIONAL_LANE_BY_CONCERN[contract.goals.primaryConcern] || null;
}

function findHighScoringConcernOmissions(contract, freeResult) {
  const contractConcerns = new Set([
    contract.goals.primaryConcern,
    ...contract.goals.secondaryConcerns
  ].filter(Boolean));

  return Object.entries(freeResult.scoring.concernScores)
    .filter(([, value]) => Number(value.total || 0) >= 18)
    .map(([axis]) => axis)
    .filter((axis) => !contractConcerns.has(axis));
}

function auditFixture(fixture) {
  const form = {
    ...DEFAULT_FORM,
    ...fixture.form
  };
  const contract = buildSurveyInputContract(form, {
    source: "audit_fixture",
    generatedAt: GENERATED_AT
  });
  const freeResult = buildLegacyFreeResultFixture(form);
  const topScoredAxis = getTopScoredAxis(freeResult);
  const contractLane = getContractLane(contract);
  const priorityLane = FUNCTIONAL_LANE_BY_CONCERN[freeResult.priority.axis] || null;
  const conflict =
    Boolean(contract.goals.primaryConcern) &&
    Boolean(freeResult.priority.axis) &&
    contractLane !== priorityLane &&
    contract.goals.primaryConcern !== topScoredAxis.axis;
  const highScoringOmissions = findHighScoringConcernOmissions(contract, freeResult);
  const missingFieldCount = contract.metadata.missingFields.length;
  const result = {
    id: fixture.id,
    label: fixture.label,
    form,
    contract: {
      goals: contract.goals,
      safety: contract.safety,
      behavior: contract.behavior,
      preferences: contract.preferences,
      sunscreen: contract.sunscreen,
      profile: contract.profile,
      metadata: contract.metadata
    },
    freeResult: {
      priority: freeResult.priority,
      scoring: freeResult.scoring
    },
    comparison: {
      topScoredAxis,
      contractLane,
      priorityLane,
      conflict,
      highScoringOmissions,
      missingFieldCount,
      missingFieldsAcceptable: missingFieldCount <= 4
    }
  };

  if (fixture.expect.primaryConcern !== undefined) {
    assert.equal(result.contract.goals.primaryConcern, fixture.expect.primaryConcern, `${fixture.id}: primaryConcern`);
  }
  if (fixture.expect.lane) {
    assert.equal(result.comparison.contractLane, fixture.expect.lane, `${fixture.id}: contract lane`);
  }
  if (fixture.expect.sensitivityRisk) {
    assert.equal(result.contract.safety.sensitivityRisk, fixture.expect.sensitivityRisk, `${fixture.id}: sensitivityRisk`);
  }
  if (fixture.expect.drynessRisk) {
    assert.equal(result.contract.safety.drynessRisk, fixture.expect.drynessRisk, `${fixture.id}: drynessRisk`);
  }
  if (fixture.expect.rednessRisk) {
    assert.equal(result.contract.safety.rednessRisk, fixture.expect.rednessRisk, `${fixture.id}: rednessRisk`);
  }
  if (fixture.expect.unresolvedPrimaryConcern !== undefined) {
    assert.equal(
      result.contract.goals.unresolvedPrimaryConcern,
      fixture.expect.unresolvedPrimaryConcern,
      `${fixture.id}: unresolvedPrimaryConcern`
    );
  }
  if (fixture.expect.warning) {
    assert.equal(
      result.contract.metadata.warnings.includes(fixture.expect.warning),
      true,
      `${fixture.id}: expected warning ${fixture.expect.warning}`
    );
  }
  if (fixture.expect.sourceCompleteness) {
    assert.equal(result.contract.sunscreen.sourceCompleteness, fixture.expect.sourceCompleteness, `${fixture.id}: sunscreen source`);
  }
  if (fixture.expect.recentSkinChange) {
    assert.equal(result.contract.safety.recentSkinChange, fixture.expect.recentSkinChange, `${fixture.id}: recentSkinChange`);
  }
  if (fixture.expect.recentlyChangedProduct) {
    assert.equal(
      result.contract.safety.recentlyChangedProduct,
      fixture.expect.recentlyChangedProduct,
      `${fixture.id}: recentlyChangedProduct`
    );
  }
  if (fixture.expect.preferredTexture) {
    assert.equal(result.contract.preferences.preferredTexture, fixture.expect.preferredTexture, `${fixture.id}: preferredTexture`);
  }
  if (fixture.expect.mostDislikedFeel) {
    assert.equal(result.contract.preferences.mostDislikedFeel, fixture.expect.mostDislikedFeel, `${fixture.id}: mostDislikedFeel`);
  }

  assert.equal(result.comparison.missingFieldsAcceptable, true, `${fixture.id}: missingFields count is not excessive`);
  assert.equal(result.comparison.conflict, false, `${fixture.id}: contract conflicts with fixture freeResult priority`);

  return result;
}

function buildMarkdown(summary) {
  const lines = [
    "# Survey Input Contract Audit",
    "",
    `Generated at: ${summary.generatedAt}`,
    "",
    "## Method",
    "",
    summary.method,
    "",
    "## Fixture Results",
    "",
    "| Fixture | Primary | Priority | Top score | Safety | Warnings | Missing | Conflict |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |"
  ];

  summary.results.forEach((item) => {
    lines.push(
      `| ${item.id} | ${item.contract.goals.primaryConcern || "null"} | ${item.freeResult.priority.axis || "null"} | ${item.comparison.topScoredAxis.axis || "null"} | sensitivity=${item.contract.safety.sensitivityRisk}, dryness=${item.contract.safety.drynessRisk}, redness=${item.contract.safety.rednessRisk} | ${item.contract.metadata.warnings.join(", ") || "none"} | ${item.contract.metadata.missingFields.join(", ") || "none"} | ${item.comparison.conflict ? "yes" : "no"} |`
    );
  });

  lines.push(
    "",
    "## Findings",
    "",
    `- Direct engine import used: ${summary.directEngineImportUsed ? "yes" : "no"}.`,
    `- Conflicts: ${summary.conflicts.length ? summary.conflicts.join(", ") : "none"}.`,
    `- Fixtures with high scoring omissions: ${summary.highScoringOmissions.length ? summary.highScoringOmissions.join(", ") : "none"}.`,
    `- Sunscreen ambiguity fixtures: ${summary.sunscreenAmbiguityFixtures.join(", ") || "none"}.`,
    `- Invalid value warnings: ${summary.invalidValueFixtures.join(", ") || "none"}.`
  );

  return `${lines.join("\n")}\n`;
}

const results = FIXTURES.map(auditFixture);
const summary = {
  generatedAt: GENERATED_AT,
  method:
    "Local fixture audit. The script does not call DB, Supabase, external APIs, image analysis, or the runtime analyze route. Existing priority/scoring are represented by a local survey/environment scoring mirror copied from the documented rules in lib/skin-match-decision-engine.js, with photo score fixed at zero.",
  directEngineImportUsed: false,
  fixtureCount: results.length,
  conflicts: results.filter((item) => item.comparison.conflict).map((item) => item.id),
  highScoringOmissions: results
    .filter((item) => item.comparison.highScoringOmissions.length)
    .map((item) => `${item.id}:${item.comparison.highScoringOmissions.join("+")}`),
  sunscreenAmbiguityFixtures: results
    .filter((item) => item.contract.metadata.warnings.includes("sunscreen_boolean_false_ambiguous"))
    .map((item) => item.id),
  invalidValueFixtures: results
    .filter((item) => item.contract.metadata.warnings.some((warning) => warning.includes("invalid")))
    .map((item) => item.id),
  results
};

assert.equal(summary.conflicts.length, 0, "no contract/freeResult priority conflicts expected");
assert.ok(
  summary.sunscreenAmbiguityFixtures.includes("sunscreen-false-only"),
  "sunscreen false-only fixture must report ambiguity"
);
assert.ok(
  summary.invalidValueFixtures.includes("invalid-concern"),
  "invalid concern fixture must report invalid value warning"
);

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(
  path.join(OUTPUT_DIR, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8"
);
await writeFile(
  path.join(OUTPUT_DIR, "summary.md"),
  buildMarkdown(summary),
  "utf8"
);

console.log("audit-survey-input-contract-against-free-result: ok");
console.log(`wrote ${path.join("tmp", "survey-input-contract-audit", "summary.json")}`);
console.log(`wrote ${path.join("tmp", "survey-input-contract-audit", "summary.md")}`);
