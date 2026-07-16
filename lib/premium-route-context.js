import "server-only";

import { isAccountUser, resolvePremiumAccessForRequest } from "@/lib/premium-access";
import { createRouteSupabaseAuthClient } from "@/lib/supabase/server-client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getBearerToken(request) {
  const authorizationHeader = request.headers.get("authorization");
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token.trim() : null;
}

async function resolveClientUser(client) {
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  return error ? null : data?.user || null;
}

export async function resolvePremiumRouteContext(request) {
  const { user, access } = await resolvePremiumAccessForRequest(request);
  if (!isAccountUser(user)) {
    return { user, access, supabase: null, authSource: "none", principalAligned: true };
  }

  const cookieClient = await createServerSupabaseClient();
  const cookieUser = await resolveClientUser(cookieClient);
  if (cookieUser?.id === user.id) {
    return { user, access, supabase: cookieClient, authSource: "cookie", principalAligned: true };
  }

  const bearerToken = getBearerToken(request);
  const bearerClient = bearerToken ? createRouteSupabaseAuthClient(bearerToken) : null;
  const bearerUser = await resolveClientUser(bearerClient);
  if (bearerUser?.id === user.id) {
    return { user, access, supabase: bearerClient, authSource: "bearer", principalAligned: true };
  }

  return {
    user,
    access,
    supabase: null,
    authSource: "none",
    principalAligned: !cookieUser && !bearerUser
  };
}
