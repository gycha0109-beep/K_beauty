import { notFound, redirect } from "next/navigation";
import ProductReviewImportWorkbench from "@/app/admin/products/reviews/import/ProductReviewImportWorkbench";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Product Review Import"
};

export default async function ProductReviewImportPage() {
  const access = await requireAdminCapability(
    ADMIN_CAPABILITIES.PRODUCTS_REVIEW
  );

  if (!access.authenticated || !access.accountUser) {
    redirect("/?auth_required=admin");
  }
  if (!access.allowed) {
    notFound();
  }

  return <ProductReviewImportWorkbench />;
}
