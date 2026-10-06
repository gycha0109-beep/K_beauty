import { notFound, redirect } from "next/navigation";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import {
  runCosrxAuthorityPreflight,
  SubjectAuthorityUpgradeError
} from "@/lib/admin/cosrx-subject-authority-upgrade";
import CosrxSubjectAuthorityUpgradeAction from "@/app/admin/products/trust/cosrx-subject-authority-upgrade/CosrxSubjectAuthorityUpgradeAction";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "COSRX Subject 권위 승격"
};

export default async function CosrxSubjectAuthorityUpgradePage() {
  const access = await requireAdminCapability(
    ADMIN_CAPABILITIES.PRODUCTS_REVIEW
  );

  if (!access.authenticated || !access.accountUser) {
    redirect("/?auth_required=admin");
  }

  if (!access.allowed || !access.userId) {
    notFound();
  }

  try {
    const preflight = await runCosrxAuthorityPreflight(access.userId);
    return (
      <div className="mx-auto w-full max-w-4xl">
        <CosrxSubjectAuthorityUpgradeAction preflight={preflight} />
      </div>
    );
  } catch (error) {
    const code =
      error instanceof SubjectAuthorityUpgradeError
        ? error.code
        : "subject_authority_upgrade_preflight_failed";

    return (
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
        <h1 className="text-lg font-bold">COSRX Subject 권위 승격</h1>
        <p className="mt-3 text-sm text-red-800 dark:text-red-200">
          Production 사전검증을 불러오지 못했습니다.
        </p>
        <p className="mt-2 font-mono text-xs text-red-700/80 dark:text-red-300/80">
          {code}
        </p>
      </div>
    );
  }
}
