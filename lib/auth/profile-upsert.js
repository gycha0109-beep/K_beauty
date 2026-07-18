import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { classifyUnknownError } from "@/lib/security/error-redaction";

export function getStringOrNull(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

export function serializeSupabaseError(error) {
  if (!error) {
    return null;
  }

  return {
    category: isSchemaCacheError(error)
      ? "schema_unavailable"
      : classifyUnknownError(error, "database_unavailable"),
    status: Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
      ? error.status
      : null
  };
}

export function isSchemaCacheError(error) {
  const message = String(error?.message || "");

  return (
    error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    error?.code === "42703" ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

export function getProfilePayload(user) {
  const metadata = user?.user_metadata || {};
  const appMetadata = user?.app_metadata || {};
  const identityProvider = Array.isArray(user?.identities)
    ? user.identities.find((identity) => getStringOrNull(identity?.provider))?.provider
    : null;
  const nickname =
    getStringOrNull(metadata.name) ||
    getStringOrNull(metadata.full_name) ||
    getStringOrNull(metadata.preferred_username) ||
    getStringOrNull(user?.email);

  return {
    id: user.id,
    nickname,
    provider:
      getStringOrNull(appMetadata.provider) ||
      getStringOrNull(identityProvider)
  };
}

function getProfilePayloadCandidates(profilePayload) {
  const fullPayload = {
    id: profilePayload.id,
    nickname: profilePayload.nickname,
    provider: profilePayload.provider
  };
  const nicknamePayload = {
    id: profilePayload.id,
    nickname: profilePayload.nickname
  };
  const idOnlyPayload = {
    id: profilePayload.id
  };

  return [
    {
      label: "full_profile",
      payload: fullPayload
    },
    {
      label: "id_nickname",
      payload: nicknamePayload
    },
    {
      label: "id_only",
      payload: idOnlyPayload
    }
  ];
}

async function tryUpsertWithClient(client, method, profilePayload) {
  const attempts = [];
  let lastError = null;

  for (const candidate of getProfilePayloadCandidates(profilePayload)) {
    const { error } = await client
      .from("profiles")
      .upsert(candidate.payload, { onConflict: "id" });
    lastError = error || null;

    attempts.push({
      method,
      payload: candidate.label,
      columns: Object.keys(candidate.payload),
      error: serializeSupabaseError(error)
    });

    if (!error) {
      return {
        error: null,
        method,
        payload: candidate.label,
        attempts
      };
    }

    if (!isSchemaCacheError(error)) {
      return {
        error,
        method,
        payload: candidate.label,
        attempts
      };
    }
  }

  return {
    error: lastError || new Error("profile_upsert_failed"),
    method,
    payload: attempts[attempts.length - 1]?.payload || "unknown",
    attempts
  };
}

export async function upsertProfileForUser({ supabase, user, preferAdmin = false }) {
  const profilePayload = getProfilePayload(user);
  const attempts = [];

  if (!profilePayload.id || profilePayload.id !== user.id) {
    return {
      error: new Error("profile_payload_user_id_mismatch"),
      profilePayload,
      method: "none",
      payload: "none",
      attempts
    };
  }

  if (preferAdmin) {
    const adminSupabase = createSupabaseAdminClient();

    if (adminSupabase) {
      const adminResult = await tryUpsertWithClient(
        adminSupabase,
        "service_role",
        profilePayload
      );

      attempts.push(...adminResult.attempts);

      if (!adminResult.error) {
        return {
          ...adminResult,
          profilePayload,
          attempts
        };
      }

      if (!isSchemaCacheError(adminResult.error)) {
        return {
          ...adminResult,
          profilePayload,
          attempts
        };
      }
    } else {
      attempts.push({
        method: "service_role",
        payload: "unavailable",
        columns: [],
        error: {
          category: "configuration_unavailable",
          status: null
        }
      });
    }
  }

  const sessionResult = await tryUpsertWithClient(supabase, "session", profilePayload);
  attempts.push(...sessionResult.attempts);

  return {
    ...sessionResult,
    profilePayload,
    attempts
  };
}
