import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  ADMIN_V2_SCOPE_CLASSIFICATIONS,
  classifyAdminV2ChangedFiles,
} from "./verify-admin-product-review-v2-diff-scope.mjs";

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
  "scripts/verify-admin-product-review-cleanser-metadata-v2.mjs",
  "scripts/verify-admin-product-review-v2-diff-scope.mjs",
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
const v2Verifier = read("scripts/verify-admin-product-review-cleanser-metadata-v2.mjs");
const v2ScopeVerifier = read("scripts/verify-admin-product-review-v2-diff-scope.mjs");
check(workflow.includes("integration/admin-product-current-main"), "integration push trigger missing");
check(workflow.includes("isolated-confirm-runtime"), "isolated runtime job missing");
check(workflow.includes("20260804233300_admin_product_review_import_confirm.sql"), "rebased confirm migration missing from workflow");

const pushStart = workflow.indexOf("  push:\n");
const dispatchStart = workflow.indexOf("  workflow_dispatch:", pushStart);
check(pushStart >= 0 && dispatchStart > pushStart, "push trigger block missing");
const pushBlock = workflow.slice(pushStart, dispatchStart);
check(pushBlock.includes("      - main\n"), "main push trigger missing");
check(
  pushBlock.includes("      - integration/admin-product-current-main\n"),
  "integration push trigger missing from push block"
);

const expectedPushPaths = [
  '"app/admin/**"',
  '"app/api/admin/product-reviews/**"',
  '"crawler/**"',
  '"lib/admin/**"',
  '"supabase/migrations/*_admin_product_*.sql"',
  '"tests/fixtures/admin-product-review*/**"',
  '"tests/fixtures/product-review-export-intake/**"',
  '"scripts/verify-admin-product-*.mjs"',
  '"scripts/run-security-closeout-verifier-suite.mjs"',
  '"docs/architecture/*product-review*.md"',
  '"docs/reports/admin-product-current-main-integration.md"',
  '"next.config.js"',
  '"package.json"',
  '"crawler/package.json"',
  '".github/workflows/admin-product-current-main-integration.yml"'
];
for (const path of expectedPushPaths) {
  check(pushBlock.includes(`      - ${path}`), `main push path missing: ${path}`);
}

for (const token of [
  "Resolve Admin verifier base and head",
  "ADMIN_VERIFY_BASE_SHA",
  "ADMIN_VERIFY_HEAD_SHA",
  "github.event.pull_request.base.sha",
  "github.event.pull_request.head.sha",
  "github.event.before",
  'git rev-parse "${head}^"',
  'git cat-file -e "${base}^{commit}"',
  'git diff --check "${ADMIN_VERIFY_BASE_SHA}...${ADMIN_VERIFY_HEAD_SHA}"'
]) {
  check(workflow.includes(token), `event-aware Admin verifier contract missing: ${token}`);
}
check(
  !workflow.includes("git fetch origin integration/admin-product-current-main"),
  "stale durable-base fetch retained in Admin workflow"
);
check(
  !workflow.includes("git diff --check origin/integration/admin-product-current-main..HEAD"),
  "stale durable-base diff retained in Admin workflow"
);
check(
  !v2Verifier.includes("origin/integration/admin-product-current-main"),
  "fixed integration BASE_REF retained in Admin v2 verifier"
);
check(
  v2Verifier.includes('from "./verify-admin-product-review-v2-diff-scope.mjs"'),
  "Admin v2 verifier does not consume the ownership classifier"
);
for (const token of [
  "ADMIN_V2_SCOPE_NOT_APPLICABLE",
  "ADMIN_V2_SCOPE_APPLICABLE",
  "ADMIN_V2_WITH_UNAPPROVED_SCOPE",
  "ADMIN_V2_WITH_PRODUCTION_RUNTIME_SCOPE",
  "app/api/admin/product-reviews/import-v2/",
  "scripts/verify-admin-product-review-cleanser-metadata-v2.mjs",
  "2c4edce5065b6d274ab26ca52e18f123ffd1fcfa",
  "b7e301293e3accf9348ead9472bfe21d44d0b7dd",
  "a670212434c56b0578654623ab4d75709d83984b"
]) {
  check(v2ScopeVerifier.includes(token), `Admin v2 scope contract token missing: ${token}`);
}

