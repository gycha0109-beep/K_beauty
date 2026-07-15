const PRODUCTION_VERCEL_ENV = "production";

export function getCanonicalProductionOrigin(env = process.env) {
  if (env.VERCEL_ENV !== PRODUCTION_VERCEL_ENV) {
    return null;
  }

  try {
    const siteUrl = new URL(env.NEXT_PUBLIC_SITE_URL || "");

    if (
      siteUrl.protocol !== "https:" ||
      siteUrl.username ||
      siteUrl.password
    ) {
      return null;
    }

    return siteUrl.origin;
  } catch {
    return null;
  }
}

export function getCanonicalProductionRedirectUrl(requestUrl, env = process.env) {
  const canonicalOrigin = getCanonicalProductionOrigin(env);

  if (!canonicalOrigin) {
    return null;
  }

  try {
    const incomingUrl = new URL(requestUrl);

    if (incomingUrl.origin === canonicalOrigin) {
      return null;
    }

    return new URL(`${incomingUrl.pathname}${incomingUrl.search}`, canonicalOrigin);
  } catch {
    return null;
  }
}
