import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
let assertions = 0;

function check(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(message);
}

function read(path) {
  const absolute = resolve(ROOT, path);
  check(existsSync(absolute), `missing integration file: ${path}`);
  return readFileSync(absolute, "utf8");
}

const requiredFiles = [
  "app/admin/AdminNavigation.js",
  "app/admin/products/reviews/ProductReviewWorkbench.js",
  "app/admin/products/reviews/import/ProductReviewImportWorkbench.js",
  "app/api/admin/product-reviews/preflight/route.js",
  "app/api/admin/product-reviews/confirm/route.js",
  "app/api/admin/product-reviews/import/dry-run/route.js",
  "app/api/admin/product-reviews/import/confirm/route.js",
  "lib/admin/product-reviews.js",
  "lib/admin/request-policy.js",
  "lib/admin/product-review-import/http-handlers.js",
  "crawler/export-product-reviews.ts",
  "crawler/import-reviewed-product-reviews.ts",
  "scripts/verify-admin-product-candidate-reviews.mjs",
  "scripts/verify-admin-product-review-import-confirm.mjs",
  "scripts/verify-admin-product-review-import-routes.mjs",
  "scripts/verify-admin-product-review-import-ui.mjs",
  "docs/reports/admin-product-current-main-integration.md"
];
requiredFiles.forEach((path) => read(path));

const pkg = JSON.parse(read("package.json"));
check(Array.isArray(pkg.workspaces), "current-main workspace contract missing");
check(pkg.workspaces.includes("packages/*"), "packages workspace lost");
check(pkg.workspaces.includes("tools/*"), "tools workspace lost");
check(pkg.dependencies?.next === "15.5.22", "current-main Next.js version drift");
check(pkg.dependencies?.sharp === "0.35.3", "current-main sharp version drift");
check(pkg.overrides?.next?.postcss === "8.5.25", "current-main postcss override drift");
check(pkg.overrides?.next?.sharp === "0.35.3", "current-main sharp override drift");
for (const name of [
  "verify:admin-product-candidate-reviews",
  "verify:admin-product-review-import-confirm",
  "verify:admin-product-review-import-ui",
  "verify:admin-product-review-import-routes",
  "verify:admin-product-current-main-integration",
  "synthetic:test",
  "verify:candidate-exposure-policy-shadow"
]) {
  check(typeof pkg.scripts?.[name] === "string", `root script missing: ${name}`);
}

const crawlerPkg = JSON.parse(read("crawler/package.json"));
for (const name of [
  "reviews:export",
  "reviews:import-reviewed",
  "verify:product-review-export",
  "verify:product-review-intake-dry-run",
  "verify:product-review-intake-bytes",
  "verify:product-review-intake-confirm",
  "verify:product-review-intake-confirm:local-runtime",
  "typecheck"
]) {
  check(typeof crawlerPkg.scripts?.[name] === "string", `crawler script missing: ${name}`);
}

const migrationNames = new Set(readdirSync(resolve(ROOT, "supabase/migrations")));
const requiredMigrations = [
  "20260804233000_admin_product_candidate_reviews.sql",
  "20260804233100_admin_product_candidate_reviews_hardening.sql",
  "20260804233200_admin_product_candidate_reviews_security_hardening.sql",
  "20260804233300_admin_product_review_import_confirm.sql"
];
requiredMigrations.forEach((name) => check(migrationNames.has(name), `rebased migration missing: ${name}`));
for (const name of [
  "20260730164500_admin_product_candidate_reviews.sql",
  "20260730164600_admin_product_candidate_reviews_hardening.sql",
  "20260731150000_admin_product_candidate_reviews_security_hardening.sql",
  "20260731183428_admin_product_review_import_confirm.sql"
]) {
  check(!migrationNames.has(name), `historical out-of-order migration retained: ${name}`);
}

const access = read("lib/admin/access.js");
check(access.includes("userId: null"), "denied access user binding missing");
check(access.includes("userId: user.id"), "authenticated actor binding missing");

const layout = read("app/admin/layout.js");
check(layout.includes("AdminNavigation"), "admin navigation integration missing");

const nextConfig = read("next.config.js");
check(nextConfig.includes("extensionAlias"), "NodeNext extension resolution missing");
check(nextConfig.includes('".ts"'), "TypeScript extension alias missing");

const securitySuite = read("scripts/run-security-closeout-verifier-suite.mjs");
check(securitySuite.includes('"verify-admin-product-candidate-reviews.mjs"'), "security closeout manifest missing admin product verifier");

const vercel = JSON.parse(read("vercel.json"));
check(vercel.git?.deploymentEnabled?.["**"] === false, "non-main Vercel deployment deny lost");
check(vercel.git?.deploymentEnabled?.main === true, "main Vercel deployment allow lost");

const workflow = read(".github/workflows/admin-product-current-main-integration.yml");
check(workflow.includes("integration/admin-product-current-main"), "integration push trigger missing");
check(workflow.includes("isolated-confirm-runtime"), "isolated runtime job missing");
check(workflow.includes("20260804233300_admin_product_review_import_confirm.sql"), "rebased confirm migration missing from workflow");

console.log(`verify-admin-product-current-main-integration: PASS (${assertions} assertions)`);
