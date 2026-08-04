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

const multipartSource = await read(
  "lib/admin/product-review-import/multipart-boundary.js",
);
const handlersSource = await read(
  "lib/admin/product-review-import/http-handlers.js",
);
const errorSource = await read(
  "lib/admin/product-review-import/import-error-map.js",
);
const packageSource = await read(
  "lib/admin/product-review-import/import-package.js",
);
const dryRunRoute = await read(
  "app/api/admin/product-reviews/import/dry-run/route.js",
);
const confirmRoute = await read(
  "app/api/admin/product-reviews/import/confirm/route.js",
);

const multipart = await import(
  `data:text/javascript;base64,${Buffer.from(multipartSource).toString("base64")}`
);

function part(boundary, name, bytes, filename = null) {
  const disposition = filename
    ? `Content-Disposition: form-data; name="${name}"; filename="${filename}"`
    : `Content-Disposition: form-data; name="${name}"`;
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\n${disposition}\r\n\r\n`, "utf8"),
    Buffer.from(bytes),
    Buffer.from("\r\n", "utf8"),
  ]);
}

function body(boundary, entries) {
  return Buffer.concat([
    ...entries.map((entry) => part(boundary, ...entry)),
    Buffer.from(`--${boundary}--`, "utf8"),
  ]);
}

function requestFor(bytes, boundary, contentLength = bytes.byteLength) {
  return new Request("https://bejewely.example/api/admin/product-reviews/import", {
    method: "POST",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "content-length": String(contentLength),
    },
    body: bytes,
    duplex: "half",
  });
}

async function expectCode(run, code) {
  await assert.rejects(
    run,
    (error) =>
      error instanceof multipart.ProductReviewMultipartError &&
      error.code === code,
  );
}

const boundary = "bejewely-import-boundary";
const fileEntries = [
  ["batch", Buffer.from("{}"), "anything.json"],
  ["manifest", Buffer.from("manifest"), "anything.csv"],
  ["evidence", Buffer.from("evidence"), "anything.jsonl"],
  ["reviewed", Buffer.from("reviewed"), "anything.csv"],
];

const valid = await multipart.parseProductReviewImportRequest(
  requestFor(body(boundary, fileEntries), boundary),
);
assert.deepEqual(Object.keys(valid.files).sort(), [
  "batch",
  "evidence",
  "manifest",
  "reviewed",
]);

await expectCode(
  () =>
    multipart.parseProductReviewImportRequest(
      requestFor(
        body(boundary, [...fileEntries, fileEntries[0]]),
        boundary,
      ),
    ),
  "duplicate_file",
);
await expectCode(
  () =>
    multipart.parseProductReviewImportRequest(
      requestFor(
        body(boundary, [
          ...fileEntries,
          ["actorUserId", Buffer.from("spoof"), "actor.txt"],
        ]),
        boundary,
      ),
    ),
  "unexpected_file",
);
await expectCode(
  () =>
    multipart.parseProductReviewImportRequest(
      requestFor(
        body(boundary, [
          ...fileEntries,
          ["actorUserId", Buffer.from("spoof")],
        ]),
        boundary,
      ),
      {
        allowedTextFields: [
          "requestId",
          "expectedReviewedFileSha256",
          "expectedCanonicalPayloadSha256",
          "confirmation",
        ],
      },
    ),
  "unexpected_file",
);
await expectCode(
  () =>
    multipart.parseProductReviewImportRequest(
      requestFor(body(boundary, fileEntries.slice(0, 3)), boundary),
    ),
  "missing_file",
);
await expectCode(
  () =>
    multipart.parseProductReviewImportRequest(
      requestFor(
        body(boundary, [
          ...fileEntries,
          ["requestId", Uint8Array.from([0xff])],
        ]),
        boundary,
      ),
      { allowedTextFields: ["requestId"] },
    ),
  "invalid_utf8",
);
await expectCode(
  () =>
    multipart.parseProductReviewImportRequest(
      requestFor(
        body(boundary, [
          ...fileEntries,
          ["requestId", Buffer.from([0x61, 0x00, 0x62])],
        ]),
        boundary,
      ),
      { allowedTextFields: ["requestId"] },
    ),
  "invalid_content_type",
);

const oversizedEvidence = Buffer.alloc(
  multipart.PRODUCT_REVIEW_IMPORT_FILE_LIMITS.evidence + 1,
  0x61,
);
const oversizedBody = body(boundary, [
  fileEntries[0],
  fileEntries[1],
  ["evidence", oversizedEvidence, "evidence.jsonl"],
  fileEntries[3],
]);
await expectCode(
  () =>
    multipart.parseProductReviewImportRequest(
      requestFor(oversizedBody, boundary, 1),
    ),
  "request_too_large",
);

const oversizedRequest = Buffer.alloc(
  multipart.PRODUCT_REVIEW_IMPORT_MAX_REQUEST_BYTES + 1,
  0x61,
);
await expectCode(
  () =>
    multipart.parseProductReviewImportRequest(
      requestFor(oversizedRequest, boundary, 1),
    ),
  "request_too_large",
);

[
  "evaluateOrigin(",
  "evaluateAccess(",
  "randomUUID()",
  "requestId",
  "retryable",
  "access.userId",
  "allowedTextFields: []",
  "expectedCanonicalPayloadSha256",
  "PRODUCT_REVIEW_IMPORT_NO_STORE_HEADERS",
].forEach((value) => includes(handlersSource, value, "HTTP handlers"));
assert.ok(
  handlersSource.indexOf("evaluateOrigin(") <
    handlersSource.indexOf("evaluateAccess("),
  "same-origin evaluation must precede access evaluation",
);

[
  "PUBLIC_CODES",
  "RETRYABLE_CODES",
  "SAFE_STATUSES",
  "415",
  "payload_hash_mismatch",
  "request_conflict",
].forEach((value) => includes(errorSource, value, "error map"));

includes(packageSource, "parseReviewedBatchFiles", "package parser");
for (const [source, label] of [
  [dryRunRoute, "dry-run route"],
  [confirmRoute, "confirm route"],
]) {
  includes(source, 'export const runtime = "nodejs"', label);
  includes(source, 'export const dynamic = "force-dynamic"', label);
  includes(source, "requireAdminCapability", label);
  includes(source, "isAllowedAdminMutationRequest", label);
}

process.stdout.write(
  "verify:admin-product-review-import-routes PASS (exact multipart, actual bytes, UTF-8/NUL, origin, capability, actor binding, no-store)\n",
);
