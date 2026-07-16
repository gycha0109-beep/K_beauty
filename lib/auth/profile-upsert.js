import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

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
    name: error.name || null,
    message: error.message || null,
    code: error.code || null,
    details: error.details || null,
    hint: error.hint || null,
    status: error.status || null
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

  for (const candidate of getProfilePayloadCandidates(profilePayload)) {
    const { error } = await client
      .from("profiles")
      .upsert(candidate.payload, { onConflict: "id" });

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

  const lastAttempt = attempts[attempts.length - 1];

  return {
    error: lastAttempt?.error || {
      message: "profile_upsert_failed"
    },
    method,
    payload: lastAttempt?.payload || "unknown",
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
          message: "SUPABASE_SERVICE_ROLE_KEY is not configured"
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
