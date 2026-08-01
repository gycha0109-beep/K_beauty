import path from "node:path";
import sharp from "sharp";
import {
  CANDIDATE_IMPORT_LIMITS,
  CANONICAL_IMAGE_POLICY_VERSION,
  PERCEPTUAL_FINGERPRINT_ALGORITHM,
  createCandidateImportError
} from "@bejewely/face-contracts";
import { sha256Hex } from "../generation/canonicalize-generation-spec.js";

const EXTENSIONS = Object.freeze({
  png: new Set([".png"]),
  jpeg: new Set([".jpg", ".jpeg"]),
  webp: new Set([".webp"])
});

function failure(code, pathValue, detail = null) {
  return { ok: false, errors: [createCandidateImportError(code, pathValue, detail)] };
}

export async function inspectImageBuffer(buffer, originalDownloadName) {
  if (!Buffer.isBuffer(buffer)) {
    return failure("image_decode_failed", "source.inboxRelativePath");
  }
  if (buffer.byteLength > CANDIDATE_IMPORT_LIMITS.maxBytes) {
    return failure("file_size_limit_exceeded", "source.inboxRelativePath", buffer.byteLength);
  }

  let metadata;
  try {
    metadata = await sharp(buffer, {
      animated: true,
      failOn: "warning",
      limitInputPixels: CANDIDATE_IMPORT_LIMITS.maxPixels + 1
    }).metadata();
  } catch (error) {
    return failure("image_decode_failed", "source.inboxRelativePath", error?.message || null);
  }

  const format = metadata.format;
  if (!CANDIDATE_IMPORT_LIMITS.allowedFormats.includes(format)) {
    return failure("unsupported_file_format", "source.inboxRelativePath", format || null);
  }
  const pages = metadata.pages || 1;
  if (pages !== 1) {
    return failure("animated_asset_forbidden", "source.inboxRelativePath", pages);
  }
  const width = metadata.width;
  const height = metadata.height;
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return failure("image_decode_failed", "source.inboxRelativePath", "missing_dimensions");
  }
  if (width < CANDIDATE_IMPORT_LIMITS.minDimension || height < CANDIDATE_IMPORT_LIMITS.minDimension) {
    return failure("dimension_below_minimum", "source.inboxRelativePath", { width, height });
  }
  if (width > CANDIDATE_IMPORT_LIMITS.maxDimension || height > CANDIDATE_IMPORT_LIMITS.maxDimension) {
    return failure("dimension_limit_exceeded", "source.inboxRelativePath", { width, height });
  }
  if (width * height > CANDIDATE_IMPORT_LIMITS.maxPixels) {
    return failure("pixel_limit_exceeded", "source.inboxRelativePath", width * height);
  }

  const extension = path.extname(originalDownloadName).toLowerCase();
  if (!EXTENSIONS[format]?.has(extension)) {
    return failure("mime_decode_mismatch", "source.originalDownloadName", { extension, format });
  }

  const rawSha256 = sha256Hex(buffer);
  return {
    ok: true,
    inspection: Object.freeze({
      rawSha256,
      assetId: `asset_${rawSha256.slice(0, 24)}`,
      byteLength: buffer.byteLength,
      detectedFormat: format,
      originalExtension: extension,
      width,
      height,
      frameCount: 1,
      hasAlpha: Boolean(metadata.hasAlpha),
      orientation: metadata.orientation || 1
    })
  };
}

export async function canonicalizeImageBuffer(buffer) {
  try {
    const { data, info } = await sharp(buffer, {
      animated: false,
      failOn: "warning",
      limitInputPixels: CANDIDATE_IMPORT_LIMITS.maxPixels + 1
    })
      .rotate()
      .toColourspace("srgb")
      .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
      .toBuffer({ resolveWithObject: true });

    if (info.width * info.height > CANDIDATE_IMPORT_LIMITS.maxPixels) {
      return failure("pixel_limit_exceeded", "canonicalAsset", info.width * info.height);
    }
    return {
      ok: true,
      canonical: Object.freeze({
        buffer: data,
        canonicalSha256: sha256Hex(data),
        width: info.width,
        height: info.height,
        format: "png",
        metadataStripped: true,
        transformPolicyVersion: CANONICAL_IMAGE_POLICY_VERSION
      })
    };
  } catch (error) {
    return failure("canonicalization_failed", "canonicalAsset", error?.message || null);
  }
}

export async function fingerprintCanonicalBuffer(buffer) {
  const { data } = await sharp(buffer)
    .greyscale()
    .resize(9, 8, { fit: "fill", kernel: "nearest" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = 0n;
  let bitIndex = 63n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = data[y * 9 + x];
      const right = data[y * 9 + x + 1];
      if (left > right) {
        bits |= 1n << bitIndex;
      }
      bitIndex -= 1n;
    }
  }
  return Object.freeze({
    algorithm: PERCEPTUAL_FINGERPRINT_ALGORITHM,
    value: bits.toString(16).padStart(16, "0")
  });
}

export function hammingDistance64(leftHex, rightHex) {
  let value = BigInt(`0x${leftHex}`) ^ BigInt(`0x${rightHex}`);
  let count = 0;
  while (value) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}
