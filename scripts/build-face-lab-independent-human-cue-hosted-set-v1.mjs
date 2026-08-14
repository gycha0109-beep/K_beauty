import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  HOSTED_HUMAN_CUE_DISTRIBUTION_MODE,
  HOSTED_HUMAN_CUE_UI_VERSION,
  stableStringifyHostedHumanCueValue
} from "../packages/face-contracts/src/archetype-human-evaluation/hosted-independent-human-cue-intake.js";
import {
  ATTESTATION_COPY,
  KOREAN_AXIS_CONTENT,
  KOREAN_REASON_MAP,
  KOREAN_TOKEN_MAP
} from "./build-face-lab-independent-human-cue-review-ui-ko-v1.mjs";

export const HOSTED_SET_SCHEMA_VERSION =
  "face-lab-independent-human-cue-single-hosted-set-authority-v1";
export const HOSTED_SET_AUTHORITY_VERSION =
  "face-lab-independent-human-cue-single-hosted-set-20260815-v1";
export const HOSTED_SET_SOURCE_MAIN_SHA =
  "6f573b632824be13dfe208f29c796aa3306b4984";

const EXPECTED_DEFINITION_DIGEST =
  "8e630605ece0629da6a51e30829297688c27f10a3a92be6a3c8e3413f546bb46";
const EXPECTED_D2DP_AUTHORITY_DIGEST =
  "1f344a9d1cbd8e8ac6076b06da7780d213ff6ff71df80ea7a9f818617965339c";
const EXPECTED_D2DUI1_AUTHORITY_DIGEST =
  "23636cf323ac944ae0c283e75e3161ebfaceedee2838bc672789488bcf772a32";

const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");
const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const parseArgs = (argv = process.argv.slice(2)) => {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    assert.match(key || "", /^--[a-z-]+$/);
    assert.ok(argv[index + 1], `missing value for ${key}`);
    result[key.slice(2)] = argv[index + 1];
  }
  return result;
};

const hostedOrderKey = (reviewItemId) =>
  sha256(`${HOSTED_SET_AUTHORITY_VERSION}\0${reviewItemId}`);

function reviewerSafeAxis(sourceAxis) {
  const content = KOREAN_AXIS_CONTENT[sourceAxis.axisPath];
  assert.ok(content, `Korean content missing:${sourceAxis.axisPath}`);
  assert.deepEqual(
    Object.keys(content.valueDefinitions),
    sourceAxis.enumOptions,
    `Korean enum mismatch:${sourceAxis.axisPath}`
  );
  return {
    axisPath: sourceAxis.axisPath,
    enumOptions: sourceAxis.enumOptions,
    content
  };
}

