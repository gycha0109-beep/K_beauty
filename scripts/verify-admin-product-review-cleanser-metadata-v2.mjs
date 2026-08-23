import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

import {
  ADMIN_V2_SCOPE_CLASSIFICATIONS,
  assertAdminV2ScopeResult,
  classifyAdminV2Diff,
  runAdminV2ScopeRegressionMatrix,
} from "./verify-admin-product-review-v2-diff-scope.mjs";

const read = (filePath) => fs.readFileSync(filePath, "utf8");
const run = (command, args) => execFileSync(command, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

const baseSha = process.env.ADMIN_VERIFY_BASE_SHA;
const headSha = process.env.ADMIN_VERIFY_HEAD_SHA;

const requiredFiles = [
  ".github/workflows/admin-product-current-main-integration.yml",
  "app/api/admin/product-reviews/import-v2/confirm/route.js",
  "app/api/admin/product-reviews/import-v2/dry-run/route.js",
  "crawler/export-product-reviews-v2.ts",
  "crawler/lib/reviews/review-cleanser-metadata-v2-contract.ts",
  "crawler/lib/reviews/review-cleanser-metadata-v2-validation.ts",
  "crawler/lib/reviews/review-cleanser-metadata-v2.ts",
  "crawler/tests/prepare-cleanser-metadata-v2-local-fixture.ts",
  "crawler/tests/verify-cleanser-metadata-v2-contract.ts",
  "crawler/tests/verify-cleanser-metadata-v2-local-runtime.ts",
  "lib/admin/product-review-import-v2/import-confirm.js",
  "lib/admin/product-review-import-v2/import-dry-run.js",
  "lib/admin/product-review-import-v2/import-package.js",
  "supabase/migrations/20260805220000_admin_product_review_cleanser_metadata_v2.sql",
  "supabase/migrations/20260805220005_admin_product_review_cleanser_metadata_v2_validate.sql",
  "supabase/migrations/20260805220010_admin_product_review_cleanser_metadata_v2_confirm.sql",
  "tests/fixtures/admin-product-review-v2/20260805215900_product_review_v2_column_adapter.sql",
  "tests/fixtures/admin-product-review-v2/20260805220100_product_review_v2_runtime_seed.sql",
  "tests/fixtures/admin-product-review-v2/20260805220200_product_review_v2_rollback_probe.sql",
  "scripts/verify-admin-product-current-main-integration.mjs",
  "scripts/verify-admin-product-review-cleanser-metadata-v2.mjs",
  "scripts/verify-admin-product-review-v2-diff-scope.mjs",
  "docs/architecture/admin-product-review-cleanser-metadata-v2.md",
  ".codex/AI_WORK_LOG.d/2026-08-05-admin-product-review-cleanser-metadata-v2.md",
];
for (const filePath of requiredFiles) {
  assert.equal(fs.existsSync(filePath), true, `missing file: ${filePath}`);
}
assert.equal(
  fs.existsSync(".github/workflows/admin-product-review-cleanser-metadata-v2.yml"),
  false,
  "temporary standalone workflow must not remain",
);

const contractFiles = [
  "crawler/lib/reviews/review-cleanser-metadata-v2-contract.ts",
  "crawler/lib/reviews/review-cleanser-metadata-v2-validation.ts",
  "crawler/lib/reviews/review-cleanser-metadata-v2.ts",
];
const contract = contractFiles.map(read).join("\n");
const migrationFiles = [
  "supabase/migrations/20260805220000_admin_product_review_cleanser_metadata_v2.sql",
  "supabase/migrations/20260805220005_admin_product_review_cleanser_metadata_v2_validate.sql",
  "supabase/migrations/20260805220010_admin_product_review_cleanser_metadata_v2_confirm.sql",
];
const migration = migrationFiles.map(read).join("\n");
const dryRoute = read("app/api/admin/product-reviews/import-v2/dry-run/route.js");
const confirmRoute = read("app/api/admin/product-reviews/import-v2/confirm/route.js");
const workflow = read(".github/workflows/admin-product-current-main-integration.yml");
const v1Contract = read("crawler/lib/reviews/review-export-contract.ts");

for (const token of [
  "admin-product-review-v2",
  "cleanser-metadata-v1",
  "cleanser-metadata-review-policy-v1",
  "product-review-field-evidence-v1",
  "reviewed_valid",
  "reviewed_unknown",
  "reviewed_conflict",
  "not_applicable",
  "low_ph",
  "balanced",
  "deep_clean",
  "cleansing_profile_evidence_refs_json",
  "buildCleanserMetadataV2ConfirmPayload",
  "runCleanserMetadataV2DryRun",
]) {
  assert.ok(contract.includes(token), `missing contract token: ${token}`);
}

assert.ok(v1Contract.includes('export const REVIEWED_SCHEMA_VERSION = "product-review-reviewed-v1"'));
assert.ok(v1Contract.includes('export const IMPORT_CONFIRM_SCHEMA_VERSION = "product-review-import-confirm-v1"'));
for (const forbidden of [
  "recommendationApproved",
  "rankingEnabled",
  "deepCleanPenaltyEnabled",
]) {
  assert.equal(contract.includes(forbidden), false, `forbidden ownership name: ${forbidden}`);
}

for (const route of [dryRoute, confirmRoute]) {
  assert.ok(route.includes('runtime = "nodejs"'));
  assert.ok(route.includes("requireAdminCapability"));
  assert.ok(route.includes("isAllowedAdminMutationRequest"));
  assert.ok(route.includes("parseProductReviewImportV2Package"));
}
assert.equal(confirmRoute.includes("reviewer"), false);

for (const token of [
  "product_metadata_field_reviews",
  "admin_product_review_import_v2_confirmations",
  "admin_confirm_product_review_import_v2_batch",
  "admin_get_product_review_import_v2_confirmation",
  "admin_confirm_product_review_import_batch(",
  "pg_advisory_xact_lock",
  "review_v2_stale_target_product",
  "review_v2_stale_metadata_review",
  "admin.product_metadata_review_v2.confirmed",
  "structured_metadata_review_complete",
  "reviewed_by uuid not null",
  "revoke all on table public.product_metadata_field_reviews",
  "grant execute on function public.admin_confirm_product_review_import_v2_batch",
  "review_v2_v1_batch_already_confirmed",
]) {
  assert.ok(migration.includes(token), `missing migration token: ${token}`);
}
assert.ok(/admin_confirm_product_review_import_v2_batch[\s\S]*admin_confirm_product_review_import_batch\(/.test(migration));
assert.ok(/admin_confirm_product_review_import_batch\([\s\S]*insert into public\.product_metadata_field_reviews/.test(migration));
assert.equal(/insert\s+into\s+public\.products[\s\S]*select/i.test(migration), false, "no catalog backfill");
for (const forbidden of ["isDeepCleanser", "getHardPenalty", "-18"]) {
  assert.equal(migration.includes(forbidden), false, `forbidden recommendation dependency: ${forbidden}`);
}

for (const token of [
  "integration/admin-product-current-main",
  "github.event.pull_request.head.sha",
  "ADMIN_VERIFY_BASE_SHA",
  "ADMIN_VERIFY_HEAD_SHA",
  "verify:product-review-cleanser-metadata-v2",
  "isolated-v2-runtime",
  "Local Supabase v2 reset and runtime cycle 1",
  "Local Supabase v2 reset and runtime cycle 2",
  "github.base_ref == 'main'",
]) {
  assert.ok(workflow.includes(token), `missing natural workflow token: ${token}`);
}
assert.equal(
  workflow.includes("feature/admin-product-review-cleanser-metadata-v2"),
  false,
  "feature-only push trigger must be removed before final main-target CI",
);
assert.equal(/supabase\s+db\s+push|supabase\s+migration\s+up|vercel\s+deploy/i.test(workflow), false);

const regressionMatrix = runAdminV2ScopeRegressionMatrix();
const scopeResult = classifyAdminV2Diff({ baseSha, headSha });
assertAdminV2ScopeResult(scopeResult, "current Admin v2 verifier pair");

const tree = (ref) => run("git", ["ls-tree", "-r", "--full-tree", ref]);
const criticalCodeFingerprint = (ref) => {
  const lines = tree(ref)
    .split("\n")
    .filter((line) => /\t(?:app\/api\/(?:analyze|full-report)|app\/result|components\/result|lib\/(?:skin-match|recommendation|candidate-exposure|functional-candidate|evaluator-boundary|premium|result|saved-report))/.test(line))
    .sort();
  return sha256(lines.join("\n"));
};

let productionFingerprint = "not-applicable";
if (scopeResult.classification === ADMIN_V2_SCOPE_CLASSIFICATIONS.APPLICABLE) {
  const baseFingerprint = criticalCodeFingerprint(baseSha);
  const headFingerprint = criticalCodeFingerprint(headSha);
  assert.equal(
    baseFingerprint,
    headFingerprint,
    "score/ranking/result/Premium/reentry/CandidatePolicy source fingerprint changed",
  );
  productionFingerprint = headFingerprint.slice(0, 12);
}

const runtimeFiles = [
  ...contractFiles,
  "crawler/export-product-reviews-v2.ts",
  "lib/admin/product-review-import-v2/import-confirm.js",
  "lib/admin/product-review-import-v2/import-dry-run.js",
  "lib/admin/product-review-import-v2/import-package.js",
  "app/api/admin/product-reviews/import-v2/confirm/route.js",
  "app/api/admin/product-reviews/import-v2/dry-run/route.js",
].map(read).join("\n");
for (const forbidden of [
  "skin-match-decision-engine",
  "candidate-exposure-policy",
  "getHardPenalty",
  "isDeepCleanser",
]) {
  assert.equal(runtimeFiles.includes(forbidden), false, `forbidden runtime dependency: ${forbidden}`);
}

for (const filePath of [
  "app/api/admin/product-reviews/import-v2/confirm/route.js",
  "app/api/admin/product-reviews/import-v2/dry-run/route.js",
  "lib/admin/product-review-import-v2/import-confirm.js",
  "lib/admin/product-review-import-v2/import-dry-run.js",
  "lib/admin/product-review-import-v2/import-package.js",
  "scripts/verify-admin-product-review-v2-diff-scope.mjs",
  "scripts/verify-admin-product-review-cleanser-metadata-v2.mjs",
]) {
  run(process.execPath, ["--check", filePath]);
}

run("git", ["diff", "--check", `${baseSha}...${headSha}`]);
const diff = run("git", ["diff", "--no-ext-diff", `${baseSha}...${headSha}`]);
const secretPattern = new RegExp([
  "sk", "-proj-",
  "|sk-[A-Za-z0-9]{20,}",
  "|e", "yJ[A-Za-z0-9_-]{30,}\\.[A-Za-z0-9_-]{20,}\\.",
].join(""));
assert.equal(secretPattern.test(diff), false, "secret-like material found in diff");
assert.equal(secretPattern.test(["sk", "-", "A".repeat(25)].join("")), true, "secret negative control drift");

process.stdout.write(
  "verify:admin-product-review-cleanser-metadata-v2 PASS " +
  `(classification ${scopeResult.classification}, regression ${regressionMatrix.length}, ` +
  `v1 boundary, explicit v2, atomic SQL, security, no activation, production fingerprint ${productionFingerprint})\n`,
);
