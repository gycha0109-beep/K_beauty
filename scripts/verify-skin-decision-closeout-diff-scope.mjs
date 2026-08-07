import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

export const ENGINE_OWNED_EXACT_PATHS = Object.freeze(new Set([
  "app/api/analyze/route.js",
  "app/api/face-reading/route.js",
  "app/page.js",
  "app/result/full-report/page.js",
  "app/result/page.js",
  "components/onboarding/SurveyFlow.js",
  "components/result/free-v2/FreeResultV2DiagnosisStep.jsx",
  "lib/condition-policy.js",
  "lib/cross-domain-consistency.js",
  "lib/functional-plan-decision.js",
  "lib/premium-condition-responses.js",
  "lib/premium-decision-state.js",
  "lib/premium-session-payload.js",
  "lib/routine-policy.js",
  "lib/security/anonymous-write-grant-core.js",
  "lib/server/vision-observation-service.js"
]));

export const ENGINE_OWNED_PREFIXES = Object.freeze([
  "app/api/full-report/",
  "app/api/my/save-report/",
  "app/api/results/",
  "components/full-report/",
  "lib/candidate-exposure-policy",
  "lib/face-lab-",
  "lib/functional-candidate-",
  "lib/image-analysis-eligibility",
  "lib/photo-evidence",
  "lib/premium-face-lab",
  "lib/premium-finalization",
  "lib/premium-functional-",
  "lib/premium-report-",
  "lib/premium-route-",
  "lib/premium-routine-",
  "lib/premium-snapshot-",
  "lib/provider-runtime-log",
  "lib/shared-skin-decision-context",
  "lib/skin-match-decision-engine",
  "lib/skin-observation-projector",
  "lib/vision-observation-"
]);

export const ALLOWED_ADMIN_BASELINE_PATHS = Object.freeze(new Set([
  "app/api/admin/product-reviews/preflight/route.js",
  "app/api/admin/product-reviews/confirm/route.js",
  "app/api/admin/product-reviews/import/dry-run/route.js",
  "app/api/admin/product-reviews/import/confirm/route.js"
]));

export const ALLOWED_ADMIN_BASELINE_MIGRATIONS = Object.freeze(new Set([
  "supabase/migrations/20260804233000_admin_product_candidate_reviews.sql",
  "supabase/migrations/20260804233100_admin_product_candidate_reviews_hardening.sql",
  "supabase/migrations/20260804233200_admin_product_candidate_reviews_security_hardening.sql",
  "supabase/migrations/20260804233300_admin_product_review_import_confirm.sql"
]));

export const PROTECTED_CATALOG_EXACT_PATHS = Object.freeze(new Set([
  "app/api/current-products/products/route.js",
  "lib/backups/product-db.backup.js",
  "lib/product-source.js",
  "lib/recommendation-scoring.ts",
  "lib/recommendation.js"
]));

export const PROTECTED_CATALOG_PREFIXES = Object.freeze([
  "catalog/",
  "data/",
  "public/catalog/",
  "public/products/"
]);

export const REGRESSION_PAIRS = Object.freeze({
  adminV2Historical: Object.freeze({
    base: "9cf90f4a464c9885c4cad647a14786ebc502e2cd",
    head: "c7aefdd13d3344a203e0ea38178b607ec97a51b0",
    expectedClassification: "NON_ENGINE_ONLY",
    expectedEngineScopeChanged: false,
    expectedAdminScopeChanged: true,
    expectedMigrationScopeChanged: true
  }),
  adminV2CurrentAtFixStart: Object.freeze({
    base: "9cf90f4a464c9885c4cad647a14786ebc502e2cd",
    head: "a670212434c56b0578654623ab4d75709d83984b",
    expectedClassification: "NON_ENGINE_ONLY",
    expectedEngineScopeChanged: false,
    expectedAdminScopeChanged: true,
    expectedMigrationScopeChanged: true
  }),
  adminV2MergedMain: Object.freeze({
    base: "9cf90f4a464c9885c4cad647a14786ebc502e2cd",
    head: "2c4edce5065b6d274ab26ca52e18f123ffd1fcfa",
    expectedClassification: "NON_ENGINE_ONLY",
    expectedEngineScopeChanged: false,
    expectedAdminScopeChanged: true,
    expectedMigrationScopeChanged: true
  }),
  adminV2ScopeFixMergedMain: Object.freeze({
    base: "2c4edce5065b6d274ab26ca52e18f123ffd1fcfa",
    head: "ead0f9632366eb940235973083830db0b69740c5",
    expectedClassification: "NON_ENGINE_ONLY",
    expectedEngineScopeChanged: false,
    expectedAdminScopeChanged: false,
    expectedMigrationScopeChanged: false
  }),
  engineCloseout171: Object.freeze({
    base: "6604ca37087eb063e793218d0b734e89c36f228d",
    head: "89985538ffa7391bca2a216974c0b8d22ba8f46d",
    expectedClassification: "ENGINE_ONLY",
    expectedEngineScopeChanged: true,
    expectedAdminScopeChanged: false,
    expectedMigrationScopeChanged: false
  })
});

