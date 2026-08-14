import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL,
  FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT,
  INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION,
  INDEPENDENT_HUMAN_CUE_REVIEW_SCHEMA_VERSION,
  INDEPENDENT_HUMAN_CUE_REVIEW_TEMPLATE_SCHEMA_VERSION,
  projectIndependentHumanCueDefinitions,
  validateBlankIndependentHumanCueReviewTemplate,
  validateIndependentHumanCueAuditProtocol
} from "../packages/face-contracts/src/archetype-human-evaluation/index.js";
import { resolveCandidateIntent } from "../tools/synthetic-evaluation/src/judgment/intent-resolver.js";
import {
  verifyObservationObjectIntegrity,
  verifyObservationRunManifestIntegrity
} from "../tools/synthetic-evaluation/src/observation/artifact-integrity.js";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sortKeys = (value) => Array.isArray(value)
  ? value.map(sortKeys)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
    : value;
const stableStringify = (value) => JSON.stringify(sortKeys(value));
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeBytes = (file, bytes) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, bytes);
};
const writeJson = (file, value) => writeBytes(file, jsonBytes(value));
const parseArgs = () => {
  const pairs = new Map();
  for (let index = 2; index < process.argv.length; index += 2) {
    assert.match(process.argv[index] || "", /^--[a-z-]+$/);
    assert.ok(process.argv[index + 1], `missing value for ${process.argv[index]}`);
    pairs.set(process.argv[index].slice(2), process.argv[index + 1]);
  }
  return Object.fromEntries(pairs);
};

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const SEMANTIC_METADATA_CHUNKS = new Set(["tEXt", "zTXt", "iTXt", "eXIf"]);
const parsePngChunks = (bytes) => {
  assert.equal(bytes.subarray(0, 8).equals(PNG_SIGNATURE), true, "canonical asset is not PNG");
  const chunks = [];
  let offset = 8;
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, "truncated PNG chunk");
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    assert.ok(end <= bytes.length, "invalid PNG chunk length");
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    chunks.push({ type, start: offset, end, payload: bytes.subarray(offset + 8, offset + 8 + length) });
    offset = end;
    if (type === "IEND") break;
  }
  assert.equal(chunks.at(-1)?.type, "IEND", "PNG missing IEND");
  return chunks;
};
const stripSemanticMetadataChunks = (bytes, chunks) => Buffer.concat([
  bytes.subarray(0, 8),
  ...chunks.filter((chunk) => !SEMANTIC_METADATA_CHUNKS.has(chunk.type)).map((chunk) => bytes.subarray(chunk.start, chunk.end))
]);
const pixelIdentity = async (bytes) => {
  const { data, info } = await sharp(bytes, { failOn: "error" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const header = Buffer.from(`${info.width}x${info.height}x${info.channels}\0`, "utf8");
  return {
    pixelDigest: sha256(Buffer.concat([header, data])),
    width: info.width,
    height: info.height,
    channels: info.channels
  };
};

const loadObservationBundle = (root, manifest) => {
  const candidateDir = path.join(root, "observation-runs", manifest.candidateId);
  assert.equal(existsSync(candidateDir), true, `observation directory missing:${manifest.candidateId}`);
  const runDirs = readdirSync(candidateDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert.equal(runDirs.length, 1, `observation count invalid:${manifest.candidateId}`);
  const run = readJson(path.join(candidateDir, runDirs[0].name, "manifest.json"));
  assert.equal(verifyObservationRunManifestIntegrity(run), true, `observation manifest integrity:${manifest.candidateId}`);
  assert.equal(run.outcome, "observed_bundle");
  assert.equal(run.authority, "observed_image");
  assert.equal(run.candidate.candidateId, manifest.candidateId);
  assert.equal(run.candidate.canonicalSha256, manifest.asset.canonicalSha256);
  const objectFile = path.join(root, ...run.observation.objectRelativePath.split("/"));
  const observation = readJson(objectFile);
  assert.equal(verifyObservationObjectIntegrity(observation), true, `observation object integrity:${manifest.candidateId}`);
  assert.equal(observation.observationDigest, run.observation.digest);
  assert.equal(observation.candidateId, manifest.candidateId);
  assert.equal(observation.canonicalSha256, manifest.asset.canonicalSha256);
  return { run, observation };
};

const loadCohort = (root, cohort, expectedPrefix) => {
  const candidateRoot = path.join(root, "candidates");
  const candidates = readdirSync(candidateRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readJson(path.join(candidateRoot, entry.name, "manifest.json")));
  assert.equal(candidates.length, 7, `${cohort} candidate count`);
  return candidates.map((manifest) => {
    assert.equal(manifest.schemaVersion, "candidate-manifest-v1");
    assert.equal(manifest.state, "G0_GENERATED");
    assert.match(manifest.candidateId, /^cand_[a-f0-9]{24}$/);
    assert.match(manifest.asset.canonicalSha256, /^[a-f0-9]{64}$/);
    const condition = manifest.grouping?.conditionId || "";
    const matched = condition.match(new RegExp(`^${expectedPrefix}-(0[1-7])$`));
    assert.ok(matched, `${cohort} condition identity invalid`);
    const ordinal = matched[1];
    const spec = readJson(path.join(root, ...manifest.generation.artifactReferences.spec.objectRelativePath.split("/")));
    const compiledPrompt = readJson(path.join(root, ...manifest.generation.artifactReferences.compiledPrompt.objectRelativePath.split("/")));
    assert.equal(resolveCandidateIntent({ candidateManifest: manifest, finalizedSpec: spec, compiledPrompt }).ok, true, `candidate intent integrity:${manifest.candidateId}`);
    const canonicalPath = path.join(root, ...manifest.asset.canonicalObjectRelativePath.split("/"));
    const canonicalBytes = readFileSync(canonicalPath);
    assert.equal(sha256(canonicalBytes), manifest.asset.canonicalSha256, `canonical SHA mismatch:${manifest.candidateId}`);
    const { run } = loadObservationBundle(root, manifest);
    return { cohort, ordinal, root, manifest, canonicalPath, canonicalBytes, run };
  }).sort((left, right) => left.ordinal.localeCompare(right.ordinal));
};

const opaqueOrder = (items, reviewerSlot) => {
  const seeded = (values, suffix) => [...values].sort((left, right) => {
    const a = sha256(`${INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION}|${reviewerSlot}|${suffix}|${left.reviewItemId}`);
    const b = sha256(`${INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION}|${reviewerSlot}|${suffix}|${right.reviewItemId}`);
    return a.localeCompare(b);
  });
  const subtle = seeded(items.filter((item) => item.cohort === "subtle"), "left");
  const moderate = seeded(items.filter((item) => item.cohort === "moderate"), "right");
  const candidates = [];
  for (const source of [moderate, [...moderate].reverse()]) {
    for (let shift = 0; shift < source.length; shift += 1) {
      const rotated = source.map((_, index) => source[(index + shift) % source.length]);
      for (const first of [subtle, rotated]) {
        const second = first === subtle ? rotated : subtle;
        candidates.push(first.flatMap((item, index) => [item, second[index]]));
      }
    }
  }
  const ordered = candidates.find((candidate) =>
    !candidate.some((item, index) => index > 0 && item.ordinal === candidate[index - 1].ordinal)
  );
  assert.ok(ordered, `${reviewerSlot} could not separate matched siblings`);
  assert.equal(ordered.some((item, index) => index > 0 && item.ordinal === ordered[index - 1].ordinal), false, `${reviewerSlot} matched siblings adjacent`);
  return ordered;
};

const packetDigestFor = ({ reviewerSlot, part, orderedReviewItems, definitionProjectionDigest }) => sha256(stableStringify({
  protocolVersion: INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION,
  reviewerSlot,
  part,
  orderedReviewItems,
  definitionProjectionDigest,
  responseSchemaVersion: INDEPENDENT_HUMAN_CUE_REVIEW_SCHEMA_VERSION
}));

const buildTemplate = ({ manifest, definitionPacket }) => ({
  schemaVersion: INDEPENDENT_HUMAN_CUE_REVIEW_TEMPLATE_SCHEMA_VERSION,
  protocolVersion: INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION,
  packetDigest: manifest.packetDigest,
  reviewerSlot: manifest.reviewerSlot,
  sessionId: `hcs_${sha256(`${manifest.packetDigest}|session`).slice(0, 24)}`,
  reviewerIndependenceAttestation: Object.fromEntries(
    Object.keys(FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL.reviewerIndependence.requiredAttestation).map((key) => [key, null])
  ),
  judgments: manifest.orderedReviewItems.flatMap((item) => definitionPacket.axes.map((axis) => ({
    reviewItemId: item.reviewItemId,
    axisPath: axis.axisPath,
    response: null,
    confidence: null,
    evidenceTags: [],
    notAssessableReasonCodes: []
  })))
});

const textLeakPatterns = [
  /\b(?:wolf|cat|puppy|deer|tofu|potato|dino)\b/i,
  /\bW1M?\b/i,
  /\bsubtle\b/i,
  /\b(?:cand_|obs_)[a-z0-9]*/i,
  /\b(?:GenerationSpec|positivePrompt|promptDigest|specDigest|targetArchetype|intendedCue|sourceSlotId)\b/i,
  /\bgpt-4o-mini\b/i,
  /\bblind scoring\b/i,
  /\btarget rank\b/i,
  /\bscore\b/i,
  /\bD[12](?:C)?\b/i
];

const args = parseArgs();
for (const key of ["source-subtle", "source-moderate", "output", "execution-main-sha"]) assert.ok(args[key], `missing --${key}`);
assert.match(args["execution-main-sha"], /^[a-f0-9]{40}$/);
const outputRoot = path.resolve(args.output);
assert.equal(outputRoot.toLowerCase().includes(`${path.sep}.synthetic-local${path.sep}`.toLowerCase()), true, "output must be local synthetic root");
assert.deepEqual(validateIndependentHumanCueAuditProtocol(FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL), { ok: true, errors: [] });

const sources = [
  ...loadCohort(path.resolve(args["source-subtle"]), "subtle", "W1"),
  ...loadCohort(path.resolve(args["source-moderate"]), "moderate", "W1M")
];
assert.equal(sources.length, 14);
assert.equal(new Set(sources.map((item) => item.manifest.candidateId)).size, 14, "candidate IDs not unique");
assert.equal(new Set(sources.map((item) => item.manifest.asset.canonicalSha256)).size, 14, "canonical assets not unique");

const reviewItems = [];
let metadataSanitizationCount = 0;
for (const source of sources) {
  const reviewItemId = `hci_${sha256(`${INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION}|${source.manifest.asset.canonicalSha256}`).slice(0, 24)}`;
  const assetName = `asset_${sha256(`${INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION}|asset|${source.manifest.asset.canonicalSha256}`).slice(0, 24)}.png`;
  const chunks = parsePngChunks(source.canonicalBytes);
  const semanticChunks = chunks.filter((chunk) => SEMANTIC_METADATA_CHUNKS.has(chunk.type));
  const reviewBytes = semanticChunks.length ? stripSemanticMetadataChunks(source.canonicalBytes, chunks) : source.canonicalBytes;
  if (semanticChunks.length) metadataSanitizationCount += 1;
  const [sourcePixels, reviewPixels] = await Promise.all([pixelIdentity(source.canonicalBytes), pixelIdentity(reviewBytes)]);
  assert.deepEqual(reviewPixels, sourcePixels, `pixel identity changed:${source.manifest.candidateId}`);
  const reviewAssetPath = path.join(outputRoot, "review-assets", assetName);
  writeBytes(reviewAssetPath, reviewBytes);
  reviewItems.push({
    reviewItemId,
    assetName,
    reviewBytes,
    reviewAssetSha256: sha256(reviewBytes),
    sourceCanonicalSha256: source.manifest.asset.canonicalSha256,
    pixelDigest: sourcePixels.pixelDigest,
    width: sourcePixels.width,
    height: sourcePixels.height,
    channels: sourcePixels.channels,
    candidateId: source.manifest.candidateId,
    candidateDigest: source.manifest.candidateDigest,
    cohort: source.cohort,
    ordinal: source.ordinal,
    observationRunId: source.run.runId,
    observationRunDigest: source.run.manifestDigest,
    observationDigest: source.run.observation.digest,
    metadataSanitized: semanticChunks.length > 0,
    removedMetadataChunks: semanticChunks.map((chunk) => chunk.type)
  });
}

const privateMapWithoutDigest = {
  schemaVersion: "face-lab-independent-human-cue-private-map-v1",
  protocolVersion: INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION,
  entries: reviewItems.map((item) => ({
    reviewItemId: item.reviewItemId,
    candidateId: item.candidateId,
    candidateDigest: item.candidateDigest,
    sourceCohort: item.cohort,
    sourceOrdinal: item.ordinal,
    sourceCanonicalSha256: item.sourceCanonicalSha256,
    reviewAssetSha256: item.reviewAssetSha256,
    pixelDigest: item.pixelDigest,
    width: item.width,
    height: item.height,
    channels: item.channels,
    metadataSanitized: item.metadataSanitized,
    removedMetadataChunks: item.removedMetadataChunks,
    observationRunId: item.observationRunId,
    observationRunDigest: item.observationRunDigest,
    observationDigest: item.observationDigest
  }))
};
const privateMap = {
  ...privateMapWithoutDigest,
  mapDigest: sha256(stableStringify(privateMapWithoutDigest))
};
writeJson(path.join(outputRoot, "private", "human-cue-private-map-v1.json"), privateMap);

const definitionPackets = Object.fromEntries(["A", "B"].map((part) => {
  const packet = projectIndependentHumanCueDefinitions(part);
  assert.ok(packet);
  return [part, { packet, digest: sha256(stableStringify(packet)) }];
}));
const reviewerPacketDigests = {};
const packetInventory = [];
const orders = [];
for (const reviewerSlot of FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL.reviewerSlotIds) {
  const reviewerName = `reviewer-${reviewerSlot.toLowerCase()}`;
  const reviewerRoot = path.join(outputRoot, "packets", reviewerName);
  const ordered = opaqueOrder(reviewItems, reviewerSlot);
  orders.push(ordered.map((item) => item.reviewItemId).join("|"));
  writeBytes(path.join(reviewerRoot, "README.md"), Buffer.from(
    "# Independent visible-cue review\n\nReview one image at a time. Use only visible facial evidence and the supplied definitions. Do not infer identity, health, personality, attractiveness, or any hidden intent. Complete Part A before Part B. Keep your work independent and do not view another reviewer's answers.\n",
    "utf8"
  ));
  for (const item of ordered) {
    const destination = path.join(reviewerRoot, "assets", item.assetName);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(path.join(outputRoot, "review-assets", item.assetName), destination);
    assert.equal(sha256(readFileSync(destination)), item.reviewAssetSha256);
  }
  reviewerPacketDigests[reviewerSlot] = {};
  for (const part of ["A", "B"]) {
    const { packet: definitionPacket, digest: definitionProjectionDigest } = definitionPackets[part];
    const orderedReviewItems = ordered.map((item) => ({
      reviewItemId: item.reviewItemId,
      assetRelativePath: `../assets/${item.assetName}`
    }));
    const packetDigest = packetDigestFor({ reviewerSlot, part, orderedReviewItems, definitionProjectionDigest });
    const manifest = {
      schemaVersion: "face-lab-independent-human-cue-review-manifest-v1",
      protocolVersion: INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION,
      packetId: `hcp_${packetDigest.slice(0, 24)}`,
      reviewerSlot,
      part,
      definitionProjectionDigest,
      orderedReviewItems,
      axisPaths: definitionPacket.axes.map((axis) => axis.axisPath),
      responseOptions: ["axis_enum_token", "uncertain", "not_assessable"],
      packetDigest
    };
    const template = buildTemplate({ manifest, definitionPacket });
    assert.equal(validateBlankIndependentHumanCueReviewTemplate(template, manifest, definitionPacket), true);
    const partRoot = path.join(reviewerRoot, `part-${part.toLowerCase()}`);
    writeJson(path.join(partRoot, "reviewer-safe-definitions.json"), definitionPacket);
    writeJson(path.join(partRoot, "review-manifest.json"), manifest);
    writeJson(path.join(partRoot, "response-template.json"), template);
    reviewerPacketDigests[reviewerSlot][part] = packetDigest;
  }
  for (const file of readdirSync(reviewerRoot, { recursive: true })) {
    const absolute = path.join(reviewerRoot, file);
    if (!statSync(absolute).isFile()) continue;
    const relativePath = path.relative(path.join(outputRoot, "packets"), absolute).split(path.sep).join("/");
    const bytes = readFileSync(absolute);
    packetInventory.push({ relativePath, sha256: sha256(bytes), byteLength: bytes.length });
    if (/\.(?:md|json|txt|html|js)$/i.test(file)) {
      const text = bytes.toString("utf8");
      for (const pattern of textLeakPatterns) assert.doesNotMatch(text, pattern, `reviewer leakage:${relativePath}:${pattern}`);
      if (!relativePath.endsWith("reviewer-safe-definitions.json")) {
        assert.doesNotMatch(text, /\bmoderate\b/i, `condition token leakage:${relativePath}`);
      }
    }
    for (const pattern of textLeakPatterns) assert.doesNotMatch(relativePath, pattern, `filename leakage:${relativePath}:${pattern}`);
  }
}
assert.equal(new Set(orders).size, 3, "reviewer orders must differ");

const reviewAssetInventory = reviewItems.map((item) => ({
  reviewItemId: item.reviewItemId,
  assetName: item.assetName,
  reviewAssetSha256: item.reviewAssetSha256,
  pixelDigest: item.pixelDigest,
  width: item.width,
  height: item.height,
  metadataSanitized: item.metadataSanitized
})).sort((a, b) => a.reviewItemId.localeCompare(b.reviewItemId));
const reviewAssetInventoryDigest = sha256(stableStringify(reviewAssetInventory));
const packetFileInventory = packetInventory.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
const reviewerPacketFileInventoryDigest = sha256(stableStringify(packetFileInventory));
const packetAuthorityWithoutDigest = {
  schemaVersion: "face-lab-independent-human-cue-packet-authority-v1",
  protocolVersion: INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION,
  executionMainSha: args["execution-main-sha"],
  definitionContractDigest: FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT.contractDigest,
  sourceAuthorities: [
    { sourceCohort: "subtle", sourceRootRole: "sealed_canonical_candidate_authority", candidateCount: 7 },
    { sourceCohort: "moderate", sourceRootRole: "sealed_canonical_candidate_authority", candidateCount: 7 }
  ],
  reviewItemPrivateMapDigest: privateMap.mapDigest,
  reviewAssetInventoryDigest,
  reviewerPacketDigests,
  reviewerPacketFileInventoryDigest,
  candidateCount: 14,
  primaryAxisCount: 8,
  validationAxisCount: 2,
  excludedDirectAxisCount: 1,
  plannedReviewerSlots: 3,
  metadataSanitizationCount,
  pixelEquivalenceChecks: 14,
  humanJudgments: 0
};
const packetAuthority = {
  ...packetAuthorityWithoutDigest,
  authorityDigest: sha256(stableStringify(packetAuthorityWithoutDigest))
};
writeJson(path.join(outputRoot, "private", "packet-authority-v1.json"), packetAuthority);
writeJson(path.join(outputRoot, "private", "review-asset-inventory-v1.json"), {
  schemaVersion: "face-lab-independent-human-cue-review-asset-inventory-v1",
  entries: reviewAssetInventory,
  inventoryDigest: reviewAssetInventoryDigest
});
writeJson(path.join(outputRoot, "private", "reviewer-packet-file-inventory-v1.json"), {
  schemaVersion: "face-lab-independent-human-cue-reviewer-packet-file-inventory-v1",
  entries: packetFileInventory,
  inventoryDigest: reviewerPacketFileInventoryDigest
});

const report = `# Independent Human cue packet freeze\n\n- Protocol: ${INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION}\n- Canonical candidates: 14\n- Independent reviewer slots: 3\n- Part A: 14 images x 8 axes = 112 judgments per reviewer\n- Part B: 14 images x 2 axes = 28 judgments per reviewer\n- Full planned burden: 140 judgments per reviewer, 420 total\n- Human judgments executed: 0\n- Packet authority digest: ${packetAuthority.authorityDigest}\n- Private-map digest: ${privateMap.mapDigest}\n- Review-asset inventory digest: ${reviewAssetInventoryDigest}\n- Metadata-sanitized assets: ${metadataSanitizationCount}\n- Pixel-equivalence checks: 14/14\n`;
writeBytes(path.join(outputRoot, "reports", "packet-freeze-report-v1.md"), Buffer.from(report, "utf8"));

console.log(JSON.stringify({
  status: "PASS",
  protocolVersion: INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL_VERSION,
  protocolDigest: FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL.protocolDigest,
  candidateCount: 14,
  uniqueCanonicalAssets: 14,
  metadataSanitizationCount,
  pixelEquivalenceChecks: 14,
  privateMapDigest: privateMap.mapDigest,
  reviewAssetInventoryDigest,
  reviewerPacketDigests,
  reviewerPacketFileInventoryDigest,
  packetAuthorityDigest: packetAuthority.authorityDigest,
  reviewerBurden: { partA: 112, partB: 28, perReviewerTotal: 140, fullPanelTotal: 420 },
  humanJudgments: 0,
  providerCalls: 0,
  w2Status: "W2_REMAINS_LOCKED"
}, null, 2));
