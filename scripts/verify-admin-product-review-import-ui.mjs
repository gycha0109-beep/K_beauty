import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

async function read(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

function includes(text, value, label) {
  assert.ok(text.includes(value), `${label} missing: ${value}`);
}

const stateSource = await read(
  "app/admin/products/reviews/import/workbench-state.js",
);
const workbenchSource = await read(
  "app/admin/products/reviews/import/ProductReviewImportWorkbench.js",
);
const pageSource = await read("app/admin/products/reviews/import/page.js");
const navigationSource = await read("app/admin/AdminNavigation.js");

const stateModule = await import(
  `data:text/javascript;base64,${Buffer.from(stateSource).toString("base64")}`
);

const fakeFile = (name) => ({
  name,
  size: 10,
  arrayBuffer: async () => new ArrayBuffer(0),
});
const files = {
  batch: fakeFile("arbitrary-name.json"),
  manifest: fakeFile("arbitrary-name.csv"),
  evidence: fakeFile("arbitrary-name.jsonl"),
  reviewed: fakeFile("arbitrary-name.csv"),
};

assert.equal(stateModule.hasAllProductReviewImportFiles(files), true);
assert.equal(
  stateModule.canConfirmProductReviewImport(
    {
      ...stateModule.INITIAL_PRODUCT_REVIEW_IMPORT_STATE,
      status: stateModule.PRODUCT_REVIEW_IMPORT_STATES.DRY_RUN_READY,
      dryRun: { status: "ready" },
      requestId: "request-id",
      reviewedFileSha256: "reviewed-hash",
      canonicalPayloadSha256: "payload-hash",
    },
    "CONFIRM_PRODUCT_REVIEW_IMPORT",
  ),
  true,
);
assert.equal(
  stateModule.canConfirmProductReviewImport(
    {
      ...stateModule.INITIAL_PRODUCT_REVIEW_IMPORT_STATE,
      status: stateModule.PRODUCT_REVIEW_IMPORT_STATES.FAILED,
      dryRun: { status: "ready" },
      requestId: "request-id",
      reviewedFileSha256: "reviewed-hash",
      canonicalPayloadSha256: "payload-hash",
      error: { retryable: false },
    },
    "CONFIRM_PRODUCT_REVIEW_IMPORT",
  ),
  false,
);
assert.equal(
  stateModule.canConfirmProductReviewImport(
    {
      ...stateModule.INITIAL_PRODUCT_REVIEW_IMPORT_STATE,
      status: stateModule.PRODUCT_REVIEW_IMPORT_STATES.FAILED,
      dryRun: { status: "ready" },
      requestId: "request-id",
      reviewedFileSha256: "reviewed-hash",
      canonicalPayloadSha256: "payload-hash",
      error: { retryable: true },
    },
    "CONFIRM_PRODUCT_REVIEW_IMPORT",
  ),
  true,
);

const completed = stateModule.productReviewImportReducer(
  {
    ...stateModule.INITIAL_PRODUCT_REVIEW_IMPORT_STATE,
    status: stateModule.PRODUCT_REVIEW_IMPORT_STATES.DRY_RUN_READY,
    dryRun: { status: "ready", summary: { total: 4 } },
    requestId: "request-id",
  },
  {
    type: "confirm_completed",
    payload: {
      status: "confirmed",
      requestId: "request-id",
      summary: { total: 4, create: 1 },
    },
  },
);
assert.deepEqual(completed.result.summary, { total: 4, create: 1 });
assert.equal(completed.dryRun.summary.total, 4);

const reset = stateModule.productReviewImportReducer(completed, {
  type: "reset",
});
assert.equal(reset.status, stateModule.PRODUCT_REVIEW_IMPORT_STATES.IDLE);
assert.equal(reset.dryRun, null);
assert.equal(reset.result, null);
assert.equal(reset.requestId, null);

[
  "batch.json",
  "manifest.csv",
  "evidence.jsonl",
  "reviewed.csv",
  "/api/admin/product-reviews/import/dry-run",
  "/api/admin/product-reviews/import/confirm",
  "state.result?.summary || state.dryRun?.summary",
  "state.error?.retryable",
  "request ID:",
  "Reset",
  "inFlight.current",
].forEach((value) => includes(workbenchSource, value, "workbench"));

includes(pageSource, "ADMIN_CAPABILITIES.PRODUCTS_REVIEW", "page capability");
includes(pageSource, "redirect(\"/admin\")", "page denial");
includes(navigationSource, "/admin/products/reviews/import", "admin navigation");

process.stdout.write(
  "verify:admin-product-review-import-ui PASS (files, reset, retry, summary precedence, Boolean confirm, capability)\n",
);
