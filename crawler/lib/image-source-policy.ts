const MAX_PRODUCT_IMAGE_URL_LENGTH = 2048;
const PRODUCT_IMAGE_PATH_PATTERN = /^\/products\/([0-9]+)\/\1_[0-9]{14}\.jpg$/;
const APPROVED_PRODUCT_IMAGE_HOST = "img.hwahae.co.kr";

function hasControlCharacter(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function getRawAuthority(value: string): string {
  const schemeIndex = value.indexOf("://");
  if (schemeIndex < 0) {
    return "";
  }

  const authorityStart = schemeIndex + 3;
  const authorityEnd = value.slice(authorityStart).search(/[/?#]/);
  return authorityEnd < 0
    ? value.slice(authorityStart)
    : value.slice(authorityStart, authorityStart + authorityEnd);
}

export function resolveSafeProductImage(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_PRODUCT_IMAGE_URL_LENGTH ||
    value !== value.trim() ||
    hasControlCharacter(value)
  ) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  const rawAuthority = getRawAuthority(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    !rawAuthority ||
    rawAuthority.includes("@") ||
    rawAuthority.includes(":") ||
    parsed.port ||
    parsed.hostname.endsWith(".") ||
    parsed.hostname !== APPROVED_PRODUCT_IMAGE_HOST ||
    value.includes("?") ||
    value.includes("#") ||
    parsed.search ||
    parsed.hash ||
    parsed.href !== value
  ) {
    return null;
  }

  try {
    if (decodeURIComponent(parsed.pathname) !== parsed.pathname) {
      return null;
    }
  } catch {
    return null;
  }

  return PRODUCT_IMAGE_PATH_PATTERN.test(parsed.pathname) ? parsed.href : null;
}

export class ProductImageSourceValidationError extends Error {
  code: string;

  constructor() {
    super("product_image_source_rejected");
    this.name = "ProductImageSourceValidationError";
    this.code = "PRODUCT_IMAGE_SOURCE_REJECTED";
  }
}

export function assertSafeProductImageForWriter(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }

  const safeUrl = resolveSafeProductImage(value);
  if (!safeUrl) {
    throw new ProductImageSourceValidationError();
  }

  return safeUrl;
}
