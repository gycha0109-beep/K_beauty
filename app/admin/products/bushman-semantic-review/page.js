import { notFound, redirect } from "next/navigation";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import { loadBushmanSemanticReviewWorkbench } from "@/lib/admin/bushman-sunscreen-semantic-review";
import BushmanSemanticReviewWorkbench from "./BushmanSemanticReviewWorkbench";

export const dynamic = "force-dynamic";
export const metadata = { title: "부쉬맨 선크림 · 제품 정보 검토" };

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
  } catch {
    return (
      <main className="mx-auto max-w-3xl rounded-2xl border border-red-200 p-6 dark:border-red-900">
        <h1 className="text-xl font-bold">부쉬맨 선크림 정보 확인</h1>
        <p className="mt-3 text-sm">관리자 검토 상태를 불러오지 못했습니다. 운영 DB와 접근 권한을 확인해 주세요.</p>
        <p className="mt-2 text-xs">검토 화면을 불러올 수 없습니다. 새로고침 후에도 문제가 계속되면 관리자 권한과 서비스 연결을 확인해 주세요.</p>
      </main>
    );
  }
}
