import "server-only";

import { resolvePremiumAccessForUser } from "@/lib/premium-access";
import { selectPremiumRoutePrincipal } from "@/lib/premium-route-principal";
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
  const cookieClient = await createServerSupabaseClient();
  const cookieUser = await resolveClientUser(cookieClient);

  const bearerToken = getBearerToken(request);
  const bearerClient = bearerToken ? createRouteSupabaseAuthClient(bearerToken) : null;
  const bearerUser = await resolveClientUser(bearerClient);

  const principal = selectPremiumRoutePrincipal({
    cookieUser,
    cookieClient,
    bearerUser,
    bearerClient
  });

  return {
    ...principal,
    access: resolvePremiumAccessForUser(principal.user)
  };
}
