import { notFound, redirect } from "next/navigation";
import ProductReviewWorkbench from "@/app/admin/products/reviews/ProductReviewWorkbench";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import {
  loadProductReviewWorkbench,
  normalizeProductReviewFilter,
  ProductReviewOperationError
} from "@/lib/admin/product-reviews";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Product Candidate Reviews"
};

function ErrorState({ code }) {
  const message =
    code === "product_review_data_unavailable"
      ? "검토 데이터를 불러오지 못했습니다. 데이터베이스와 migration 상태를 확인해 주세요."
      : "제품 후보 검수 화면을 준비하지 못했습니다.";

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
      <p className="text-sm font-semibold text-red-800 dark:text-red-200">{message}</p>
      <p className="mt-2 text-xs text-red-700/80 dark:text-red-300/80">오류 코드: {code}</p>
    </div>
  );
}

export default async function ProductCandidateReviewsPage({ searchParams }) {
  const access = await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_READ);

  if (!access.authenticated || !access.accountUser) {
    redirect("/?auth_required=admin");
  }

  if (!access.allowed) {
    notFound();
  }

  const params = await searchParams;
  const filter = normalizeProductReviewFilter(params?.status);
  const candidateId = typeof params?.candidate === "string" ? params.candidate : null;

  try {
    const workbench = await loadProductReviewWorkbench({
      filter,
      candidateId,
      limit: 100
    });

    return (
      <ProductReviewWorkbench
        workbench={workbench}
        canReview={access.capabilities.includes(ADMIN_CAPABILITIES.PRODUCTS_REVIEW)}
      />
    );
  } catch (error) {
    if (error instanceof ProductReviewOperationError) {
      return <ErrorState code={error.code} />;
    }

    return <ErrorState code="product_review_operation_failed" />;
  }
}