export function buildHostedSet({
  sourceRoot,
  distributionRoot,
  authorityOutput,
  assetOutput
}) {
  sourceRoot = path.resolve(sourceRoot);
  distributionRoot = path.resolve(distributionRoot);
  authorityOutput = path.resolve(authorityOutput);
  assetOutput = path.resolve(assetOutput);

  assert.equal(existsSync(authorityOutput), false, "authority output already exists");
  assert.equal(existsSync(assetOutput), false, "asset output already exists");

  const packetAuthority = readJson(
    path.join(sourceRoot, "private", "packet-authority-v1.json")
  );
  const assetInventory = readJson(
    path.join(sourceRoot, "private", "review-asset-inventory-v1.json")
  );
  const uiAuthority = readJson(
    path.join(distributionRoot, "private", "ui-distribution-authority-v1.json")
  );
  const primaryDefinitions = readJson(
    path.join(
      sourceRoot,
      "packets",
      "reviewer-r01",
      "part-a",
      "reviewer-safe-definitions.json"
    )
  );
  const validationDefinitions = readJson(
    path.join(
      sourceRoot,
      "packets",
      "reviewer-r01",
      "part-b",
      "reviewer-safe-definitions.json"
    )
  );

  assert.equal(packetAuthority.authorityDigest, EXPECTED_D2DP_AUTHORITY_DIGEST);
  assert.equal(
    packetAuthority.definitionContractDigest,
    EXPECTED_DEFINITION_DIGEST
  );
  assert.equal(assetInventory.inventoryDigest, packetAuthority.reviewAssetInventoryDigest);
  assert.equal(uiAuthority.authorityDigest, EXPECTED_D2DUI1_AUTHORITY_DIGEST);
  assert.equal(packetAuthority.humanJudgments, 0);
  assert.equal(uiAuthority.humanJudgments, 0);
  assert.equal(assetInventory.entries.length, 14);
  assert.equal(primaryDefinitions.axes.length, 8);
  assert.equal(validationDefinitions.axes.length, 2);

  const orderedEntries = [...assetInventory.entries].sort((left, right) =>
    hostedOrderKey(left.reviewItemId).localeCompare(hostedOrderKey(right.reviewItemId))
  );
  const orderedItems = orderedEntries.map((entry, index) => ({
    ordinal: index + 1,
    reviewItemId: entry.reviewItemId,
    assetPath: `/facelab/hosted-review/v1/assets/${entry.assetName}`,
    assetName: entry.assetName,
    assetSha256: entry.reviewAssetSha256,
    pixelDigest: entry.pixelDigest,
    width: entry.width,
    height: entry.height,
    orderKey: hostedOrderKey(entry.reviewItemId)
  }));

  const authorityWithoutDigest = {
    schemaVersion: HOSTED_SET_SCHEMA_VERSION,
    authorityVersion: HOSTED_SET_AUTHORITY_VERSION,
    sourceMainSha: HOSTED_SET_SOURCE_MAIN_SHA,
    distributionMode: HOSTED_HUMAN_CUE_DISTRIBUTION_MODE,
    orderAlgorithm:
      "lexicographic_sha256(authorityVersion + NUL + opaqueReviewItemId)",
    sourceAuthorities: {
      d2cFDefinitionContractDigest: EXPECTED_DEFINITION_DIGEST,
      d2dPPacketAuthorityDigest: EXPECTED_D2DP_AUTHORITY_DIGEST,
      d2dUi1DistributionAuthorityDigest: EXPECTED_D2DUI1_AUTHORITY_DIGEST
    },
    imageCount: 14,
    orderedItems,
    primaryAxes: primaryDefinitions.axes.map(reviewerSafeAxis),
    validationAxes: validationDefinitions.axes.map(reviewerSafeAxis),
    excludedAxes: ["observations.visualLanguage.featureContrast"],
    ui: {
      uiVersion: HOSTED_HUMAN_CUE_UI_VERSION,
      language: "ko",
      estimatedMinutes: 5,
      tokenLabels: KOREAN_TOKEN_MAP,
      reasonLabels: KOREAN_REASON_MAP,
      attestationCopy: ATTESTATION_COPY
    },
    blindness: {
      reviewerSlotUsed: false,
      targetMetadataExposed: false,
      archetypeMetadataExposed: false,
      visionMetadataExposed: false,
      scorerMetadataExposed: false,
      neutralAssetNames: true,
      reviewerSafeProjectionConfirmed: true
    },
    executionCounters: {
      providerCalls: 0,
      observationCalls: 0,
      generationCalls: 0,
      humanJudgments: 0,
      consensus: 0
    },
    productionConsumption: false,
    w2Status: "W2_REMAINS_LOCKED"
  };
  const authority = {
    ...authorityWithoutDigest,
    authorityDigest: sha256(
      stableStringifyHostedHumanCueValue(authorityWithoutDigest)
    )
  };

  const tempAuthority = `${authorityOutput}.tmp-${process.pid}`;
  const tempAssets = `${assetOutput}.tmp-${process.pid}`;
  try {
    mkdirSync(path.dirname(authorityOutput), { recursive: true });
    mkdirSync(tempAssets, { recursive: true });
    for (const item of orderedItems) {
      const sourceAsset = path.join(
        sourceRoot,
        "packets",
        "reviewer-r01",
        "assets",
        item.assetName
      );
      const destinationAsset = path.join(tempAssets, item.assetName);
      const bytes = readFileSync(sourceAsset);
      assert.equal(sha256(bytes), item.assetSha256, `asset digest mismatch:${item.assetName}`);
      copyFileSync(sourceAsset, destinationAsset);
      assert.equal(
        sha256(readFileSync(destinationAsset)),
        item.assetSha256,
        `asset copy mismatch:${item.assetName}`
      );
    }
    writeFileSync(tempAuthority, `${JSON.stringify(authority, null, 2)}\n`, "utf8");
    renameSync(tempAssets, assetOutput);
    renameSync(tempAuthority, authorityOutput);
    return {
      status: "PASS",
      authorityDigest: authority.authorityDigest,
      imageCount: orderedItems.length,
      primaryAxes: authority.primaryAxes.length,
      validationAxes: authority.validationAxes.length,
      reviewerSlots: 0,
      humanJudgments: 0,
      sourceMutationCount: 0,
      w2Status: authority.w2Status
    };
  } catch (error) {
    if (existsSync(tempAuthority)) rmSync(tempAuthority, { force: true });
    if (existsSync(tempAssets)) rmSync(tempAssets, { recursive: true, force: true });
    throw error;
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs();
  for (const required of [
    "source-root",
    "distribution-root",
    "authority-output",
    "asset-output"
  ]) {
    assert.ok(args[required], `--${required} is required`);
  }
  console.log(
    JSON.stringify(
      buildHostedSet({
        sourceRoot: args["source-root"],
        distributionRoot: args["distribution-root"],
        authorityOutput: args["authority-output"],
        assetOutput: args["asset-output"]
      }),
      null,
      2
    )
  );
}
