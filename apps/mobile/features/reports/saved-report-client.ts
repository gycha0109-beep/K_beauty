import type { Session } from "@supabase/auth-js";
import { getMobileApiBaseUrl } from "../../lib/env";
import { fetchNativeMyDashboard, type NativeMyDashboard, type NativeSavedReport } from "../../lib/my";

export type NativeSavedReportMetadata = Readonly<{
  id: string;
  reportType: "free" | "premium";
  title: string | null;
  reportVersion: string | null;
  createdAt: string | null;
}>;

export type NativeFreeSavedResult = Readonly<{
  shareId?: string;
  schemaVersion?: number | null;
  locale?: string;
  skinType?: string;
  mainConcerns?: string[];
  summary?: string;
  routineAm?: string[];
  routinePm?: string[];
  topPick?: Record<string, unknown> | null;
  categoryPicks?: Record<string, unknown>[];
  routineStructure?: Record<string, unknown> | null;
  isPublic?: boolean;
}>;

export type NativeSavedReportRead =
  | Readonly<{
      kind: "free";
      metadata: NativeSavedReportMetadata;
      result: NativeFreeSavedResult;
    }>
  | Readonly<{
      kind: "premium";
      metadata: NativeSavedReportMetadata;
      report: Record<string, unknown>;
    }>;

export type NativeSavedReportLoadResult =
  | Readonly<{ status: "empty" }>
  | Readonly<{ status: "loaded"; value: NativeSavedReportRead }>;

type SavedReportDashboard = NativeMyDashboard & {
  latestSharePath?: string | null;
  latestSavedReport: (NativeSavedReport & {
    source_type?: string | null;
    source_session_id?: string | null;
    report_version?: string | null;
    updated_at?: string | null;
  }) | null;
};

function bearerHeaders(session: Session) {
  return {
    Authorization: `Bearer ${session.access_token}`,
    Accept: "application/json"
  };
}

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

function getErrorCode(response: Response, payload: any, fallback: string) {
  if (response.status === 401) return "mobile_saved_report_unauthorized";
  if (response.status === 404) return "mobile_saved_report_not_found";
  if (response.status === 429) return "mobile_saved_report_rate_limited";
  if (response.status >= 500) return "mobile_saved_report_unavailable";
  return typeof payload?.error === "string" && payload.error ? payload.error : fallback;
}

function requireOk(response: Response, payload: any, fallback: string) {
  if (!response.ok) throw new Error(getErrorCode(response, payload, fallback));
}

function normalizeReportType(value: unknown): "free" | "premium" | null {
  return value === "free" || value === "premium" ? value : null;
}

function toMetadata(report: SavedReportDashboard["latestSavedReport"]): NativeSavedReportMetadata | null {
  const reportType = normalizeReportType(report?.report_type);
  if (!report?.id || !reportType) return null;

  return {
    id: report.id,
    reportType,
    title: typeof report.title === "string" && report.title.trim() ? report.title.trim() : null,
    reportVersion:
      typeof report.report_version === "string" && report.report_version.trim()
        ? report.report_version.trim()
        : null,
    createdAt: typeof report.created_at === "string" ? report.created_at : null
  };
}

export function getNativeFreeShareId(latestSharePath: unknown) {
  if (typeof latestSharePath !== "string" || !latestSharePath.startsWith("/r/")) return null;
  const encoded = latestSharePath.slice(3);
  if (!encoded || encoded.includes("/") || encoded.includes("?")) return null;

  try {
    const decoded = decodeURIComponent(encoded);
    return /^[A-Za-z0-9_-]{8}$|^[A-Za-z0-9_-]{22}$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

async function loadFreeSavedReport(
  session: Session,
  metadata: NativeSavedReportMetadata,
  latestSharePath: unknown
): Promise<NativeSavedReportRead> {
  const shareId = getNativeFreeShareId(latestSharePath);
  if (!shareId) throw new Error("mobile_saved_report_reentry_unavailable");

  const response = await fetch(
    `${getMobileApiBaseUrl()}/api/results/${encodeURIComponent(shareId)}`,
    {
      method: "GET",
      headers: bearerHeaders(session),
      credentials: "include"
    }
  );
  const payload = await readJson(response);
  requireOk(response, payload, "mobile_saved_report_free_read_failed");

  if (payload?.success !== true || !payload.result || typeof payload.result !== "object") {
    throw new Error("mobile_saved_report_free_shape_invalid");
  }

  return {
    kind: "free",
    metadata,
    result: payload.result as NativeFreeSavedResult
  };
}

async function loadPremiumSavedReport(
  session: Session,
  metadata: NativeSavedReportMetadata,
  locale: "ko" | "en"
): Promise<NativeSavedReportRead> {
  const response = await fetch(`${getMobileApiBaseUrl()}/api/full-report`, {
    method: "POST",
    headers: {
      ...bearerHeaders(session),
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      savedReportId: metadata.id,
      locale
    })
  });
  const payload = await readJson(response);
  requireOk(response, payload, "mobile_saved_report_premium_read_failed");

  if (!payload || typeof payload !== "object" || payload?.meta?.source !== "saved-report") {
    throw new Error("mobile_saved_report_premium_shape_invalid");
  }

  return {
    kind: "premium",
    metadata,
    report: payload as Record<string, unknown>
  };
}

export async function loadLatestNativeSavedReport(
  session: Session,
  locale: "ko" | "en"
): Promise<NativeSavedReportLoadResult> {
  const dashboard = await fetchNativeMyDashboard(session) as SavedReportDashboard;
  const metadata = toMetadata(dashboard.latestSavedReport);

  if (!metadata) return { status: "empty" };

  const value = metadata.reportType === "premium"
    ? await loadPremiumSavedReport(session, metadata, locale)
    : await loadFreeSavedReport(session, metadata, dashboard.latestSharePath);

  return { status: "loaded", value };
}
