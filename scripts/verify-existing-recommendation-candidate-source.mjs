import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  buildExistingRecommendationCandidateSource,
  buildFinalResultsOnlyCandidateSource
} from "../lib/existing-recommendation-candidate-source.js";
import { captureFunctionalShadowFixture } from "../lib/functional-shadow-capture.js";

const execFileAsync = promisify(execFile);
const TEST_DIR = path.join(process.cwd(), "tmp", "existing-candidate-source-verify");

function product(overrides = {}) {
  return {
    id: "source-product",
    name: "Do Not Capture Product Name",
    brand: "Do Not Capture Brand",
    category: "moisturizer_cream",
    product_form: "cream",
    skin_types: ["dry"],
    concerns: ["dehydration"],
    texture: "cream",
    finish: "natural",
    irritation_risk: "low",
    sensitivity_safe: true,
    buy_link: "https://shop.example.test/product",
    raw_review_text: "raw review text",
    ingredient_signals: {
      functional: [
        { label: "skin hydration", count: 8 },
        { label: "moisture evaporation blocking", count: 4 }
      ]
    },
    market_signals: {
      review_count: 2000,
      rating: 4.5
    },
    ...overrides
  };
}

function surveyContract() {
  return {
    skinState: {
      skinType: "dry",
      sensitivity: "low",
      postWashFeeling: "tight",
      afternoonSkinChange: "more_dry"
    },
    goals: {
      primaryConcern: "dehydration",
      secondaryConcerns: [],
      unresolvedPrimaryConcern: false
    },
    safety: {
      recentSkinChange: "no",
      recentlyChangedProduct: "no",
      sensitivityRisk: "low",
      drynessRisk: "high",
      rednessRisk: "low"
    },
    preferences: {
      preferredTexture: "cream",
      mostDislikedFeel: "sticky"
    },
    sunscreen: {
      whiteCastHate: false,
      toneUpWanted: false,
      makeupUse: false,
      eyeSensitive: false,
      sourceCompleteness: "answered"
    }
  };
}

function goalPolicy() {
  return {
    rankingGoal: "dehydration",
    safetyGoal: "dehydration",
    recommendationGuard: "normal",
    hasTension: false,
    tensionType: null
  };
}

function freeResult(topPick = product()) {
  return {
    priority: { axis: "dehydration" },
    topPick,
    premiumReport: {
      supportingProducts: [],
      budgetAlternatives: []
    }
  };
}

async function captureWithSource(candidateSource, captureId = "candidate-source-capture") {
  return captureFunctionalShadowFixture({
    surveyContract: surveyContract(),
    freeResult: freeResult(product({ id: "capture-top" })),
    goalPolicy: goalPolicy(),
    existingRecommendationResult: freeResult(product({ id: "capture-top" })),
    candidateSource,
    options: {
      outputDir: TEST_DIR,
      env: { NODE_ENV: "development", FUNCTIONAL_SHADOW_CAPTURE: "1" },
      now: new Date("2026-07-03T01:00:00.000Z"),
      captureId
    }
  });
}

