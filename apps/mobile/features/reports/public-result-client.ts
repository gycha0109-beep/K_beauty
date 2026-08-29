import { getMobileApiBaseUrl } from "../../lib/env";
import type { NativeFreeSavedResult } from "./saved-report-client";

export type NativePublicResultLoadResult =
  | Readonly<{ status: "invalid" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "rate_limited" }>
  | Readonly<{ status: "unavailable" }>
  | Readonly<{ status: "loaded"; shareId: string; result: NativeFreeSavedResult }>;

const SHARE_ID_PATTERN = /^(?:[A-Za-z0-9_-]{8}|[A-Za-z0-9_-]{22})$/;

export function parseNativePublicResultShareId(value: unknown) {
  if (typeof value !== "string" || !SHARE_ID_PATTERN.test(value)) return null;
  return value;
}

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

export async function loadNativePublicResult(shareId: string): Promise<NativePublicResultLoadResult> {
  const canonicalShareId = parseNativePublicResultShareId(shareId);
  if (!canonicalShareId) return { status: "invalid" };

  try {
    const response = await fetch(
      `${getMobileApiBaseUrl()}/api/results/${encodeURIComponent(canonicalShareId)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include"
      }
    );
    const payload = await readJson(response);

    if (response.status === 404) return { status: "not_found" };
    if (response.status === 429) return { status: "rate_limited" };
    if (response.status === 503) return { status: "unavailable" };
    if (!response.ok) return { status: "unavailable" };

    if (
      payload?.success !== true ||
      !payload.result ||
      typeof payload.result !== "object" ||
      payload.result.shareId !== canonicalShareId
    ) {
      return { status: "unavailable" };
    }

    return {
      status: "loaded",
      shareId: canonicalShareId,
      result: payload.result as NativeFreeSavedResult
    };
  } catch {
    return { status: "unavailable" };
  }
}
