export const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_REQUEST_BYTES = MAX_IMAGE_UPLOAD_BYTES + (512 * 1024);
export const IMAGE_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp";

export const ALLOWED_IMAGE_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const ALLOWED_IMAGE_MIME_TYPE_SET = new Set(ALLOWED_IMAGE_MIME_TYPES);

export function formatUploadSize(maxBytes = MAX_IMAGE_UPLOAD_BYTES) {
  const megabytes = maxBytes / (1024 * 1024);
  return Number.isInteger(megabytes) ? `${megabytes}MB` : `${megabytes.toFixed(1)}MB`;
}

export function validateImageUpload(file, options = {}) {
  const maxBytes = options.maxBytes ?? MAX_IMAGE_UPLOAD_BYTES;
  const allowedMimeTypes = options.allowedMimeTypes
    ? new Set(options.allowedMimeTypes)
    : ALLOWED_IMAGE_MIME_TYPE_SET;

  if (!file || typeof file.arrayBuffer !== "function") {
    return {
      ok: false,
      code: "missing"
    };
  }

  const mimeType = typeof file.type === "string" ? file.type : "";

  if (!allowedMimeTypes.has(mimeType)) {
    return {
      ok: false,
      code: "invalid_type",
      allowedMimeTypes: Array.from(allowedMimeTypes)
    };
  }

  const size = Number(file.size);

  if (!Number.isSafeInteger(size) || size <= 0) {
    return {
      ok: false,
      code: "empty"
    };
  }

  if (size > maxBytes) {
    return {
      ok: false,
      code: "too_large",
      maxBytes
    };
  }

  return {
    ok: true,
    mimeType,
    size
  };
}

export function validateImageRequestContentLength(request, options = {}) {
  const maxBytes = options.maxBytes ?? MAX_IMAGE_UPLOAD_REQUEST_BYTES;
  const contentLength = request?.headers?.get?.("content-length");

  if (contentLength === null || contentLength === undefined || contentLength === "") {
    return {
      ok: true,
      present: false
    };
  }

  if (!/^\d+$/.test(contentLength)) {
    return {
      ok: false,
      code: "invalid_content_length"
    };
  }

  const size = Number(contentLength);

  if (!Number.isSafeInteger(size) || size <= 0) {
    return {
      ok: false,
      code: "invalid_content_length"
    };
  }

  if (size > maxBytes) {
    return {
      ok: false,
      code: "too_large",
      maxBytes
    };
  }

  return {
    ok: true,
    present: true,
    size
  };
}
