import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const [outputPath] = process.argv.slice(2);
assert.ok(
  outputPath,
  "Usage: node scripts/build-face-lab-pointing04-source-metadata.mjs <output.json>"
);

const DATA_PAGE =
  "https://crowley-coutaz.fr/Pointing04/data-face.html";
const TERMS_PAGE =
  "https://crowley-coutaz.fr/Head%20Pose%20Image%20Database.html";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

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

function textOnly(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "BEJEWELY-FaceLab-Research-Metadata/1.0"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000)
  });
  assert.equal(
    response.ok,
    true,
    "pointing04_page_fetch_failed:" + url + ":" + response.status
  );
  const html = await response.text();
  assert.ok(html.length > 1000, "pointing04_page_too_small:" + url);
  return {
    requestedUrl: url,
    finalUrl: response.url,
    html
  };
}

const [dataPage, termsPage] = await Promise.all([
  fetchText(DATA_PAGE),
  fetchText(TERMS_PAGE)
]);

const dataText = textOnly(dataPage.html);
const termsText = textOnly(termsPage.html);

assert.match(
  dataText,
  /head pose database consists of 15 sets of images/i
);
assert.match(
  dataText,
  /2 series of 93 images/i
);
assert.match(
  dataText,
  /VerticalAngle\s*=\s*\{-90,\s*-60,\s*-30,\s*-15,\s*0,\s*\+15,\s*\+30,\s*\+60,\s*\+90\}/i
);
assert.match(
  dataText,
  /HorizontalAngle\s*=\s*\{-90,\s*-75,\s*-60,\s*-45,\s*-30,\s*-15,\s*0,\s*\+15,\s*\+30,\s*\+45,\s*\+60,\s*\+75,\s*\+90\}/i
);
assert.match(
  termsText,
  /This database can be used for any purpose/i
);
assert.match(
  termsText,
  /provided that the following article is cited/i
);

const anchors = [];
const anchorRegex =
  /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
let match;
while ((match = anchorRegex.exec(dataPage.html)) !== null) {
  const href = match[1].trim();
  const label = textOnly(match[2]);
  const personMatch = /^Person(\d{2})-([12])$/i.exec(label);
  if (!personMatch) continue;

  const subject = personMatch[1];
  const series = Number(personMatch[2]);
  const archiveUrl = new URL(href, dataPage.finalUrl).toString();
  const pathname = new URL(archiveUrl).pathname;
  const fileName = decodeURIComponent(pathname.split("/").filter(Boolean).at(-1));

  anchors.push({
    subjectId: subject,
    series,
    label,
    fileName,
    archiveUrl
  });
}

anchors.sort(
  (a, b) =>
    a.subjectId.localeCompare(b.subjectId) ||
    a.series - b.series
);

assert.equal(
  anchors.length,
  30,
  "pointing04_person_archive_count_invalid:" + anchors.length
);

const expected = [];
for (let subject = 1; subject <= 15; subject += 1) {
  const subjectId = String(subject).padStart(2, "0");
  for (const series of [1, 2]) {
    expected.push(subjectId + "-" + series);
  }
}
assert.deepEqual(
  anchors.map((row) => row.subjectId + "-" + row.series),
  expected
);
assert.equal(new Set(anchors.map((row) => row.archiveUrl)).size, 30);

for (const archive of anchors) {
  assert.match(archive.archiveUrl, /^https?:\/\//);
  assert.match(
    archive.fileName,
    /^Person\d{2}-[12]\.tar\.gz$/i
  );
}

const source = {
  datasetName: "Pointing'04 Head Pose Image Database",
  dataPage: dataPage.finalUrl,
  termsPage: termsPage.finalUrl,
  dataPageSha256: "sha256:" + sha256(dataPage.html),
  termsPageSha256: "sha256:" + sha256(termsPage.html),
  citation: {
    required: true,
    article:
      "Estimating Face Orientation from Robust Detection of Salient Facial Features",
    venue:
      "Pointing 2004, ICPR International Workshop on Visual Observation of Deictic Gestures"
  },
  usageTerms: {
    standardizedLicenseIdentifier: null,
    explicitAnyPurposeUse: true,
    citationRequired: true,
    redistributionAuthorityInferred: false
  },
  structure: {
    subjectCount: 15,
    seriesPerSubject: 2,
    imagesPerSeries: 93,
    totalImages: 2790,
    poseAxes: ["tilt", "pan"],
    tiltDegrees: [-90, -60, -30, -15, 0, 15, 30, 60, 90],
    panDegrees: [-90, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90]
  }
};

const digestPayload = {
  source,
  archives: anchors
};

const output = {
  schemaVersion: "face-lab-pointing04-source-metadata-v0",
  status: "metadata_only_exact_source_inventory",
  sourceMetadataDigest:
    "sha256:" +
    createHash("sha256").update(stableJson(digestPayload)).digest("hex"),
  source,
  archiveCount: anchors.length,
  archives: anchors,
  acquisition: {
    metadataPagesFetched: true,
    archiveBytesDownloaded: false,
    rawImageBytesDownloaded: false,
    rawImageBytesPersisted: false
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
    adequacyDecisionAuthority: false,
    redistributionAuthority: false
  }
};

writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      archiveCount: output.archiveCount,
      sourceMetadataDigest: output.sourceMetadataDigest,
      explicitAnyPurposeUse:
        output.source.usageTerms.explicitAnyPurposeUse,
      citationRequired:
        output.source.usageTerms.citationRequired,
      rawImageBytesDownloaded: false,
      productionAuthority: false
    },
    null,
    2
  )
);
