// S1-D operator-only image header preflight. No model, network, EXIF, output image or persistence.
import fs from "node:fs";
import path from "node:path";

export const SCHEMA_VERSION = "skin-local-photo-preflight-v1";
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const BASENAME = /^(?!\.)(?!.*\.\.)(?=.{1,120}$)[A-Za-z0-9_.()\-]+\.(?:jpe?g|png)$/i;
const TAGS = new Set([
  "baseline", "low_light", "strong_glare", "white_balance_shift", "angle_change",
  "makeup_present", "filter_suspected", "skin_occluded", "low_resolution",
  "different_device", "controlled_repeat"
]);
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function validRecord(value, allowed, context) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.includes(key))) {
    throw new Error(`${context}_invalid_shape`);
  }
}
function parseImageHeader(buffer) {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    if (buffer.toString("ascii", 12, 16) !== "IHDR") throw new Error("png_ihdr_invalid");
    return { format: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error("unsupported_image_header");
  let i = 2;
  while (i + 4 <= buffer.length) {
    if (buffer[i++] !== 0xff) throw new Error("jpeg_marker_invalid");
    while (i < buffer.length && buffer[i] === 0xff) i++;
    if (i >= buffer.length) break;
    const marker = buffer[i++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    if (i + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(i);
    if (length < 2 || i + length > buffer.length) throw new Error("jpeg_segment_truncated");
    const isSof = (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      if (length < 7) throw new Error("jpeg_sof_invalid");
      return { format: "jpeg", width: buffer.readUInt16BE(i + 5), height: buffer.readUInt16BE(i + 3) };
    }
    i += length;
  }
  throw new Error("jpeg_sof_missing");
}

// Read only locally-selected regular files; no filenames, path, EXIF, hashes, or bytes in output.
export function inspectSkinLocalPhotoManifest(input, directory) {
  validRecord(input, ["schemaVersion", "datasetId", "cases"], "manifest");
  if (input.schemaVersion !== SCHEMA_VERSION || !ID.test(input.datasetId || "")) {
    throw new Error("manifest_version_or_id_invalid");
  }
  if (!Array.isArray(input.cases) || input.cases.length < 1 || input.cases.length > 50) {
    throw new Error("case_count_invalid");
  }
  const dirStat = fs.statSync(directory);
  if (!dirStat.isDirectory()) throw new Error("photo_directory_invalid");
  const seen = new Set();
  const cases = input.cases.map(item => {
    validRecord(item, ["caseId", "fileName", "captureTags", "rightsStatus"], "case");
    if (typeof item.caseId !== "string" || !ID.test(item.caseId) || seen.has(item.caseId)) {
      throw new Error("case_id_invalid_or_duplicate");
    }
    seen.add(item.caseId);
    if (typeof item.fileName !== "string" || !BASENAME.test(item.fileName)) {
      throw new Error("file_name_invalid");
    }
    if (!Array.isArray(item.captureTags) || item.captureTags.length === 0 ||
        item.captureTags.length > TAGS.size ||
        item.captureTags.some(t => !TAGS.has(t)) ||
        new Set(item.captureTags).size !== item.captureTags.length) {
      throw new Error("capture_tags_invalid");
    }
    if (!new Set(["unverified", "operator_claimed_documented"]).has(item.rightsStatus)) {
      throw new Error("rights_status_invalid");
    }
    const filePath = path.join(directory, item.fileName);
    const stats = fs.lstatSync(filePath);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size < 24 || stats.size > MAX_FILE_BYTES) {
      throw new Error("photo_file_type_or_size_invalid");
    }
    const img = parseImageHeader(fs.readFileSync(filePath));
    if (!img.width || !img.height || img.width > 16000 || img.height > 16000) {
      throw new Error("image_dimensions_invalid");
    }
    if ((img.format === "png") !== item.fileName.toLowerCase().endsWith(".png")) {
      throw new Error("image_extension_header_mismatch");
    }
    return {
      caseId: item.caseId,
      format: img.format,
      widthPx: img.width,
      heightPx: img.height,
      fileBytes: stats.size,
      captureTags: [...item.captureTags],
      rightsStatus: item.rightsStatus,
      shortSideBelow320Px: Math.min(img.width, img.height) < 320,
      qualityAndSkinCuesReviewedByTool: false,
      providerResult: "NOT_RUN"
    };
  });
  return {
    version: SCHEMA_VERSION,
    status: "LOCAL_HEADER_PREFLIGHT_ONLY",
    datasetId: input.datasetId,
    cases,
    bounds: {
      sourcePhotoFilesPersistedByTool: false,
      localPathOrExifEmitted: false,
      rightsVerifiedByTool: false,
      externalProviderTransferAuthorized: false,
      modelSkinCuesMeasured: false,
      independentHumanReferenceVerified: false,
      productReady: false,
      releaseReady: false
    }
  };
}