const packageOnly = classifyAdminV2ChangedFiles(["package.json"]);
check(
  packageOnly.classification === ADMIN_V2_SCOPE_CLASSIFICATIONS.NOT_APPLICABLE && packageOnly.pass,
  "package-only diff must not activate Admin v2 scope"
);
const verifierOnly = classifyAdminV2ChangedFiles([
  "scripts/verify-admin-product-review-cleanser-metadata-v2.mjs"
]);
check(
  verifierOnly.classification === ADMIN_V2_SCOPE_CLASSIFICATIONS.APPLICABLE && verifierOnly.pass,
  "Admin v2 verifier-only maintenance must activate bounded scope"
);
const mixedEngine = classifyAdminV2ChangedFiles([
  "scripts/verify-admin-product-review-cleanser-metadata-v2.mjs",
  ".github/workflows/skin-decision-engine-closeout.yml"
]);
check(
  mixedEngine.classification === ADMIN_V2_SCOPE_CLASSIFICATIONS.UNAPPROVED && !mixedEngine.pass,
  "Admin v2 plus Engine must fail closed"
);

function resolveAdminVerifierRefs({ eventName, prBase = "", prHead = "", before = "", sha = "", parent = "" }) {
  if (eventName === "pull_request") return { base: prBase, head: prHead };
  if (eventName === "push") return { base: before, head: sha };
  if (eventName === "workflow_dispatch") return { base: parent, head: sha };
  return null;
}

const refMatrix = [
  [
    { eventName: "pull_request", prBase: "base", prHead: "head", sha: "merge" },
    { base: "base", head: "head" },
    "pull request"
  ],
  [
    { eventName: "push", before: "before", sha: "head" },
    { base: "before", head: "head" },
    "push"
  ],
  [
    { eventName: "workflow_dispatch", parent: "parent", sha: "head" },
    { base: "parent", head: "head" },
    "workflow dispatch"
  ]
];
for (const [event, expected, label] of refMatrix) {
  const actual = resolveAdminVerifierRefs(event);
  check(actual?.base === expected.base && actual?.head === expected.head, `Admin verifier ref mismatch: ${label}`);
}
check(resolveAdminVerifierRefs({ eventName: "schedule" }) === null, "unsupported event must fail closed");

const expectedV2Condition =
  "if: ${{ (github.event_name == 'pull_request' && github.base_ref == 'main') || (github.event_name == 'push' && github.ref_name == 'main') || (github.event_name == 'workflow_dispatch' && github.ref_name == 'main') }}";
check(workflow.includes(expectedV2Condition), "isolated-v2-runtime event condition drift");

function shouldRunV2({ eventName, baseRef = "", refName = "" }) {
  return (
    (eventName === "pull_request" && baseRef === "main") ||
    (eventName === "push" && refName === "main") ||
    (eventName === "workflow_dispatch" && refName === "main")
  );
}

const eventMatrix = [
  [{ eventName: "pull_request", baseRef: "main" }, true, "main pull request"],
  [{ eventName: "push", refName: "main" }, true, "main push"],
  [
    { eventName: "push", refName: "integration/admin-product-current-main" },
    false,
    "integration push"
  ],
  [{ eventName: "workflow_dispatch", refName: "main" }, true, "main workflow dispatch"],
  [
    { eventName: "workflow_dispatch", refName: "feature/admin-product-review-cleanser-metadata-v2" },
    false,
    "non-main workflow dispatch"
  ],
  [{ eventName: "pull_request", baseRef: "integration/admin-product-current-main" }, false, "stacked pull request"]
];
for (const [event, expected, label] of eventMatrix) {
  check(shouldRunV2(event) === expected, `isolated-v2-runtime event matrix mismatch: ${label}`);
}

console.log(`verify-admin-product-current-main-integration: PASS (${assertions} assertions)`);
