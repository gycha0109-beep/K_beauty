import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import sharp from "sharp";
import {
  canonicalizeImageBytes,
  canonicalizeImageFile,
  canonicalizeOptionalImageDataUrl,
  detectImageSignature,
  parseImageDataUrl,
  validateFullReportImageAliases
} from "../lib/image-upload-boundary-core.js";
import {
  IMAGE_UPLOAD_ACCEPT,
  MAX_IMAGE_UPLOAD_BYTES,
  validateImageRequestContentLength,
  validateImageUpload
} from "../lib/upload-validation.js";

const REQUIRED_CASE_IDS = Object.freeze([
  "P01_JPEG_CANONICAL",
  "P02_PNG_CANONICAL",
  "P03_WEBP_CANONICAL",
  "P04_EXIF_ORIENTATION",
  "P05_METADATA_REMOVED",
  "P06_TRAILING_PAYLOAD_REMOVED",
  "P07_FILE_CONTRACT",
  "P08_DATA_URL_CANONICAL",
  "P09_CONTENT_LENGTH_ABSENT",
  "P10_ANALYZE_ROUTE_ORDER",
  "P11_FACE_READING_ROUTE_ORDER",
  "P12_FULL_REPORT_PERSISTENCE_BOUNDARY",
  "P13_CLIENT_UPLOAD_BOUNDARY",
  "P14_OPTIONAL_DATA_URL",
  "N01_ZERO_BYTE",
  "N02_HTML_SPOOF",
  "N03_JAVASCRIPT_SPOOF",
  "N04_ZIP_SPOOF",
  "N05_PDF_SPOOF",
  "N06_MIME_SIGNATURE_MISMATCH",
  "N07_PNG_DECLARED_JPEG",
  "N08_TRUNCATED_JPEG",
  "N09_TRUNCATED_PNG",
  "N10_TRUNCATED_WEBP",
  "N11_HEADER_ONLY",
  "N12_MALFORMED_PNG_CHUNK",
  "N13_WIDTH_EXCEEDED",
  "N14_HEIGHT_EXCEEDED",
  "N15_TOTAL_PIXELS_EXCEEDED",
  "N16_ANIMATED_WEBP",
  "N17_APNG",
  "N18_SVG_REJECTED",
  "N19_GIF_REJECTED",
  "N20_AVIF_REJECTED",
  "N21_HEIF_REJECTED",
  "N22_EXCESSIVE_METADATA_LIMIT",
  "N23_MALFORMED_BASE64",
  "N24_DATA_URL_MIME_MISMATCH",
  "N25_REMOTE_URL",
  "N26_BLOB_URL",
  "N27_JAVASCRIPT_URL",
  "N28_FILE_URL",
  "N29_CANONICAL_OUTPUT_LIMIT",
  "N30_EMPTY_FILE_PREFLIGHT",
  "N31_OVERSIZED_FILE_PREFLIGHT",
  "N32_CONTENT_LENGTH_TOO_LARGE",
  "N33_NESTED_IMAGE_ALIAS",
  "N34_FACE_LAB_IMAGE_ALIAS",
  "N35_ALIAS_DEPTH_LIMIT",
  "N36_ALIAS_CYCLE",
  "N37_SOURCE_SIZE_MISMATCH",
  "N38_DATA_URL_WHITESPACE",
  "N39_DATA_TEXT_URL",
  "N40_NON_OBJECT_FULL_REPORT_BODY",
  "N41_LEGACY_IMAGE_PREVIEW_ALIAS"
]);
const EXPECTED_REQUIRED_CASE_COUNT = 55;
const cases = [];

function defineCase(id, run) {
  cases.push(Object.freeze({ id, run }));
}

function assertRejected(result, expectedCode = null) {
  assert.equal(result?.ok, false);

  if (expectedCode) {
    assert.equal(result.code, expectedCode);
  }
}

async function createImage(format, width = 4, height = 3, options = {}) {
  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: options.background || { r: 118, g: 72, b: 91, alpha: 1 }
    }
  });

  if (format === "jpeg") {
    pipeline = pipeline.jpeg({ quality: 92 });
  } else if (format === "png") {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else if (format === "webp") {
    pipeline = pipeline.webp({ quality: 92 });
  } else if (format === "avif") {
    pipeline = pipeline.avif({ quality: 50 });
  }

  if (options.orientation) {
    pipeline = pipeline.withMetadata({ orientation: options.orientation });
  }

  return pipeline.toBuffer();
}

