import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import {
  executeOpenAiChatJson
} from "../lib/server/openai-chat-runtime.js";
import {
  createVisionObservationPrompt,
  VISION_OBSERVATION_PROMPT_VERSION,
  VISION_OBSERVATION_SCHEMA_VERSION
} from "../lib/vision-observation-contract.js";
import { normalizeVisionObservationBundle } from "../lib/vision-observation-normalizer.js";
import {
  OPENAI_RUNTIME_MODEL,
  OPENAI_RUNTIME_REASONING_EFFORT
} from "../lib/ai-model-policy.js";

const apiKey = process.env.OPENAI_API_KEY || "";
assert.ok(apiKey, "OPENAI_API_KEY is required for the image-detail A/B smoke");

const FIXTURES = Object.freeze([
  {
    id: "fcneutralv2_03",
    path: new URL(
      "../public/facelab/neutral-review/v2/assets/fcneutralv2_03.jpg",
      import.meta.url
    )
  },
  {
    id: "fcneutralv2_04",
    path: new URL(
      "../public/facelab/neutral-review/v2/assets/fcneutralv2_04.jpg",
      import.meta.url
    )
  }
]);

const DETAILS = Object.freeze(["auto", "high"]);
const REPEAT_COUNT = 2;
const UPSCALED_LONG_EDGE = 4096;
const model = OPENAI_RUNTIME_MODEL;
const prompt = createVisionObservationPrompt();

function safeTokenCount(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function flattenFaceValues(bundle) {
  const output = {};
  for (const [groupName, fields] of Object.entries(
    bundle?.face?.analysis?.observations || {}
  )) {
    for (const [fieldName, field] of Object.entries(fields || {})) {
      if (field?.status !== "available") continue;
      output[`${groupName}.${fieldName}`] = Array.isArray(field.value)
        ? [...field.value].sort().join("|")
        : field.value;
    }
  }
  return output;
}

function compareFaceValues(autoBundle, highBundle) {
  const autoValues = flattenFaceValues(autoBundle);
  const highValues = flattenFaceValues(highBundle);
  const comparableKeys = Object.keys(autoValues).filter((key) =>
    Object.prototype.hasOwnProperty.call(highValues, key)
  );
  const sameKeys = comparableKeys.filter(
    (key) => autoValues[key] === highValues[key]
  );

  return {
    autoAvailableFieldCount: Object.keys(autoValues).length,
    highAvailableFieldCount: Object.keys(highValues).length,
    comparableFieldCount: comparableKeys.length,
    sameFieldCount: sameKeys.length,
    agreementRate:
      comparableKeys.length > 0
        ? Number((sameKeys.length / comparableKeys.length).toFixed(4))
        : null
  };
}

async function createHighResolutionFixture(path) {
  const source = await readFile(path);
  assert.ok(source.length > 0, "A/B source fixture must not be empty");

  const imageBuffer = await sharp(source)
    .rotate()
    .resize({
      width: UPSCALED_LONG_EDGE,
      height: UPSCALED_LONG_EDGE,
      fit: "inside",
      withoutEnlargement: false
    })
    .jpeg({ quality: 95, progressive: false })
    .toBuffer();

  const metadata = await sharp(imageBuffer).metadata();
  assert.ok(
    Math.max(metadata.width || 0, metadata.height || 0) === UPSCALED_LONG_EDGE,
    "A/B fixture must exercise a 4096px long edge"
  );

  return {
    imageBuffer,
    width: metadata.width,
    height: metadata.height,
    bytes: imageBuffer.length
  };
}

async function runFixtureDetail({ fixtureId, imageBuffer, detail }) {
  const runtime = await executeOpenAiChatJson({
    apiKey,
    stage: "vision-observation",
    timeoutMs: 120_000,
    body: {
      model,
      max_completion_tokens: 2_200,
      reasoning_effort: OPENAI_RUNTIME_REASONING_EFFORT,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the canonical locale-neutral observation bundle from this fixed non-user Face Lab evaluation asset."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBuffer.toString("base64")}`,
                detail
              }
            }
          ]
        }
      ]
    }
  });

  const bundle = normalizeVisionObservationBundle(runtime.parsed, {
    provider: "openai",
    model
  });

  assert.equal(bundle.schemaVersion, VISION_OBSERVATION_SCHEMA_VERSION);
  assert.equal(bundle.promptVersion, VISION_OBSERVATION_PROMPT_VERSION);
  assert.equal(bundle.privacy.sourceImagePersisted, false);
  assert.equal(bundle.privacy.rawProviderResponsePersisted, false);

  return {
    fixtureId,
    detail,
    bundle,
    telemetry: {
      inputTokens: safeTokenCount(runtime.providerPayload?.usage?.prompt_tokens),
      outputTokens: safeTokenCount(runtime.providerPayload?.usage?.completion_tokens)
    }
  };
}

