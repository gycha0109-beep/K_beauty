import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const [outputPath] = process.argv.slice(2);
if (!outputPath) {
  throw new Error(
    "Usage: node scripts/build-face-lab-london-set-v5-figshare-metadata.mjs <output.json>"
  );
}

const ARTICLE_ID = 5047666;
const EXPECTED_VERSION = 5;
const EXPECTED_DOI = "10.6084/m9.figshare.5047666.v5";
const endpoint = "https://api.figshare.com/v2/articles/" + ARTICLE_ID;

function stableJson(value) {
  if (Array.isArray(value)) {
    return "[" + value.map((item) => stableJson(item)).join(",") + "]";
  }
  if (value !== null && typeof value === "object") {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stableJson(value[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 20000);
let response;
try {
  response = await fetch(endpoint, {
    headers: {
      accept: "application/json",
      "user-agent": "BEJEWELY-FaceLab-Research-Metadata/1.0"
    },
    signal: controller.signal
  });
} finally {
  clearTimeout(timeout);
}

if (!response.ok) {
  throw new Error(
    "london_set_v5_figshare_metadata_fetch_failed:" + response.status
  );
}

const article = await response.json();
if (article.id !== ARTICLE_ID) {
  throw new Error("london_set_v5_figshare_article_id_mismatch");
}
if (article.version !== EXPECTED_VERSION) {
  throw new Error(
    "london_set_v5_figshare_version_mismatch:" + String(article.version)
  );
}
if (String(article.doi || "").toLowerCase() !== EXPECTED_DOI) {
  throw new Error(
    "london_set_v5_figshare_doi_mismatch:" + String(article.doi)
  );
}
if (!Array.isArray(article.files) || article.files.length === 0) {
  throw new Error("london_set_v5_figshare_files_absent");
}

const files = article.files
  .map((file) => ({
    id: file.id,
    name: file.name,
    size: file.size,
    isLinkOnly: file.is_link_only === true,
    downloadUrl: file.download_url,
    suppliedMd5: file.supplied_md5 ?? null,
    computedMd5: file.computed_md5 ?? null
  }))
  .sort((a, b) => a.id - b.id);

const seen = new Set();
for (const file of files) {
  if (!Number.isInteger(file.id) || file.id <= 0) {
    throw new Error("london_set_v5_figshare_file_id_invalid");
  }
  if (seen.has(file.id)) {
    throw new Error("london_set_v5_figshare_file_id_duplicate:" + file.id);
  }
  seen.add(file.id);
  if (typeof file.name !== "string" || file.name.length === 0) {
    throw new Error("london_set_v5_figshare_file_name_invalid:" + file.id);
  }
  if (!Number.isInteger(file.size) || file.size < 0) {
    throw new Error("london_set_v5_figshare_file_size_invalid:" + file.id);
  }
  if (
    typeof file.downloadUrl !== "string" ||
    !file.downloadUrl.startsWith("https://")
  ) {
    throw new Error("london_set_v5_figshare_download_url_invalid:" + file.id);
  }
}

const source = {
  articleId: ARTICLE_ID,
  version: EXPECTED_VERSION,
  doi: EXPECTED_DOI,
  title: article.title,
  url: article.url_public_api ?? endpoint,
  publicUrl:
    article.url_public_html ??
    "https://figshare.com/articles/dataset/Face_Research_Lab_London_Set/5047666",
  license: article.license
    ? {
        id: article.license.id ?? null,
        name: article.license.name ?? null,
        url: article.license.url ?? null
      }
    : null,
  publishedDate: article.published_date ?? null,
  modifiedDate: article.modified_date ?? null
};

const digestPayload = { source, files };
const output = {
  schemaVersion: "face-lab-london-set-v5-figshare-source-metadata-v0",
  status: "metadata_only_exact_source_inventory",
  sourceMetadataDigest:
    "sha256:" +
    createHash("sha256").update(stableJson(digestPayload)).digest("hex"),
  source,
  fileCount: files.length,
  totalFileBytes: files.reduce((sum, file) => sum + file.size, 0),
  files,
  acquisition: {
    metadataEndpointOnly: true,
    rawImageBytesDownloaded: false,
    rawImageBytesPersisted: false,
    fileContentInspected: false
  },
  privacy: {
    rawImagesPersisted: false,
    rawLandmarksPersisted: false,
    identityEmbeddingCreated: false,
    biometricIdentityMatchPerformed: false,
    localImagePathsIncluded: false
  },
  authority: {
    productionAuthority: false,
    normalizationAuthority: false,
    thresholdAuthority: false,
    adequacyDecisionAuthority: false
  }
};

writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(
  JSON.stringify(
    {
      ok: true,
      articleId: ARTICLE_ID,
      version: EXPECTED_VERSION,
      fileCount: output.fileCount,
      totalFileBytes: output.totalFileBytes,
      sourceMetadataDigest: output.sourceMetadataDigest,
      rawImageBytesDownloaded: false,
      productionAuthority: false
    },
    null,
    2
  )
);
