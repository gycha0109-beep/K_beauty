import { NextResponse } from "next/server";
import { requireAdminCapability } from "@/lib/admin/access";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfig
} from "@/lib/supabase-admin";
import {
  inspectFaceLabProductionIdentity
} from "@/lib/face-lab-v2/production-identity-readback-core.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function respond(body, status) {
  return NextResponse.json(body, { status, headers: HEADERS });
}

/**
 * Owner-only, on-demand HEAD metadata probe. Never exposes environment
 * variables, token material, project URL, record data, or internal errors.
 * No mutation, schema discovery, migration repair or automatic PASS.
 */
export async function GET(request) {
  const access = await requireAdminCapability(ADMIN_CAPABILITIES.AUDIT_READ);
  if (!access.authenticated || !access.accountUser)
    return respond({ok:false,error:"관리자 로그인이 필요합니다."},401);
  if (!access.allowed || !access.userId)
    return respond({ok:false,error:"감사 조회 권한이 없습니다."},403);

  if (new URL(request.url).search)
    return respond({ok:false,error:"조회 매개변수는 허용하지 않습니다."},400);

  // Only configured production deployments can trigger this server read.
  if (process.env.VERCEL_ENV !== "production")
    return respond({ok:false,status:"HOLD",reason:"not_production_runtime"},409);

  const configured = getSupabaseAdminConfig();
  if (!configured)
    return respond({ok:false,status:"HOLD",reason:"server_connection_unavailable"},503);

  const result = await inspectFaceLabProductionIdentity({
    environment: process.env.VERCEL_ENV,
    configuredSupabaseUrl: configured.supabaseUrl,
    // No body/count requested; PostgREST HEAD with limit=0, under a
    // server-only service role credential, solely after the ref matches.
    probeReadOnly: async () => {
      const client = createSupabaseAdminClient();
      if (!client) throw new Error("unavailable");
      return client.from("saved_reports")
        .select("face_lab_revision", {head:true}).limit(0);
    }
  });
  const status = result.serverProjectMatch === false ? 409 :
    result.dbHeadReadback === "failed" ? 503 : 200;
  return respond({ok:true,mode:"read_only_identity_probe",...result},status);
}
