import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL,
  projectIndependentHumanCueDefinitions
} from "../packages/face-contracts/src/archetype-human-evaluation/index.js";
import {
  ATTESTATION_COPY,
  EXECUTION_CANDIDATE_SCHEMA_VERSION,
  EXPECTED_PACKET_AUTHORITY_DIGEST,
  EXPECTED_PACKET_DIGESTS,
  EXPECTED_PACKET_FILE_INVENTORY_DIGEST,
  EXPECTED_PRIVATE_MAP_DIGEST,
  EXPECTED_REVIEW_ASSET_INVENTORY_DIGEST,
  EXPECTED_SOURCE_MAIN_SHA,
  KOREAN_AXIS_CONTENT,
  KOREAN_REASON_MAP,
  KOREAN_TOKEN_MAP,
  UI_AUTHORITY_SCHEMA_VERSION,
  UI_VERSION,
  isStructurallyValidJudgment,
  renderReviewHtml,
  stableStringify
} from "./build-face-lab-independent-human-cue-review-ui-ko-v1.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
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
const recursiveInventory = (root) => readdirSync(root, { recursive: true })
  .filter((relativePath) => statSync(path.join(root, relativePath)).isFile())
  .map((relativePath) => {
    const bytes = readFileSync(path.join(root, relativePath));
    return { relativePath: relativePath.split(path.sep).join("/"), sha256: sha256(bytes), byteLength: bytes.length };
  })
  .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

const protocol = FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL;
const partDefinitions = { A: projectIndependentHumanCueDefinitions("A"), B: projectIndependentHumanCueDefinitions("B") };
const expectedAxes = [...protocol.primaryAxes, ...protocol.validationOnlyAxes];
assert.deepEqual(Object.keys(KOREAN_AXIS_CONTENT), expectedAxes, "Korean axis map must match the exact A+B contract order");
assert.equal(Object.hasOwn(KOREAN_AXIS_CONTENT, "observations.visualLanguage.featureContrast"), false);
assert.deepEqual(Object.keys(ATTESTATION_COPY), Object.keys(protocol.reviewerIndependence.requiredAttestation));
assert.deepEqual(Object.keys(KOREAN_REASON_MAP), protocol.notAssessableReasonCodes);

const expectedTokenLabels = {
  oval: "계란형", round: "둥근형", square: "사각형", oblong: "긴 사각형", heart: "하트형", diamond: "다이아몬드형", triangle: "삼각형", mixed: "혼합형",
  soft: "부드러움", moderate: "중간", angular: "각짐", short: "짧음", balanced: "균형", long: "김",
  upturned: "올라감", level: "수평", downturned: "내려감", narrow: "좁음", medium: "중간", wide: "넓음",
  small: "작음", large: "큼", spread: "넓게 분포", centered: "중심부에 모임", curved: "곡선 우세", straight: "직선 우세",
  defined: "선명함", uncertain: "판단 애매", not_assessable: "판단 불가", low: "낮음", high: "높음", not_applicable: "해당 없음"
};
assert.deepEqual(KOREAN_TOKEN_MAP, expectedTokenLabels, "Korean token mapping drift");

for (const definitions of Object.values(partDefinitions)) {
  for (const sourceAxis of definitions.axes) {
    const translated = KOREAN_AXIS_CONTENT[sourceAxis.axisPath];
    assert.ok(translated);
    assert.deepEqual(Object.keys(translated.valueDefinitions), sourceAxis.enumOptions);
    for (const key of ["title", "shortInstruction", "observableTarget", "referenceFrame", "humanReviewerInstruction"]) assert.match(translated[key], /[가-힣]/, `${sourceAxis.axisPath}:${key}`);
    for (const key of ["neighborContrasts", "ambiguityRules", "notAssessableConditions", "imageConditionWarnings"]) {
      assert.equal(translated[key].length, sourceAxis[key].length, `${sourceAxis.axisPath}:${key} translation count`);
      assert.equal(translated[key].every((text) => /[가-힣]/.test(text)), true);
    }
  }
}

