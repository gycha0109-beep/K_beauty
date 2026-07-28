const MAX_PRODUCT_IMAGE_URL_LENGTH = 2048;
const MAX_FACE_DATA_URL_LENGTH = Math.ceil((8 * 1024 * 1024) / 3) * 4 + 32;
const MAX_PAYLOAD_DEPTH = 24;
// Preview runtime attestation measured 8,763 structural entries in the
// server-built Premium report before this projection. Preserve a finite
// fail-closed traversal ceiling with bounded headroom for that canonical data.
const MAX_COLLECTION_ENTRIES = 16384;

const PRODUCT_IMAGE_PATH_PATTERN = /^\/products\/([0-9]+)\/\1_[0-9]{14}\.jpg$/;
const PRODUCT_IMAGE_ALIASES = Object.freeze([
  "image_url",
  "imageUrl",
  "thumbnail_url",
  "thumbnailUrl",
  "product_image",
  "productImage",
  "product_image_url",
  "productImageUrl",
  "image_src",
  "imageSrc",
  "image"
]);
const PRODUCT_IMAGE_ALIAS_SET = new Set(PRODUCT_IMAGE_ALIASES);
const DANGEROUS_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export const APPROVED_PRODUCT_IMAGE_HOSTS = Object.freeze(["img.hwahae.co.kr"]);
export const APPROVED_PRODUCT_IMAGE_ORIGINS = Object.freeze([
  "https://img.hwahae.co.kr"
]);
export const PRODUCT_IMAGE_CSP_DIRECTIVE =
  "img-src 'self' data: blob: https://img.hwahae.co.kr;";

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasControlCharacter(value) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function isAllowedFaceDataImageSource(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_FACE_DATA_URL_LENGTH ||
    hasControlCharacter(value)
  ) {
    return false;
  }

  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  return Boolean(match && match[2].length % 4 === 0);
}

function getRawAuthority(value) {
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

export function parseProductImageSource(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_PRODUCT_IMAGE_URL_LENGTH ||
    value !== value.trim() ||
    hasControlCharacter(value)
  ) {
    return Object.freeze({ kind: "none", url: null, source: null });
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    return Object.freeze({ kind: "none", url: null, source: null });
  }

  const rawAuthority = getRawAuthority(value);
  const hostname = parsed.hostname;

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    !rawAuthority ||
    rawAuthority.includes("@") ||
    rawAuthority.includes(":") ||
    parsed.port ||
    hostname.endsWith(".") ||
    hostname !== APPROVED_PRODUCT_IMAGE_HOSTS[0] ||
    value.includes("?") ||
    value.includes("#") ||
    parsed.search ||
    parsed.hash ||
    parsed.href !== value
  ) {
    return Object.freeze({ kind: "none", url: null, source: null });
  }

  try {
    if (decodeURIComponent(parsed.pathname) !== parsed.pathname) {
      return Object.freeze({ kind: "none", url: null, source: null });
    }
  } catch {
    return Object.freeze({ kind: "none", url: null, source: null });
  }

  if (!PRODUCT_IMAGE_PATH_PATTERN.test(parsed.pathname)) {
    return Object.freeze({ kind: "none", url: null, source: null });
  }

  return Object.freeze({
    kind: "approved",
    url: parsed.href,
    source: "hwahae"
  });
}

export function resolveSafeProductImage(value) {
  const parsed = parseProductImageSource(value);
  return parsed.kind === "approved" ? parsed.url : null;
}

export class ProductImageSourceValidationError extends Error {
  constructor() {
    super("product_image_source_rejected");
    this.name = "ProductImageSourceValidationError";
    this.code = "PRODUCT_IMAGE_SOURCE_REJECTED";
  }
}

export function assertSafeProductImageForWriter(value) {
  if (value == null || value === "") {
    return null;
  }

  const safeUrl = resolveSafeProductImage(value);

  if (!safeUrl) {
    throw new ProductImageSourceValidationError();
  }

  return safeUrl;
}

export function resolveSafeAvatarImage() {
  return null;
}

