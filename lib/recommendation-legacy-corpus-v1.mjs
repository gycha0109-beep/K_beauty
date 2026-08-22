import fs from "node:fs";
import crypto from "node:crypto";

export const LEGACY_RECOMMENDATION_CORPUS_VERSION =
  "LEGACY_FROZEN_RECOMMENDATION_CORPUS_V1";
export const LEGACY_RECOMMENDATION_CORPUS_COUNT = 164;
export const LEGACY_RECOMMENDATION_CORPUS_SHA256 =
  "b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05";

const UUID_LOWERCASE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CORPUS_URL = new URL(
  "../fixtures/recommendation-governance/legacy-frozen-recommendation-corpus-v1.txt",
  import.meta.url,
);

const corpusText = fs.readFileSync(CORPUS_URL, "utf8");
const corpusHash = crypto.createHash("sha256").update(corpusText, "utf8").digest("hex");
if (corpusHash !== LEGACY_RECOMMENDATION_CORPUS_SHA256) {
  throw new Error("LEGACY_RECOMMENDATION_CORPUS_HASH_MISMATCH");
}
if (!corpusText.endsWith("\n")) {
  throw new Error("LEGACY_RECOMMENDATION_CORPUS_FINAL_LF_REQUIRED");
}

export const LEGACY_RECOMMENDATION_CORPUS_IDS = Object.freeze(
  corpusText.slice(0, -1).split("\n"),
);

if (LEGACY_RECOMMENDATION_CORPUS_IDS.length !== LEGACY_RECOMMENDATION_CORPUS_COUNT) {
  throw new Error("LEGACY_RECOMMENDATION_CORPUS_COUNT_MISMATCH");
}
if (new Set(LEGACY_RECOMMENDATION_CORPUS_IDS).size !== LEGACY_RECOMMENDATION_CORPUS_COUNT) {
  throw new Error("LEGACY_RECOMMENDATION_CORPUS_DUPLICATE_ID");
}
for (let index = 0; index < LEGACY_RECOMMENDATION_CORPUS_IDS.length; index += 1) {
  const id = LEGACY_RECOMMENDATION_CORPUS_IDS[index];
  if (!UUID_LOWERCASE_RE.test(id)) {
    throw new Error("LEGACY_RECOMMENDATION_CORPUS_ID_FORMAT_INVALID");
  }
  if (index > 0 && LEGACY_RECOMMENDATION_CORPUS_IDS[index - 1] >= id) {
    throw new Error("LEGACY_RECOMMENDATION_CORPUS_ORDER_INVALID");
  }
}

const legacyIdSet = new Set(LEGACY_RECOMMENDATION_CORPUS_IDS);

export function isExactLegacyRecommendationCorpusMember(productId) {
  return typeof productId === "string" && legacyIdSet.has(productId);
}
