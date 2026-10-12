import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { readR16IR4D4Review } from "@/lib/product-offer-r16i-r4-d4-db-reader.mjs";
import R16ICorrectionEvidenceWorkbench from "./R16ICorrectionEvidenceWorkbench";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const metadata = {
  title: "에스네이처 상품 정정 · 근거 검토",
  robots: { index: false, follow: false, nocache: true }
};

export default async function R16ICorrectionReviewPage() {
  const access = await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW);
  if (!access.authenticated || !access.accountUser) redirect("/?auth_required=admin");
  if (!access.allowed || !access.userId) notFound();

  let review = null;
  try {
    const client = createSupabaseAdminClient();
    if (!client) throw new Error("UNAVAILABLE");
    review = await readR16IR4D4Review(client);
  } catch {
    return (
      <section className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-white p-6 dark:border-red-900 dark:bg-[#17191f]">
        <h1 className="text-xl font-semibold">상품 정정 근거를 읽지 못했습니다</h1>
        <p className="mt-3 text-sm text-[#677080] dark:text-[#aeb8c6]">
          읽기 전용 데이터 조회에 실패했습니다. 승인이나 정정은 진행되지 않았습니다.
        </p>
        <Link href="/admin/products/trust" className="mt-5 inline-block text-sm font-semibold underline underline-offset-4">
          제품 신뢰 검토로 돌아가기
        </Link>
      </section>
    );
  }
  return <R16ICorrectionEvidenceWorkbench review={review} />;
}
