const PREVIEW_HOST_PATTERN = /^k-beauty-[a-z0-9-]+-johnny-self\.vercel\.app$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const DEFAULT_PRODUCTION_ORIGIN = "https://k-beauty-two.vercel.app";

function parseOrigin(value) {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function getSafeProductionOrigin(configuredProductionOrigin) {
  const url = parseOrigin(configuredProductionOrigin);
  return url?.protocol === "https:" ? url.origin : null;
}

export function resolveOAuthReturnOrigin(
  currentOrigin,
  configuredProductionOrigin = DEFAULT_PRODUCTION_ORIGIN
) {
  const productionOrigin = getSafeProductionOrigin(configuredProductionOrigin);
  const current = parseOrigin(currentOrigin);

  if (!current) {
    return productionOrigin;
  }

  if (productionOrigin && current.origin === productionOrigin) {
    return productionOrigin;
  }

  if (
    current.protocol === "https:" &&
    PREVIEW_HOST_PATTERN.test(current.hostname)
  ) {
    return current.origin;
  }

  if (
    (current.protocol === "http:" || current.protocol === "https:") &&
    LOCAL_HOSTS.has(current.hostname)
  ) {
    return current.origin;
  }

  return productionOrigin;
}

export function buildOAuthCallbackUrl({
  currentOrigin,
  configuredProductionOrigin,
  next = "/my"
}) {
  const origin = resolveOAuthReturnOrigin(currentOrigin, configuredProductionOrigin);
  if (!origin) {
    return null;
  }

  const nextPath =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/my";
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
}