async function readFixture(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function runCase(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok - ${name}`));
}

await rm(TEST_DIR, { recursive: true, force: true });

await runCase("complete product-row source keeps count, stage, and stable notes", () => {
  const source = buildExistingRecommendationCandidateSource({
    products: [product({ id: "a" }), product({ id: "b" }), product({ id: "a" })],
    sourceStage: "post_score_candidate_pool",
    sourceNotes: ["z_note", "a_note"],
    completeness: "complete",
    candidateIdentityMode: "product_row"
  });

  assert.equal(source.completeness, "complete");
  assert.equal(source.sourceStage, "post_score_candidate_pool");
  assert.equal(source.candidateIdentityMode, "product_row");
  assert.equal(source.sourceCount, 2);
  assert.deepEqual(source.sourceNotes, [
    "a_note",
    "candidate_source_after_existing_score_sort",
    "existing_candidate_pool_reused",
    "z_note"
  ]);
});

await runCase("partial source records filtered boundary limitation", () => {
  const source = buildExistingRecommendationCandidateSource({
    products: [product({ id: "partial-a", category: "sunscreen" })],
    sourceStage: "post_filter_candidate_pool",
    sourceNotes: ["category_filtered_pool"],
    completeness: "partial"
  });

  assert.equal(source.completeness, "partial");
  assert.equal(source.sourceStage, "post_filter_candidate_pool");
  assert.equal(source.candidateIdentityMode, "product_row");
  assert.ok(source.sourceNotes.includes("candidate_source_filtered_before_capture"));
});

await runCase("final-results-only source preserves fallback semantics", () => {
  const source = buildFinalResultsOnlyCandidateSource([product({ id: "final-a" })]);

  assert.equal(source.completeness, "final_results_only");
  assert.equal(source.sourceStage, "final_results_only");
  assert.equal(source.sourceCount, 1);
  assert.ok(source.sourceNotes.includes("legacy_result_only"));
});

await runCase("unavailable source does not throw", () => {
  const source = buildExistingRecommendationCandidateSource({
    products: [],
    sourceStage: "unavailable"
  });

  assert.equal(source.completeness, "unavailable");
  assert.equal(source.sourceStage, "unavailable");
  assert.equal(source.candidateIdentityMode, "unavailable");
  assert.deepEqual(source.products, []);
});

await runCase("capture helper stores sanitized complete source metadata", async () => {
  const source = buildExistingRecommendationCandidateSource({
    products: [
      product({ id: "sanitized-a" }),
      product({ id: "sanitized-b", category: "sunscreen", white_cast: "none", eye_sting: "low" })
    ],
    sourceStage: "post_score_candidate_pool",
    completeness: "complete",
    candidateIdentityMode: "product_row"
  });
  const result = await captureWithSource(source, "candidate-source-sanitized");
  const fixture = await readFixture(result.filePath);
  const raw = (await readFile(result.filePath, "utf8")).toLowerCase();

  assert.equal(result.captured, true);
  assert.equal(fixture.candidateSource.completeness, "complete");
  assert.equal(fixture.candidateSource.sourceStage, "post_score_candidate_pool");
  assert.equal(fixture.candidateSource.candidateIdentityMode, "product_row");
  assert.equal(fixture.candidateSource.sourceCount, 2);
  assert.equal(raw.includes("do not capture product name"), false);
  assert.equal(raw.includes("do not capture brand"), false);
  assert.equal(raw.includes("shop.example"), false);
  assert.equal(raw.includes("raw review text"), false);
});

await runCase("old final-results-only fixture replays as low confidence", async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });
  await captureFunctionalShadowFixture({
    surveyContract: surveyContract(),
    freeResult: freeResult(product({ id: "old-final" })),
    goalPolicy: goalPolicy(),
    existingRecommendationResult: freeResult(product({ id: "old-final" })),
    options: {
      outputDir: TEST_DIR,
      env: { NODE_ENV: "development", FUNCTIONAL_SHADOW_CAPTURE: "1" },
      now: new Date("2026-07-03T01:01:00.000Z"),
      captureId: "old-final-only"
    }
  });
  await execFileAsync(process.execPath, ["scripts/replay-functional-shadow-captures.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, FUNCTIONAL_SHADOW_CAPTURE_DIR: TEST_DIR },
    maxBuffer: 1024 * 1024
  });
  const summary = JSON.parse(await readFile(path.join(TEST_DIR, "replay-summary.json"), "utf8"));

  assert.equal(summary.replayedCount, 1);
  assert.equal(summary.comparisonConfidenceDistribution.low, 1);
});

await runCase("complete fixture replay can produce high confidence comparison", async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  const candidateProducts = [
    product({ id: "complete-top" }),
    product({ id: "complete-support" }),
    product({ id: "complete-other", category: "serum" })
  ];
  const source = buildExistingRecommendationCandidateSource({
    products: candidateProducts,
    sourceStage: "post_score_candidate_pool",
    completeness: "complete",
    candidateIdentityMode: "product_row"
  });

  await captureFunctionalShadowFixture({
    surveyContract: surveyContract(),
    freeResult: freeResult(candidateProducts[0]),
    goalPolicy: goalPolicy(),
    existingRecommendationResult: {
      ...freeResult(candidateProducts[0]),
      premiumReport: {
        supportingProducts: [candidateProducts[1]],
        budgetAlternatives: []
      }
    },
    candidateSource: source,
    options: {
      outputDir: TEST_DIR,
      env: { NODE_ENV: "development", FUNCTIONAL_SHADOW_CAPTURE: "1" },
      now: new Date("2026-07-03T01:02:00.000Z"),
      captureId: "complete-replay-high"
    }
  });
  await execFileAsync(process.execPath, ["scripts/replay-functional-shadow-captures.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, FUNCTIONAL_SHADOW_CAPTURE_DIR: TEST_DIR },
    maxBuffer: 1024 * 1024
  });
  const summary = JSON.parse(await readFile(path.join(TEST_DIR, "replay-summary.json"), "utf8"));

  assert.equal(summary.replayedCount, 1);
  assert.equal(summary.comparisonConfidenceDistribution.high, 1);
  assert.equal(summary.candidateSourceCompletenessDistribution.complete, 1);
});

await runCase("candidate source diagnostics stay out of response-like objects", async () => {
  const diagnosticDecision = {
    summary: "summary",
    priority: { axis: "dehydration" },
    topPick: product({ id: "response-top" }),
    diagnostics: {
      candidateSource: buildExistingRecommendationCandidateSource({
        products: [product({ id: "response-top" })],
        completeness: "complete",
        sourceStage: "post_score_candidate_pool"
      })
    }
  };
  const responseLike = {
    summary: diagnosticDecision.summary,
    priority: diagnosticDecision.priority,
    topPick: diagnosticDecision.topPick
  };

  assert.equal(diagnosticDecision.diagnostics.candidateSource.completeness, "complete");
  assert.equal(Object.hasOwn(responseLike, "diagnostics"), false);
  assert.equal(Object.hasOwn(responseLike, "candidateSource"), false);
});

await runCase("disabled capture still writes no fixture with candidate source present", async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  const source = buildExistingRecommendationCandidateSource({
    products: [product({ id: "disabled-candidate" })],
    completeness: "complete",
    sourceStage: "post_score_candidate_pool"
  });
  const result = await captureFunctionalShadowFixture({
    surveyContract: surveyContract(),
    freeResult: freeResult(),
    goalPolicy: goalPolicy(),
    existingRecommendationResult: freeResult(),
    candidateSource: source,
    options: {
      outputDir: TEST_DIR,
      env: { NODE_ENV: "development" }
    }
  });

  assert.equal(result.captured, false);
  assert.equal(result.reason, "disabled");
});
