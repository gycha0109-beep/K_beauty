import { NextResponse } from "next/server";
import { getCanonicalProductionRedirectUrl } from "@/lib/canonical-site-origin";
import securityHeaderPolicy from "@/lib/security/security-headers";
import { updateSession } from "@/lib/supabase/middleware";

const {
  applyDocumentSecurityHeaders,
  createDocumentSecurityContext,
  isDocumentRequest
} = securityHeaderPolicy;

function createSecurityPolicyUnavailableResponse() {
  return NextResponse.json(
    { success: false, error: "security_policy_unavailable" },
    { status: 503 }
  );
}

export async function middleware(request) {
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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|opengraph-image.png|twitter-image.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
