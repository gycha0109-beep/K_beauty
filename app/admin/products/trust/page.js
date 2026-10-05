import { notFound, redirect } from "next/navigation";
import TrustQueueWorkbench from "@/app/admin/products/trust/TrustQueueWorkbench";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import {
  loadTrustAdminQueue,
  normalizeTrustQueueFilter,
  TrustQueueOperationError
} from "@/lib/admin/trust-queue";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "제품 신뢰 검토 대기열"
};

function ErrorState({ code }) {
  const message =
    code === "trust_queue_data_unavailable"
      ? "TRUST 검토 대기열을 불러오지 못했습니다. 데이터베이스 상태를 확인해 주세요."
      : code === "trust_queue_service_unavailable"
        ? "관리자 데이터 연결을 사용할 수 없습니다."
        : "TRUST 검토 화면을 준비하지 못했습니다.";

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
      <p className="text-sm font-semibold text-red-800 dark:text-red-200">{message}</p>
      <p className="mt-2 text-xs text-red-700/80 dark:text-red-300/80">세부 오류 정보는 서버 로그에 기록됩니다.</p>
    </div>
  );
}

export default async function TrustAdminQueuePage({ searchParams }) {
  const access = await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_READ);

  if (!access.authenticated || !access.accountUser) {
    redirect("/?auth_required=admin");
  }

  if (!access.allowed) {
    notFound();
  }

  const params = await searchParams;
  const filter = normalizeTrustQueueFilter(params?.blocker);
  const taskId = typeof params?.task === "string" ? params.task : null;
  const searchQuery = typeof params?.q === "string" ? params.q.slice(0, 200) : "";

  try {
    const queue = await loadTrustAdminQueue({ filter, taskId, limit: 100 });
    const canReview = access.capabilities.includes(
      ADMIN_CAPABILITIES.PRODUCTS_REVIEW
    );
    return (
      <TrustQueueWorkbench
        queue={queue}
        canReview={canReview}
        initialSearch={searchQuery}
      />
    );
  } catch (error) {
    if (error instanceof TrustQueueOperationError) {
      return <ErrorState code={error.code} />;
    }

    return <ErrorState code="trust_queue_operation_failed" />;
  }
}
