import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const checkedFiles = [];

function read(relativePath) {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`missing file: ${relativePath}`);
  }
  checkedFiles.push(relativePath);
  return readFileSync(absolutePath, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(text, value, label) {
  assert(text.includes(value), `${label} missing: ${value}`);
}

const migration = read(
  "supabase/migrations/20260731183428_admin_product_review_import_confirm.sql",
);
const cli = read("crawler/import-reviewed-product-reviews.ts");
const confirm = read("crawler/lib/reviews/reviewed-intake-confirm.ts");
const confirmClient = read("crawler/lib/reviews/review-confirm-client.ts");
const parser = read("crawler/lib/reviews/reviewed-intake-parser.ts");
const argumentsModule = read("crawler/lib/reviews/review-cli-args.ts");
const contract = read("crawler/lib/reviews/review-export-contract.ts");
const identity = read("crawler/lib/reviews/review-promotion-identity.ts");
const verifier = read("crawler/test-product-review-intake-confirm.ts");
const runtimeVerifier = read(
  "crawler/tests/verify-reviewed-intake-confirm-local-runtime.ts",
);
const crawlerPackage = JSON.parse(read("crawler/package.json"));

[
  "create table public.admin_product_review_import_confirmations",
  "enable row level security",
  "create or replace function public.admin_get_product_review_import_confirmation(",
  "create or replace function public.admin_confirm_product_review_import_batch(",
  "security definer",
  "pg_advisory_xact_lock",
  "bejewely_review_import_request:",
  "bejewely_review_import_batch:",
  "review_import_request_id_conflict",
  "review_import_batch_already_confirmed",
  "review_import_stale_candidate",
  "review_import_stale_review_queue",
  "review_import_duplicate_product_create",
  "review_import_normalization_contract_mismatch",
  "public.promote_product_candidate(",
  "public.record_admin_audit_event(",
  "admin.product_review_import.confirmed",
  "grant execute on function public.admin_confirm_product_review_import_batch(",
  "to service_role",
].forEach((value) => includes(migration, value, "confirm migration"));

assert(
  !/grant\s+execute[\s\S]{0,300}admin_(?:get|confirm)_product_review_import[\s\S]{0,120}to\s+(?:anon|authenticated|public)/i.test(
    migration,
  ),
  "review import RPCs must not be granted to browser roles",
);
assert(
  !/grant\s+(?:insert|update|delete|all)[\s\S]{0,180}admin_product_review_import_confirmations[\s\S]{0,100}to\s+(?:anon|authenticated|service_role)/i.test(
    migration,
  ),
  "confirmation ledger must not expose direct writes",
);

[
  "runReviewedIntakeDryRun",
  "lookupReviewedImportConfirmation",
  "buildReviewImportConfirmPayload",
  "confirmReviewedImportBatch",
  'options.mode === "confirm"',
].forEach((value) => includes(cli, value, "confirm CLI"));

[
  "admin_get_product_review_import_confirmation",
  "admin_confirm_product_review_import_batch",
  "review_import_confirm_requires_passing_dry_run",
  "review_import_confirm_failed",
].forEach((value) => includes(confirm, value, "confirm boundary"));

includes(confirmClient, "SUPABASE_SERVICE_ROLE_KEY", "service client");
includes(parser, "reviewedFileSha256", "reviewed parser");
includes(argumentsModule, '"confirm"', "CLI arguments");
includes(argumentsModule, '"actor-user-id"', "CLI arguments");
includes(argumentsModule, '"request-id"', "CLI arguments");
includes(contract, "product-review-import-confirm-v1", "confirm contract");
includes(identity, "normalizePromotionBrand", "promotion identity");
includes(verifier, "deterministic hash", "confirm verifier");
[
  "review_import_capability_required",
  "review_import_stale_candidate",
  "review_import_request_id_conflict",
  "review_import_batch_already_confirmed",
  "admin_audit_logs",
].forEach((value) => includes(runtimeVerifier, value, "runtime verifier"));

assert(
  crawlerPackage.scripts?.["verify:product-review-intake-confirm"] ===
    "tsx test-product-review-intake-confirm.ts",
  "confirm verifier package command must be registered",
);
assert(
  crawlerPackage.scripts?.[
    "verify:product-review-intake-confirm:local-runtime"
  ] === "tsx tests/verify-reviewed-intake-confirm-local-runtime.ts",
  "confirm runtime verifier package command must be registered",
);

console.log(
  JSON.stringify(
    {
      status: "passed",
      checkedFiles: [...new Set(checkedFiles)].sort(),
    },
    null,
    2,
  ),
);
