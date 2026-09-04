import { createHash } from "node:crypto";

export const NEUTRAL_FACE_COUNT_SUBMISSION_SCHEMA_VERSION =
  "face-count-neutral-submission-v1";
export const NEUTRAL_FACE_COUNT_ACCESS_MODE = "shared_opaque_link";
export const NEUTRAL_FACE_COUNT_TABLE =
  "tmp_face_lab_neutral_face_count_submissions";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SESSION_PATTERN = /^hsi_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NEUTRAL_ITEM_COUNT = 8;
const RESPONSE_TOKENS = ["none", "one", "two_or_more", "not_assessable"];
const EXACT_QUESTION =
  "눈, 코, 입 등 얼굴의 정확한 특징을 판별할 수 있을 정도로 보이는 사람은 몇 명인가요?";

export function stableStringifyNeutralFaceCountValue(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringifyNeutralFaceCountValue).join(",")}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringifyNeutralFaceCountValue(value[key])}`
    )
    .join(",")}}`;
}

export function sha256NeutralFaceCountValue(value) {
  return createHash("sha256")
    .update(stableStringifyNeutralFaceCountValue(value), "utf8")
    .digest("hex");
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isCanonicalIso(value) {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
}

export function computeNeutralFaceCountAuthorityDigest(authority) {
  const { authorityDigest: _ignored, ...material } = authority;
  return sha256NeutralFaceCountValue(material);
}

function validateV1Items(items, errors) {
  const ids = new Set();
  const paths = new Set();
  const digests = new Set();
  for (const item of items) {
    if (!exactKeys(item, ["reviewItemId", "assetPath", "assetSha256"])) errors.push("item_shape");
    if (typeof item.reviewItemId !== "string" || !/^fcneutral_[0-9]{2}$/.test(item.reviewItemId)) errors.push("item_id");
    if (typeof item.assetPath !== "string" || !/^\/facelab\/neutral-review\/v1\/assets\/fcneutral_[0-9]{2}\.(?:jpg|png)$/.test(item.assetPath)) errors.push("asset_path");
    if (!SHA256_PATTERN.test(item.assetSha256 || "")) errors.push("asset_digest");
    ids.add(item.reviewItemId);
    paths.add(item.assetPath);
    digests.add(item.assetSha256);
  }
  if (ids.size !== NEUTRAL_ITEM_COUNT || paths.size !== NEUTRAL_ITEM_COUNT || digests.size !== NEUTRAL_ITEM_COUNT) {
    errors.push("item_uniqueness");
  }
}

function validateV2Items(items, errors) {
  const ids = new Set();
  const referencedPaths = new Set();
  for (const item of items) {
    if (!exactKeys(item, ["reviewItemId", "presentation"])) errors.push("item_shape");
    if (typeof item.reviewItemId !== "string" || !/^fcneutralv2_[0-9]{2}$/.test(item.reviewItemId)) errors.push("item_id");
    ids.add(item.reviewItemId);
    const presentation = item.presentation;
    const mode = presentation?.mode;
    const expectedKeys = mode === "obscured_single"
      ? ["mode", "assetPaths", "blurPx"]
      : ["mode", "assetPaths"];
    if (!exactKeys(presentation, expectedKeys)) errors.push("presentation_shape");
    if (!["single", "obscured_single", "composite"].includes(mode)) errors.push("presentation_mode");
    const assetPaths = presentation?.assetPaths;
    const expectedLength = mode === "composite" ? [2, 3] : [1];
    if (!Array.isArray(assetPaths) || !expectedLength.includes(assetPaths.length)) {
      errors.push("presentation_asset_count");
      continue;
    }
    for (const assetPath of assetPaths) {
      if (
        typeof assetPath !== "string" ||
        !/^\/facelab\/(?:neutral-review\/v1|hosted-review\/v1)\/assets\/[A-Za-z0-9_.-]+\.(?:jpg|png)$/.test(assetPath)
      ) errors.push("presentation_asset_path");
      referencedPaths.add(assetPath);
    }
    if (mode === "obscured_single" && (!Number.isInteger(presentation.blurPx) || presentation.blurPx < 20 || presentation.blurPx > 48)) {
      errors.push("presentation_blur");
    }
  }
  if (ids.size !== NEUTRAL_ITEM_COUNT) errors.push("item_uniqueness");
  if (referencedPaths.size < 8) errors.push("source_diversity");
}

export function validateNeutralFaceCountAuthority(authority) {
  const errors = [];
  if (!authority || typeof authority !== "object" || Array.isArray(authority)) {
    return { ok: false, errors: ["authority_object_required"] };
  }
  if (!exactKeys(authority, [
    "schemaVersion",
    "authorityRef",
    "authorityVersion",
    "campaignKey",
    "intakeVersion",
    "storageSchemaVersion",
    "sourceAcquisitionManifestSha256",
    "responseTokens",
    "orderedItems",
    "reviewerUi",
    "authorityBoundary",
    "authorityDigest"
  ])) errors.push("authority_shape");

  const isV1 = authority.schemaVersion === "face-count-neutral-review-authority-v1";
  const isV2 = authority.schemaVersion === "face-count-neutral-review-authority-v2";
  if (!isV1 && !isV2) errors.push("schema_version");
  if (isV1) {
    if (authority.authorityRef !== "authority.facelab.neutral_face_count.shared_review.v1") errors.push("authority_ref");
    if (authority.authorityVersion !== "1.1.0") errors.push("authority_version");
    if (authority.campaignKey !== "face_count_neutral_shared_review_v1") errors.push("campaign_key");
    if (authority.intakeVersion !== "face-count-neutral-intake-v1") errors.push("intake_version");
  }
  if (isV2) {
    if (authority.authorityRef !== "authority.facelab.neutral_face_count.shared_review.v2") errors.push("authority_ref");
    if (authority.authorityVersion !== "2.0.0") errors.push("authority_version");
    if (authority.campaignKey !== "face_count_neutral_shared_review_v2") errors.push("campaign_key");
    if (authority.intakeVersion !== "face-count-neutral-intake-v2") errors.push("intake_version");
  }
  if (authority.storageSchemaVersion !== "face-count-neutral-storage-v1") errors.push("storage_schema_version");
  if (!SHA256_PATTERN.test(authority.sourceAcquisitionManifestSha256 || "")) errors.push("source_manifest_digest");
  if (!SHA256_PATTERN.test(authority.authorityDigest || "")) errors.push("authority_digest_format");
  if (computeNeutralFaceCountAuthorityDigest(authority) !== authority.authorityDigest) errors.push("authority_digest_mismatch");
  if (JSON.stringify(authority.responseTokens) !== JSON.stringify(RESPONSE_TOKENS)) errors.push("response_tokens");

  if (!Array.isArray(authority.orderedItems) || authority.orderedItems.length !== NEUTRAL_ITEM_COUNT) {
    errors.push("ordered_items");
  } else if (isV1) {
    validateV1Items(authority.orderedItems, errors);
  } else if (isV2) {
    validateV2Items(authority.orderedItems, errors);
  }

  const ui = authority.reviewerUi;
  if (!exactKeys(ui, [
    "title",
    "instruction",
    "responseLabels",
    "attestationCopy",
    "requiredIndependenceAttestation"
  ])) errors.push("reviewer_ui_shape");
  if (ui?.instruction !== EXACT_QUESTION) errors.push("instruction");
  const labels = ui?.responseLabels;
  if (!labels || Object.keys(labels).sort().join("|") !== [...RESPONSE_TOKENS].sort().join("|")) errors.push("response_labels");

  const attestationKeys = [
    "sourceOrAnswerInformationNotViewed",
    "automatedAnalysisResultsNotViewed",
    "otherParticipantResponsesNotViewed",
    "visibleHumanFaceCountOnly",
    "sensitiveIdentityInferenceNotPerformed"
  ];
  if (!exactKeys(ui?.attestationCopy, attestationKeys)) errors.push("attestation_copy_shape");
  if (!exactKeys(ui?.requiredIndependenceAttestation, attestationKeys)) errors.push("attestation_value_shape");
  for (const key of attestationKeys) {
    if (typeof ui?.attestationCopy?.[key] !== "string" || ui.attestationCopy[key].length < 5) errors.push(`attestation_copy_${key}`);
    if (ui?.requiredIndependenceAttestation?.[key] !== true) errors.push(`attestation_value_${key}`);
  }

  const boundary = authority.authorityBoundary;
  for (const key of [
    "expectedFaceCountLabelsIncluded",
    "sourceNamesIncludedInReviewerModel",
    "assetDigestsIncludedInReviewerModel",
    "traditionalSemanticAuthority",
    "providerInferenceAuthority",
    "empiricalValidationEstablished"
  ]) {
    if (boundary?.[key] !== false) errors.push(`authority_boundary_${key}`);
  }

  const serialized = stableStringifyNeutralFaceCountValue(authority);
  for (const forbidden of [
    "Earth_apollo17",
    "Eisenhower",
    "Group_Portrait",
    "HistoryTrustSA",
    "groundTruth",
    "ground_truth",
    "expectedClass",
    "requiredDistribution"
  ]) {
    if (serialized.includes(forbidden)) errors.push(`forbidden_reviewer_authority_${forbidden}`);
  }

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function getNeutralFaceCountPublicModel(authority, receiptState = null) {
  const validation = validateNeutralFaceCountAuthority(authority);
  if (!validation.ok) throw new Error(`neutral_face_count_authority_invalid:${validation.errors.join(",")}`);
  const isV2 = authority.schemaVersion === "face-count-neutral-review-authority-v2";
  return {
    schemaVersion: authority.schemaVersion,
    campaignKey: authority.campaignKey,
    intakeVersion: authority.intakeVersion,
    authorityDigest: authority.authorityDigest,
    responseTokens: [...authority.responseTokens],
    responseLabels: { ...authority.reviewerUi.responseLabels },
    title: authority.reviewerUi.title,
    instruction: authority.reviewerUi.instruction,
    attestationCopy: { ...authority.reviewerUi.attestationCopy },
    attestationValue: { ...authority.reviewerUi.requiredIndependenceAttestation },
    items: authority.orderedItems.map((item) => ({
      reviewItemId: item.reviewItemId,
      assetPath: isV2
        ? `/api/facelab/review/neutral/visual/${item.reviewItemId}`
        : item.assetPath
    })),
    receiptAccepted: receiptState?.accepted === true,
    hostedSessionId:
      receiptState?.accepted === true && typeof receiptState.hostedSessionId === "string"
        ? receiptState.hostedSessionId
        : null,
    submitEndpoint: "/api/facelab/review/neutral/submit"
  };
}

export function validateNeutralFaceCountSubmission(payload, authority) {
  const errors = [];
  const authorityValidation = validateNeutralFaceCountAuthority(authority);
  if (!authorityValidation.ok) return { ok: false, errors: ["authority_invalid"] };
  if (!exactKeys(payload, [
    "schemaVersion",
    "campaignKey",
    "intakeVersion",
    "authorityDigest",
    "sessionId",
    "startedAt",
    "clientSubmittedAt",
    "independenceAttestation",
    "responses",
    "completion"
  ])) return { ok: false, errors: ["payload_shape"] };

  if (payload.schemaVersion !== NEUTRAL_FACE_COUNT_SUBMISSION_SCHEMA_VERSION) errors.push("schema_version");
  if (payload.campaignKey !== authority.campaignKey) errors.push("campaign_key");
  if (payload.intakeVersion !== authority.intakeVersion) errors.push("intake_version");
  if (payload.authorityDigest !== authority.authorityDigest) errors.push("authority_digest");
  if (!SESSION_PATTERN.test(payload.sessionId || "")) errors.push("session_id");
  if (!isCanonicalIso(payload.startedAt)) errors.push("started_at");
  if (!isCanonicalIso(payload.clientSubmittedAt)) errors.push("client_submitted_at");
  if (isCanonicalIso(payload.startedAt) && isCanonicalIso(payload.clientSubmittedAt) && payload.startedAt > payload.clientSubmittedAt) errors.push("timeline");
  if (
    stableStringifyNeutralFaceCountValue(payload.independenceAttestation) !==
    stableStringifyNeutralFaceCountValue(authority.reviewerUi.requiredIndependenceAttestation)
  ) errors.push("independence_attestation");

  if (!Array.isArray(payload.responses) || payload.responses.length !== authority.orderedItems.length) {
    errors.push("responses");
  } else {
    const seen = new Set();
    payload.responses.forEach((response, index) => {
      if (!exactKeys(response, ["reviewItemId", "response"])) errors.push("response_shape");
      const expectedItem = authority.orderedItems[index];
      if (response.reviewItemId !== expectedItem.reviewItemId) errors.push("response_order_binding");
      if (!authority.responseTokens.includes(response.response)) errors.push("response_token");
      seen.add(response.reviewItemId);
    });
    if (seen.size !== authority.orderedItems.length) errors.push("response_uniqueness");
  }

  if (!exactKeys(payload.completion, ["completed", "imageCount", "responseCount"])) {
    errors.push("completion_shape");
  } else {
    if (payload.completion.completed !== true) errors.push("completion_flag");
    if (payload.completion.imageCount !== authority.orderedItems.length) errors.push("completion_image_count");
    if (payload.completion.responseCount !== authority.orderedItems.length) errors.push("completion_response_count");
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
