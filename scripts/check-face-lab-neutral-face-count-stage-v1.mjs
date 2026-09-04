import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  computeNeutralFaceCountAuthorityDigest,
  getNeutralFaceCountPublicModel,
  validateNeutralFaceCountAuthority,
  validateNeutralFaceCountSubmission
} from "../lib/face-lab-neutral-face-count-contract.mjs";

const root = process.cwd();
const read = (p) => readFile(path.join(root, p));
const text = async (p) => (await read(p)).toString("utf8");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ITEM_COUNT = 8;
const QUESTION =
  "눈, 코, 입 등 얼굴의 정확한 특징을 판별할 수 있을 정도로 보이는 사람은 몇 명인가요?";
const EXPECTED_DISTRIBUTION = { none: 2, one: 3, two_or_more: 3 };

function imageMetadata(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("Stage A v2 assets must be JPEG");
  }
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return {
        mediaType: "image/jpeg",
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5)
      };
    }
    offset += length;
  }
  throw new Error("image dimensions unavailable");
}

const must = (condition, message) => {
  if (!condition) throw new Error(message);
};
const mustContain = (source, needle, label) =>
  must(source.includes(needle), `${label}: missing ${needle}`);
const mustNotContain = (source, needle, label) =>
  must(!source.includes(needle), `${label}: forbidden ${needle}`);

const authorityPath =
  "evidence/facelab/face-count-neutral-review-authority-20260905-v2.json";
const acquisitionPath =
  "evidence/facelab/face-count-neutral-source-acquisition-20260905-v2.json";
const importEvidencePath =
  "evidence/facelab/face-count-neutral-natural-set-import-20260905-v2.json";
const curationPath =
  "evidence/facelab/face-count-neutral-curation-validation-20260905-v2.json";

const authority = JSON.parse(await text(authorityPath));
const acquisitionBytes = await read(acquisitionPath);
const acquisition = JSON.parse(acquisitionBytes.toString("utf8"));
const importEvidence = JSON.parse(await text(importEvidencePath));
const curation = JSON.parse(await text(curationPath));

const authorityValidation = validateNeutralFaceCountAuthority(authority);
must(
  authorityValidation.ok,
  `authority invalid: ${authorityValidation.errors.join(",")}`
);
must(authority.schemaVersion === "face-count-neutral-review-authority-v2", "active authority must be v2");
must(authority.authorityVersion === "2.0.0", "active authority version drift");
must(
  computeNeutralFaceCountAuthorityDigest(authority) === authority.authorityDigest,
  "authority digest mismatch"
);
must(
  sha256(acquisitionBytes) === authority.sourceAcquisitionManifestSha256,
  "acquisition manifest raw digest mismatch"
);
must(authority.orderedItems.length === ITEM_COUNT, "authority must contain eight items");
must(authority.reviewerUi.instruction === QUESTION, "review question wording drift");

must(acquisition.assetSetPolicy?.itemCount === ITEM_COUNT, "acquisition item-count policy drift");
must(acquisition.assetSetPolicy?.currentFaceLabHostedReviewAssetReuse === false, "hosted-review reuse must be false");
must(acquisition.assetSetPolicy?.syntheticCompositeAssets === false, "synthetic composites must be false");
must(acquisition.assetSetPolicy?.syntheticBlurAssets === false, "synthetic blur must be false");
must(acquisition.assets.length === ITEM_COUNT, "acquisition must contain eight assets");
must(importEvidence.assetCount === ITEM_COUNT, "import evidence must contain eight assets");

const acquisitionByFile = new Map(acquisition.assets.map((asset) => [asset.fileName, asset]));
const importedByFile = new Map(importEvidence.assets.map((asset) => [asset.fileName, asset]));
const curationById = new Map(curation.items.map((item) => [item.reviewItemId, item]));

