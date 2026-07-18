import { getCanonicalProductionOrigin } from "@/lib/canonical-site-origin";
import {
  createSignOutRouteHandlers,
  getSignOutRuntimeOriginContract
} from "@/lib/security/signout-request-policy";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const signOutHandlers = createSignOutRouteHandlers({
  createSupabaseClient: createServerSupabaseClient,
  getRuntimeOriginContract() {
    return getSignOutRuntimeOriginContract({
      vercelEnvironment: process.env.VERCEL_ENV,
      configuredProductionOrigin: process.env.NEXT_PUBLIC_SITE_URL,
      canonicalProductionOrigin: getCanonicalProductionOrigin()
    });
  }
});

export const GET = signOutHandlers.GET;
export const HEAD = signOutHandlers.HEAD;
export const OPTIONS = signOutHandlers.OPTIONS;
export const POST = signOutHandlers.POST;
