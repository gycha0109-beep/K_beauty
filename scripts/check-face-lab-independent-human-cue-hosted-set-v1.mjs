import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL,
  stableStringifyHostedHumanCueValue
} from "@bejewely/face-contracts";
import {
  HOSTED_SET_AUTHORITY_VERSION,
  HOSTED_SET_SCHEMA_VERSION,
  HOSTED_SET_SOURCE_MAIN_SHA
} from "./build-face-lab-independent-human-cue-hosted-set-v1.mjs";

const root = process.cwd();
const authorityPath = path.join(
  root,
  "evidence",
  "facelab",
  "face-lab-independent-human-cue-single-hosted-set-20260815-v1.json"
);
const authority = JSON.parse(readFileSync(authorityPath, "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const { authorityDigest, ...semanticAuthority } = authority;
assert.equal(authority.schemaVersion, HOSTED_SET_SCHEMA_VERSION);
assert.equal(authority.authorityVersion, HOSTED_SET_AUTHORITY_VERSION);
assert.equal(authority.sourceMainSha, HOSTED_SET_SOURCE_MAIN_SHA);
assert.equal(
  authorityDigest,
  sha256(stableStringifyHostedHumanCueValue(semanticAuthority))
);
assert.equal(
  authority.sourceAuthorities.d2cFDefinitionContractDigest,
  "8e630605ece0629da6a51e30829297688c27f10a3a92be6a3c8e3413f546bb46"
);
assert.equal(
  authority.sourceAuthorities.d2dPPacketAuthorityDigest,
  "1f344a9d1cbd8e8ac6076b06da7780d213ff6ff71df80ea7a9f818617965339c"
);
assert.equal(
  authority.sourceAuthorities.d2dUi1DistributionAuthorityDigest,
  "23636cf323ac944ae0c283e75e3161ebfaceedee2838bc672789488bcf772a32"
);
assert.equal(authority.distributionMode, "single_hosted_set");
assert.equal(authority.imageCount, 14);
assert.equal(authority.orderedItems.length, 14);
assert.equal(new Set(authority.orderedItems.map((item) => item.reviewItemId)).size, 14);
assert.equal(authority.primaryAxes.length, 8);
assert.equal(authority.validationAxes.length, 2);
assert.deepEqual(
  authority.primaryAxes.map((axis) => axis.axisPath),
  FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL.primaryAxes
);
assert.deepEqual(
  authority.validationAxes.map((axis) => axis.axisPath),
  FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL.validationOnlyAxes
);
assert.deepEqual(authority.excludedAxes, [
  "observations.visualLanguage.featureContrast"
]);

const expectedOrder = [...authority.orderedItems]
  .sort((left, right) => left.orderKey.localeCompare(right.orderKey))
  .map((item) => item.reviewItemId);
assert.deepEqual(
  authority.orderedItems.map((item) => item.reviewItemId),
  expectedOrder
);

for (const item of authority.orderedItems) {
  assert.match(item.reviewItemId, /^hci_[0-9a-f]{24}$/);
  assert.match(item.assetName, /^asset_[0-9a-f]{24}\.png$/);
  assert.equal(
    item.assetPath,
    `/facelab/hosted-review/v1/assets/${item.assetName}`
  );
  const asset = readFileSync(
    path.join(root, "public", "facelab", "hosted-review", "v1", "assets", item.assetName)
  );
  assert.equal(sha256(asset), item.assetSha256);
}

assert.deepEqual(authority.blindness, {
  reviewerSlotUsed: false,
  targetMetadataExposed: false,
  archetypeMetadataExposed: false,
  visionMetadataExposed: false,
  scorerMetadataExposed: false,
  neutralAssetNames: true,
  reviewerSafeProjectionConfirmed: true
});
assert.deepEqual(authority.executionCounters, {
  providerCalls: 0,
  observationCalls: 0,
  generationCalls: 0,
  humanJudgments: 0,
  consensus: 0
});
assert.equal(authority.productionConsumption, false);
assert.equal(authority.w2Status, "W2_REMAINS_LOCKED");

const reviewerProjection = JSON.stringify({
  items: authority.orderedItems.map(({ reviewItemId, assetPath }) => ({
    reviewItemId,
    assetPath
  })),
  axes: [...authority.primaryAxes, ...authority.validationAxes],
  ui: authority.ui
});
assert.doesNotMatch(
  reviewerProjection,
  /\b(?:wolf|cat|puppy|deer|tofu|potato|dino|W1M?|subtle|sourceCohort|candidateId|privateMap|scorerOutput|visionObservation)\b/i
);

console.log(
  JSON.stringify(
    {
      status: "PASS",
      authorityVersion: authority.authorityVersion,
      authorityDigest,
      imageCount: 14,
      primaryAxes: 8,
      validationAxes: 2,
      featureContrast: "excluded",
      reviewerSlots: 0,
      blindSafeProjection: true,
      assetShaChecks: 14,
      humanJudgments: 0,
      providerCalls: 0,
      w2Status: authority.w2Status
    },
    null,
    2
  )
);
