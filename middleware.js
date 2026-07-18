import { NextResponse } from "next/server";
import { getCanonicalProductionRedirectUrl } from "@/lib/canonical-site-origin";
import securityHeaderPolicy from "@/lib/security/security-headers";
import { updateSession } from "@/lib/supabase/middleware";

const {
  applyDocumentSecurityHeaders,
  createDocumentSecurityContext,
  isDocumentRequest
} = securityHeaderPolicy;

const SEC_02_PROBE_NONCE = "sec02-594a3936-20260718";
const SEC_02_PROBE_BRANCH = "feature/premium-beta-flow";

function getSec02ProbeRewrite(request) {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== SEC_02_PROBE_BRANCH ||
    request.nextUrl.pathname !== "/"
  ) {
    return null;
  }

  const target = request.nextUrl.clone();
  target.pathname = "/api/internal/sec-02-live-mutation-probe";
  target.search = "";
  target.searchParams.set("run", SEC_02_PROBE_NONCE);
  return target;
}

export async function middleware(request) {
  const sec02ProbeRewrite = getSec02ProbeRewrite(request);
  if (sec02ProbeRewrite) {
    return NextResponse.rewrite(sec02ProbeRewrite);
  }

  if (isDocumentRequest(request)) {
    let securityContext;

    try {
      securityContext = createDocumentSecurityContext({
        requestHeaders: request.headers,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        isDevelopment: process.env.NODE_ENV === "development",
        requestUrl: request.url
      });
    } catch {
      return createSecurityPolicyUnavailableResponse();
    }

    const canonicalUrl = getCanonicalProductionRedirectUrl(request.url);

    if (canonicalUrl) {
      return applyDocumentSecurityHeaders(
        NextResponse.redirect(canonicalUrl, 307),
        securityContext.contentSecurityPolicy
      );
    }

    const response = await updateSession(request, {
      requestHeaders: securityContext.requestHeaders
    });
    return applyDocumentSecurityHeaders(
      response,
      securityContext.contentSecurityPolicy
    );
  }

  return updateSession(request);
}

function createSecurityPolicyUnavailableResponse() {
  return NextResponse.json(
    { success: false, error: "security_policy_unavailable" },
    { status: 503 }
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|opengraph-image.png|twitter-image.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
