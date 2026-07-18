import "server-only";

import {
  ANALYSIS_RESULT_READ_SELECT,
  resolveAnalysisResultReadAudience,
  serializeOwnerAnalysisResult,
  serializePublicAnalysisResult
} from "@/lib/analysis-results";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRouteSupabaseUser } from "@/lib/supabase/server-client";

export const ANALYSIS_RESULT_ACCESS_SELECT = `${ANALYSIS_RESULT_READ_SELECT}, user_id`;

async function getCurrentUserFromRequest(request = null) {
  if (request) {
    const routeUser = await getRouteSupabaseUser(request);

    if (routeUser?.id) {
      return routeUser;
    }
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    return user || null;
  } catch {
    return null;
  }
}

export async function readAnalysisResultForShare({ shareId, request = null, supabase = null, viewerUserId = undefined } = {}) {
  if (!shareId) {
    return { ok: true, state: "not_found", result: null };
  }

  const adminSupabase = supabase || createSupabaseAdminClient();

  if (!adminSupabase) {
    return { ok: false, state: "unavailable", result: null };
  }

  const { data, error } = await adminSupabase
    .from("analysis_results")
    .select(ANALYSIS_RESULT_ACCESS_SELECT)
    .eq("share_id", shareId)
    .maybeSingle();

  if (error) {
    return { ok: false, state: "unavailable", result: null };
  }
  if (!data) {
    return { ok: true, state: "not_found", result: null };
  }

  const publicAudience = resolveAnalysisResultReadAudience(data);

  if (publicAudience === "public") {
    return { ok: true, state: "public", result: serializePublicAnalysisResult(data) };
  }

  if (!data.is_public) {
    const currentUserId = viewerUserId === undefined
      ? (await getCurrentUserFromRequest(request))?.id || null
      : viewerUserId;

    if (resolveAnalysisResultReadAudience(data, currentUserId) !== "owner") {
      return { ok: true, state: "not_found", result: null };
    }

    return { ok: true, state: "owner", result: serializeOwnerAnalysisResult(data) };
  }

  return { ok: true, state: "not_found", result: null };
}

function isPermanentAccountUser(user) {
  return Boolean(user?.id) && !user.is_anonymous && user.app_metadata?.provider !== "anonymous";
}

export async function getAnalysisResultForShare(options = {}) {
  const outcome = await readAnalysisResultForShare(options);
  return outcome.ok ? outcome.result : null;
}

export async function getAnalysisResultOwnerUserId(request) {
  const currentUser = await getCurrentUserFromRequest(request);

  return isPermanentAccountUser(currentUser) ? currentUser.id : null;
}

export async function unpublishAnalysisResultForOwner({ shareId, userId, supabase = null } = {}) {
  if (!shareId || !userId) return { ok: true, state: "not_found" };
  const adminSupabase = supabase || createSupabaseAdminClient();
  if (!adminSupabase) return { ok: false, state: "unavailable" };

  const { data, error } = await adminSupabase
    .from("analysis_results")
    .update({ is_public: false })
    .eq("share_id", shareId)
    .eq("user_id", userId)
    .select("share_id, is_public")
    .maybeSingle();

  if (error) return { ok: false, state: "unavailable" };
  return data ? { ok: true, state: "unpublished" } : { ok: true, state: "not_found" };
}
