import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as faceContractsRoot from "../packages/face-contracts/src/index.js";
import {
  FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL,
  FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT,
  INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION,
  INDEPENDENT_HUMAN_CUE_REVIEW_SCHEMA_VERSION,
  canonicalizeIndependentHumanCueAuditProtocol,
  projectIndependentHumanCueDefinitions,
  validateBlankIndependentHumanCueReviewTemplate,
  validateIndependentHumanCueAuditProtocol,
  validateIndependentHumanCueJudgment
} from "../packages/face-contracts/src/archetype-human-evaluation/index.js";

const FREEZE_PATH = "evidence/facelab/archetype-stress-independent-human-cue-audit-protocol-freeze-v1.json";
const EXPECTED = {
  mainSha: "5fa0c661672502b9e49f2222e4eeb19bdc82ce15",
  definitionContractDigest: "8e630605ece0629da6a51e30829297688c27f10a3a92be6a3c8e3413f546bb46",
  definitionFreezeDigest: "cb7d3a0d60ce398dc9c76ee1aa4ff88ee94b0e001fa378f173367712ea279029",
  reviewerSafeDefinitionProjectionDigest: "4adbae197f32402a7e063666e3031cd558be7770952e41fa49d29aeaedd798f3",
  protocolDigest: "a32dd94dfbd8e090363ae0d662d51174eeab05796ccad5a8b2ad4c303d886b77",
  localPacketAuthorityDigest: "1f344a9d1cbd8e8ac6076b06da7780d213ff6ff71df80ea7a9f818617965339c",
  freezeDigest: "2ef4f572002cf8050d73c204d7e28b649dc3bb8b6b1a179f1be560fb04f5c228"
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sortKeys = (value) => Array.isArray(value)
  ? value.map(sortKeys)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
    : value;
const stableStringify = (value) => JSON.stringify(sortKeys(value));
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const digestWithout = (value, key) => {
  const copy = structuredClone(value);
  delete copy[key];
  return sha256(stableStringify(copy));
};
const parseArgs = () => {
  const values = {};
  for (let index = 2; index < process.argv.length; index += 2) {
    assert.match(process.argv[index] || "", /^--[a-z-]+$/);
    assert.ok(process.argv[index + 1]);
    values[process.argv[index].slice(2)] = process.argv[index + 1];
  }
  return values;
};
const pixelDigest = async (bytes) => {
  const { data, info } = await sharp(bytes, { failOn: "error" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return sha256(Buffer.concat([Buffer.from(`${info.width}x${info.height}x${info.channels}\0`), data]));
};
const packetDigestFor = (manifest) => sha256(stableStringify({
  protocolVersion: manifest.protocolVersion,
  reviewerSlot: manifest.reviewerSlot,
  part: manifest.part,
  orderedReviewItems: manifest.orderedReviewItems,
  definitionProjectionDigest: manifest.definitionProjectionDigest,
  responseSchemaVersion: INDEPENDENT_HUMAN_CUE_REVIEW_SCHEMA_VERSION
}));

const protocol = FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL;
const definition = FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT;
const freeze = readJson(FREEZE_PATH);
assert.deepEqual(validateIndependentHumanCueAuditProtocol(protocol), { ok: true, errors: [] });
assert.equal(faceContractsRoot.FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL, protocol, "root export missing");
assert.equal(sha256(canonicalizeIndependentHumanCueAuditProtocol(protocol)), protocol.protocolDigest);
assert.equal(protocol.protocolDigest, EXPECTED.protocolDigest);
assert.equal(protocol.definitionContractDigest, EXPECTED.definitionContractDigest);
assert.equal(protocol.productionConsumption, false);
assert.equal(protocol.w2Status, "locked");
assert.equal(Object.values(protocol.executionCounters).every((count) => count === 0), true);

const ready = definition.axes.filter((axis) => axis.validationStatus === "READY_FOR_BLIND_HUMAN_CUE_AUDIT").map((axis) => axis.axisPath);
const validation = definition.axes.filter((axis) => axis.validationStatus === "NOT_READY_REQUIRES_VALIDATION").map((axis) => axis.axisPath);
const excluded = definition.axes.filter((axis) => axis.validationStatus === "NOT_READY_REQUIRES_DECOMPOSITION").map((axis) => axis.axisPath);
assert.deepEqual(protocol.primaryAxes, ready);
assert.deepEqual(protocol.validationOnlyAxes, validation);
assert.deepEqual(protocol.excludedDirectAxes, excluded);
assert.deepEqual([ready.length, validation.length, excluded.length], [8, 2, 1]);
assert.equal(protocol.excludedDirectAxisRelation, "NOT_COMPARABLE_CONTRACT_DECOMPOSITION");

const forbiddenProjectionKeys = [
  "validationStatus", "disposition", "generationTokenParity", "generationOperationalParity",
  "rubricDependency", "historicalObserverDefinitionVersion", "productionConsumption",
  "candidateId", "Vision", "scorer", "targetArchetype", "intendedCue"
];
const forbiddenTargets = /\b(?:wolf|cat|puppy|deer|tofu|potato|dino)\b/i;
for (const part of ["A", "B"]) {
  const projectionA = projectIndependentHumanCueDefinitions(part);
  const projectionB = projectIndependentHumanCueDefinitions(part);
  assert.equal(stableStringify(projectionA), stableStringify(projectionB));
  assert.equal(projectionA.axes.length, part === "A" ? 8 : 2);
  const text = JSON.stringify(projectionA);
  assert.doesNotMatch(text, forbiddenTargets);
  for (const key of forbiddenProjectionKeys) assert.equal(text.includes(`\"${key}\"`), false, `projection leaked ${key}`);
  for (const axis of projectionA.axes) {
    assert.deepEqual(Object.keys(axis), [
      "axisPath", "enumOptions", "observableTarget", "referenceFrame", "valueDefinitions",
      "neighborContrasts", "ambiguityRules", "notAssessableConditions", "imageConditionWarnings",
      "humanReviewerInstruction", "allowedEvidenceTags"
    ]);
  }
}

const testAxis = projectIndependentHumanCueDefinitions("A").axes[0];
assert.equal(validateIndependentHumanCueJudgment({
  reviewItemId: "hci_000000000000000000000000",
  axisPath: testAxis.axisPath,
  response: testAxis.enumOptions[0],
  confidence: "medium",
  evidenceTags: [testAxis.allowedEvidenceTags[0]],
  notAssessableReasonCodes: []
}, testAxis), true);
assert.equal(validateIndependentHumanCueJudgment({
  reviewItemId: "hci_000000000000000000000000",
  axisPath: testAxis.axisPath,
  response: "uncertain",
  confidence: "high",
  evidenceTags: [],
  notAssessableReasonCodes: []
}, testAxis), false, "uncertain high confidence must fail");

assert.equal(freeze.schemaVersion, "face-lab-independent-human-cue-audit-protocol-freeze-v1");
assert.equal(freeze.protocolVersion, protocol.protocolVersion);
assert.equal(freeze.status, "packet_ready_not_executed");
assert.equal(freeze.authority.mainSha, EXPECTED.mainSha);
assert.equal(freeze.authority.definitionContractDigest, EXPECTED.definitionContractDigest);
assert.equal(freeze.authority.definitionFreezeDigest, EXPECTED.definitionFreezeDigest);
assert.equal(freeze.authority.reviewerSafeDefinitionProjectionDigest, EXPECTED.reviewerSafeDefinitionProjectionDigest);
assert.equal(freeze.authority.protocolDigest, protocol.protocolDigest);
assert.deepEqual(freeze.inputSummary, {
  subtleCanonicalCandidates: 7,
  moderateCanonicalCandidates: 7,
  totalCanonicalCandidates: 14,
  uniqueCanonicalAssets: 14,
  sourceMutationCount: 0
});
assert.deepEqual(freeze.axisSummary, { primaryAxisCount: 8, validationOnlyAxisCount: 2, excludedDirectAxisCount: 1 });
assert.deepEqual(freeze.reviewerSummary, {
  plannedReviewerSlots: 3,
  partAJudgmentsPerReviewer: 112,
  partBJudgmentsPerReviewer: 28,
  fullPlannedJudgments: 420,
  humanJudgmentsExecuted: 0
});
assert.equal(freeze.localPacketAuthorityDigest, EXPECTED.localPacketAuthorityDigest);
assert.equal(freeze.packetPrepared, true);
assert.equal(freeze.productionConsumption, false);
assert.equal(Object.values(freeze.executionCounters).every((count) => count === 0), true);
assert.equal(freeze.w2Status, "locked");
assert.equal(digestWithout(freeze, "freezeDigest"), freeze.freezeDigest);
assert.equal(freeze.freezeDigest, EXPECTED.freezeDigest);
const freezeText = JSON.stringify(freeze);
assert.doesNotMatch(freezeText, /\b(?:cand_|obs_)[a-z0-9]*/i);
assert.doesNotMatch(freezeText, /[A-Za-z]:[\\/]/);

const args = parseArgs();
let local = null;
if (args["local-root"]) {
  const localRoot = path.resolve(args["local-root"]);
  const privateRoot = path.join(localRoot, "private");
  const packetRoot = path.join(localRoot, "packets");
  assert.equal(existsSync(path.join(packetRoot, "private")), false, "private map leaked into packets");
  const privateMap = readJson(path.join(privateRoot, "human-cue-private-map-v1.json"));
  const assetInventory = readJson(path.join(privateRoot, "review-asset-inventory-v1.json"));
  const fileInventory = readJson(path.join(privateRoot, "reviewer-packet-file-inventory-v1.json"));
  const authority = readJson(path.join(privateRoot, "packet-authority-v1.json"));
  assert.equal(digestWithout(privateMap, "mapDigest"), privateMap.mapDigest);
  assert.equal(privateMap.entries.length, 14);
  assert.equal(new Set(privateMap.entries.map((entry) => entry.candidateId)).size, 14);
  assert.equal(new Set(privateMap.entries.map((entry) => entry.sourceCanonicalSha256)).size, 14);
  assert.equal(new Set(privateMap.entries.map((entry) => entry.reviewItemId)).size, 14);
  assert.equal(sha256(stableStringify(assetInventory.entries)), assetInventory.inventoryDigest);
  assert.equal(sha256(stableStringify(fileInventory.entries)), fileInventory.inventoryDigest);
  assert.equal(digestWithout(authority, "authorityDigest"), authority.authorityDigest);
  assert.equal(authority.authorityDigest, freeze.localPacketAuthorityDigest);
  assert.equal(authority.reviewItemPrivateMapDigest, privateMap.mapDigest);
  assert.equal(authority.reviewAssetInventoryDigest, assetInventory.inventoryDigest);
  assert.equal(authority.reviewerPacketFileInventoryDigest, fileInventory.inventoryDigest);
  assert.equal(authority.candidateCount, 14);
  assert.equal(authority.humanJudgments, 0);
  for (const asset of assetInventory.entries) {
    const bytes = readFileSync(path.join(localRoot, "review-assets", asset.assetName));
    assert.equal(sha256(bytes), asset.reviewAssetSha256);
    assert.equal(await pixelDigest(bytes), asset.pixelDigest);
  }
  const mapByItem = new Map(privateMap.entries.map((entry) => [entry.reviewItemId, entry]));
  const observedOrders = [];
  for (const reviewerSlot of protocol.reviewerSlotIds) {
    const reviewerRoot = path.join(packetRoot, `reviewer-${reviewerSlot.toLowerCase()}`);
    for (const asset of assetInventory.entries) {
      const bytes = readFileSync(path.join(reviewerRoot, "assets", asset.assetName));
      assert.equal(sha256(bytes), asset.reviewAssetSha256);
    }
    for (const part of ["A", "B"]) {
      const partRoot = path.join(reviewerRoot, `part-${part.toLowerCase()}`);
      const definitions = readJson(path.join(partRoot, "reviewer-safe-definitions.json"));
      const manifest = readJson(path.join(partRoot, "review-manifest.json"));
      const template = readJson(path.join(partRoot, "response-template.json"));
      assert.equal(stableStringify(definitions), stableStringify(projectIndependentHumanCueDefinitions(part)));
      assert.equal(manifest.reviewerSlot, reviewerSlot);
      assert.equal(manifest.part, part);
      assert.equal(manifest.orderedReviewItems.length, 14);
      assert.equal(new Set(manifest.orderedReviewItems.map((item) => item.reviewItemId)).size, 14);
      assert.equal(manifest.axisPaths.length, part === "A" ? 8 : 2);
      assert.equal(manifest.definitionProjectionDigest, sha256(stableStringify(definitions)));
      assert.equal(packetDigestFor(manifest), manifest.packetDigest);
      assert.equal(manifest.packetId, `hcp_${manifest.packetDigest.slice(0, 24)}`);
      assert.equal(validateBlankIndependentHumanCueReviewTemplate(template, manifest, definitions), true);
      assert.equal(template.judgments.length, part === "A" ? 112 : 28);
      assert.equal(authority.reviewerPacketDigests[reviewerSlot][part], manifest.packetDigest);
      if (part === "A") observedOrders.push(manifest.orderedReviewItems.map((item) => item.reviewItemId).join("|"));
      const mapped = manifest.orderedReviewItems.map((item) => mapByItem.get(item.reviewItemId));
      assert.equal(mapped.every(Boolean), true);
      assert.equal(mapped.some((entry, index) => index > 0 && entry.sourceOrdinal === mapped[index - 1].sourceOrdinal), false);
    }
  }
  assert.equal(new Set(observedOrders).size, 3);
  const actualFiles = readdirSync(packetRoot, { recursive: true }).filter((file) => statSync(path.join(packetRoot, file)).isFile())
    .map((file) => {
      const bytes = readFileSync(path.join(packetRoot, file));
      return { relativePath: file.split(path.sep).join("/"), sha256: sha256(bytes), byteLength: bytes.length };
    }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  assert.deepEqual(actualFiles, fileInventory.entries);
  local = {
    authorityDigest: authority.authorityDigest,
    privateMapDigest: privateMap.mapDigest,
    reviewAssetInventoryDigest: assetInventory.inventoryDigest,
    packetFileInventoryDigest: fileInventory.inventoryDigest,
    candidates: privateMap.entries.length,
    pixelChecks: assetInventory.entries.length,
    packets: 6,
    packetFiles: actualFiles.length
  };
}

console.log(JSON.stringify({
  status: "PASS",
  protocolVersion: protocol.protocolVersion,
  protocolDigest: protocol.protocolDigest,
  freezeDigest: freeze.freezeDigest,
  definitionContractDigest: protocol.definitionContractDigest,
  primaryAxes: protocol.primaryAxes.length,
  validationOnlyAxes: protocol.validationOnlyAxes.length,
  excludedDirectAxes: protocol.excludedDirectAxes.length,
  reviewerSlots: protocol.plannedReviewerSlots,
  local,
  providerCalls: 0,
  humanJudgments: 0,
  productionConsumption: false,
  w2Status: "W2_REMAINS_LOCKED"
}, null, 2));