const concrete = { response: "oval", confidence: "high", notAssessableReasonCodes: [] };
assert.equal(isStructurallyValidJudgment(concrete, ["oval", "round"]), true);
assert.equal(isStructurallyValidJudgment({ ...concrete, response: null }, ["oval", "round"]), false);
assert.equal(isStructurallyValidJudgment({ ...concrete, confidence: null }, ["oval", "round"]), false);
assert.equal(isStructurallyValidJudgment({ ...concrete, response: "uncertain", confidence: "medium" }, ["oval"]), true);
assert.equal(isStructurallyValidJudgment({ ...concrete, response: "uncertain", confidence: "high" }, ["oval"]), false);
assert.equal(isStructurallyValidJudgment({ response: "not_assessable", confidence: "not_applicable", notAssessableReasonCodes: ["pose"] }, ["oval"]), true);
assert.equal(isStructurallyValidJudgment({ response: "not_assessable", confidence: "not_applicable", notAssessableReasonCodes: [] }, ["oval"]), false);

const syntheticItems = Array.from({ length: 14 }, (_, index) => ({ reviewItemId: `hci_${String(index).padStart(24, "0")}`, assetRelativePath: `assets/asset_${String(index).padStart(24, "0")}.png` }));
const syntheticModel = {
  uiVersion: UI_VERSION,
  executionCandidateSchemaVersion: EXECUTION_CANDIDATE_SCHEMA_VERSION,
  protocolVersion: protocol.protocolVersion,
  reviewerSlot: "R01",
  packetDigests: EXPECTED_PACKET_DIGESTS.R01,
  tokenLabels: KOREAN_TOKEN_MAP,
  reasonLabels: KOREAN_REASON_MAP,
  attestationCopy: ATTESTATION_COPY,
  parts: Object.fromEntries(["A", "B"].map((part) => [part, {
    definitionProjectionDigest: sha256(stableStringify(partDefinitions[part])),
    items: syntheticItems,
    axes: partDefinitions[part].axes.map((sourceAxis) => ({ axisPath: sourceAxis.axisPath, enumOptions: sourceAxis.enumOptions, content: KOREAN_AXIS_CONTENT[sourceAxis.axisPath] }))
  }]))
};
const firstHtml = renderReviewHtml(syntheticModel);
const secondHtml = renderReviewHtml(syntheticModel);
assert.equal(firstHtml, secondHtml, "UI rendering is nondeterministic");
assert.match(firstHtml, /<html lang="ko">/);
assert.match(firstHtml, /얼굴 특징 판별 테스트/);
assert.match(firstHtml, /첫 번째 평가/);
assert.match(firstHtml, /두 번째 평가/);
assert.match(firstHtml, /평가 결과 저장/);
assert.match(firstHtml, /execution_candidate_response/);
assert.match(firstHtml, /review-response-/);
assert.match(firstHtml, /localStorage\.getItem\(STORAGE_KEY\)/);
assert.match(firstHtml, /DATA\.protocolVersion,DATA\.reviewerSlot,DATA\.packetDigests\.A,DATA\.packetDigests\.B/);
assert.match(firstHtml, /j\.response==="uncertain"\)return \["low","medium"\]/);
assert.match(firstHtml, /j\.response==="not_assessable"\)return j\.confidence==="not_applicable"&&j\.notAssessableReasonCodes\.length>0/);
for (const pattern of [/\bfetch\s*\(/i, /XMLHttpRequest/i, /WebSocket/i, /EventSource/i, /navigator\.sendBeacon/i, /<script[^>]+src=/i, /<link[^>]+href=/i, /https?:\/\//i, /\beval\s*\(/i, /new\s+Function/i, /serviceWorker/i, /getUserMedia/i, /geolocation/i]) assert.doesNotMatch(firstHtml, pattern);

const leakagePatterns = [
  /\b(?:wolf|cat|puppy|deer|tofu|potato|dino)\b/i,
  /\bW1M?\b/i,
  /\bsubtle\b/i,
  /\b(?:cand_|obs_)[a-z0-9]*/i,
  /GenerationSpec|positivePrompt|promptDigest|specDigest|targetArchetype|intendedCue/i,
  /Vision output|gpt-4o-mini|shadow score|target rank/i,
  /\bD1\b|\bD2C\b/i,
  /source cohort|source ordinal|private map/i
];
for (const pattern of leakagePatterns) assert.doesNotMatch(firstHtml, pattern, `synthetic reviewer leakage:${pattern}`);

const args = parseArgs();
let local = null;
if (args["distribution-root"] || args["source-root"]) {
  assert.ok(args["distribution-root"] && args["source-root"], "local verification requires both roots");
  const distributionRoot = path.resolve(args["distribution-root"]);
  const sourceRoot = path.resolve(args["source-root"]);
  assert.equal(existsSync(distributionRoot), true);
  assert.equal(existsSync(sourceRoot), true);
  const sourceAuthority = readJson(path.join(sourceRoot, "private", "packet-authority-v1.json"));
  const sourcePrivateMap = readJson(path.join(sourceRoot, "private", "human-cue-private-map-v1.json"));
  const sourceAssets = readJson(path.join(sourceRoot, "private", "review-asset-inventory-v1.json"));
  const sourcePacketInventory = readJson(path.join(sourceRoot, "private", "reviewer-packet-file-inventory-v1.json"));
  assert.equal(sourceAuthority.authorityDigest, EXPECTED_PACKET_AUTHORITY_DIGEST);
  assert.equal(sourcePrivateMap.mapDigest, EXPECTED_PRIVATE_MAP_DIGEST);
  assert.equal(sourceAssets.inventoryDigest, EXPECTED_REVIEW_ASSET_INVENTORY_DIGEST);
  assert.equal(sourcePacketInventory.inventoryDigest, EXPECTED_PACKET_FILE_INVENTORY_DIGEST);
  assert.deepEqual(sourceAuthority.reviewerPacketDigests, EXPECTED_PACKET_DIGESTS);
  assert.equal(sourceAuthority.humanJudgments, 0);
  const authority = readJson(path.join(distributionRoot, "private", "ui-distribution-authority-v1.json"));
  const bindings = readJson(path.join(distributionRoot, "private", "source-packet-bindings-v1.json"));
  const inventory = readJson(path.join(distributionRoot, "private", "distribution-file-inventory-v1.json"));
  assert.equal(authority.schemaVersion, UI_AUTHORITY_SCHEMA_VERSION);
  assert.equal(authority.sourceMainSha, EXPECTED_SOURCE_MAIN_SHA);
  assert.equal(authority.sourceD2DPProtocolVersion, protocol.protocolVersion);
  assert.equal(authority.sourceD2DPProtocolDigest, protocol.protocolDigest);
  assert.equal(authority.sourcePacketAuthorityDigest, EXPECTED_PACKET_AUTHORITY_DIGEST);
  assert.deepEqual(authority.sourcePacketDigests, EXPECTED_PACKET_DIGESTS);
  assert.equal(authority.uiVersion, UI_VERSION);
  assert.deepEqual(authority.reviewerSlots, ["R01", "R02", "R03"]);
  assert.equal(authority.humanJudgments, 0);
  assert.equal(digestWithout(authority, "authorityDigest"), authority.authorityDigest);
  assert.equal(bindings.sourcePacketAuthorityDigest, EXPECTED_PACKET_AUTHORITY_DIGEST);
  assert.deepEqual(bindings.sourcePacketDigests, EXPECTED_PACKET_DIGESTS);
  assert.equal(bindings.humanJudgments, 0);
  assert.equal(sha256(stableStringify(inventory.entries)), inventory.inventoryDigest);
  assert.equal(inventory.inventoryDigest, authority.distributionFileInventoryDigest);
  const actualVisible = recursiveInventory(distributionRoot).filter((entry) => entry.relativePath.startsWith("reviewer-"));
  assert.deepEqual(actualVisible, inventory.entries);
  const sourceAssetMap = new Map(sourceAssets.entries.map((entry) => [entry.assetName, entry.reviewAssetSha256]));
  for (const reviewerSlot of ["R01", "R02", "R03"]) {
    const reviewerName = `reviewer-${reviewerSlot.toLowerCase()}`;
    const prefix = `${reviewerName}/`;
    const reviewerEntries = actualVisible.filter((entry) => entry.relativePath.startsWith(prefix));
    assert.equal(sha256(stableStringify(reviewerEntries)), authority.reviewerDistributionDigests[reviewerSlot]);
    const assets = reviewerEntries.filter((entry) => entry.relativePath.startsWith(`${prefix}assets/`));
    assert.equal(assets.length, 14);
    for (const asset of assets) {
      const assetName = path.basename(asset.relativePath);
      assert.equal(asset.sha256, sourceAssetMap.get(assetName), `source asset identity:${reviewerSlot}:${assetName}`);
    }
    const htmlPath = path.join(distributionRoot, reviewerName, "review.html");
    const html = readFileSync(htmlPath, "utf8");
    for (const pattern of leakagePatterns) assert.doesNotMatch(html, pattern, `${reviewerSlot} leakage:${pattern}`);
    for (const pattern of [/\bfetch\s*\(/i, /XMLHttpRequest/i, /WebSocket/i, /EventSource/i, /navigator\.sendBeacon/i, /<script[^>]+src=/i, /<link[^>]+href=/i, /https?:\/\//i, /\beval\s*\(/i, /new\s+Function/i, /serviceWorker/i, /getUserMedia/i, /geolocation/i]) assert.doesNotMatch(html, pattern, `${reviewerSlot} network/security primitive:${pattern}`);
    const dataMatch = html.match(/const DATA=(\{.*\});\nconst TOKEN_LABELS=/s);
    assert.ok(dataMatch, `${reviewerSlot} embedded data missing`);
    const data = JSON.parse(dataMatch[1]);
    assert.equal(data.reviewerSlot, reviewerSlot);
    assert.deepEqual(data.packetDigests, EXPECTED_PACKET_DIGESTS[reviewerSlot]);
    assert.equal(data.parts.A.items.length, 14);
    assert.equal(data.parts.B.items.length, 14);
    assert.deepEqual(data.parts.A.items.map((item) => item.reviewItemId), bindings.reviewerBindings[reviewerSlot].orderedReviewItemIds);
    assert.deepEqual(data.parts.B.items.map((item) => item.reviewItemId), bindings.reviewerBindings[reviewerSlot].orderedReviewItemIds);
    assert.equal(data.parts.A.axes.length, 8);
    assert.equal(data.parts.B.axes.length, 2);
    assert.equal([...data.parts.A.axes, ...data.parts.B.axes].some((item) => item.axisPath.endsWith("featureContrast")), false);
  }
  local = {
    sourcePacketAuthorityDigest: sourceAuthority.authorityDigest,
    distributionAuthorityDigest: authority.authorityDigest,
    distributionFileInventoryDigest: inventory.inventoryDigest,
    reviewerDistributionDigests: authority.reviewerDistributionDigests,
    reviewerSlots: authority.reviewerSlots.length,
    imageChecks: 42,
    sourceMutationCount: 0
  };
}

console.log(JSON.stringify({
  status: "PASS",
  uiVersion: UI_VERSION,
  protocolVersion: protocol.protocolVersion,
  protocolDigest: protocol.protocolDigest,
  KoreanVisibleLabels: true,
  internalTokenPreservation: true,
  primaryAxes: partDefinitions.A.axes.length,
  validationAxes: partDefinitions.B.axes.length,
  featureContrast: "excluded",
  syntheticImagesBound: syntheticItems.length,
  localStorageIsolation: true,
  responseValidation: "PASS",
  networkRequests: 0,
  deterministic: true,
  local,
  providerCalls: 0,
  observationCalls: 0,
  generationCalls: 0,
  humanJudgments: 0,
  consensus: 0,
  hostedProductionWrites: 0,
  w2Status: "W2_REMAINS_LOCKED"
}, null, 2));
