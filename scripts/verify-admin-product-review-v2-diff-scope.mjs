import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const ADMIN_V2_SCOPE_CLASSIFICATIONS = Object.freeze({
  NOT_APPLICABLE: "ADMIN_V2_SCOPE_NOT_APPLICABLE",
  APPLICABLE: "ADMIN_V2_SCOPE_APPLICABLE",
  UNAPPROVED: "ADMIN_V2_WITH_UNAPPROVED_SCOPE",
  PRODUCTION_RUNTIME: "ADMIN_V2_WITH_PRODUCTION_RUNTIME_SCOPE",
});

export const ADMIN_V2_ALLOWED_FILES = Object.freeze([
  ".codex/AI_WORK_LOG.d/2026-08-05-admin-product-review-cleanser-metadata-v2.md",
  ".github/workflows/admin-product-current-main-integration.yml",
  "app/api/admin/product-reviews/import-v2/confirm/route.js",
  "app/api/admin/product-reviews/import-v2/dry-run/route.js",
  "crawler/export-product-reviews-v2.ts",
  "crawler/lib/reviews/review-cleanser-metadata-v2-contract.ts",
  "crawler/lib/reviews/review-cleanser-metadata-v2-validation.ts",
  "crawler/lib/reviews/review-cleanser-metadata-v2.ts",
  "crawler/package.json",
  "crawler/tests/prepare-cleanser-metadata-v2-local-fixture.ts",
  "crawler/tests/verify-cleanser-metadata-v2-contract.ts",
  "crawler/tests/verify-cleanser-metadata-v2-local-runtime.ts",
  "docs/architecture/admin-product-review-cleanser-metadata-v2.md",
  "lib/admin/product-review-import-v2/import-confirm.js",
  "lib/admin/product-review-import-v2/import-dry-run.js",
  "lib/admin/product-review-import-v2/import-package.js",
  "scripts/verify-admin-product-current-main-integration.mjs",
  "scripts/verify-admin-product-review-cleanser-metadata-v2.mjs",
  "scripts/verify-admin-product-review-v2-diff-scope.mjs",
  "supabase/migrations/20260805220000_admin_product_review_cleanser_metadata_v2.sql",
  "supabase/migrations/20260805220005_admin_product_review_cleanser_metadata_v2_validate.sql",
  "supabase/migrations/20260805220010_admin_product_review_cleanser_metadata_v2_confirm.sql",
  "tests/fixtures/admin-product-review-v2/20260805215900_product_review_v2_column_adapter.sql",
  "tests/fixtures/admin-product-review-v2/20260805220100_product_review_v2_runtime_seed.sql",
  "tests/fixtures/admin-product-review-v2/20260805220200_product_review_v2_rollback_probe.sql",
]);

const ADMIN_V2_ANCHOR_MATCHERS = Object.freeze([
  (filePath) => filePath.startsWith("app/api/admin/product-reviews/import-v2/"),
  (filePath) => filePath === "crawler/export-product-reviews-v2.ts",
  (filePath) => /^crawler\/lib\/reviews\/review-cleanser-metadata-v2(?:-|\.)/.test(filePath),
  (filePath) => /^crawler\/tests\/.*cleanser-metadata-v2/.test(filePath),
  (filePath) => filePath.startsWith("lib/admin/product-review-import-v2/"),
  (filePath) => /^supabase\/migrations\/202608052200(?:00|05|10)_admin_product_review_cleanser_metadata_v2(?:_validate|_confirm)?\.sql$/.test(filePath),
  (filePath) => filePath.startsWith("tests/fixtures/admin-product-review-v2/"),
  (filePath) => filePath === "scripts/verify-admin-product-review-cleanser-metadata-v2.mjs",
  (filePath) => filePath === "scripts/verify-admin-product-review-v2-diff-scope.mjs",
  (filePath) => filePath === "docs/architecture/admin-product-review-cleanser-metadata-v2.md",
]);

