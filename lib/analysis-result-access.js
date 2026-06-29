import "server-only";

import {
  normalizeStoredAnalysisResult,
  PUBLIC_ANALYSIS_RESULT_SELECT
} from "@/lib/analysis-results";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRouteSupabaseUser } from "@/lib/supabase/server-client";

export const ANALYSIS_RESULT_ACCESS_SELECT = `${PUBLIC_ANALYSIS_RESULT_SELECT}, user_id`;

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

export async function getAnalysisResultForShare({ shareId, request = null } = {}) {
  if (!shareId) {
    return null;
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("analysis_results")
    .select(ANALYSIS_RESULT_ACCESS_SELECT)
    .eq("share_id", shareId)
    .single();

  if (error || !data) {
    return null;
  }

  if (!data.is_public) {
    const currentUser = await getCurrentUserFromRequest(request);

    if (!currentUser?.id || currentUser.id !== data.user_id) {
      return null;
    }
  }

  return normalizeStoredAnalysisResult(data);
}

export async function getAnalysisResultOwnerUserId(request) {
  const currentUser = await getCurrentUserFromRequest(request);

  return currentUser?.id || null;
}
