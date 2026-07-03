import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  captureFunctionalShadowFixture,
  isFunctionalShadowCaptureEnabled
} from "../lib/functional-shadow-capture.js";

const execFileAsync = promisify(execFile);
const TEST_DIR = path.join(process.cwd(), "tmp", "functional-shadow-capture-verify");
let captureCounter = 0;

function surveyContract(overrides = {}) {
  return {
    skinState: {
      skinType: "dry",
      sensitivity: "low",
      postWashFeeling: "tight",
      afternoonSkinChange: "more_dry",
      ...(overrides.skinState || {})
    },
    goals: {
      primaryConcern: "dehydration",
      secondaryConcerns: [],
      unresolvedPrimaryConcern: false,
      ...(overrides.goals || {})
    },
    safety: {
      recentSkinChange: "no",
      recentlyChangedProduct: "no",
      sensitivityRisk: "low",
      drynessRisk: "high",
      rednessRisk: "low",
      ...(overrides.safety || {})
    },
    behavior: {
      cleansingFrequency: "twice",
      environmentExposure: ["indoor_dry"],
      ...(overrides.behavior || {})
    },
    preferences: {
      preferredTexture: "cream",
      mostDislikedFeel: "sticky",
      ...(overrides.preferences || {})
    },
    sunscreen: {
      whiteCastHate: false,
      toneUpWanted: false,
      makeupUse: false,
      eyeSensitive: false,
      sourceCompleteness: "answered",
      ...(overrides.sunscreen || {})
    }
  };
}

function goalPolicy(overrides = {}) {
  return {
    requestedConcern: "dehydration",
    detectedPriority: "dehydration",
    hasTension: false,
    tensionType: null,
    rankingGoal: "dehydration",
    safetyGoal: "dehydration",
    recommendationGuard: "normal",
    copyStrategy: "aligned",
    ...overrides
  };
}

function product(overrides = {}) {
  return {
    id: "capture-product",
    category: "moisturizer_cream",
    product_form: "cream",
    skin_types: ["dry"],
    concerns: ["dehydration"],
    texture: "cream",
    finish: "natural",
    irritation_risk: "low",
    sensitivity_safe: true,
    ingredient_signals: {
      functional: [
        { label: "skin hydration", count: 8 },
        { label: "moisture evaporation blocking", count: 4 }
      ]
    },
    market_signals: {
      review_count: 2300,
      rating: 4.5
    },
    ...overrides
  };
}

function freeResult(topPick = product()) {
  return {
    priority: {
      axis: "dehydration",
      reasonCode: "dry_tight_pattern"
    },
    topPick,
    premiumReport: {
      supportingProducts: [],
      budgetAlternatives: []
    }
  };
}