function normalizeInitialsSource(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export function buildAvatarInitials({ displayName, email } = {}) {
  const name = normalizeInitialsSource(displayName);

  if (name) {
    const parts = name.split(" ").filter(Boolean);
    const initials = parts.length > 1
      ? `${Array.from(parts[0])[0] || ""}${Array.from(parts.at(-1))[0] || ""}`
      : Array.from(parts[0] || "").slice(0, 2).join("");

    return initials.toLocaleUpperCase().slice(0, 2) || null;
  }

  const emailValue = normalizeInitialsSource(email);
  const localPart = emailValue.includes("@") ? emailValue.split("@", 1)[0] : "";
  const emailInitials = Array.from(localPart).filter((character) => /[\p{L}\p{N}]/u.test(character));
  return emailInitials.slice(0, 2).join("").toLocaleUpperCase() || null;
}

export function getProductImageDescriptor(product) {
  const safeUrl = resolveSafeProductImage(product?.image_url);

  return safeUrl
    ? Object.freeze({ kind: "approved", src: safeUrl })
    : Object.freeze({ kind: "none", src: null });
}

export function projectProductImage(product) {
  if (!isPlainObject(product)) {
    return product == null ? null : {};
  }

  const safeUrl = resolveSafeProductImage(product.image_url);
  const projected = {};

  for (const [key, value] of Object.entries(product)) {
    if (DANGEROUS_OBJECT_KEYS.has(key) || PRODUCT_IMAGE_ALIAS_SET.has(key)) {
      continue;
    }

    projected[key] = value;
  }

  if (safeUrl) {
    projected.image_url = safeUrl;
  }

  return projected;
}

function isAnalyzeProductPath(path) {
  if (path.length === 1 && (path[0] === "topPick" || path[0] === "alternative")) {
    return true;
  }

  return (
    path.length === 2 &&
    ["products", "categoryPicks", "altPicks", "explanationProducts"].includes(path[0]) &&
    typeof path[1] === "number"
  );
}

function isPremiumProductPath(path, value) {
  if (isAnalyzeProductPath(path)) {
    return true;
  }

  if (path[0] === "freeResult" && isAnalyzeProductPath(path.slice(1))) {
    return true;
  }

  if (path[0] === "supportingProducts" && typeof path[1] === "number") {
    return (path.length === 2 && !isPlainObject(value?.product)) ||
      (path.length === 3 && path[2] === "product");
  }

  if (
    path[0] === "fullRoutine" &&
    ["morningSteps", "nightSteps"].includes(path[1]) &&
    typeof path[2] === "number" &&
    path[3] === "product" &&
    path.length === 4
  ) {
    return true;
  }

  if (path[0] === "budgetAlternatives" && typeof path[1] === "number") {
    return (path.length === 2 && !isPlainObject(value?.product)) ||
      (path.length === 3 && path[2] === "product");
  }

  if (
    path[0] === "currentProductVerdicts" &&
    typeof path[1] === "number" &&
    path[2] === "product" &&
    path.length === 3
  ) {
    return true;
  }

  return (
    path[0] === "currentProducts" &&
    path[1] === "selections" &&
    typeof path[2] === "number" &&
    path[3] === "productSnapshot" &&
    path.length === 4
  );
}

function isPreservedFaceImagePath(path, mode) {
  return mode === "premium" && path.length === 2 && path[0] === "faceLabSummary" && path[1] === "imageUrl";
}

function sanitizePayloadValue(value, path, mode, context, depth) {
  if (depth > MAX_PAYLOAD_DEPTH || context.entries > MAX_COLLECTION_ENTRIES) {
    return null;
  }

  if (Array.isArray(value)) {
    if (context.seen.has(value)) {
      return null;
    }

    context.seen.add(value);
    const result = [];

    for (let index = 0; index < value.length; index += 1) {
      context.entries += 1;

      if (context.entries > MAX_COLLECTION_ENTRIES) {
        context.seen.delete(value);
        return null;
      }

      result.push(sanitizePayloadValue(value[index], [...path, index], mode, context, depth + 1));
    }

    context.seen.delete(value);
    return result;
  }

  if (!isPlainObject(value)) {
    return value && typeof value === "object" ? null : value;
  }

  if (context.seen.has(value)) {
    return null;
  }

  context.seen.add(value);
  const isProductNode = mode === "premium"
    ? isPremiumProductPath(path, value)
    : isAnalyzeProductPath(path);
  const safeProductUrl = isProductNode ? resolveSafeProductImage(value.image_url) : null;
  const result = {};

  for (const [key, childValue] of Object.entries(value)) {
    context.entries += 1;

    if (context.entries > MAX_COLLECTION_ENTRIES) {
      context.seen.delete(value);
      return null;
    }

    if (DANGEROUS_OBJECT_KEYS.has(key)) {
      continue;
    }

    const childPath = [...path, key];

    if (PRODUCT_IMAGE_ALIAS_SET.has(key)) {
      if (!isPreservedFaceImagePath(childPath, mode) || !isAllowedFaceDataImageSource(childValue)) {
        continue;
      }
    }

    result[key] = sanitizePayloadValue(childValue, childPath, mode, context, depth + 1);
  }

  if (safeProductUrl) {
    result.image_url = safeProductUrl;
  }

  context.seen.delete(value);
  return result;
}

export function sanitizeProductImagePayload(payload, { mode = "analyze" } = {}) {
  if (!isPlainObject(payload) && !Array.isArray(payload)) {
    return payload == null ? null : {};
  }

  return sanitizePayloadValue(payload, [], mode === "premium" ? "premium" : "analyze", {
    entries: 0,
    seen: new WeakSet()
  }, 0);
}

export function sanitizeAnalyzeResultProductImages(payload) {
  return sanitizeProductImagePayload(payload, { mode: "analyze" });
}

export function sanitizePremiumReportProductImages(payload) {
  return sanitizeProductImagePayload(payload, { mode: "premium" });
}

export function getProductImagePolicyContract() {
  return Object.freeze({
    hosts: APPROVED_PRODUCT_IMAGE_HOSTS,
    origins: APPROVED_PRODUCT_IMAGE_ORIGINS,
    pathPattern: PRODUCT_IMAGE_PATH_PATTERN.source,
    cspDirective: PRODUCT_IMAGE_CSP_DIRECTIVE
  });
}
