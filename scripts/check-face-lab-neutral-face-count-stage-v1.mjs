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

function imageMetadata(bytes) {
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return {
      mediaType: "image/png",
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20)
    };
  }
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("unsupported image format");
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
    const sof = [
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
      0xce, 0xcf
    ].includes(marker);
    if (sof) {
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
  "evidence/facelab/face-count-neutral-review-authority-20260831-v1.json";
const acquisitionPath =
  "evidence/facelab/face-count-neutral-source-acquisition-20260831-v1.json";
const authority = JSON.parse(await text(authorityPath));
const acquisitionBytes = await read(acquisitionPath);
const acquisition = JSON.parse(acquisitionBytes.toString("utf8"));

const authorityValidation = validateNeutralFaceCountAuthority(authority);
must(
  authorityValidation.ok,
  `authority invalid: ${authorityValidation.errors.join(",")}`
);
must(
  computeNeutralFaceCountAuthorityDigest(authority) === authority.authorityDigest,
  "authority digest mismatch"
);
must(
  sha256(acquisitionBytes) === authority.sourceAcquisitionManifestSha256,
  "acquisition manifest raw digest mismatch"
);
must(
  acquisition.assets.length === authority.orderedItems.length,
  "asset count mismatch"
);
must(authority.orderedItems.length === ITEM_COUNT, "authority must contain eight items");
must(authority.reviewerUi.instruction === QUESTION, "review question wording drift");

const acquisitionByFile = new Map(
  acquisition.assets.map((asset) => [asset.fileName, asset])
);
for (const item of authority.orderedItems) {
  const fileName = path.basename(item.assetPath);
  const acquired = acquisitionByFile.get(fileName);
  must(acquired, `missing acquisition entry for ${fileName}`);
  const repoPath = `public/facelab/neutral-review/v1/assets/${fileName}`;
  const bytes = await read(repoPath);
  must(sha256(bytes) === item.assetSha256, `${fileName}: authority digest mismatch`);
  must(sha256(bytes) === acquired.sha256, `${fileName}: acquisition digest mismatch`);
  must(bytes.length === acquired.byteLength, `${fileName}: byte length mismatch`);
  const metadata = imageMetadata(bytes);
  must(metadata.mediaType === acquired.mediaType, `${fileName}: media type mismatch`);
  must(metadata.width === acquired.width, `${fileName}: width mismatch`);
  must(metadata.height === acquired.height, `${fileName}: height mismatch`);
  if (
    typeof acquired.originalUrl === "string" &&
    acquired.originalUrl.startsWith("/facelab/hosted-review/v1/assets/")
  ) {
    const governedSourceBytes = await read(`public${acquired.originalUrl}`);
    must(
      bytes.equals(governedSourceBytes),
      `${fileName}: governed source byte reuse mismatch`
    );
  }
}

const publicModel = getNeutralFaceCountPublicModel(authority, {
  accepted: true,
  hostedSessionId: "hsi_123e4567-e89b-42d3-a456-426614174000"
});
const reviewerMaterial = JSON.stringify(publicModel);
for (const forbidden of [
  "Earth_apollo17",
  "Eisenhower",
  "Group_Portrait",
  "HistoryTrustSA",
  "wikimedia",
  "face-lab-independent-human-cue-single-hosted-set",
  "asset_004581",
  "asset_445922",
  "asset_4a631",
  "asset_4c9d",
  "asset_565547",
  "groundTruth",
  "ground_truth",
  "expectedFaceCount"
]) {
  mustNotContain(reviewerMaterial, forbidden, "public reviewer model");
}
for (const item of authority.orderedItems) {
  mustNotContain(
    reviewerMaterial,
    item.assetSha256,
    "public reviewer model asset digest"
  );
}
must(
  publicModel.items.length === ITEM_COUNT,
  "public model must expose exactly eight items"
);
must(publicModel.instruction === QUESTION, "public model question wording drift");
for (const item of publicModel.items) {
  must(
    JSON.stringify(Object.keys(item).sort()) ===
      JSON.stringify(["assetPath", "reviewItemId"]),
    "public model item must expose only opaque id and asset path"
  );
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
  completion: {
    completed: true,
    imageCount: ITEM_COUNT,
    responseCount: ITEM_COUNT
  }
};
must(
  validateNeutralFaceCountSubmission(validPayload, authority).ok,
  "valid neutral payload rejected"
);
must(
  !validateNeutralFaceCountSubmission(
    { ...validPayload, groundTruth: [0, 1, 2] },
    authority
  ).ok,
  "ground-truth-bearing payload must be rejected"
);
must(
  !validateNeutralFaceCountSubmission(
    {
      ...validPayload,
      independenceAttestation: {
        ...validPayload.independenceAttestation,
        automatedAnalysisResultsNotViewed: false
      }
    },
    authority
  ).ok,
  "changed independence attestation must be rejected"
);
const { independenceAttestation: _removedAttestation, ...withoutAttestation } =
  validPayload;
must(
  !validateNeutralFaceCountSubmission(withoutAttestation, authority).ok,
  "missing independence attestation must be rejected"
);
must(
  !validateNeutralFaceCountSubmission(
    { ...validPayload, responses: [...validPayload.responses].reverse() },
    authority
  ).ok,
  "response order drift must be rejected"
);

const intakeSource = await text("lib/face-lab-neutral-face-count-intake.js");
const neutralApiSource = await text(
  "app/api/facelab/review/neutral/submit/route.js"
);
const hostedSubmitSource = await text("app/api/facelab/review/submit/route.js");
const reviewRouteSource = await text("app/facelab/review/route.js");
const neutralReviewHtmlSource = await text(
  "lib/face-lab-neutral-face-count-review-html.js"
);
const migrationSource = await text(
  "supabase/migrations/20260901012653_face_lab_neutral_face_count_intake_v1.sql"
);

mustContain(intakeSource, '"facelab_neutral_receipt_v1"', "intake");
mustContain(intakeSource, "createHmac", "intake");
mustContain(
  intakeSource,
  '.eq("submission_status", "submitted")',
  "intake"
);
mustContain(
  intakeSource,
  '.eq("session_id", parsed.sessionId)',
  "intake"
);
mustContain(
  intakeSource,
  '.eq("authority_digest", neutralAuthority.authorityDigest)',
  "intake"
);
mustContain(
  neutralApiSource,
  "setNeutralFaceCountReceiptCookie",
  "neutral api"
);
mustContain(
  neutralApiSource,
  "isValidHostedHumanCueAccessToken",
  "neutral api"
);
mustContain(neutralApiSource, "isSameOriginRequest", "neutral api");
mustContain(
  hostedSubmitSource,
  "requireVerifiedNeutralFaceCountReceipt",
  "hosted submit"
);
mustContain(
  hostedSubmitSource,
  "clearNeutralFaceCountReceiptCookie",
  "hosted submit"
);
must(
  hostedSubmitSource.indexOf("requireVerifiedNeutralFaceCountReceipt") <
    hostedSubmitSource.indexOf("persistHostedHumanCueSubmission({"),
  "neutral receipt gate must execute before hosted persistence"
);
mustContain(
  hostedSubmitSource,
  "if (!testSubmission)",
  "hosted submit test boundary"
);
mustContain(
  reviewRouteSource,
  "renderNeutralFaceCountReviewHtml",
  "review route"
);
mustContain(
  reviewRouteSource,
  "getVerifiedNeutralFaceCountReceiptState",
  "review route"
);
mustContain(
  reviewRouteSource,
  "receiptState.hostedSessionId",
  "review route"
);
mustContain(
  neutralReviewHtmlSource,
  "1단계 · 중립 관찰",
  "neutral review html"
);
mustContain(
  neutralReviewHtmlSource,
  "먼저 8장의 이미지",
  "neutral review html"
);
mustContain(
  neutralReviewHtmlSource,
  'byId("instruction").textContent=DATA.instruction',
  "neutral review html authority instruction binding"
);
mustContain(
  neutralReviewHtmlSource,
  "independenceAttestation:DATA.attestationValue",
  "neutral review html"
);
mustContain(
  neutralReviewHtmlSource,
  "window.location.reload()",
  "neutral review html"
);
for (const forbidden of [
  "Earth_apollo17",
  "Eisenhower",
  "Group_Portrait",
  "HistoryTrustSA",
  "upload.wikimedia.org",
  "asset_004581",
  "asset_445922",
  "asset_4a631",
  "asset_4c9d",
  "asset_565547"
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

for (const bootstrapPath of [
  "scripts/acquire-face-count-neutral-assets-v1.mjs",
  ".github/workflows/face-count-neutral-asset-acquisition-v1.yml",
  ".github/workflows/tmp-neutral-asset03-import.yml"
]) {
  let exists = true;
  try {
    await access(path.join(root, bootstrapPath));
  } catch {
    exists = false;
  }
  must(!exists, `${bootstrapPath}: bootstrap write path must not ship`);
}

for (const forbiddenAsset of [
  "public/facelab/neutral-review/v1/assets/asset_ae76a5be54f53cca50074a0d.jpg",
  "public/facelab/neutral-review/v1/assets/asset_a48278513a38768ff9224797.jpg",
  "public/facelab/neutral-review/v1/assets/asset_1131e5923243d08050e20666.jpg",
  "public/facelab/neutral-review/v1/assets/asset_5427892220dadebde0c91bde.jpg"
]) {
  let exists = true;
  try {
    await access(path.join(root, forbiddenAsset));
  } catch {
    exists = false;
  }
  must(!exists, `${forbiddenAsset}: digest-bearing or superseded public filename must not ship`);
}

console.log(
  JSON.stringify({
    status: "FACE_COUNT_NEUTRAL_SHARED_STAGE_V1_PASS",
    authorityDigest: authority.authorityDigest,
    acquisitionManifestSha256: authority.sourceAcquisitionManifestSha256,
    itemCount: authority.orderedItems.length,
    assets: authority.orderedItems.map((item) => {
      const acquired = acquisitionByFile.get(path.basename(item.assetPath));
      return {
        reviewItemId: item.reviewItemId,
        sha256: item.assetSha256,
        byteLength: acquired.byteLength,
        width: acquired.width,
        height: acquired.height,
        mediaType: acquired.mediaType,
        governedRepoReuse:
          typeof acquired.originalUrl === "string" &&
          acquired.originalUrl.startsWith("/facelab/hosted-review/v1/assets/")
      };
    }),
    reviewerAssetDigestsExposed: false,
    independenceAttestationRequired: true,
    productionSemanticAuthority: false,
    empiricalValidationEstablished: false
  })
);