const PRODUCTION_RUNTIME_PATTERNS = Object.freeze([
  /^(?:app\/api\/(?:analyze|full-report)|app\/result|components\/result)\//,
  /^lib\/(?:skin-match|recommendation|candidate-exposure|functional-candidate|evaluator-boundary|premium|result|saved-report)/,
  /recommendation-scoring|candidate-exposure-policy-shadow/,
]);

const FIXED_REGRESSION_PAIRS = Object.freeze([
  {
    label: "#174 Engine CI-maintenance PR",
    baseSha: "2c4edce5065b6d274ab26ca52e18f123ffd1fcfa",
    headSha: "b7e301293e3accf9348ead9472bfe21d44d0b7dd",
    classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.NOT_APPLICABLE,
  },
  {
    label: "#170 final feature delta",
    baseSha: "9cf90f4a464c9885c4cad647a14786ebc502e2cd",
    headSha: "a670212434c56b0578654623ab4d75709d83984b",
    classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.APPLICABLE,
  },
  {
    label: "#170 squash merge delta",
    baseSha: "9cf90f4a464c9885c4cad647a14786ebc502e2cd",
    headSha: "2c4edce5065b6d274ab26ca52e18f123ffd1fcfa",
    classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.APPLICABLE,
  },
]);

const run = (command, args) => execFileSync(command, args, { encoding: "utf8" });
const normalizeChangedFiles = (changedFiles) =>
  [...new Set(changedFiles.map((filePath) => filePath.trim()).filter(Boolean))].sort();

export function isAdminV2OwnedAnchor(filePath) {
  return ADMIN_V2_ANCHOR_MATCHERS.some((matches) => matches(filePath));
}

export function isProductionRuntimePath(filePath) {
  return PRODUCTION_RUNTIME_PATTERNS.some((pattern) => pattern.test(filePath));
}

export function classifyAdminV2ChangedFiles(changedFiles) {
  const normalized = normalizeChangedFiles(changedFiles);
  const anchorFiles = normalized.filter(isAdminV2OwnedAnchor);

  if (anchorFiles.length === 0) {
    return {
      adminV2ScopeChanged: false,
      classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.NOT_APPLICABLE,
      changedFiles: normalized,
      anchorFiles,
      unexpectedFiles: [],
      productionRuntimeFiles: [],
      pass: true,
    };
  }

  const allowed = new Set(ADMIN_V2_ALLOWED_FILES);
  const unexpectedFiles = normalized.filter((filePath) => !allowed.has(filePath));
  const productionRuntimeFiles = unexpectedFiles.filter(isProductionRuntimePath);

  if (productionRuntimeFiles.length > 0) {
    return {
      adminV2ScopeChanged: true,
      classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.PRODUCTION_RUNTIME,
      changedFiles: normalized,
      anchorFiles,
      unexpectedFiles,
      productionRuntimeFiles,
      pass: false,
    };
  }

  if (unexpectedFiles.length > 0) {
    return {
      adminV2ScopeChanged: true,
      classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.UNAPPROVED,
      changedFiles: normalized,
      anchorFiles,
      unexpectedFiles,
      productionRuntimeFiles: [],
      pass: false,
    };
  }

  return {
    adminV2ScopeChanged: true,
    classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.APPLICABLE,
    changedFiles: normalized,
    anchorFiles,
    unexpectedFiles: [],
    productionRuntimeFiles: [],
    pass: true,
  };
}

function assertCommitSha(value, name) {
  assert.match(value ?? "", /^[0-9a-f]{40}$/, `${name} must be an explicit 40-character commit SHA`);
  run("git", ["cat-file", "-e", `${value}^{commit}`]);
}

export function getChangedFilesForPair(baseSha, headSha) {
  assertCommitSha(baseSha, "baseSha");
  assertCommitSha(headSha, "headSha");
  assert.notEqual(baseSha, headSha, "baseSha and headSha must differ");
  return normalizeChangedFiles(
    run("git", ["diff", "--name-only", `${baseSha}...${headSha}`]).split("\n"),
  );
}

export function classifyAdminV2Diff({ baseSha, headSha }) {
  const changedFiles = getChangedFilesForPair(baseSha, headSha);
  return {
    baseSha,
    headSha,
    ...classifyAdminV2ChangedFiles(changedFiles),
  };
}