function makeRequest(contentLength) {
  return {
    headers: {
      get(name) {
        return name === "content-length" ? contentLength : null;
      }
    }
  };
}

function makeFile(bytes, type, size = bytes.length) {
  return {
    type,
    size,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  };
}

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function crc32(bytes) {
  let checksum = 0xffffffff;

  for (const byte of bytes) {
    checksum ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      checksum = (checksum >>> 1) ^ ((checksum & 1) ? 0xedb88320 : 0);
    }
  }

  return (checksum ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function createAnimatedPng() {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  const animationControl = Buffer.alloc(8);
  animationControl.writeUInt32BE(2, 0);
  const frameControl = (sequence) => {
    const data = Buffer.alloc(26);
    data.writeUInt32BE(sequence, 0);
    data.writeUInt32BE(1, 4);
    data.writeUInt32BE(1, 8);
    data.writeUInt16BE(1, 20);
    data.writeUInt16BE(10, 22);
    return data;
  };
  const firstFrame = deflateSync(Buffer.from([0, 255, 0, 0, 255]));
  const secondFrameBytes = deflateSync(Buffer.from([0, 0, 0, 255, 255]));
  const secondFrame = Buffer.alloc(4 + secondFrameBytes.length);
  secondFrame.writeUInt32BE(2, 0);
  secondFrameBytes.copy(secondFrame, 4);

  return Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("acTL", animationControl),
    pngChunk("fcTL", frameControl(0)),
    pngChunk("IDAT", firstFrame),
    pngChunk("fcTL", frameControl(1)),
    pngChunk("fdAT", secondFrame),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

async function createAnimatedWebp() {
  const inputs = [
    { create: { width: 2, height: 2, channels: 4, background: "#ff0000" } },
    { create: { width: 2, height: 2, channels: 4, background: "#0000ff" } }
  ];

  return sharp(inputs, { join: { animated: true } })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
}

let jpeg;
let png;
let webp;

defineCase("P01_JPEG_CANONICAL", async () => {
  jpeg ||= await createImage("jpeg");
  const result = await canonicalizeImageBytes({ bytes: jpeg, declaredMimeType: "image/jpeg" });
  assert.equal(result.ok, true);
  assert.equal(result.mimeType, "image/jpeg");
  assert.equal(result.format, "jpeg");
  assert.equal(detectImageSignature(result.bytes), "jpeg");
  assert.deepEqual([result.width, result.height, result.totalPixels], [4, 3, 12]);
  assert.equal((await sharp(result.bytes).metadata()).format, "jpeg");
});

defineCase("P02_PNG_CANONICAL", async () => {
  png ||= await createImage("png");
  const result = await canonicalizeImageBytes({ bytes: png, declaredMimeType: "image/png" });
  assert.equal(result.ok, true);
  assert.equal(result.mimeType, "image/png");
  assert.equal(detectImageSignature(result.bytes), "png");
});

defineCase("P03_WEBP_CANONICAL", async () => {
  webp ||= await createImage("webp");
  const result = await canonicalizeImageBytes({ bytes: webp, declaredMimeType: "image/webp" });
  assert.equal(result.ok, true);
  assert.equal(result.mimeType, "image/webp");
  assert.equal(detectImageSignature(result.bytes), "webp");
});

defineCase("P04_EXIF_ORIENTATION", async () => {
  const source = await createImage("jpeg", 3, 2, { orientation: 6 });
  const result = await canonicalizeImageBytes({ bytes: source, declaredMimeType: "image/jpeg" });
  assert.equal(result.ok, true);
  assert.deepEqual([result.width, result.height], [2, 3]);
});

defineCase("P05_METADATA_REMOVED", async () => {
  for (const [format, mimeType] of [
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"]
  ]) {
    const source = await sharp({
      create: { width: 3, height: 2, channels: 3, background: "#667788" }
    })[format]().withMetadata({ orientation: 1 }).toBuffer();
    const sourceMetadata = await sharp(source).metadata();
    const result = await canonicalizeImageBytes({ bytes: source, declaredMimeType: mimeType });
    const metadata = await sharp(result.bytes).metadata();
    assert.equal(Boolean(sourceMetadata.exif), true);
    assert.equal(Boolean(sourceMetadata.icc), true);
    assert.equal(result.ok, true);
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    assert.equal(metadata.orientation, undefined);
  }
});

defineCase("P06_TRAILING_PAYLOAD_REMOVED", async () => {
  jpeg ||= await createImage("jpeg");
  const marker = Buffer.from("SEC08_SAFE_TRAILING_MARKER", "ascii");
  const result = await canonicalizeImageBytes({
    bytes: Buffer.concat([jpeg, marker]),
    declaredMimeType: "image/jpeg"
  });
  assert.equal(result.ok, true);
  assert.equal(result.bytes.includes(marker), false);
});

defineCase("P07_FILE_CONTRACT", async () => {
  png ||= await createImage("png");
  const file = makeFile(png, "image/png");
  const result = await canonicalizeImageFile(file, png);
  assert.equal(result.ok, true);
  assert.equal(result.dataUrl.startsWith("data:image/png;base64,"), true);
  assert.equal(Object.hasOwn(result, "file"), false);
  assert.equal(Object.hasOwn(result, "sourceBytes"), false);
});

defineCase("P08_DATA_URL_CANONICAL", async () => {
  webp ||= await createImage("webp");
  const result = await canonicalizeOptionalImageDataUrl(
    `data:image/webp;base64,${webp.toString("base64")}`
  );
  assert.equal(result.ok, true);
  assert.equal(result.dataUrl.startsWith("data:image/webp;base64,"), true);
});

defineCase("P09_CONTENT_LENGTH_ABSENT", () => {
  assert.deepEqual(validateImageRequestContentLength(makeRequest(null)), {
    ok: true,
    present: false
  });
});

defineCase("P10_ANALYZE_ROUTE_ORDER", async () => {
  const source = (await readSource("app/api/analyze/route.js")).split("export async function POST")[1];
  const contentGuard = source.indexOf("validateImageRequestContentLength(request)");
  const formData = source.indexOf("await request.formData()");
  const requestGuard = source.indexOf("await guardAnalysisRequest(");
  const byteRead = source.indexOf("const buffer = Buffer.from(await image.arrayBuffer())");
  const canonicalize = source.indexOf("await canonicalizeImageFile(image, buffer)");
  const providerPrep = source.indexOf("analyzeVisionObservation({");
  assert(contentGuard >= 0 && contentGuard < formData);
  assert(requestGuard >= 0 && requestGuard < byteRead);
  assert(byteRead >= 0 && byteRead < canonicalize && canonicalize < providerPrep);
  assert.equal(source.includes("data:${image.type"), false);
});

defineCase("P11_FACE_READING_ROUTE_ORDER", async () => {
  const source = (await readSource("app/api/face-reading/route.js")).split("export async function POST")[1];
  const contentGuard = source.indexOf("validateImageRequestContentLength(request)");
  const formData = source.indexOf("await request.formData()");
  const requestGuard = source.indexOf("await guardAnalysisRequest(");
  const byteRead = source.indexOf("const imageBuffer = Buffer.from(await image.arrayBuffer())");
  const canonicalize = source.indexOf("await canonicalizeImageFile(image, imageBuffer)");
  const providerCall = source.indexOf("analyzeVisionObservation({");
  assert(contentGuard >= 0 && contentGuard < formData);
  assert(requestGuard >= 0 && requestGuard < byteRead);
  assert(byteRead >= 0 && byteRead < canonicalize && canonicalize < providerCall);
  assert.equal(source.includes("data:${image.type"), false);
});

defineCase("P12_FULL_REPORT_PERSISTENCE_BOUNDARY", async () => {
  png ||= await createImage("png");
  const source = await readSource("app/api/full-report/route.js");
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
  assert.equal(validateFullReportImageAliases({ imageUrl: dataUrl, faceLab: {} }).ok, true);
  const canonical = await canonicalizeOptionalImageDataUrl(dataUrl);
  assert.equal(canonical.ok, true);
  assert(source.includes("canonicalImageUrl || storedFaceLabSummary.imageUrl"));
  assert(source.includes("authoritativePremiumReport = sanitizePremiumReportForBoundary("));
  assert(source.includes("updateResult.payload.premiumReport"));
  assert.equal(source.includes("imageUrl: body?.imageUrl ||"), false);
});

defineCase("P13_CLIENT_UPLOAD_BOUNDARY", async () => {
  const page = await readSource("app/page.js");
  const photo = await readSource("components/onboarding/PhotoUploadStep.js");
  const face = await readSource("components/FaceLab.js");
  assert.equal(IMAGE_UPLOAD_ACCEPT, "image/jpeg,image/png,image/webp");
  assert(page.indexOf("validateImageUpload(file)") < page.indexOf("URL.createObjectURL(file)"));
  assert.equal((photo.match(/accept="image\/jpeg,image\/png,image\/webp"/g) || []).length, 2);
  assert.equal((face.match(/accept="image\/jpeg,image\/png,image\/webp"/g) || []).length, 2);
});

defineCase("P14_OPTIONAL_DATA_URL", async () => {
  assert.deepEqual(await canonicalizeOptionalImageDataUrl(null), { ok: true, absent: true });
  assert.deepEqual(await canonicalizeOptionalImageDataUrl(""), { ok: true, absent: true });
});

defineCase("N01_ZERO_BYTE", async () => {
  assertRejected(await canonicalizeImageBytes({ bytes: Buffer.alloc(0), declaredMimeType: "image/jpeg" }), "empty");
});
defineCase("N02_HTML_SPOOF", async () => {
  assertRejected(await canonicalizeImageBytes({ bytes: Buffer.from("<html>"), declaredMimeType: "image/jpeg" }));
});
defineCase("N03_JAVASCRIPT_SPOOF", async () => {
  assertRejected(await canonicalizeImageBytes({ bytes: Buffer.from("alert(1)"), declaredMimeType: "image/png" }));
});
defineCase("N04_ZIP_SPOOF", async () => {
  assertRejected(await canonicalizeImageBytes({ bytes: Buffer.from("PK\u0003\u0004"), declaredMimeType: "image/jpeg" }));
});
defineCase("N05_PDF_SPOOF", async () => {
  assertRejected(await canonicalizeImageBytes({ bytes: Buffer.from("%PDF-1.7"), declaredMimeType: "image/webp" }));
});
defineCase("N06_MIME_SIGNATURE_MISMATCH", async () => {
  jpeg ||= await createImage("jpeg");
  assertRejected(await canonicalizeImageBytes({ bytes: jpeg, declaredMimeType: "image/png" }), "signature_mismatch");
});
defineCase("N07_PNG_DECLARED_JPEG", async () => {
  png ||= await createImage("png");
  assertRejected(await canonicalizeImageBytes({ bytes: png, declaredMimeType: "image/jpeg" }), "signature_mismatch");
});
defineCase("N08_TRUNCATED_JPEG", async () => {
  jpeg ||= await createImage("jpeg");
  assertRejected(await canonicalizeImageBytes({ bytes: jpeg.subarray(0, jpeg.length / 2), declaredMimeType: "image/jpeg" }));
});
defineCase("N09_TRUNCATED_PNG", async () => {
  png ||= await createImage("png");
  assertRejected(await canonicalizeImageBytes({ bytes: png.subarray(0, png.length / 2), declaredMimeType: "image/png" }));
});
defineCase("N10_TRUNCATED_WEBP", async () => {
  webp ||= await createImage("webp");
  assertRejected(await canonicalizeImageBytes({ bytes: webp.subarray(0, webp.length / 2), declaredMimeType: "image/webp" }));
});
defineCase("N11_HEADER_ONLY", async () => {
  assertRejected(await canonicalizeImageBytes({ bytes: Buffer.from([0xff, 0xd8, 0xff]), declaredMimeType: "image/jpeg" }));
});
defineCase("N12_MALFORMED_PNG_CHUNK", async () => {
  const malformed = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0xff, 0xff, 0xff, 0xff, 0x49, 0x48, 0x44, 0x52])
  ]);
  assertRejected(await canonicalizeImageBytes({ bytes: malformed, declaredMimeType: "image/png" }));
});
defineCase("N13_WIDTH_EXCEEDED", async () => {
  const source = await createImage("png", 8193, 1);
  assertRejected(await canonicalizeImageBytes({ bytes: source, declaredMimeType: "image/png" }));
});
defineCase("N14_HEIGHT_EXCEEDED", async () => {
  const source = await createImage("png", 1, 8193);
  assertRejected(await canonicalizeImageBytes({ bytes: source, declaredMimeType: "image/png" }));
});
defineCase("N15_TOTAL_PIXELS_EXCEEDED", async () => {
  const source = await createImage("png", 4097, 4097);
  assertRejected(await canonicalizeImageBytes({ bytes: source, declaredMimeType: "image/png" }));
});
defineCase("N16_ANIMATED_WEBP", async () => {
  assertRejected(await canonicalizeImageBytes({ bytes: await createAnimatedWebp(), declaredMimeType: "image/webp" }), "invalid_frame_count");
});
defineCase("N17_APNG", async () => {
  assertRejected(await canonicalizeImageBytes({ bytes: createAnimatedPng(), declaredMimeType: "image/png" }), "invalid_frame_count");
});
defineCase("N18_SVG_REJECTED", async () => {
  assertRejected(await canonicalizeImageBytes({ bytes: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>") , declaredMimeType: "image/png" }));
});
defineCase("N19_GIF_REJECTED", async () => {
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
  assertRejected(await canonicalizeImageBytes({ bytes: gif, declaredMimeType: "image/png" }));
});
defineCase("N20_AVIF_REJECTED", async () => {
  assertRejected(await canonicalizeImageBytes({ bytes: await createImage("avif"), declaredMimeType: "image/webp" }));
});
defineCase("N21_HEIF_REJECTED", async () => {
  const heif = Buffer.from("00000018667479706865696300000000686569636d696631", "hex");
  assertRejected(await canonicalizeImageBytes({ bytes: heif, declaredMimeType: "image/jpeg" }));
});
defineCase("N22_EXCESSIVE_METADATA_LIMIT", async () => {
  const source = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#999999" } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { ImageDescription: "A".repeat(4096) } } })
    .toBuffer();
  assertRejected(await canonicalizeImageBytes(
    { bytes: source, declaredMimeType: "image/jpeg" },
    { maxSourceBytes: 1024 }
  ), "too_large");
});
defineCase("N23_MALFORMED_BASE64", () => {
  assertRejected(parseImageDataUrl("data:image/png;base64,%%%="));
});
defineCase("N24_DATA_URL_MIME_MISMATCH", async () => {
  png ||= await createImage("png");
  assertRejected(await canonicalizeOptionalImageDataUrl(`data:image/jpeg;base64,${png.toString("base64")}`), "signature_mismatch");
});
defineCase("N25_REMOTE_URL", () => assertRejected(parseImageDataUrl("https://example.invalid/image.jpg")));
defineCase("N26_BLOB_URL", () => assertRejected(parseImageDataUrl("blob:https://example.invalid/id")));
defineCase("N27_JAVASCRIPT_URL", () => assertRejected(parseImageDataUrl("javascript:alert(1)")));
defineCase("N28_FILE_URL", () => assertRejected(parseImageDataUrl("file:///tmp/image.jpg")));
defineCase("N29_CANONICAL_OUTPUT_LIMIT", async () => {
  jpeg ||= await createImage("jpeg");
  assertRejected(await canonicalizeImageBytes(
    { bytes: jpeg, declaredMimeType: "image/jpeg" },
    { maxCanonicalBytes: 32 }
  ), "canonical_too_large");
});
defineCase("N30_EMPTY_FILE_PREFLIGHT", () => {
  assertRejected(validateImageUpload(makeFile(Buffer.alloc(0), "image/jpeg")), "empty");
});
defineCase("N31_OVERSIZED_FILE_PREFLIGHT", () => {
  assertRejected(validateImageUpload(makeFile(Buffer.from([1]), "image/jpeg", MAX_IMAGE_UPLOAD_BYTES + 1)), "too_large");
});
defineCase("N32_CONTENT_LENGTH_TOO_LARGE", () => {
  assertRejected(validateImageRequestContentLength(makeRequest(String(MAX_IMAGE_UPLOAD_BYTES + 1024 * 1024))), "too_large");
});
defineCase("N33_NESTED_IMAGE_ALIAS", () => {
  assertRejected(validateFullReportImageAliases({ freeResult: { imagePreviewDataUrl: "data:image/png;base64,AA==" } }), "unexpected_image_alias");
});
defineCase("N34_FACE_LAB_IMAGE_ALIAS", () => {
  assertRejected(validateFullReportImageAliases({ faceLab: { imageUrl: "data:image/png;base64,AA==" } }), "unexpected_image_alias");
});
defineCase("N35_ALIAS_DEPTH_LIMIT", () => {
  let nested = { value: true };
  for (let index = 0; index < 22; index += 1) nested = { nested };
  assertRejected(validateFullReportImageAliases(nested), "image_alias_scan_limit");
});
defineCase("N36_ALIAS_CYCLE", () => {
  const cyclic = {};
  cyclic.self = cyclic;
  assertRejected(validateFullReportImageAliases(cyclic), "cyclic_payload");
});
defineCase("N37_SOURCE_SIZE_MISMATCH", async () => {
  png ||= await createImage("png");
  assertRejected(await canonicalizeImageFile(makeFile(png, "image/png", png.length + 1), png), "size_mismatch");
});
defineCase("N38_DATA_URL_WHITESPACE", () => {
  assertRejected(parseImageDataUrl("data:image/png;base64,AAAA\n"));
});
defineCase("N39_DATA_TEXT_URL", () => {
  assertRejected(parseImageDataUrl("data:text/html;base64,PGgxPnRlc3Q8L2gxPg=="));
});
defineCase("N40_NON_OBJECT_FULL_REPORT_BODY", () => {
  assertRejected(validateFullReportImageAliases(null), "invalid_payload");
});
defineCase("N41_LEGACY_IMAGE_PREVIEW_ALIAS", () => {
  assertRejected(
    validateFullReportImageAliases({ report: { imagePreview: "data:image/jpeg;base64,AA==" } }),
    "unexpected_image_alias"
  );
});

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  return [...duplicates].sort();
}

function validateExactSet(actualIds, expectedIds, layer) {
  const duplicateIds = findDuplicates(actualIds);
  const actualSet = new Set(actualIds);
  const expectedSet = new Set(expectedIds);
  const missingIds = expectedIds.filter((id) => !actualSet.has(id));
  const unknownIds = actualIds.filter((id) => !expectedSet.has(id));

  assert.deepEqual(duplicateIds, [], `${layer} duplicate IDs: ${duplicateIds.join(",")}`);
  assert.deepEqual(missingIds, [], `${layer} missing IDs: ${missingIds.join(",")}`);
  assert.deepEqual(unknownIds, [], `${layer} unknown IDs: ${unknownIds.join(",")}`);
}

async function main() {
  assert.equal(
    REQUIRED_CASE_IDS.length,
    EXPECTED_REQUIRED_CASE_COUNT,
    "required case count mismatch"
  );
  validateExactSet(REQUIRED_CASE_IDS, REQUIRED_CASE_IDS, "manifest");
  validateExactSet(cases.map((testCase) => testCase.id), REQUIRED_CASE_IDS, "catalog");
  assert.equal(cases.length, EXPECTED_REQUIRED_CASE_COUNT, "catalog count mismatch");

  const observedIds = [];
  let failures = 0;

  for (const testCase of cases) {
    try {
      await testCase.run();
      observedIds.push(testCase.id);
      process.stdout.write(`${JSON.stringify({ caseId: testCase.id, status: "PASS" })}\n`);
    } catch (error) {
      failures += 1;
      observedIds.push(testCase.id);
      process.stderr.write(`${JSON.stringify({
        caseId: testCase.id,
        status: "FAIL",
        category: error?.name || "Error"
      })}\n`);
    }
  }

  validateExactSet(observedIds, REQUIRED_CASE_IDS, "observed");
  assert.equal(observedIds.length, EXPECTED_REQUIRED_CASE_COUNT, "observed count mismatch");
  assert.equal(failures, 0, `${failures} SEC-08 case(s) failed`);
  process.stdout.write(`SEC08_IMAGE_UPLOAD_BOUNDARY=PASS ${observedIds.length}/${EXPECTED_REQUIRED_CASE_COUNT}\n`);
}

main().catch((error) => {
  process.stderr.write(`SEC08_IMAGE_UPLOAD_BOUNDARY=FAIL category=${error?.name || "Error"}\n`);
  process.exitCode = 1;
});
