import "server-only";
import {
  canonicalizeImageBytes,
  canonicalizeImageFile as canonicalizeImageFileCore,
  canonicalizeOptionalImageDataUrl,
  detectImageSignature,
  validateFullReportImageAliases
} from "../image-upload-boundary-core.js";
import {
  MAX_PROVIDER_IMAGE_EDGE,
  resizeImageForProvider
} from "../provider-image-budget.js";

export { MAX_PROVIDER_IMAGE_EDGE };

export async function canonicalizeImageFile(file, sourceBytes, options = {}) {
  const canonical = await canonicalizeImageFileCore(file, sourceBytes, options);
  return resizeImageForProvider(canonical);
}

export {
  canonicalizeImageBytes,
  canonicalizeOptionalImageDataUrl,
  detectImageSignature,
  validateFullReportImageAliases
};