must(curation.currentFaceLabHostedReviewAssetReuse === false, "curation hosted-review reuse must be false");
must(curation.syntheticCompositeAssets === false, "curation synthetic composites must be false");
must(curation.syntheticBlurAssets === false, "curation synthetic blur must be false");
must(curation.items.length === ITEM_COUNT, "curation must contain eight items");
must(curation.maxSingleBucket === 3, "curation max bucket drift");
must(
  JSON.stringify(curation.requiredDistribution) === JSON.stringify(EXPECTED_DISTRIBUTION),
  "required answer-bucket distribution drift"
);

for (const acquired of acquisition.assets) {
  mustNotContain(acquired.selectedSource || "", "/facelab/hosted-review/", "acquisition selected source");
  mustNotContain(acquired.fileName || "", "asset_", "natural Stage A filename");
}

for (const item of authority.orderedItems) {
  must(
    /^\/facelab\/neutral-review\/v2\/assets\/fcneutralv2_[0-9]{2}\.jpg$/.test(item.assetPath),
    `${item.reviewItemId}: must use physical v2 natural-review asset`
  );
  const fileName = path.basename(item.assetPath);
  const acquired = acquisitionByFile.get(fileName);
  const imported = importedByFile.get(fileName);
  const curated = curationById.get(item.reviewItemId);
  must(acquired, `missing acquisition entry for ${fileName}`);
  must(imported, `missing import evidence for ${fileName}`);
  must(curated, `missing curation entry for ${item.reviewItemId}`);

  const repoPath = `public${item.assetPath}`;
  const bytes = await read(repoPath);
  const digest = sha256(bytes);
  must(digest === item.assetSha256, `${fileName}: authority digest mismatch`);
  must(digest === acquired.sha256, `${fileName}: acquisition digest mismatch`);
  must(digest === imported.sha256, `${fileName}: import digest mismatch`);
  must(bytes.length === acquired.byteLength, `${fileName}: acquisition byte length mismatch`);
  must(bytes.length === imported.byteLength, `${fileName}: import byte length mismatch`);
  const metadata = imageMetadata(bytes);
  for (const evidence of [acquired, imported]) {
    must(metadata.mediaType === evidence.mediaType, `${fileName}: media type mismatch`);
    must(metadata.width === evidence.width, `${fileName}: width mismatch`);
    must(metadata.height === evidence.height, `${fileName}: height mismatch`);
  }

  if (typeof acquired.selectedSource === "string" && acquired.selectedSource.startsWith("repo://public/")) {
    const reusedPath = acquired.selectedSource.slice("repo://".length);
    const reusedBytes = await read(reusedPath);
    must(bytes.equals(reusedBytes), `${fileName}: governed neutral v1 byte reuse mismatch`);
  }
}

must(acquisitionByFile.size === ITEM_COUNT, "acquisition filenames must be unique");
must(importedByFile.size === ITEM_COUNT, "import evidence filenames must be unique");
must(curationById.size === ITEM_COUNT, "curation IDs must be unique");
const authorityIds = new Set(authority.orderedItems.map((item) => item.reviewItemId));
for (const reviewItemId of curationById.keys()) {
  must(authorityIds.has(reviewItemId), `${reviewItemId}: curation item is not authority-bound`);
}

const actualDistribution = { none: 0, one: 0, two_or_more: 0 };
for (const item of curation.items) {
  must(Object.hasOwn(actualDistribution, item.expectedClass), `${item.reviewItemId}: unsupported expected class`);
  actualDistribution[item.expectedClass] += 1;
}
must(
  JSON.stringify(actualDistribution) === JSON.stringify(EXPECTED_DISTRIBUTION),
  `semantic diversity collapse: ${JSON.stringify(actualDistribution)}`
);
must(Math.max(...Object.values(actualDistribution)) <= curation.maxSingleBucket, "single answer bucket dominates Stage A");
must(Object.values(actualDistribution).every((count) => count > 0), "all observable answer buckets must be represented");