const CREDENTIAL_LITERAL_PATTERN = /sk-(?:proj-)?[A-Za-z0-9_-]{24,}|eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/;
const IMAGE_FIXTURE_PATTERN = /\.(?:jpe?g|png|webp|heic|gif)$/i;

function normalizeChangedFiles(changedFiles) {
  return [...new Set(changedFiles.map((file) => String(file).trim()).filter(Boolean))].sort();
}

export function isEngineOwnedPath(file) {
  return ENGINE_OWNED_EXACT_PATHS.has(file) || ENGINE_OWNED_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isProtectedCatalogPath(file) {
  return PROTECTED_CATALOG_EXACT_PATHS.has(file) || PROTECTED_CATALOG_PREFIXES.some((prefix) => file.startsWith(prefix));
}

export function classifySkinDecisionCloseoutDiffScope(changedFiles, options = {}) {
  const files = normalizeChangedFiles(changedFiles);
  const addedLines = Array.isArray(options.addedLines) ? options.addedLines : [];
  const engineOwnedPaths = files.filter(isEngineOwnedPath);
  const adminPaths = files.filter((file) => file.startsWith("app/api/admin/"));
  const migrationPaths = files.filter((file) => file.startsWith("supabase/migrations/"));
  const protectedCatalogPaths = files.filter(isProtectedCatalogPath);
  const unapprovedAdminPaths = adminPaths.filter((file) => !ALLOWED_ADMIN_BASELINE_PATHS.has(file));
  const unapprovedMigrationPaths = migrationPaths.filter((file) => !ALLOWED_ADMIN_BASELINE_MIGRATIONS.has(file));
  const engineScopeChanged = engineOwnedPaths.length > 0;
  const credentialLiteralDetected = addedLines.some((line) => CREDENTIAL_LITERAL_PATTERN.test(line));
  const imageFixturePaths = files.filter((file) => IMAGE_FIXTURE_PATTERN.test(file));

  let classification = "NON_ENGINE_ONLY";
  if (engineScopeChanged) {
    if (unapprovedAdminPaths.length > 0) {
      classification = "ENGINE_WITH_UNAPPROVED_ADMIN_SCOPE";
    } else if (unapprovedMigrationPaths.length > 0) {
      classification = "ENGINE_WITH_UNAPPROVED_MIGRATION_SCOPE";
    } else if (protectedCatalogPaths.length > 0) {
      classification = "ENGINE_WITH_UNAPPROVED_CATALOG_SCOPE";
    } else if (adminPaths.length > 0 || migrationPaths.length > 0) {
      classification = "ENGINE_WITH_ALLOWED_ADMIN_BASELINE";
    } else {
      classification = "ENGINE_ONLY";
    }
  }

  const scopeFailure = classification.startsWith("ENGINE_WITH_UNAPPROVED_");
  const hygieneFailure = credentialLiteralDetected || imageFixturePaths.length > 0;
  const pass = !scopeFailure && !hygieneFailure;
  const reasons = [];
  if (unapprovedAdminPaths.length > 0 && engineScopeChanged) reasons.push(`unapproved Admin scope: ${unapprovedAdminPaths.join(", ")}`);
  if (unapprovedMigrationPaths.length > 0 && engineScopeChanged) reasons.push(`unapproved migration scope: ${unapprovedMigrationPaths.join(", ")}`);
  if (protectedCatalogPaths.length > 0 && engineScopeChanged) reasons.push(`unapproved catalog or recommendation scope: ${protectedCatalogPaths.join(", ")}`);
  if (credentialLiteralDetected) reasons.push("potential credential literal detected");
  if (imageFixturePaths.length > 0) reasons.push(`image fixture detected: ${imageFixturePaths.join(", ")}`);

  return {
    version: "skin-decision-closeout-diff-scope-v1",
    engineScopeChanged,
    adminScopeChanged: adminPaths.length > 0,
    migrationScopeChanged: migrationPaths.length > 0,
    protectedCatalogScopeChanged: protectedCatalogPaths.length > 0,
    scopeGuardApplicable: engineScopeChanged,
    classification,
    pass,
    reason: reasons.join("; ") || "scope classification passed",
    changedFiles: files,
    engineOwnedPaths,
    adminPaths,
    migrationPaths,
    protectedCatalogPaths,
    unapprovedAdminPaths,
    unapprovedMigrationPaths,
    credentialLiteralDetected,
    imageFixturePaths
  };
}

export function readGitChangedFiles(base, head, cwd = ROOT) {
  return execFileSync("git", ["diff", "--name-only", `${base}..${head}`], {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  }).split(/\r?\n/).filter(Boolean);
}

export function readGitAddedLines(base, head, cwd = ROOT) {
  return execFileSync("git", ["diff", "-U0", `${base}..${head}`], {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  }).split(/\r?\n/).filter((line) => line.startsWith("+") && !line.startsWith("+++"));
}

function hasCommit(sha, cwd = ROOT) {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function runFixtureRegressions() {
  const engineFile = "lib/shared-skin-decision-context-v4.js";
  const cases = [
    {
      name: "engine-only",
      result: classifySkinDecisionCloseoutDiffScope([engineFile]),
      expectedClassification: "ENGINE_ONLY",
      expectedPass: true
    },
    {
      name: "engine-with-unapproved-admin",
      result: classifySkinDecisionCloseoutDiffScope([engineFile, "app/api/admin/example/route.js"]),
      expectedClassification: "ENGINE_WITH_UNAPPROVED_ADMIN_SCOPE",
      expectedPass: false
    },
    {
      name: "engine-with-unapproved-migration",
      result: classifySkinDecisionCloseoutDiffScope([engineFile, "supabase/migrations/20990101000000_unapproved_admin.sql"]),
      expectedClassification: "ENGINE_WITH_UNAPPROVED_MIGRATION_SCOPE",
      expectedPass: false
    },
    {
      name: "non-engine-admin-migration-only",
      result: classifySkinDecisionCloseoutDiffScope(["supabase/migrations/20990101000000_admin_only.sql"]),
      expectedClassification: "NON_ENGINE_ONLY",
      expectedPass: true
    },
    {
      name: "engine-with-allowed-admin-baseline",
      result: classifySkinDecisionCloseoutDiffScope([
        engineFile,
        "app/api/admin/product-reviews/confirm/route.js",
        "supabase/migrations/20260804233300_admin_product_review_import_confirm.sql"
      ]),
      expectedClassification: "ENGINE_WITH_ALLOWED_ADMIN_BASELINE",
      expectedPass: true
    },
    {
      name: "engine-with-catalog-mutation",
      result: classifySkinDecisionCloseoutDiffScope([engineFile, "lib/product-source.js"]),
      expectedClassification: "ENGINE_WITH_UNAPPROVED_CATALOG_SCOPE",
      expectedPass: false
    },
    {
      name: "secret-literal-global",
      result: classifySkinDecisionCloseoutDiffScope(["docs/ci.md"], {
        addedLines: [`+OPENAI_API_KEY=${["sk", "-proj-", "a".repeat(32)].join("")}`]
      }),
      expectedClassification: "NON_ENGINE_ONLY",
      expectedPass: false
    },
    {
      name: "image-fixture-global",
      result: classifySkinDecisionCloseoutDiffScope(["tests/fixtures/skin.jpg"]),
      expectedClassification: "NON_ENGINE_ONLY",
      expectedPass: false
    }
  ];

  for (const testCase of cases) {
    assert.equal(testCase.result.classification, testCase.expectedClassification, `${testCase.name} classification`);
    assert.equal(testCase.result.pass, testCase.expectedPass, `${testCase.name} pass`);
  }
  return cases.map(({ name, result }) => ({ name, classification: result.classification, pass: result.pass }));
}

function runRepositoryPairRegressions(requirePairs) {
  const results = [];
  for (const [name, pair] of Object.entries(REGRESSION_PAIRS)) {
    const available = existsSync(path.join(ROOT, ".git")) && hasCommit(pair.base) && hasCommit(pair.head);
    if (!available) {
      if (requirePairs) throw new Error(`required regression pair unavailable: ${name} ${pair.base}..${pair.head}`);
      results.push({ name, available: false, base: pair.base, head: pair.head });
      continue;
    }
    const result = classifySkinDecisionCloseoutDiffScope(
      readGitChangedFiles(pair.base, pair.head),
      { addedLines: readGitAddedLines(pair.base, pair.head) }
    );
    assert.equal(result.engineScopeChanged, pair.expectedEngineScopeChanged, `${name} engineScopeChanged`);
    assert.equal(result.adminScopeChanged, pair.expectedAdminScopeChanged, `${name} adminScopeChanged`);
    assert.equal(result.migrationScopeChanged, pair.expectedMigrationScopeChanged, `${name} migrationScopeChanged`);
    assert.equal(result.classification, pair.expectedClassification, `${name} classification`);
    assert.equal(result.pass, true, `${name} pass`);
    results.push({ name, available: true, base: pair.base, head: pair.head, ...result });
  }
  return results;
}

function parseArgs(argv) {
  const options = {
    base: process.env.CLOSEOUT_BASE_SHA || "",
    head: process.env.CLOSEOUT_HEAD_SHA || "HEAD",
    evidence: "",
    requireRepositoryPairs: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base") options.base = argv[++index] || "";
    else if (arg === "--head") options.head = argv[++index] || "";
    else if (arg === "--evidence") options.evidence = argv[++index] || "";
    else if (arg === "--require-repository-pairs") options.requireRepositoryPairs = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function runCli() {
  const options = parseArgs(process.argv.slice(2));
  const fixtureRegressions = runFixtureRegressions();
  const repositoryPairRegressions = runRepositoryPairRegressions(options.requireRepositoryPairs);
  let current = null;
  if (options.base) {
    current = classifySkinDecisionCloseoutDiffScope(
      readGitChangedFiles(options.base, options.head),
      { addedLines: readGitAddedLines(options.base, options.head) }
    );
    assert.ok(current.changedFiles.length > 0, "current closeout diff is non-empty");
    assert.ok(current.pass, current.reason);
  }

  const evidence = {
    version: "skin-decision-closeout-diff-scope-verifier-v1",
    status: "PASS",
    currentBase: options.base || null,
    currentHead: options.head || null,
    current,
    fixtureRegressions,
    repositoryPairRegressions,
    ownershipContract: {
      engineOwnedExactPaths: [...ENGINE_OWNED_EXACT_PATHS].sort(),
      engineOwnedPrefixes: [...ENGINE_OWNED_PREFIXES],
      allowedAdminBaselinePaths: [...ALLOWED_ADMIN_BASELINE_PATHS].sort(),
      allowedAdminBaselineMigrations: [...ALLOWED_ADMIN_BASELINE_MIGRATIONS].sort(),
      protectedCatalogExactPaths: [...PROTECTED_CATALOG_EXACT_PATHS].sort(),
      protectedCatalogPrefixes: [...PROTECTED_CATALOG_PREFIXES]
    }
  };

  if (options.evidence) {
    const evidencePath = path.resolve(ROOT, options.evidence);
    mkdirSync(path.dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entryPath === import.meta.url) runCli();