const rows = [];
let validPairCount = 0;
let comparableEligibleCount = 0;
let faceAvailablePairCount = 0;
let totalAutoInputTokens = 0;
let totalHighInputTokens = 0;
let totalAutoOutputTokens = 0;
let totalHighOutputTokens = 0;

for (const fixture of FIXTURES) {
  const prepared = await createHighResolutionFixture(fixture.path);

  for (let repeat = 1; repeat <= REPEAT_COUNT; repeat += 1) {
    const [autoResult, highResult] = await Promise.all(
      DETAILS.map((detail) =>
        runFixtureDetail({
          fixtureId: fixture.id,
          imageBuffer: prepared.imageBuffer,
          detail
        })
      )
    );
    const results = {
      auto: autoResult,
      high: highResult
    };

    const autoBundle = results.auto.bundle;
    const highBundle = results.high.bundle;
    const comparison = compareFaceValues(autoBundle, highBundle);
    const validPair =
      autoBundle.status === "available" &&
      highBundle.status === "available";
    const bothFaceEligible =
      validPair &&
      autoBundle.eligibility.faceLabEligible === true &&
      highBundle.eligibility.faceLabEligible === true;
    const bothFaceAvailable =
      bothFaceEligible &&
      autoBundle.face.status === "available" &&
      highBundle.face.status === "available";

    if (validPair) validPairCount += 1;
    if (bothFaceEligible) comparableEligibleCount += 1;
    if (bothFaceAvailable) faceAvailablePairCount += 1;

    totalAutoInputTokens += results.auto.telemetry.inputTokens || 0;
    totalHighInputTokens += results.high.telemetry.inputTokens || 0;
    totalAutoOutputTokens += results.auto.telemetry.outputTokens || 0;
    totalHighOutputTokens += results.high.telemetry.outputTokens || 0;

    rows.push({
      fixture: fixture.id,
      repeat,
      preparedImage: {
        width: prepared.width,
        height: prepared.height,
        bytes: prepared.bytes
      },
      bundleStatus: {
        auto: autoBundle.status,
        high: highBundle.status
      },
      imageType: {
        auto: autoBundle.eligibility.imageType,
        high: highBundle.eligibility.imageType
      },
      faceLabEligible: {
        auto: autoBundle.eligibility.faceLabEligible,
        high: highBundle.eligibility.faceLabEligible
      },
      faceStatus: {
        auto: autoBundle.face.status,
        high: highBundle.face.status
      },
      coverage: comparison,
      tokens: {
        auto: results.auto.telemetry,
        high: results.high.telemetry
      }
    });
  }
}

assert.equal(
  validPairCount,
  FIXTURES.length * REPEAT_COUNT,
  "all high-resolution A/B pairs must return canonical-valid bundles"
);
assert.ok(
  comparableEligibleCount >= 2,
  "high-resolution A/B must retain multiple face-eligible comparisons"
);

const inputTokenReductionRate =
  totalAutoInputTokens > 0
    ? Number(
        ((totalAutoInputTokens - totalHighInputTokens) / totalAutoInputTokens).toFixed(4)
      )
    : null;

assert.ok(
  Number.isFinite(inputTokenReductionRate) && inputTokenReductionRate >= 0.25,
  "detail: high must demonstrate a material input-token reduction on 4096px fixtures"
);

console.log(
  JSON.stringify(
    {
      status: "PASS",
      contract: "ai-provider-image-detail-ab-v2",
      model,
      fixtureCount: FIXTURES.length,
      repeatCount: REPEAT_COUNT,
      upscaledLongEdge: UPSCALED_LONG_EDGE,
      validPairCount,
      comparableEligibleCount,
      faceAvailablePairCount,
      totals: {
        auto: {
          inputTokens: totalAutoInputTokens,
          outputTokens: totalAutoOutputTokens
        },
        high: {
          inputTokens: totalHighInputTokens,
          outputTokens: totalHighOutputTokens
        },
        inputTokenReductionRate
      },
      rows,
      persisted: false
    },
    null,
    2
  )
);
