import { notFound, redirect } from "next/navigation";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import {
  BushmanSemanticReviewError,
  loadBushmanSemanticReviewWorkbench,
} from "@/lib/admin/bushman-sunscreen-semantic-review";
import BushmanSemanticReviewWorkbench from "./BushmanSemanticReviewWorkbench";

export const dynamic = "force-dynamic";
export const metadata = { title: "BUSHMAN 선크림 검토 — 12개 Semantic 항목" };

export default async function BushmanSemanticReviewPage() {
  const access = await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW);
  if (!access.authenticated || !access.accountUser) redirect("/?auth_required=admin");
  if (!access.allowed || !access.userId) notFound();

  try {
    const workbench = await loadBushmanSemanticReviewWorkbench();
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <BushmanSemanticReviewWorkbench workbench={workbench} />
      </main>
    );
  } catch (error) {
    const code = error instanceof BushmanSemanticReviewError
      ? error.code : "semantic_review_operation_failed";
    return (
      <main className="mx-auto max-w-3xl rounded-2xl border border-red-200 p-6 dark:border-red-900">
        <h1 className="text-xl font-bold">BUSHMAN Semantic Review</h1>
        <p className="mt-3 text-sm">관리자 검토 상태를 불러오지 못했습니다. 운영 DB와 접근 권한을 확인해 주세요.</p>
        <p className="mt-2 font-mono text-xs">{code}</p>
      </main>
    );
  }
}
