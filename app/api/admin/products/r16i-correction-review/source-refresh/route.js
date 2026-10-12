import { NextResponse } from "next/server";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import { inspectR16ISources } from "@/lib/product-intelligence/r16i-live-source-inspection.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function respond(body, code = 200) {
  return NextResponse.json(body, { status: code, headers: {
    "Cache-Control": "private, no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store"
  } });
}

/** Two fixed seller origins only. Live HTML access never constitutes checkout approval. */
export async function GET() {
  const access = await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW);
  if (!access.authenticated || !access.accountUser)
    return respond({ ok: false, error: "관리자 로그인이 필요합니다." }, 401);
  if (!access.allowed || !access.userId)
    return respond({ ok: false, error: "제품 검토 권한이 없습니다." }, 403);
  const inspection = await inspectR16ISources();
  return respond({ ok: true, mode: "판매처 접근 상태 확인", inspection });
}
