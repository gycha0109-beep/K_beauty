import "server-only";

import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import { isAllowedAdminMutationRequest } from "@/lib/admin/request-policy";
import { parseProductReviewImportRequest } from "@/lib/admin/product-review-import/multipart-boundary";
import { parseProductReviewImportPackage } from "@/lib/admin/product-review-import/import-package";
import { executeProductReviewImportConfirm } from "@/lib/admin/product-review-import/import-confirm";
import { createProductReviewImportConfirmHandler } from "@/lib/admin/product-review-import/http-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export const POST = createProductReviewImportConfirmHandler({
  resolveAccess: () => requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW),
  isAllowedOrigin: isAllowedAdminMutationRequest,
  parseMultipart: parseProductReviewImportRequest,
  parsePackage: parseProductReviewImportPackage,
  executeConfirm: executeProductReviewImportConfirm
});
