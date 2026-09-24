import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const [outputPath] = process.argv.slice(2);
assert.ok(
  outputPath,
  "Usage: node scripts/build-face-lab-pointing04-source-metadata.mjs <output.json>"
);

const ARTICLE_ID = 5142466;
const EXPECTED_VERSION = 2;
const EXPECTED_DOI = "10.6084/m9.figshare.5142466.v2";
const ENDPOINT = "https://api.figshare.com/v2/articles/" + ARTICLE_ID;
const LEGACY_SOURCE_PAGE =
  "http://www-prima.inrialpes.fr/Pointing04/data-face.html";

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

const response = await fetch(ENDPOINT, {
  headers: {
    accept: "application/json",
    "user-agent": "BEJEWELY-FaceLab-Research-Metadata/1.0"
  },
  signal: AbortSignal.timeout(20_000)
});

assert.equal(
  response.ok,
  true,
  "pointing04_figshare_metadata_fetch_failed:" + response.status
);

const article = await response.json();

assert.equal(
  article.id,
  ARTICLE_ID,
  "pointing04_figshare_article_id_mismatch"
);
assert.equal(
  article.version,
  EXPECTED_VERSION,
  "pointing04_figshare_version_mismatch"
);
assert.equal(
  String(article.doi || "").toLowerCase(),
  EXPECTED_DOI,
  "pointing04_figshare_doi_mismatch"
);
assert.equal(
  article.title,
  "Pointing04 DB",
  "pointing04_figshare_title_mismatch"
);
assert.ok(
  Array.isArray(article.files) && article.files.length > 0,
  "pointing04_figshare_files_absent"
);

const description = String(article.description || "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/\s+/g, " ")
  .trim();

assert.match(
  description,
  /Estimating Face Orientation from Robust Detection of Salient Facial Features/i,
  "pointing04_required_citation_claim_missing"
);

const license = article.license
  ? {
      id: article.license.id ?? null,
      name: article.license.name ?? null,
      url: article.license.url ?? null
    }
  : null;

assert.ok(license, "pointing04_license_missing");
assert.ok(
  /CC BY/i.test(String(license.name || "")) ||
    /creativecommons\.org\/licenses\/by\/4\.0/i.test(
      String(license.url || "")
    ),
  "pointing04_license_not_cc_by"
);

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
  assert.ok(
    Number.isInteger(file.id) && file.id > 0,
    "pointing04_figshare_file_id_invalid"
  );
  assert.equal(
    seen.has(file.id),
    false,
    "pointing04_figshare_file_id_duplicate:" + file.id
  );
  seen.add(file.id);
  assert.ok(
    typeof file.name === "string" && file.name.length > 0,
    "pointing04_figshare_file_name_invalid:" + file.id
  );
  assert.ok(
    Number.isInteger(file.size) && file.size >= 0,
    "pointing04_figshare_file_size_invalid:" + file.id
  );
  assert.ok(
    typeof file.downloadUrl === "string" &&
      file.downloadUrl.startsWith("https://"),
    "pointing04_figshare_download_url_invalid:" + file.id
  );
}

const source = {
  datasetName: "Pointing'04 Head Pose Image Database",
  articleId: ARTICLE_ID,
  version: EXPECTED_VERSION,
  doi: EXPECTED_DOI,
  title: article.title,
  publicUrl:
    article.url_public_html ??
    "https://figshare.com/articles/dataset/Pointing04_DB/5142466",
  apiUrl: article.url_public_api ?? ENDPOINT,
  legacySourcePage: LEGACY_SOURCE_PAGE,
  license,
  publishedDate: article.published_date ?? null,
  modifiedDate: article.modified_date ?? null,
  citation: {
    required: true,
    article:
      "Estimating Face Orientation from Robust Detection of Salient Facial Features"
  },
  usageSemantics: {
    figshareLicenseIsCcBy: true,
    standardizedLicensePresent: true,
    legacyAnyPurposeClaimNotUsedAsTransportAuthority: true
  }
};

const digestPayload = { source, files };

const output = {
  schemaVersion: "face-lab-pointing04-source-metadata-v0",
  status: "figshare_metadata_only_exact_source_inventory",
  sourceMetadataDigest:
    "sha256:" +
    createHash("sha256").update(stableJson(digestPayload)).digest("hex"),
  source,
  fileCount: files.length,
  totalFileBytes: files.reduce((sum, file) => sum + file.size, 0),
  files,
  acquisition: {
    metadataEndpointOnly: true,
    archiveBytesDownloaded: false,
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
      licenseName: license.name,
      rawImageBytesDownloaded: false,
      productionAuthority: false
    },
    null,
    2
  )
);
