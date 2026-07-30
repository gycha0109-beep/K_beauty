import { NextResponse } from "next/server";
import { getCanonicalProductionRedirectUrl } from "@/lib/canonical-site-origin";
import securityHeaderPolicy from "@/lib/security/security-headers";
import { updateSession } from "@/lib/supabase/middleware";

const {
  applyDocumentSecurityHeaders,
  createDocumentSecurityContext,
  isDocumentRequest
} = securityHeaderPolicy;

const CSP_HEADER_NAME = "Content-Security-Policy";
const SCRIPT_SRC_PREFIX = "script-src ";
const WASM_EXECUTION_SOURCE = "'wasm-unsafe-eval'";

function createSecurityPolicyUnavailableResponse() {
  return NextResponse.json(
    { success: false, error: "security_policy_unavailable" },
    { status: 503 }
  );
}

function enableWasmExecution(contentSecurityPolicy) {
  if (contentSecurityPolicy.includes(WASM_EXECUTION_SOURCE)) {
    return contentSecurityPolicy;
  }

  if (!contentSecurityPolicy.includes(SCRIPT_SRC_PREFIX)) {
    throw new Error("script_src_directive_missing");
  }

  return contentSecurityPolicy.replace(
    SCRIPT_SRC_PREFIX,
    `${SCRIPT_SRC_PREFIX}${WASM_EXECUTION_SOURCE} `
  );
}

export async function middleware(request) {
  if (isDocumentRequest(request)) {
    let securityContext;
    let contentSecurityPolicy;
    let requestHeaders;

    try {
      securityContext = createDocumentSecurityContext({
        requestHeaders: request.headers,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        isDevelopment: process.env.NODE_ENV === "development",
        requestUrl: request.url
      });
      contentSecurityPolicy = enableWasmExecution(
        securityContext.contentSecurityPolicy
      );
      requestHeaders = new Headers(securityContext.requestHeaders);
      requestHeaders.set(CSP_HEADER_NAME, contentSecurityPolicy);
    } catch {
      return createSecurityPolicyUnavailableResponse();
    }

    const canonicalUrl = getCanonicalProductionRedirectUrl(request.url);

    if (canonicalUrl) {
      return applyDocumentSecurityHeaders(
        NextResponse.redirect(canonicalUrl, 307),
        contentSecurityPolicy
      );
    }

    const response = await updateSession(request, {
      requestHeaders
    });
    return applyDocumentSecurityHeaders(
      response,
      contentSecurityPolicy
    );
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|opengraph-image.png|twitter-image.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