async function listJsonFiles() {
  try {
    return (await readdir(TEST_DIR))
      .filter((name) => name.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
}

async function latestFixture() {
  const files = (await listJsonFiles()).filter((name) => !name.includes("summary"));
  const filePath = path.join(TEST_DIR, files.at(-1));
  return {
    filePath,
    fixture: JSON.parse(await readFile(filePath, "utf8"))
  };
}

async function capture(overrides = {}) {
  const now = overrides.now || new Date(Date.UTC(2026, 6, 3, 0, 0, captureCounter++));

  return captureFunctionalShadowFixture({
    surveyContract: surveyContract(overrides.surveyContract || {}),
    freeResult: overrides.freeResult || freeResult(overrides.topPick || product()),
    goalPolicy: goalPolicy(overrides.goalPolicy || {}),
    existingRecommendationResult: overrides.existingRecommendationResult || freeResult(overrides.topPick || product()),
    candidateProducts: overrides.candidateProducts,
    currentProductFindings: overrides.currentProductFindings,
    options: {
      outputDir: TEST_DIR,
      env: overrides.env || { NODE_ENV: "development", FUNCTIONAL_SHADOW_CAPTURE: "1" },
      now,
      captureId: overrides.captureId || "verify-capture-0001"
    }
  });
}

function assertNoCaptureFieldsInResponseLike(responseLike) {
  const keys = Object.keys(responseLike);
  assert.equal(keys.includes("functionalShadowCapture"), false);
  assert.equal(keys.includes("shadowCapture"), false);
  assert.equal(keys.includes("capture"), false);
  assert.equal(keys.includes("surveyInputContract"), false);
  assert.equal(keys.includes("debugContract"), false);
}

function runCase(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok - ${name}`));
}

await rm(TEST_DIR, { recursive: true, force: true });

await runCase("capture gate is enabled only in development with explicit env flag", () => {
  assert.equal(isFunctionalShadowCaptureEnabled({ NODE_ENV: "development", FUNCTIONAL_SHADOW_CAPTURE: "1" }), true);
  assert.equal(isFunctionalShadowCaptureEnabled({ NODE_ENV: "development" }), false);
  assert.equal(isFunctionalShadowCaptureEnabled({ NODE_ENV: "development", FUNCTIONAL_SHADOW_CAPTURE: "0" }), false);
  assert.equal(isFunctionalShadowCaptureEnabled({ NODE_ENV: "production", FUNCTIONAL_SHADOW_CAPTURE: "1" }), false);
});

await runCase("disabled no-op does not create a fixture", async () => {
  const result = await capture({
    env: { NODE_ENV: "development" },
    captureId: "disabled-unset"
  });

  assert.equal(result.captured, false);
  assert.equal(result.reason, "disabled");
  assert.deepEqual(await listJsonFiles(), []);
});

await runCase("explicit false no-op does not create a fixture", async () => {
  const result = await capture({
    env: { NODE_ENV: "development", FUNCTIONAL_SHADOW_CAPTURE: "0" },
    captureId: "disabled-zero"
  });

  assert.equal(result.captured, false);
  assert.equal(result.reason, "disabled");
  assert.deepEqual(await listJsonFiles(), []);
});

await runCase("production no-op does not create a fixture", async () => {
  const result = await capture({
    env: { NODE_ENV: "production", FUNCTIONAL_SHADOW_CAPTURE: "1" },
    captureId: "production-disabled"
  });

  assert.equal(result.captured, false);
  assert.equal(result.reason, "production");
  assert.deepEqual(await listJsonFiles(), []);
});

await runCase("development opt-in writes required fixture keys", async () => {
  const result = await capture({
    captureId: "capture-required-keys",
    candidateProducts: [product({ id: "required-product" })]
  });
  const { fixture } = await latestFixture();

  assert.equal(result.captured, true);
  assert.equal(fixture.captureVersion, "v1");
  assert.equal(typeof fixture.captureId, "string");
  assert.ok(fixture.survey);
  assert.ok(fixture.freeResultContext);
  assert.ok(fixture.goalPolicy);
  assert.ok(fixture.existingRecommendationSnapshot);
  assert.ok(fixture.candidateSource);
  assert.ok(fixture.currentProductFindingSummary);
});

await runCase("fixture excludes raw and identifying data", async () => {
  const unsafeProduct = product({
    id: "safe-id-only",
    name: "Forbidden Product Name",
    brand: "Forbidden Brand",
    buy_link: "https://shop.example.test/forbidden",
    purchase_url: "https://shop.example.test/purchase",
    image_url: "https://cdn.example.test/image.png",
    raw_review_text: "raw current product text",
    email: "person@example.test",
    session: "secret-session",
    cookie: "secret-cookie",
    user_agent: "secret-agent",
    filename: "face.png",
    image: "raw-image",
    base64: "base64payload"
  });
  await capture({
    captureId: "capture-sanitize-check",
    topPick: unsafeProduct,
    candidateProducts: [unsafeProduct]
  });
  const { filePath, fixture } = await latestFixture();
  const raw = (await readFile(filePath, "utf8")).toLowerCase();
  const blockedTokens = [
    "forbidden product name",
    "forbidden brand",
    "shop.example",
    "raw current product text",
    "person@example",
    "secret-session",
    "secret-cookie",
    "secret-agent",
    "face.png",
    "raw-image",
    "base64payload",
    "buy_link",
    "purchase_url",
    "image_url",
    "raw_review_text",
    "user_agent"
  ];

  blockedTokens.forEach((token) => assert.equal(raw.includes(token), false, token));
  assert.deepEqual(Object.keys(fixture.candidateSource.products[0]).sort(), [
    "category",
    "concerns",
    "finish",
    "id",
    "ingredient_signals",
    "irritation_risk",
    "market_signals",
    "product_form",
    "sensitivity_safe",
    "skin_types",
    "texture"
  ]);
});

await runCase("candidate source completeness is recorded for complete and absent sources", async () => {
  await capture({
    captureId: "capture-complete-source",
    candidateProducts: [product({ id: "complete-source-product" })]
  });
  assert.equal((await latestFixture()).fixture.candidateSource.completeness, "complete");

  await capture({
    captureId: "capture-final-only-source",
    candidateProducts: null,
    topPick: product({ id: "final-result-product" })
  });
  assert.equal((await latestFixture()).fixture.candidateSource.completeness, "final_results_only");

  await capture({
    captureId: "capture-unavailable-source",
    candidateProducts: null,
    existingRecommendationResult: { premiumReport: { supportingProducts: [], budgetAlternatives: [] } },
    freeResult: {
      priority: { axis: "dehydration" },
      premiumReport: { supportingProducts: [], budgetAlternatives: [] }
    }
  });
  assert.equal((await latestFixture()).fixture.candidateSource.completeness, "unavailable");
});

await runCase("capture result does not mutate response-like free result object", async () => {
  const responseLike = freeResult(product({ id: "response-isolation" }));

  assertNoCaptureFieldsInResponseLike(responseLike);
  await capture({
    captureId: "capture-response-isolation",
    freeResult: responseLike,
    existingRecommendationResult: responseLike,
    candidateProducts: [product({ id: "response-isolation" })]
  });
  assertNoCaptureFieldsInResponseLike(responseLike);
});

await runCase("replay runner continues across complete, final-only, unsupported, and malformed fixtures", async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });
  await capture({
    captureId: "capture-replay-complete",
    candidateProducts: [product({ id: "replay-complete" })]
  });
  await capture({
    captureId: "capture-replay-final",
    candidateProducts: null,
    topPick: product({ id: "replay-final" })
  });
  await writeFile(path.join(TEST_DIR, "unsupported-version.json"), JSON.stringify({ captureVersion: "v0" }), "utf8");
  await writeFile(path.join(TEST_DIR, "malformed.json"), "{", "utf8");

  await execFileAsync(process.execPath, ["scripts/replay-functional-shadow-captures.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      FUNCTIONAL_SHADOW_CAPTURE_DIR: TEST_DIR
    },
    maxBuffer: 1024 * 1024
  });

  const summary = JSON.parse(await readFile(path.join(TEST_DIR, "replay-summary.json"), "utf8"));

  assert.ok(summary.totalCaptureCount >= 4);
  assert.ok(summary.replayedCount >= 2);
  assert.ok(summary.skippedCount >= 1);
  assert.ok(summary.failedCount >= 1);
  assert.equal(typeof summary.topPickMatchRate, "number");
  assert.ok(summary.comparisonConfidenceDistribution.low >= 1);
  assert.ok(summary.limitations.includes("sample_size_too_low_for_policy_conclusion"));
});

await runCase("aggregate summarizer reports confidence, divergence, and limitations", async () => {
  await execFileAsync(process.execPath, ["scripts/summarize-functional-shadow-captures.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      FUNCTIONAL_SHADOW_CAPTURE_DIR: TEST_DIR
    },
    maxBuffer: 1024 * 1024
  });

  const summary = JSON.parse(await readFile(path.join(TEST_DIR, "aggregate-summary.json"), "utf8"));

  assert.equal(typeof summary.comparisonConfidenceDistribution.high, "number");
  assert.equal(typeof summary.comparisonConfidenceDistribution.medium, "number");
  assert.equal(typeof summary.comparisonConfidenceDistribution.low, "number");
  assert.equal(typeof summary.topPickMatchRate, "number");
  assert.equal(typeof summary.divergenceTypeDistribution, "object");
  assert.ok(summary.limitations.includes("sample_size_too_low_for_policy_conclusion"));
});
