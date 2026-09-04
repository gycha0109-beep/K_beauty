import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  computeNeutralFaceCountAuthorityDigest,
  getNeutralFaceCountPublicModel,
  validateNeutralFaceCountAuthority
} from "../lib/face-lab-neutral-face-count-contract.mjs";

const root = process.cwd();
const authorityPath = path.join(
  root,
  "evidence/facelab/face-count-neutral-review-authority-20260905-v2.json"
);
const manifestPath = path.join(
  root,
  "evidence/facelab/face-count-neutral-source-composition-20260905-v2.json"
);
const curationPath = path.join(
  root,
  "evidence/facelab/face-count-neutral-curation-validation-20260905-v2.json"
);

const rawAuthority = await readFile(authorityPath, "utf8");
const rawManifest = await readFile(manifestPath, "utf8");
const rawCuration = await readFile(curationPath, "utf8");
const authority = JSON.parse(rawAuthority);
const manifest = JSON.parse(rawManifest);
const curation = JSON.parse(rawCuration);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

assert.equal(authority.schemaVersion, "face-count-neutral-review-authority-v2");
assert.equal(authority.authorityVersion, "2.0.0");
assert.equal(authority.campaignKey, "face_count_neutral_shared_review_v2");
assert.equal(authority.intakeVersion, "face-count-neutral-intake-v2");
assert.equal(
  authority.reviewerUi.instruction,
  "눈, 코, 입 등 얼굴의 정확한 특징을 판별할 수 있을 정도로 보이는 사람은 몇 명인가요?"
);
assert.deepEqual(authority.responseTokens, [
  "none",
  "one",
  "two_or_more",
  "not_assessable"
]);
assert.equal(authority.orderedItems.length, 8);
assert.equal(sha256(rawManifest), authority.sourceAcquisitionManifestSha256);
assert.equal(computeNeutralFaceCountAuthorityDigest(authority), authority.authorityDigest);
assert.deepEqual(validateNeutralFaceCountAuthority(authority), { ok: true, errors: [] });

const publicModel = getNeutralFaceCountPublicModel(authority);
assert.equal(publicModel.items.length, 8);
for (const item of publicModel.items) {
  assert.match(
    item.assetPath,
    /^\/api\/facelab\/review\/neutral\/visual\/fcneutralv2_[0-9]{2}$/
  );
  assert.equal("expectedClass" in item, false);
  assert.equal("presentation" in item, false);
}

for (const forbidden of [
  "expectedClass",
  "requiredDistribution",
  "maxSingleBucket",
  "rationale"
]) {
  assert.equal(rawAuthority.includes(forbidden), false);
  assert.equal(JSON.stringify(publicModel).includes(forbidden), false);
}

assert.equal(curation.schemaVersion, "face-count-neutral-curation-validation-v2");
assert.equal(curation.authorityRef, authority.authorityRef);
assert.deepEqual(curation.requiredDistribution, {
  none: 2,
  one: 3,
  two_or_more: 3
});
assert.equal(curation.maxSingleBucket, 3);
assert.equal(curation.items.length, 8);
assert.deepEqual(
  curation.items.map((item) => item.reviewItemId),
  authority.orderedItems.map((item) => item.reviewItemId)
);

const distribution = { none: 0, one: 0, two_or_more: 0 };
for (const item of curation.items) {
  assert.ok(Object.hasOwn(distribution, item.expectedClass));
  distribution[item.expectedClass] += 1;
  assert.ok(typeof item.rationale === "string" && item.rationale.length >= 10);
}
assert.deepEqual(distribution, curation.requiredDistribution);
assert.ok(Math.max(...Object.values(distribution)) <= curation.maxSingleBucket);
assert.ok(Object.values(distribution).every((count) => count > 0));

assert.equal(manifest.schemaVersion, "face-count-neutral-source-composition-v2");
assert.equal(manifest.assetMutability, "referenced_governed_source_bytes_immutable");
assert.equal(manifest.items.length, 8);
assert.deepEqual(
  manifest.items.map((item) => item.reviewItemId),
  authority.orderedItems.map((item) => item.reviewItemId)
);

const sourcePaths = new Set();
for (let index = 0; index < manifest.items.length; index += 1) {
  const manifestItem = manifest.items[index];
  const authorityItem = authority.orderedItems[index];
  assert.equal(manifestItem.presentation.mode, authorityItem.presentation.mode);
  assert.deepEqual(
    manifestItem.presentation.sources.map((source) => source.assetPath),
    authorityItem.presentation.assetPaths
  );
  if (authorityItem.presentation.mode === "obscured_single") {
    assert.equal(manifestItem.presentation.blurPx, authorityItem.presentation.blurPx);
    assert.ok(authorityItem.presentation.blurPx >= 20);
  }
  if (authorityItem.presentation.mode === "composite") {
    assert.ok(authorityItem.presentation.assetPaths.length >= 2);
  }

  for (const source of manifestItem.presentation.sources) {
    assert.equal(sourcePaths.has(source.assetPath), false, `source reused across items: ${source.assetPath}`);
    sourcePaths.add(source.assetPath);
    const absolute = path.join(root, "public", source.assetPath.slice(1));
    const bytes = await readFile(absolute);
    assert.equal(sha256(bytes), source.assetSha256, source.assetPath);
    if (Number.isInteger(source.byteLength)) {
      assert.equal(bytes.length, source.byteLength, source.assetPath);
    }
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, source.width, source.assetPath);
    assert.equal(metadata.height, source.height, source.assetPath);
    assert.equal(
      source.mediaType,
      metadata.format === "jpeg" ? "image/jpeg" : `image/${metadata.format}`,
      source.assetPath
    );
  }
}
assert.ok(sourcePaths.size >= 11);

const curationById = new Map(
  curation.items.map((item) => [item.reviewItemId, item.expectedClass])
);
for (const item of authority.orderedItems) {
  const expected = curationById.get(item.reviewItemId);
  if (expected === "one") {
    assert.equal(item.presentation.mode, "single");
    assert.equal(item.presentation.assetPaths.length, 1);
  }
  if (expected === "two_or_more" && item.reviewItemId !== "fcneutralv2_06") {
    assert.equal(item.presentation.mode, "composite");
    assert.ok(item.presentation.assetPaths.length >= 2);
  }
}
assert.equal(curationById.get("fcneutralv2_01"), "none");
assert.equal(curationById.get("fcneutralv2_02"), "none");
assert.equal(authority.orderedItems[1].presentation.mode, "obscured_single");
assert.equal(curationById.get("fcneutralv2_06"), "two_or_more");
assert.equal(
  authority.orderedItems[5].presentation.assetPaths[0],
  "/facelab/neutral-review/v1/assets/fcneutral_03.jpg"
);

assert.equal(
  rawCuration.includes("not_assessable\""),
  false,
  "not_assessable must remain a reviewer fallback, not a curated expected answer bucket"
);

console.log(
  JSON.stringify({
    status: "FACE_COUNT_NEUTRAL_STAGE_V2_PASS",
    itemCount: authority.orderedItems.length,
    distribution,
    sourceCount: sourcePaths.size,
    authorityDigest: authority.authorityDigest,
    sourceManifestSha256: authority.sourceAcquisitionManifestSha256,
    expectedAnswerLeakage: false
  })
);
