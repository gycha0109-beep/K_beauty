import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const evidencePath = path.join(
  root,
  "evidence/recommendation-metadata-shadow/cleanser-policy-comparison-v1.json"
);
const original = await readFile(evidencePath, "utf8");
const manifest = JSON.parse(original);

assert.equal(manifest.artifactSchemaVersion, "cleanser-policy-comparison-artifact-v1");
assert.equal(manifest.encoding, "brotli+base64-chunks");
assert(Array.isArray(manifest.payloadChunks));
assert.equal(manifest.payloadChunks.length, 5);

const chunks = [];
for (const chunk of manifest.payloadChunks) {
  assert.match(chunk.path, /^evidence\/recommendation-metadata-shadow\/cleanser-policy-comparison-v1\.payload-\d{2}\.b64$/);
  const content = await readFile(path.join(root, chunk.path), "utf8");
  assert.equal(content.length, chunk.length);
  assert.equal(createHash("sha256").update(content).digest("hex"), chunk.sha256);
  chunks.push(content);
}

const encoded = chunks.join("");
assert.equal(encoded.length, manifest.payloadEncodedLength);
assert.equal(
  createHash("sha256").update(encoded).digest("hex"),
  manifest.payloadEncodedSha256
);

const compatibilityArtifact = {
  ...manifest,
  encoding: "brotli+base64",
  payloadBrotliBase64: encoded
};

try {
  await writeFile(evidencePath, JSON.stringify(compatibilityArtifact));
  await import("./verify-cleanser-structured-authority-policy-review-core.mjs");
} finally {
  await writeFile(evidencePath, original);
}
