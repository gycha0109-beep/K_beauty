import { NextResponse } from "next/server";
import { getCanonicalProductionRedirectUrl } from "@/lib/canonical-site-origin";
import { updateSession } from "@/lib/supabase/middleware";

function isDocumentNavigation(request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  const destination = request.headers.get("sec-fetch-dest");
  const accept = request.headers.get("accept") || "";
  return destination === "document" || accept.includes("text/html");
}

export async function middleware(request) {
  if (isDocumentNavigation(request)) {
    const canonicalUrl = getCanonicalProductionRedirectUrl(request.url);

    if (canonicalUrl) {
      return NextResponse.redirect(canonicalUrl, 307);
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|opengraph-image.png|twitter-image.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
