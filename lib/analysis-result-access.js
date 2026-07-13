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

  const publicAudience = resolveAnalysisResultReadAudience(data);

  if (publicAudience === "public") {
    return serializePublicAnalysisResult(data);
  }

  if (!data.is_public) {
    const currentUser = await getCurrentUserFromRequest(request);

    if (resolveAnalysisResultReadAudience(data, currentUser?.id) !== "owner") {
      return null;
    }

    return serializeOwnerAnalysisResult(data);
  }

  return null;
}

export async function getAnalysisResultOwnerUserId(request) {
  const currentUser = await getCurrentUserFromRequest(request);

  return currentUser?.id || null;
}
