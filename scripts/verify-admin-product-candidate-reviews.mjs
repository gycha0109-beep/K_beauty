import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const checkedFiles = [];

function read(path) {
  const absolutePath = resolve(root, path);
  if (!existsSync(absolutePath)) {
    throw new Error(`missing file: ${path}`);
  }
  checkedFiles.push(path);
  return readFileSync(absolutePath, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function includes(text, value, label) {
  assert(text.includes(value), `${label} missing: ${value}`);
}

function excludes(text, value, label) {
  assert(!text.includes(value), `${label} unexpectedly contains: ${value}`);
}

const migrationFiles = readdirSync(resolve(root, "supabase/migrations"))
  .filter((name) => name.includes("admin_product_candidate_reviews"))
  .sort();
assert(migrationFiles.length === 3, "three admin product review migrations are required");

const migration = read(`supabase/migrations/${migrationFiles[0]}`);
const hardening = read(`supabase/migrations/${migrationFiles[1]}`);
const securityHardening = read(`supabase/migrations/${migrationFiles[2]}`);
const design = read("docs/architecture/admin-product-candidate-reviews-v1.md");
const access = read("lib/admin/access.js");
const requestPolicy = read("lib/admin/request-policy.js");
const serverBoundary = read("lib/admin/product-reviews.js");
const preflightRoute = read("app/api/admin/product-reviews/preflight/route.js");
const confirmRoute = read("app/api/admin/product-reviews/confirm/route.js");
const page = read("app/admin/products/reviews/page.js");
const workbench = read("app/admin/products/reviews/ProductReviewWorkbench.js");
const navigation = read("app/admin/AdminNavigation.js");
const fixture = read("tests/fixtures/admin-product-reviews/20260730140000_product_review_foundation.sql");
const runtimeSql = read("tests/fixtures/admin-product-reviews/verify_admin_product_review_runtime.sql");
const workflow = read(".github/workflows/admin-product-candidate-reviews.yml");
const packageJson = JSON.parse(read("package.json"));

[
  "create table if not exists public.admin_product_review_confirmations",
  "create or replace function public.admin_preflight_product_candidate_review(",
  "create or replace function public.admin_confirm_product_candidate_review(",
  "public.promote_product_candidate(",
  "public.record_admin_audit_event(",
  "admin_product_review_stale_preflight",
  "admin_product_review_request_id_conflict",
  "review_status = 'needs_review'::public.product_review_status",
  "review_status = 'rejected'::public.product_review_status",
  "status = 'deferred'",
  "status = 'rejected'",
  "status = 'approved'"
].forEach((value) => includes(migration, value, "product review migration"));

[
  "rename to admin_preflight_product_candidate_review_unsafe_v1",
  "rename to admin_confirm_product_candidate_review_unsafe_v1",
  "jsonb_typeof(v_product_payload -> 'skin_types') is distinct from 'array'",
  "jsonb_typeof(v_product_payload -> 'concerns') is distinct from 'array'",
  "jsonb_typeof(v_product_payload -> 'sensitivity_safe') is distinct from 'boolean'",
  "missing_external_identity",
  "pg_advisory_xact_lock",
  "bejewely_admin_product_review:",
  "admin_product_review_unsafe_function_exposed"
].forEach((value) => includes(hardening, value, "product review hardening"));

[
  "admin_audit_payload_has_forbidden_content",
  "admin_audit_sensitive_payload_rejected",
  "record_admin_audit_event_unsafe_v1",
  "admin_preflight_product_candidate_review_unsafe_v2",
  "invalid_duplicate_product_reference",
  "invalid_matched_product_reference",
  "conflicting_product_identity",
  "conflicting_product_references",
  "for share",
  "admin_security_hardening_unsafe_function_exposed"
].forEach((value) =>
  includes(securityHardening, value, "product review security hardening")
);

assert(
  !/grant\s+execute[\s\S]{0,300}admin_(?:preflight|confirm)_product_candidate_review[\s\S]{0,120}to\s+(?:anon|authenticated|public)/i.test(
    `${migration}\n${hardening}\n${securityHardening}`
  ),
  "product review RPCs must not be callable by browser roles"
);
assert(
  !/grant\s+(?:insert|update|delete|all)[\s\S]{0,180}admin_product_review_confirmations[\s\S]{0,100}to\s+(?:anon|authenticated|service_role)/i.test(
    migration
  ),
  "confirmation ledger must not expose direct writes"
);

[
  "candidate_promotion_reviews",
  "dry-run preflight",
  "approve",
  "defer",
  "block",
  "optimistic concurrency",
  "admin.product_candidate.review_confirmed",
  "products write는 0"
].forEach((value) => includes(design, value, "product review design"));

[
  "userId: null",
  "userId: user.id"
].forEach((value) => includes(access, value, "admin access actor identity"));

[
  'import "server-only"',
  "evaluateSignOutRequest",
  "getSignOutRuntimeOriginContract",
  "getNormalizedConfiguredProductionOrigin",
  "getCanonicalProductionOrigin",
  "decision.allowed === true",
  'request?.headers?.get?.("referer")',
  "source.origin === target.origin"
].forEach((value) => includes(requestPolicy, value, "admin request origin policy"));

[
  'import "server-only"',
  "createSupabaseAdminClient",
  "loadProductReviewWorkbench",
  "runProductReviewPreflight",
  "confirmProductReview",
  "admin_preflight_product_candidate_review",
  "admin_confirm_product_candidate_review",
  "ProductReviewOperationError",
  "LIST_LIMIT = 100",
  "UUID_PATTERN",
  "HASH_PATTERN",
  "REQUEST_ID_PATTERN",
  '"source_url"',
  '"first_seen_at"',
  '"last_seen_at"',
  '"seen_count"'
].forEach((value) => includes(serverBoundary, value, "product review server boundary"));

[
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role_key",
  "error.message"
].forEach((value) => excludes(workbench, value, "client workbench"));

for (const [route, label] of [
  [preflightRoute, "preflight route"],
  [confirmRoute, "confirm route"]
]) {
  includes(route, "ADMIN_CAPABILITIES.PRODUCTS_REVIEW", label);
  includes(route, "isAllowedAdminMutationRequest(request)", label);
  includes(route, 'error: "invalid_request_origin"', label);
  includes(route, "MAX_BODY_BYTES = 8192", label);
  includes(route, 'request.headers.get("content-length")', label);
  includes(route, "request.body?.getReader()", label);
  includes(route, "receivedBytes > MAX_BODY_BYTES", label);
  includes(route, "await reader.cancel()", label);
  includes(route, "Array.isArray(body)", label);
  includes(route, 'export const runtime = "nodejs"', label);
  includes(route, '"Cache-Control": "private, no-store, max-age=0"', label);
  includes(route, '"CDN-Cache-Control": "no-store"', label);
  includes(route, '"Vercel-CDN-Cache-Control": "no-store"', label);
  excludes(route, "SUPABASE_SERVICE_ROLE_KEY", label);
}

[
  "requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_READ)",
  "loadProductReviewWorkbench",
  "ProductReviewWorkbench"
].forEach((value) => includes(page, value, "product review page"));

[
  '"use client"',
  "Dry-run",
  "Confirm",
  "/api/admin/product-reviews/preflight",
  "/api/admin/product-reviews/confirm",
  "preflight.status === \"ready\"",
  "router.refresh()",
  "evidenceSnapshot",
  "matchedProduct",
  "confirmRequestId",
  "requestInFlight",
  "현재 원시 후보는 승인 dry-run에서 차단되는 것이 정상입니다.",
  "Source URL",
  "Observed count",
  "필드별 근거·confidence"
].forEach((value) => includes(workbench, value, "product review workbench"));

includes(navigation, 'href: "/admin/products/reviews"', "admin navigation");
includes(
  navigation,
  "capability: ADMIN_CAPABILITIES.PRODUCTS_READ",
  "admin navigation"
);
includes(
  navigation,
  "!grantedCapabilities.has(item.capability)",
  "admin navigation"
);

[
  "create type public.product_review_status",
  "create table public.product_candidates",
  "create table public.candidate_promotion_reviews",
  "create or replace function public.promote_product_candidate"
].forEach((value) => includes(fixture, value, "isolated runtime fixture"));

[
  "premium_override_became_admin",
  "missing_product_form_preflight_not_blocked",
  "insert_preflight_changed_products",
  "wrong_hash_confirm_unexpectedly_succeeded",
  "idempotent_retry_failed",
  "merge_confirm_failed",
  "defer_confirm_failed",
  "block_confirm_failed",
  "stale_preflight_unexpectedly_succeeded",
  "stale_candidate_unexpectedly_succeeded",
  "stale_review_unexpectedly_succeeded",
  "request_id_conflict_unexpectedly_succeeded",
  "conflicting_identity_preflight_not_blocked",
  "null_required_fields_preflight_not_blocked",
  "sensitive_audit_payload_unexpectedly_succeeded",
  "transaction_rollback_failed",
  "privacy_capability_matrix_invalid",
  "audit_count_invalid",
  "owner_audit_visibility_invalid",
  "viewer_audit_visibility_invalid",
  "viewer_direct_escalation_unexpectedly_succeeded",
  "ADMIN_PRODUCT_CANDIDATE_REVIEW_SQL_RUNTIME_VERIFIED"
].forEach((value) => includes(runtimeSql, value, "isolated SQL runtime verifier"));

[
  "Admin Product Candidate Reviews",
  "npm run verify:admin-product-candidate-reviews",
  "ADMIN_PRODUCT_REVIEW_RUNTIME_DIR: ${{ runner.temp }}/admin-product-review-runtime",
  "--workdir \"${ADMIN_PRODUCT_REVIEW_RUNTIME_DIR}\"",
  "supabase_db_admin-product-review-runtime",
  "verify_admin_product_review_runtime.sql",
  "npm run architecture:guard",
  "npm run build",
  "git diff --check"
].forEach((value) => includes(workflow, value, "product review workflow"));
assert(
  !workflow.includes("tmp/admin-product-review-runtime"),
  "product review workflow must not create a repository-local Supabase workdir"
);
includes(
  workflow,
  'rm -rf -- "${ADMIN_PRODUCT_REVIEW_RUNTIME_DIR}"',
  "product review workflow cleanup"
);

assert(
  packageJson.scripts?.["verify:admin-product-candidate-reviews"] ===
    "node scripts/verify-admin-product-candidate-reviews.mjs",
  "package verifier command must be registered"
);

console.log(
  JSON.stringify(
    {
      status: "passed",
      migrations: migrationFiles,
      checkedFiles: [...new Set(checkedFiles)].sort()
    },
    null,
    2
  )
);
