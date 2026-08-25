import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { writeSafeLog } from "@/lib/security/error-redaction";

export const SAVED_REPORT_HISTORY_DEFAULT_LIMIT = 5;
export const SAVED_REPORT_HISTORY_MAX_LIMIT = 12;
export const SAVED_REPORT_HISTORY_MAX_OFFSET = 240;

const SAVED_REPORT_HISTORY_COLUMNS = [
  "id",
  "report_type",
  "source_type",
  "source_session_id",
  "title",
  "report_version",
  "created_at",
  "updated_at"
].join(",");

export function parseSavedReportHistoryLimit(value) {
  if (value === null || value === undefined || value === "") {
    return SAVED_REPORT_HISTORY_DEFAULT_LIMIT;
  }

  if (!/^\d+$/.test(String(value))) {
    return null;
  }

  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1 || limit > SAVED_REPORT_HISTORY_MAX_LIMIT) {
    return null;
  }

  return limit;
}

export function parseSavedReportHistoryOffset(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (!/^\d+$/.test(String(value))) {
    return null;
  }

  const offset = Number(value);

  if (!Number.isInteger(offset) || offset < 0 || offset > SAVED_REPORT_HISTORY_MAX_OFFSET) {
    return null;
  }

  return offset;
}

export function getSavedReportHistoryPath(report) {
  if (!report || typeof report !== "object") {
    return null;
  }

  if (report.report_type === "premium" && report.id) {
    return `/result/full-report?savedReportId=${encodeURIComponent(report.id)}`;
  }

  if (
    report.report_type === "free" &&
    report.source_type === "share" &&
    report.source_session_id
  ) {
    return `/r/${encodeURIComponent(report.source_session_id)}`;
  }

  return null;
}

function normalizeSavedReport(report) {
  return {
    id: report.id,
    reportType: report.report_type,
    title: report.title || null,
    reportVersion: report.report_version || null,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
    href: getSavedReportHistoryPath(report)
  };
}

export async function getMySavedReportHistory({ limit, offset } = {}) {
  const normalizedLimit = parseSavedReportHistoryLimit(limit);
  const normalizedOffset = parseSavedReportHistoryOffset(offset);

  if (normalizedLimit === null || normalizedOffset === null) {
    return {
      status: 400,
      error: "invalid_saved_report_history_query",
      payload: null
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      status: 401,
      error: "unauthorized",
      payload: null
    };
  }

  try {
    const { data, error } = await supabase
      .from("saved_reports")
      .select(SAVED_REPORT_HISTORY_COLUMNS)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(normalizedOffset, normalizedOffset + normalizedLimit);

    if (error) {
      throw new Error("saved_report_history_query_failed");
    }

    const rows = Array.isArray(data) ? data : [];
    const hasMore = rows.length > normalizedLimit;
    const reports = rows.slice(0, normalizedLimit).map(normalizeSavedReport);

    return {
      status: 200,
      error: null,
      payload: {
        reports,
        nextOffset: hasMore ? normalizedOffset + normalizedLimit : null
      }
    };
  } catch {
    writeSafeLog("error", {
      event: "saved_report_history_failed",
      category: "database_unavailable",
      operation: "saved_report_history",
      dependency: "supabase",
      retryable: true
    });

    return {
      status: 500,
      error: "saved_report_history_unavailable",
      payload: null
    };
  }
}
