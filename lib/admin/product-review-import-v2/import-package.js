import "server-only";

import { parseCleanserMetadataV2Package, CleanserMetadataV2Error } from "../../../crawler/lib/reviews/review-cleanser-metadata-v2";
import { ProductReviewImportError } from "@/lib/admin/product-review-import/import-error-map";

export function parseProductReviewImportV2Package(files) {
  try {
    return parseCleanserMetadataV2Package({
      batch: files.batch.bytes,
      manifest: files.manifest.bytes,
      evidence: files.evidence.bytes,
      reviewed: files.reviewed.bytes
    });
  } catch (error) {
    if (error instanceof CleanserMetadataV2Error) {
      const detail = String(error.message || "").toLowerCase();
      const code = detail.includes("utf-8") || detail.includes("nul byte")
        ? "invalid_utf8"
        : "invalid_reviewed_file";
      throw new ProductReviewImportError(code, 400);
    }
    throw error;
  }
}
