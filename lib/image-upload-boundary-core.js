import sharp from "sharp";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_UPLOAD_BYTES,
  validateImageUpload
} from "./upload-validation.js";

export const MAX_IMAGE_WIDTH = 8192;
export const MAX_IMAGE_HEIGHT = 8192;
export const MAX_IMAGE_TOTAL_PIXELS = 16_777_216;
export const REQUIRED_IMAGE_PAGE_COUNT = 1;
export const MAX_IMAGE_DATA_URL_BASE64_LENGTH = Math.ceil(MAX_IMAGE_UPLOAD_BYTES / 3) * 4;

const FORMAT_TO_MIME = Object.freeze({
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
});
const MIME_TO_FORMAT = Object.freeze({
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp"
});
const BASE64_DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const FACE_IMAGE_INPUT_KEYS = new Set([
  "imageUrl",
  "imagePreviewDataUrl",
  "imagePreview",
  "previewDataUrl",
  "imageDataUrl",
  "photoDataUrl",
  "base64Image",
  "imageBase64",
  "imageData",
  "photoImageData",
  "previewImage",
  "photoUrl"
]);

function failure(code) {
  return { ok: false, code };
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeOptions(options = {}) {
  return {
    maxSourceBytes: options.maxSourceBytes ?? MAX_IMAGE_UPLOAD_BYTES,
    maxCanonicalBytes: options.maxCanonicalBytes ?? MAX_IMAGE_UPLOAD_BYTES,
    maxWidth: options.maxWidth ?? MAX_IMAGE_WIDTH,
    maxHeight: options.maxHeight ?? MAX_IMAGE_HEIGHT,
    maxTotalPixels: options.maxTotalPixels ?? MAX_IMAGE_TOTAL_PIXELS
  };
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }

  return null;
}

