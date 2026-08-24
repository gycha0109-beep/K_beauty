export const DOCUMENT_LOCALE_HEADER_NAME = "x-bejewely-locale";

export function resolveDocumentLocale(pathname) {
  const normalizedPathname = typeof pathname === "string" && pathname ? pathname : "/";
  return normalizedPathname === "/en" || normalizedPathname.startsWith("/en/") ? "en" : "ko";
}

export function normalizeDocumentLocale(value) {
  return value === "en" ? "en" : "ko";
}
