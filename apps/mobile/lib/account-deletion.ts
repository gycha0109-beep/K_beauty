import type { Session } from "@supabase/auth-js";

import { getMobileApiBaseUrl } from "./env";

function userUsesApple(session: Session) {
  const provider = typeof session.user.app_metadata?.provider === "string"
    ? session.user.app_metadata.provider
    : "";
  const providers = Array.isArray(session.user.app_metadata?.providers)
    ? session.user.app_metadata.providers
    : [];

  return provider === "apple" || providers.includes("apple");
}

export function nativeAccountDeletionNeedsAppleReauthorization(session: Session) {
  return userUsesApple(session);
}

export async function deleteNativeAccount(
  session: Session,
  { appleAuthorizationCode = null }: { appleAuthorizationCode?: string | null } = {}
) {
  const response = await fetch(`${getMobileApiBaseUrl()}/api/my/account`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      confirmation: "delete_account",
      ...(appleAuthorizationCode ? { appleAuthorizationCode } : {})
    })
  });
  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    throw new Error("mobile_account_deletion_unauthorized");
  }

  if (!response.ok || payload?.deleted !== true) {
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : "mobile_account_deletion_failed"
    );
  }

  return {
    deleted: true as const,
    appleRevoked: payload?.appleRevoked === true
  };
}
