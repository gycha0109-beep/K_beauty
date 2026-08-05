import "server-only";

import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import { isAllowedAdminMutationRequest } from "@/lib/admin/request-policy";
import { parseProductReviewImportRequest } from "@/lib/admin/product-review-import/multipart-boundary";
import { createProductReviewImportDryRunHandler } from "@/lib/admin/product-review-import/http-handlers";
import { parseProductReviewImportV2Package } from "@/lib/admin/product-review-import-v2/import-package";
import { executeProductReviewImportV2DryRun } from "@/lib/admin/product-review-import-v2/import-dry-run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export const POST = createProductReviewImportDryRunHandler({
  resolveAccess: () => requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW),
  isAllowedOrigin: isAllowedAdminMutationRequest,
  parseMultipart: parseProductReviewImportRequest,
  parsePackage: parseProductReviewImportV2Package,
  executeDryRun: executeProductReviewImportV2DryRun
});
