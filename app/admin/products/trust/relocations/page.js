import { notFound, redirect } from "next/navigation";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import {
  loadTrustGroupedRelocationQueue,
  TrustGroupedRelocationError,
} from "@/lib/admin/trust-grouped-relocation";
import TrustGroupedRelocationWorkbench from "@/app/admin/products/trust/relocations/TrustGroupedRelocationWorkbench";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "TRUST Source Relocations",
};

function ErrorState({ code }) {
  const message =
    code === "trust_grouped_relocation_data_unavailable"
      ? "Official-source relocation 검토 데이터를 불러오지 못했습니다."
      : code === "trust_grouped_relocation_service_unavailable"
        ? "관리자 relocation 서비스를 사용할 수 없습니다."
        : "Official-source relocation 검토 화면을 준비하지 못했습니다.";

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
      <p className="text-sm font-semibold text-red-800 dark:text-red-200">
        {message}
      </p>
      <p className="mt-2 text-xs text-red-700/80 dark:text-red-300/80">
        오류 코드: {code}
      </p>
    </div>
  );
}

export default async function TrustGroupedRelocationsPage() {
  const access = await requireAdminCapability(
    ADMIN_CAPABILITIES.PRODUCTS_REVIEW,
  );

  if (!access.authenticated || !access.accountUser) {
    redirect("/?auth_required=admin");
  }
  if (!access.allowed || !access.userId) {
    notFound();
  }

  try {
    const queue = await loadTrustGroupedRelocationQueue({
      actorUserId: access.userId,
      limit: 50,
    });
    return <TrustGroupedRelocationWorkbench queue={queue} />;
  } catch (error) {
    if (error instanceof TrustGroupedRelocationError) {
      return <ErrorState code={error.code} />;
    }
    return <ErrorState code="trust_grouped_relocation_operation_failed" />;
  }
}