const publicModel = getNeutralFaceCountPublicModel(authority, {
  accepted: true,
  hostedSessionId: "hsi_123e4567-e89b-42d3-a456-426614174000"
});
const reviewerMaterial = JSON.stringify(publicModel);
for (const forbidden of [
  "Earth_apollo17",
  "Full_moon",
  "Eisenhower",
  "Armstrong",
  "Aldrin",
  "Group_Portrait",
  "Apollo_11",
  "Mercury_Seven",
  "wikimedia",
  "expectedClass",
  "requiredDistribution",
  "naturalSceneClass",
  "groundTruth",
  "ground_truth",
  "expectedFaceCount"
]) {
  mustNotContain(reviewerMaterial, forbidden, "public reviewer model");
}
for (const item of authority.orderedItems) {
  mustNotContain(reviewerMaterial, item.assetSha256, "public reviewer model asset digest");
}
must(publicModel.items.length === ITEM_COUNT, "public model must expose exactly eight items");
must(publicModel.instruction === QUESTION, "public model question wording drift");
for (const item of publicModel.items) {
  must(
    JSON.stringify(Object.keys(item).sort()) === JSON.stringify(["assetPath", "reviewItemId"]),
    "public model item must expose only opaque id and asset path"
  );
  must(item.assetPath.startsWith("/facelab/neutral-review/v2/assets/"), "public model must use v2 assets");
}
must(publicModel.receiptAccepted === true, "receipt state projection failed");

const validPayload = {
  schemaVersion: "face-count-neutral-submission-v1",
  campaignKey: authority.campaignKey,
  intakeVersion: authority.intakeVersion,
  authorityDigest: authority.authorityDigest,
  sessionId: "hsi_123e4567-e89b-42d3-a456-426614174000",
  startedAt: "2026-09-01T00:00:00.000Z",
  clientSubmittedAt: "2026-09-01T00:01:00.000Z",
  independenceAttestation: authority.reviewerUi.requiredIndependenceAttestation,
  responses: authority.orderedItems.map((item, index) => ({
    reviewItemId: item.reviewItemId,
    response: authority.responseTokens[index % authority.responseTokens.length]
  })),
  completion: { completed: true, imageCount: ITEM_COUNT, responseCount: ITEM_COUNT }
};
must(validateNeutralFaceCountSubmission(validPayload, authority).ok, "valid neutral payload rejected");
must(
  !validateNeutralFaceCountSubmission({ ...validPayload, groundTruth: [0,1,2] }, authority).ok,
  "ground-truth-bearing payload must be rejected"
);
must(
  !validateNeutralFaceCountSubmission(
    { ...validPayload, responses: [...validPayload.responses].reverse() },
    authority
  ).ok,
  "response order drift must be rejected"
);

const intakeSource = await text("lib/face-lab-neutral-face-count-intake.js");
const neutralApiSource = await text("app/api/facelab/review/neutral/submit/route.js");
const hostedSubmitSource = await text("app/api/facelab/review/submit/route.js");
const reviewRouteSource = await text("app/facelab/review/route.js");
const neutralReviewHtmlSource = await text("lib/face-lab-neutral-face-count-review-html.js");
const migrationSource = await text("supabase/migrations/20260901012653_face_lab_neutral_face_count_intake_v1.sql");

