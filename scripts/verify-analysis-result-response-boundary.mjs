import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const checkedFiles = [];
const PUBLIC_KEYS = [
  "shareId",
  "schemaVersion",
  "locale",
  "skinType",
  "mainConcerns",
  "summary",
  "routineAm",
  "routinePm",
  "topPick",
  "categoryPicks",
  "routineStructure"
];
const OWNER_KEYS = [...PUBLIC_KEYS, "isPublic"];
const PRODUCT_KEYS = ["id", "name", "brand", "step", "reason"];
const CATEGORY_PRODUCT_KEYS = ["id", "name", "brand", "step"];
const ROUTINE_KEYS = ["type", "label", "title", "body", "am", "pm", "cards"];
const ROUTINE_TIMING_KEYS = ["mode", "label", "strategyLine"];
const ROUTINE_CARD_KEYS = ["key", "label", "body", "mode"];

function read(path) {
  checkedFiles.push(path);
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertKeys(value, expectedKeys, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} should be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} keys mismatch: expected ${expected.join(", ")}, got ${actual.join(", ")}`
  );
}

function assertNoForbiddenKeys(value, path = "result") {
  const forbidden = new Set([
    "userId",
    "imageUrl",
    "source",
    "createdAt",
    "generatedAt",
    "scoring",
    "matched_signals",
    "score_breakdown",
    "decision_meta",
    "engine_score",
    "unexpected",
    "internal",
    "privateMetadata"
  ]);

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${path}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  Object.entries(value).forEach(([key, item]) => {
    assert(!forbidden.has(key), `${path}.${key} must not be exposed`);
    assertNoForbiddenKeys(item, `${path}.${key}`);
  });
}

async function loadAnalysisResultsModule() {
  const source = read("lib/analysis-results.js");
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

  return import(moduleUrl);
}

function createResultRow(overrides = {}) {
  return {
    id: "internal-row-id",
    share_id: "public-share-id",
    created_at: "2026-07-13T00:00:00.000Z",
    user_id: "owner-user-id",
    image_url: "private-storage-path",
    locale: "en",
    skin_type: "oily",
    main_concerns: ["pores"],
    summary: "Column fallback summary",
    routine_am: ["Gentle cleanse"],
    routine_pm: ["Barrier support"],
    recommended_products: [
      {
        id: "fallback-product",
        name: "Fallback Product",
        brand: "Fallback Brand",
        step: "Cleanser",
        reason: "Fallback reason",
        privateMetadata: "drop"
      }
    ],
    is_public: true,
    result_json: {
      schemaVersion: 1,
      generatedAt: "2026-07-13T00:00:00.000Z",
      source: "skin-match-v2",
      unexpected: "drop",
      submission: {
        form: {
          skinType: "oily",
          mainConcerns: ["pores"],
          privateMetadata: "drop"
        }
      },
      result: {
        summary: "Public summary",
        morning: ["Cleanse", "Moisturize"],
        night: ["Cleanse", "Repair"],
        topPick: {
          id: "top-product",
          name: "Top Product",
          brand: "Top Brand",
          step: "Serum",
          reason: "Public reason",
          scoring: { private: true },
          matched_signals: { private: true },
          score_breakdown: { private: true },
          decision_meta: { private: true },
          engine_score: 99,
          unexpected: "drop"
        },
        alternative: {
          id: "alternative-product",
          name: "Alternative Product",
          brand: "Alternative Brand",
          step: "Cream",
          reason: "Alternative reason",
          internal: "drop"
        },
        categoryPicks: [
          {
            id: "category-product",
            name: "Category Product",
            brand: "Category Brand",
            step: "Toner",
            reason: "Category reason",
            decision_meta: { private: true }
          }
        ],
        routineStructure: {
          type: "am_pm_balanced",
          label: "Routine",
          title: "Balanced care",
          body: "Keep the routine gentle.",
          am: {
            mode: "light",
            label: "AM",
            strategyLine: "Protect the barrier.",
            internal: "drop"
          },
          pm: {
            mode: "repair",
            label: "PM",
            strategyLine: "Repair overnight.",
            internal: "drop"
          },
          cards: [
            {
              key: "morning",
              label: "AM",
              body: "Gentle cleanse.",
              mode: "light",
              unexpected: "drop"
            }
          ],
          privateMetadata: "drop"
        },
        scoring: { private: true },
        privateMetadata: "drop"
      }
    },
    ...overrides
  };
}

const analysisResults = await loadAnalysisResultsModule();
const {
  resolveAnalysisResultReadAudience,
  serializeOwnerAnalysisResult,
  serializePublicAnalysisResult
} = analysisResults;

[
  "serializePublicAnalysisResult",
  "serializeOwnerAnalysisResult",
  "resolveAnalysisResultReadAudience"
].forEach((name) => assert(typeof analysisResults[name] === "function", `missing export: ${name}`));

const publicRow = createResultRow();
const publicResult = serializePublicAnalysisResult(publicRow);
assertKeys(publicResult, PUBLIC_KEYS, "public DTO");
assertKeys(publicResult.topPick, PRODUCT_KEYS, "public topPick");
publicResult.categoryPicks.forEach((product, index) => assertKeys(product, CATEGORY_PRODUCT_KEYS, `categoryPicks[${index}]`));
assertKeys(publicResult.routineStructure, ROUTINE_KEYS, "routineStructure");
assertKeys(publicResult.routineStructure.am, ROUTINE_TIMING_KEYS, "routineStructure.am");
assertKeys(publicResult.routineStructure.pm, ROUTINE_TIMING_KEYS, "routineStructure.pm");
publicResult.routineStructure.cards.forEach((card, index) => {
  assertKeys(card, ROUTINE_CARD_KEYS, `routineStructure.cards[${index}]`);
});
assertNoForbiddenKeys(publicResult);
assert(!Object.hasOwn(publicResult, "id"), "public DTO must not expose the row id");
assert(!Object.hasOwn(publicResult, "userId"), "public DTO must not expose the owner id");
assert(!Object.hasOwn(publicResult, "imageUrl"), "public DTO must not expose an image path");
assert(publicResult.schemaVersion === 1, "schemaVersion should remain public for compatibility");

const ownerResult = serializeOwnerAnalysisResult(createResultRow({ is_public: false }));
assertKeys(ownerResult, OWNER_KEYS, "owner DTO");
assert(ownerResult.isPublic === false, "owner DTO should preserve the visibility state");
assertNoForbiddenKeys(ownerResult);

const legacyResult = serializePublicAnalysisResult(createResultRow({
  result_json: null,
  recommended_products: [
    {
      id: "legacy-product",
      name: "Legacy Product",
      brand: "Legacy Brand",
      step: "Cream",
      reason: "Legacy reason",
      unexpected: "drop"
    }
  ]
}));
assertKeys(legacyResult, PUBLIC_KEYS, "legacy public DTO");
assert(legacyResult.schemaVersion === null, "legacy result_json must not invent a schema version");
assertKeys(legacyResult.topPick, PRODUCT_KEYS, "legacy topPick");
assertNoForbiddenKeys(legacyResult, "legacyResult");
assert(serializePublicAnalysisResult(null) === null, "null rows must fail closed");

assert(resolveAnalysisResultReadAudience(publicRow, null) === "public", "public row + unauthenticated user");
assert(resolveAnalysisResultReadAudience(publicRow, "owner-user-id") === "public", "public row + owner");
assert(resolveAnalysisResultReadAudience(publicRow, "other-user-id") === "public", "public row + non-owner");
const privateRow = createResultRow({ is_public: false });
assert(resolveAnalysisResultReadAudience(privateRow, "owner-user-id") === "owner", "private row + owner");
assert(resolveAnalysisResultReadAudience(privateRow, "other-user-id") === null, "private row + non-owner");
assert(resolveAnalysisResultReadAudience(privateRow, null) === null, "private row + unauthenticated user");
assert(
  resolveAnalysisResultReadAudience(createResultRow({ is_public: false, user_id: null }), "owner-user-id") === null,
  "private anonymous row must fail closed"
);

const accessHelper = read("lib/analysis-result-access.js");
[
  "ANALYSIS_RESULT_READ_SELECT",
  "resolveAnalysisResultReadAudience(data)",
  "serializePublicAnalysisResult(data)",
  "serializeOwnerAnalysisResult(data)"
].forEach((pattern) => assert(accessHelper.includes(pattern), `access helper missing: ${pattern}`));
assert(!accessHelper.includes("normalizeStoredAnalysisResult"), "access helper must not return the legacy broad normalizer");

const publicRoute = read("app/api/results/[shareId]/route.js");
const publicReadCore = read("lib/security/public-result-read-guard-core.js");
assert(publicReadCore.includes('error: "Failed to load result."'), "public API boundary must use a generic 500 response");
assert(!publicRoute.includes("error instanceof Error ? error.message"), "public API must not return internal error messages");
assert(publicRoute.includes("executePublicResultReadAccessCore"), "public API must use the guarded access boundary");
assert(publicRoute.includes("readAnalysisResultForShare"), "public API must use the strict access helper");
assert(publicRoute.includes("PUBLIC_RESULT_READ_HEADERS"), "public API must apply no-store headers");

console.log(JSON.stringify({
  status: "passed",
  publicKeys: PUBLIC_KEYS,
  ownerKeys: OWNER_KEYS,
  checks: [
    "exact_public_owner_dto_keys",
    "nested_allowlist",
    "legacy_and_null_fail_closed",
    "access_matrix",
    "generic_api_error"
  ],
  checkedFiles: [...new Set(checkedFiles)]
}, null, 2));