export function detectImageSignature(value) {
  const bytes = toBuffer(value);

  if (!bytes) {
    return null;
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

function getOrientedDimensions(metadata) {
  const autoOrient = metadata?.autoOrient;

  if (
    autoOrient &&
    Number.isSafeInteger(autoOrient.width) &&
    Number.isSafeInteger(autoOrient.height)
  ) {
    return {
      width: autoOrient.width,
      height: autoOrient.height
    };
  }

  const shouldSwap = [5, 6, 7, 8].includes(metadata?.orientation);
  return {
    width: shouldSwap ? metadata?.height : metadata?.width,
    height: shouldSwap ? metadata?.width : metadata?.height
  };
}

function validateDecodedMetadata(metadata, expectedFormat, limits) {
  if (!metadata || metadata.format !== expectedFormat) {
    return failure("decoded_format_mismatch");
  }

  const pages = metadata.pages ?? 1;

  if (!Number.isSafeInteger(pages) || pages !== REQUIRED_IMAGE_PAGE_COUNT) {
    return failure("invalid_frame_count");
  }

  const { width, height } = getOrientedDimensions(metadata);

  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    return failure("invalid_dimensions");
  }

  if (width > limits.maxWidth) {
    return failure("width_exceeded");
  }

  if (height > limits.maxHeight) {
    return failure("height_exceeded");
  }

  const totalPixels = width * height;

  if (!Number.isSafeInteger(totalPixels) || totalPixels > limits.maxTotalPixels) {
    return failure("pixel_limit_exceeded");
  }

  return {
    ok: true,
    width,
    height,
    totalPixels
  };
}

function hasAnimatedContainer(bytes, format) {
  if (format === "png") {
    let offset = 8;

    while (offset + 12 <= bytes.length) {
      const chunkLength = bytes.readUInt32BE(offset);
      const typeStart = offset + 4;
      const dataEnd = typeStart + 4 + chunkLength;
      const chunkEnd = dataEnd + 4;

      if (!Number.isSafeInteger(chunkEnd) || chunkEnd > bytes.length) {
        return false;
      }

      const chunkType = bytes.subarray(typeStart, typeStart + 4).toString("ascii");

      if (chunkType === "acTL" || chunkType === "fcTL" || chunkType === "fdAT") {
        return true;
      }

      offset = chunkEnd;

      if (chunkType === "IEND") {
        break;
      }
    }
  }

  if (format === "webp") {
    let offset = 12;

    while (offset + 8 <= bytes.length) {
      const chunkType = bytes.subarray(offset, offset + 4).toString("ascii");
      const chunkLength = bytes.readUInt32LE(offset + 4);
      const chunkEnd = offset + 8 + chunkLength + (chunkLength % 2);

      if (!Number.isSafeInteger(chunkEnd) || chunkEnd > bytes.length) {
        return false;
      }

      if (chunkType === "ANIM" || chunkType === "ANMF") {
        return true;
      }

      offset = chunkEnd;
    }
  }

  return false;
}

function createCanonicalPipeline(bytes, format, maxTotalPixels) {
  const pipeline = sharp(bytes, {
    animated: true,
    failOn: "warning",
    limitInputPixels: maxTotalPixels
  }).autoOrient();

  if (format === "jpeg") {
    return pipeline.jpeg({ quality: 90, progressive: false });
  }

  if (format === "png") {
    return pipeline.png({ compressionLevel: 9, progressive: false });
  }

  return pipeline.webp({ quality: 90, effort: 4 });
}

export async function canonicalizeImageBytes(input, options = {}) {
  const limits = normalizeOptions(options);
  const bytes = toBuffer(input?.bytes);
  const declaredMimeType = input?.declaredMimeType;

  if (!bytes || bytes.length <= 0) {
    return failure("empty");
  }

  if (bytes.length > limits.maxSourceBytes) {
    return failure("too_large");
  }

  if (typeof declaredMimeType !== "string" || !ALLOWED_IMAGE_MIME_TYPES.includes(declaredMimeType)) {
    return failure("invalid_type");
  }

  const signatureFormat = detectImageSignature(bytes);
  const declaredFormat = MIME_TO_FORMAT[declaredMimeType];

  if (!signatureFormat || signatureFormat !== declaredFormat) {
    return failure("signature_mismatch");
  }

  if (hasAnimatedContainer(bytes, signatureFormat)) {
    return failure("invalid_frame_count");
  }

  let sourceMetadata;

  try {
    sourceMetadata = await sharp(bytes, {
      animated: true,
      failOn: "warning",
      limitInputPixels: limits.maxTotalPixels
    }).metadata();
  } catch {
    return failure("decode_failed");
  }

  const decodedValidation = validateDecodedMetadata(sourceMetadata, signatureFormat, limits);

  if (!decodedValidation.ok) {
    return decodedValidation;
  }

  let canonicalBytes;

  try {
    canonicalBytes = await createCanonicalPipeline(
      bytes,
      signatureFormat,
      limits.maxTotalPixels
    ).toBuffer();
  } catch {
    return failure("canonicalization_failed");
  }

  if (!canonicalBytes.length || canonicalBytes.length > limits.maxCanonicalBytes) {
    return failure("canonical_too_large");
  }

  if (detectImageSignature(canonicalBytes) !== signatureFormat) {
    return failure("canonical_signature_mismatch");
  }

  let canonicalMetadata;

  try {
    canonicalMetadata = await sharp(canonicalBytes, {
      animated: true,
      failOn: "warning",
      limitInputPixels: limits.maxTotalPixels
    }).metadata();
  } catch {
    return failure("canonical_decode_failed");
  }

  const canonicalValidation = validateDecodedMetadata(
    canonicalMetadata,
    signatureFormat,
    limits
  );

  if (!canonicalValidation.ok) {
    return canonicalValidation;
  }

  const mimeType = FORMAT_TO_MIME[signatureFormat];

  return {
    ok: true,
    bytes: canonicalBytes,
    mimeType,
    format: signatureFormat,
    width: canonicalValidation.width,
    height: canonicalValidation.height,
    totalPixels: canonicalValidation.totalPixels,
    dataUrl: `data:${mimeType};base64,${canonicalBytes.toString("base64")}`
  };
}

export async function canonicalizeImageFile(file, sourceBytes, options = {}) {
  const preflight = validateImageUpload(file, {
    maxBytes: options.maxSourceBytes ?? MAX_IMAGE_UPLOAD_BYTES
  });

  if (!preflight.ok) {
    return preflight;
  }

  const bytes = toBuffer(sourceBytes);

  if (!bytes || bytes.length !== preflight.size) {
    return failure("size_mismatch");
  }

  return canonicalizeImageBytes(
    {
      bytes,
      declaredMimeType: preflight.mimeType
    },
    options
  );
}

export function parseImageDataUrl(value, options = {}) {
  if (value === null || value === undefined || value === "") {
    return {
      ok: true,
      absent: true
    };
  }

  if (typeof value !== "string" || CONTROL_CHARACTER_PATTERN.test(value)) {
    return failure("invalid_data_url");
  }

  const match = BASE64_DATA_URL_PATTERN.exec(value);

  if (!match) {
    return failure("invalid_data_url");
  }

  const maxBase64Length = options.maxBase64Length ?? MAX_IMAGE_DATA_URL_BASE64_LENGTH;

  if (match[2].length > maxBase64Length || match[2].length % 4 !== 0) {
    return failure("too_large");
  }

  let bytes;

  try {
    bytes = Buffer.from(match[2], "base64");
  } catch {
    return failure("invalid_base64");
  }

  if (!bytes.length || bytes.toString("base64") !== match[2]) {
    return failure("invalid_base64");
  }

  return {
    ok: true,
    absent: false,
    bytes,
    declaredMimeType: match[1]
  };
}

export async function canonicalizeOptionalImageDataUrl(value, options = {}) {
  const parsed = parseImageDataUrl(value, options);

  if (!parsed.ok || parsed.absent) {
    return parsed;
  }

  return canonicalizeImageBytes(
    {
      bytes: parsed.bytes,
      declaredMimeType: parsed.declaredMimeType
    },
    options
  );
}

export function validateFullReportImageAliases(body, options = {}) {
  if (!isPlainObject(body)) {
    return failure("invalid_payload");
  }

  const maxDepth = options.maxDepth ?? 20;
  const maxNodes = options.maxNodes ?? 5000;
  const stack = [{ value: body, depth: 0, path: [] }];
  const seen = new WeakSet();
  let visitedNodes = 0;

  while (stack.length) {
    const current = stack.pop();
    visitedNodes += 1;

    if (visitedNodes > maxNodes || current.depth > maxDepth) {
      return failure("image_alias_scan_limit");
    }

    if (!current.value || typeof current.value !== "object") {
      continue;
    }

    if (seen.has(current.value)) {
      return failure("cyclic_payload");
    }

    seen.add(current.value);

    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        stack.push({
          value: current.value[index],
          depth: current.depth + 1,
          path: [...current.path, String(index)]
        });
      }
      continue;
    }

    if (!isPlainObject(current.value)) {
      return failure("invalid_payload_object");
    }

    for (const [key, nestedValue] of Object.entries(current.value)) {
      const isAllowedRootImageUrl = current.path.length === 0 && key === "imageUrl";

      if (
        FACE_IMAGE_INPUT_KEYS.has(key) &&
        !isAllowedRootImageUrl &&
        nestedValue !== null &&
        nestedValue !== undefined &&
        nestedValue !== ""
      ) {
        return failure("unexpected_image_alias");
      }

      stack.push({
        value: nestedValue,
        depth: current.depth + 1,
        path: [...current.path, key]
      });
    }
  }

  return { ok: true };
}
