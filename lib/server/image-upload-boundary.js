import "server-only";
import sharp from "sharp";
import {
  canonicalizeImageBytes,
  canonicalizeImageFile as canonicalizeImageFileCore,
  canonicalizeOptionalImageDataUrl,
  detectImageSignature,
  validateFullReportImageAliases
} from "../image-upload-boundary-core.js";

export const MAX_PROVIDER_IMAGE_EDGE = 1024;

function isWithinProviderBounds(image) {
  return image.width <= MAX_PROVIDER_IMAGE_EDGE && image.height <= MAX_PROVIDER_IMAGE_EDGE;
}

async function resizeCanonicalImageForProvider(image) {
  if (!image?.ok || isWithinProviderBounds(image)) {
    return image;
  }

  try {
    const bytes = await sharp(image.bytes, {
      animated: false,
      failOn: "warning"
    })
      .resize({
        width: MAX_PROVIDER_IMAGE_EDGE,
        height: MAX_PROVIDER_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true
      })
      .toBuffer();
    const metadata = await sharp(bytes, {
      animated: false,
      failOn: "warning"
    }).metadata();
    const width = Number(metadata.width);
    const height = Number(metadata.height);

    if (
      !Number.isSafeInteger(width) ||
      width <= 0 ||
      width > MAX_PROVIDER_IMAGE_EDGE ||
      !Number.isSafeInteger(height) ||
      height <= 0 ||
      height > MAX_PROVIDER_IMAGE_EDGE
    ) {
      return { ok: false, code: "provider_resize_invalid" };
    }

    return {
      ...image,
      bytes,
      width,
      height,
      totalPixels: width * height,
      dataUrl: `data:${image.mimeType};base64,${bytes.toString("base64")}`
    };
  } catch {
    return { ok: false, code: "provider_resize_failed" };
  }
}

export async function canonicalizeImageFile(file, sourceBytes, options = {}) {
  const canonical = await canonicalizeImageFileCore(file, sourceBytes, options);
  return resizeCanonicalImageForProvider(canonical);
}

export {
  canonicalizeImageBytes,
  canonicalizeOptionalImageDataUrl,
  detectImageSignature,
  validateFullReportImageAliases
};
