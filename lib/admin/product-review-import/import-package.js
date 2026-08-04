import "server-only";

import {
  IntakeFileError,
  parseReviewedBatchFiles
} from "../../../crawler/lib/reviews/reviewed-intake-parser";
import {
  mapProductReviewImportCode,
  ProductReviewImportError
} from "@/lib/admin/product-review-import/import-error-map";

export function parseProductReviewImportPackage(files) {
  try {
    return parseReviewedBatchFiles({
      batch: files.batch.bytes,
      manifest: files.manifest.bytes,
      evidence: files.evidence.bytes,
      reviewed: files.reviewed.bytes
    });
  } catch (error) {
    if (error instanceof IntakeFileError) {
      const detail = typeof error.message === "string" ? error.message.toLowerCase() : "";
      const code =
        detail.includes("utf-8") || detail.includes("nul byte")
          ? "invalid_utf8"
          : mapProductReviewImportCode(error.code, "invalid_reviewed_file");
      throw new ProductReviewImportError(code, 400);
    }
    throw error;
  }
}