export function assertAdminV2ScopeResult(result, label = "Admin v2 diff scope") {
  assert.equal(
    result.pass,
    true,
    `${label} failed: ${result.classification}; unexpected files: ${result.unexpectedFiles.join(", ")}`,
  );
}

export function runAdminV2ScopeRegressionMatrix() {
  const results = [];
  for (const pair of FIXED_REGRESSION_PAIRS) {
    const result = classifyAdminV2Diff(pair);
    assert.equal(result.classification, pair.classification, `${pair.label} classification drift`);
    assertAdminV2ScopeResult(result, pair.label);
    results.push({ label: pair.label, ...result });
  }

  const syntheticCases = [
    {
      label: "Admin v2 verifier-only maintenance",
      files: ["scripts/verify-admin-product-review-cleanser-metadata-v2.mjs"],
      classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.APPLICABLE,
      pass: true,
    },
    {
      label: "package.json only",
      files: ["package.json"],
      classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.NOT_APPLICABLE,
      pass: true,
    },
    {
      label: "next.config.js only",
      files: ["next.config.js"],
      classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.NOT_APPLICABLE,
      pass: true,
    },
    {
      label: "security verifier only",
      files: ["scripts/run-security-closeout-verifier-suite.mjs"],
      classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.NOT_APPLICABLE,
      pass: true,
    },
    {
      label: "Engine workflow plus package.json",
      files: [".github/workflows/skin-decision-engine-closeout.yml", "package.json"],
      classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.NOT_APPLICABLE,
      pass: true,
    },
    {
      label: "Admin v1 only",
      files: [
        "app/api/admin/product-reviews/confirm/route.js",
        "supabase/migrations/20260804233300_admin_product_review_import_confirm.sql",
      ],
      classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.NOT_APPLICABLE,
      pass: true,
    },
    {
      label: "Admin v2 plus Engine",
      files: [
        "scripts/verify-admin-product-review-cleanser-metadata-v2.mjs",
        ".github/workflows/skin-decision-engine-closeout.yml",
      ],
      classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.UNAPPROVED,
      pass: false,
    },
    {
      label: "Admin v2 plus recommendation runtime",
      files: [
        "scripts/verify-admin-product-review-cleanser-metadata-v2.mjs",
        "lib/skin-match-decision-engine.js",
      ],
      classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.PRODUCTION_RUNTIME,
      pass: false,
    },
    {
      label: "Admin v2 plus catalog mutation",
      files: [
        "scripts/verify-admin-product-review-cleanser-metadata-v2.mjs",
        "crawler/data/products.json",
      ],
      classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.UNAPPROVED,
      pass: false,
    },
    {
      label: "Admin v2 plus unapproved migration",
      files: [
        "scripts/verify-admin-product-review-cleanser-metadata-v2.mjs",
        "supabase/migrations/20990101000000_unrelated.sql",
      ],
      classification: ADMIN_V2_SCOPE_CLASSIFICATIONS.UNAPPROVED,
      pass: false,
    },
  ];

  for (const testCase of syntheticCases) {
    const result = classifyAdminV2ChangedFiles(testCase.files);
    assert.equal(result.classification, testCase.classification, `${testCase.label} classification drift`);
    assert.equal(result.pass, testCase.pass, `${testCase.label} pass/fail drift`);
    results.push({ label: testCase.label, ...result });
  }

  return results;
}

function parseCliArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    assert.ok(key?.startsWith("--") && value, `invalid CLI arguments near ${key ?? "<empty>"}`);
    args.set(key.slice(2), value);
  }
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseCliArgs(process.argv.slice(2));
  const baseSha = args.get("base") ?? process.env.ADMIN_VERIFY_BASE_SHA;
  const headSha = args.get("head") ?? process.env.ADMIN_VERIFY_HEAD_SHA;
  const regression = runAdminV2ScopeRegressionMatrix();
  const result = classifyAdminV2Diff({ baseSha, headSha });
  process.stdout.write(`${JSON.stringify({ ...result, regressionCases: regression.length }, null, 2)}\n`);
  assertAdminV2ScopeResult(result);
}
