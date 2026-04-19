export const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export function formatUploadSize(maxBytes = MAX_IMAGE_UPLOAD_BYTES) {
  const megabytes = maxBytes / (1024 * 1024);
  return Number.isInteger(megabytes) ? `${megabytes}MB` : `${megabytes.toFixed(1)}MB`;
}

export function validateImageUpload(file, options = {}) {
  const maxBytes = options.maxBytes || MAX_IMAGE_UPLOAD_BYTES;
  const allowedMimeTypes = options.allowedMimeTypes || ALLOWED_IMAGE_MIME_TYPES;

  if (!file || typeof file.arrayBuffer !== "function") {
    return {
      ok: false,
      code: "missing"
    };
  }

  const mimeType = typeof file.type === "string" ? file.type.toLowerCase() : "";

  if (!allowedMimeTypes.has(mimeType)) {
    return {
      ok: false,
      code: "invalid_type",
      allowedMimeTypes: Array.from(allowedMimeTypes)
    };
  }

  const size = Number(file.size);

  if (Number.isFinite(size) && size > maxBytes) {
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
