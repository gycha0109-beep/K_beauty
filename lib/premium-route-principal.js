export function selectPremiumRoutePrincipal({
  cookieUser = null,
  cookieClient = null,
  bearerUser = null,
  bearerClient = null
} = {}) {
  const cookieUserId = cookieUser?.id || null;
  const bearerUserId = bearerUser?.id || null;

  if (cookieUserId && bearerUserId && cookieUserId !== bearerUserId) {
    return {
      user: null,
      supabase: null,
      authSource: "conflict",
      principalAligned: false,
      authError: "principal_conflict"
    };
  }

  if (cookieUserId) {
    return {
      user: cookieUser,
      supabase: cookieClient,
      authSource: "cookie",
      principalAligned: true,
      authError: null
    };
  }

  if (bearerUserId) {
    return {
      user: bearerUser,
      supabase: bearerClient,
      authSource: "bearer",
      principalAligned: true,
      authError: null
    };
  }

  return {
    user: null,
    supabase: null,
    authSource: "none",
    principalAligned: true,
    authError: null
  };
}
