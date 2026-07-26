const PRODUCTION_VERCEL_ENV = "production";

export function getNormalizedConfiguredProductionOrigin(env = process.env) {
  const value = env.NEXT_PUBLIC_SITE_URL;

  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim()
  ) {
    return null;
  }

  return value.endsWith("/") && !value.endsWith("//")
    ? value.slice(0, -1)
    : value;
}

export function getCanonicalProductionOrigin(env = process.env) {
  if (env.VERCEL_ENV !== PRODUCTION_VERCEL_ENV) {
    return null;
  }

  try {
    const configuredOrigin = getNormalizedConfiguredProductionOrigin(env);
    const siteUrl = new URL(configuredOrigin || "");

    if (
      siteUrl.protocol !== "https:" ||
      siteUrl.username ||
      siteUrl.password ||
      siteUrl.pathname !== "/" ||
      siteUrl.search ||
      siteUrl.hash
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
