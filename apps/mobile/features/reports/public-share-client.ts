import type { Session } from "@supabase/auth-js";
import { getMobileApiBaseUrl } from "../../lib/env";
import { getNativeFreeShareId } from "./saved-report-client";

export type NativePublicShare = Readonly<{
  shareId: string;
  sharePath: string;
  shareUrl: string;
}>;

function getPublishErrorCode(response: Response, payload: any) {
  if (response.status === 401) return "mobile_public_share_unauthorized";
  if (response.status === 404) return "mobile_public_share_not_found";
  if (response.status === 429) return "mobile_public_share_rate_limited";
  if (response.status >= 500) return "mobile_public_share_unavailable";
  return typeof payload?.error === "string" && payload.error
    ? payload.error
    : "mobile_public_share_failed";
}

export function buildNativePublicShareUrl(sharePath: string) {
  const shareId = getNativeFreeShareId(sharePath);
  if (!shareId) throw new Error("mobile_public_share_path_invalid");

  const apiUrl = new URL(getMobileApiBaseUrl());
  const shareUrl = new URL(`/r/${encodeURIComponent(shareId)}`, `${apiUrl.origin}/`);

  if (shareUrl.origin !== apiUrl.origin) {
    throw new Error("mobile_public_share_origin_mismatch");
  }
  if (process.env.NODE_ENV === "production" && shareUrl.protocol !== "https:") {
    throw new Error("mobile_public_share_https_required");
  }

  return shareUrl.toString();
}

export async function publishNativeFreeSavedReport(
  session: Session,
  shareId: string
): Promise<NativePublicShare> {
  if (!/^[A-Za-z0-9_-]{8}$|^[A-Za-z0-9_-]{22}$/.test(shareId)) {
    throw new Error("mobile_public_share_id_invalid");
  }

  const response = await fetch(`${getMobileApiBaseUrl()}/api/results`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      share: true,
      shareId
    })
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getPublishErrorCode(response, payload));
  }

  const publishedShareId = typeof payload?.shareId === "string" ? payload.shareId : null;
  const sharePath = typeof payload?.sharePath === "string" ? payload.sharePath : null;
  const canonicalShareId = getNativeFreeShareId(sharePath);

  if (
    payload?.success !== true ||
    payload?.publicShared !== true ||
    !publishedShareId ||
    publishedShareId !== shareId ||
    canonicalShareId !== shareId ||
    !sharePath
  ) {
    throw new Error("mobile_public_share_shape_invalid");
  }

  return {
    shareId,
    sharePath,
    shareUrl: buildNativePublicShareUrl(sharePath)
  };
}