mustContain(intakeSource, "face-count-neutral-review-authority-20260905-v2.json", "intake active authority");
mustContain(intakeSource, '"facelab_neutral_receipt_v1"', "intake");
mustContain(intakeSource, "createHmac", "intake");
mustContain(intakeSource, '.eq("submission_status", "submitted")', "intake");
mustContain(intakeSource, '.eq("session_id", parsed.sessionId)', "intake");
mustContain(intakeSource, '.eq("authority_digest", neutralAuthority.authorityDigest)', "intake");
mustContain(neutralApiSource, "setNeutralFaceCountReceiptCookie", "neutral api");
mustContain(neutralApiSource, "isValidHostedHumanCueAccessToken", "neutral api");
mustContain(neutralApiSource, "isSameOriginRequest", "neutral api");
mustContain(hostedSubmitSource, "requireVerifiedNeutralFaceCountReceipt", "hosted submit");
mustContain(hostedSubmitSource, "clearNeutralFaceCountReceiptCookie", "hosted submit");
must(
  hostedSubmitSource.indexOf("requireVerifiedNeutralFaceCountReceipt") <
    hostedSubmitSource.indexOf("persistHostedHumanCueSubmission({"),
  "neutral receipt gate must execute before hosted persistence"
);
mustContain(reviewRouteSource, "renderNeutralFaceCountReviewHtml", "review route");
mustContain(reviewRouteSource, "getVerifiedNeutralFaceCountReceiptState", "review route");
mustContain(neutralReviewHtmlSource, "1단계 · 중립 관찰", "neutral review html");
mustContain(neutralReviewHtmlSource, "먼저 8장의 이미지", "neutral review html");
mustContain(neutralReviewHtmlSource, 'byId("instruction").textContent=DATA.instruction', "neutral review html authority instruction binding");
mustContain(neutralReviewHtmlSource, "localStorage.setItem(STORAGE_KEY", "neutral review local state");
mustContain(neutralReviewHtmlSource, 'state.imageIndex===DATA.items.length-1?"1단계 제출"', "final submit button");
const fetchNeedle = "fetch(DATA.submitEndpoint";
must((neutralReviewHtmlSource.match(/fetch\(DATA\.submitEndpoint/g) || []).length === 1, "neutral submit endpoint must have one fetch call");
must(
  neutralReviewHtmlSource.indexOf(fetchNeedle) > neutralReviewHtmlSource.indexOf("async function submit()"),
  "neutral POST must exist only inside final submit function"
);
mustContain(neutralReviewHtmlSource, "independenceAttestation:DATA.attestationValue", "neutral review html");
mustContain(neutralReviewHtmlSource, "window.location.reload()", "neutral review html");

for (const forbidden of [
  "Earth_apollo17",
  "Full_moon",
  "Eisenhower",
  "Armstrong",
  "Aldrin",
  "Group_Portrait",
  "Apollo_11",
  "Mercury_Seven",
  "upload.wikimedia.org",
  "expectedClass",
  "requiredDistribution"
]) {
  mustNotContain(reviewRouteSource, forbidden, "review route source");
  mustNotContain(neutralReviewHtmlSource, forbidden, "neutral review html source");
}

mustContain(migrationSource, "enable row level security", "migration");
mustContain(migrationSource, "revoke all", "migration");
mustContain(migrationSource, "grant insert, select", "migration");
mustNotContain(migrationSource, "grant update", "migration");
mustNotContain(migrationSource, "grant delete", "migration");
mustNotContain(migrationSource, "ground_truth", "migration");
mustNotContain(migrationSource.toLowerCase(), "truncate ", "migration");

for (const bootstrapPath of [
  "scripts/acquire-face-count-neutral-assets-v1.mjs",
  ".github/workflows/face-count-neutral-asset-acquisition-v1.yml",
  ".github/workflows/tmp-neutral-asset03-import.yml",
  ".github/workflows/facelab-neutral-stage-a-natural-set-import.yml"
]) {
  let exists = true;
  try {
    await access(path.join(root, bootstrapPath));
  } catch {
    exists = false;
  }
  must(!exists, `${bootstrapPath}: bootstrap write path must not ship`);
}

console.log(JSON.stringify({
  status: "FACE_COUNT_NEUTRAL_SHARED_STAGE_V2_PASS",
  authorityDigest: authority.authorityDigest,
  acquisitionManifestSha256: authority.sourceAcquisitionManifestSha256,
  itemCount: authority.orderedItems.length,
  answerBucketDistribution: actualDistribution,
  currentFaceLabHostedReviewAssetReuse: false,
  syntheticCompositeAssets: false,
  syntheticBlurAssets: false,
  reviewerAssetDigestsExposed: false,
  finalSubmitOnlyPersistence: true,
  existingRowsResetOrDeleted: false,
  independenceAttestationRequired: true,
  productionSemanticAuthority: false,
  empiricalValidationEstablished: false
}));
