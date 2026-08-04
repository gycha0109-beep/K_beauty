const FILE_FIELDS = Object.freeze(["batch", "manifest", "evidence", "reviewed"]);

export const PRODUCT_REVIEW_IMPORT_FILE_LIMITS = Object.freeze({
  batch: 64 * 1024,
  manifest: 2 * 1024 * 1024,
  evidence: 8 * 1024 * 1024,
  reviewed: 2 * 1024 * 1024
});

export const PRODUCT_REVIEW_IMPORT_MAX_REQUEST_BYTES =
  Object.values(PRODUCT_REVIEW_IMPORT_FILE_LIMITS).reduce(
    (total, value) => total + value,
    0
  ) +
  256 * 1024;

const MAX_BOUNDARY_LENGTH = 70;
const MAX_PART_HEADERS_BYTES = 16 * 1024;
const MAX_TEXT_FIELD_BYTES = 512;
const MAX_FILE_COUNT = 4;
const MAX_TEXT_FIELD_COUNT = 4;
const BOUNDARY_PATTERN = /^[0-9A-Za-z'()+_,.\/:=?-]+$/;

export class ProductReviewMultipartError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = "ProductReviewMultipartError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, status = 400) {
  throw new ProductReviewMultipartError(code, status);
}

function parseBoundary(contentType) {
  if (typeof contentType !== "string") {
    fail("invalid_content_type", 415);
  }

  const segments = contentType.split(";").map((segment) => segment.trim());
  if (segments.shift()?.toLowerCase() !== "multipart/form-data") {
    fail("invalid_content_type", 415);
  }

  let boundary = null;
  for (const segment of segments) {
    const separator = segment.indexOf("=");
    if (separator < 1) continue;
    const key = segment.slice(0, separator).trim().toLowerCase();
    let value = segment.slice(separator + 1).trim();
    if (key !== "boundary" || boundary !== null) continue;
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    boundary = value;
  }

  if (
    !boundary ||
    boundary.length > MAX_BOUNDARY_LENGTH ||
    !BOUNDARY_PATTERN.test(boundary)
  ) {
    fail("invalid_content_type", 415);
  }

  return boundary;
}

async function readCappedBody(request) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > PRODUCT_REVIEW_IMPORT_MAX_REQUEST_BYTES
    ) {
      fail("request_too_large", 413);
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    fail("missing_file");
  }

  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        fail("invalid_content_type");
      }
      totalBytes += value.byteLength;
      if (totalBytes > PRODUCT_REVIEW_IMPORT_MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => {});
        fail("request_too_large", 413);
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (error instanceof ProductReviewMultipartError) throw error;
    fail("invalid_content_type");
  }

  if (totalBytes === 0) {
    fail("missing_file");
  }
  return Buffer.concat(chunks, totalBytes);
}

function parseHeaders(rawHeaders) {
  if (rawHeaders.byteLength === 0 || rawHeaders.byteLength > MAX_PART_HEADERS_BYTES) {
    fail("invalid_content_type");
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(rawHeaders);
  } catch {
    fail("invalid_content_type");
  }
  if (text.includes("\0") || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    fail("invalid_content_type");
  }

  const headers = Object.create(null);
  for (const line of text.split("\r\n")) {
    const separator = line.indexOf(":");
    if (separator < 1) fail("invalid_content_type");
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (!name || !value || Object.prototype.hasOwnProperty.call(headers, name)) {
      fail("invalid_content_type");
    }
    headers[name] = value;
  }

  const disposition = headers["content-disposition"];
  if (!disposition) fail("invalid_content_type");
  const tokens = disposition.split(";").map((token) => token.trim());
  if (tokens.shift()?.toLowerCase() !== "form-data") {
    fail("invalid_content_type");
  }

  let fieldName = null;
  let hasFilename = false;
  for (const token of tokens) {
    const separator = token.indexOf("=");
    if (separator < 1) continue;
    const key = token.slice(0, separator).trim().toLowerCase();
    const rawValue = token.slice(separator + 1).trim();
    if (!rawValue.startsWith('"') || !rawValue.endsWith('"')) {
      fail("invalid_content_type");
    }
    const value = rawValue.slice(1, -1).replace(/\\([\\"])/g, "$1");
    if (key === "name") {
      if (fieldName !== null) fail("duplicate_file");
      fieldName = value;
    } else if (key === "filename") {
      hasFilename = true;
    }
  }

  if (!fieldName || fieldName.length > 100) {
    fail("invalid_content_type");
  }

  return { fieldName, hasFilename };
}

function decodeTextField(bytes) {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_TEXT_FIELD_BYTES || bytes.includes(0)) {
    fail("invalid_content_type");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("invalid_utf8");
  }
}

function parseParts(body, boundary, allowedTextFields) {
  const openingBoundary = Buffer.from(`--${boundary}`);
  const nextBoundary = Buffer.from(`\r\n--${boundary}`);
  if (!body.subarray(0, openingBoundary.length).equals(openingBoundary)) {
    fail("invalid_content_type");
  }

  const files = Object.create(null);
  const fields = Object.create(null);
  let fileCount = 0;
  let textFieldCount = 0;
  let cursor = openingBoundary.length;
  let sawClosingBoundary = false;

  while (cursor < body.length) {
    if (body.subarray(cursor, cursor + 2).equals(Buffer.from("--"))) {
      cursor += 2;
      if (body.subarray(cursor, cursor + 2).equals(Buffer.from("\r\n"))) cursor += 2;
      sawClosingBoundary = true;
      break;
    }
    if (!body.subarray(cursor, cursor + 2).equals(Buffer.from("\r\n"))) {
      fail("invalid_content_type");
    }
    cursor += 2;

    const headersEnd = body.indexOf(Buffer.from("\r\n\r\n"), cursor);
    if (headersEnd < 0 || headersEnd - cursor > MAX_PART_HEADERS_BYTES) {
      fail("invalid_content_type");
    }
    const { fieldName, hasFilename } = parseHeaders(body.subarray(cursor, headersEnd));
    const dataStart = headersEnd + 4;
    const boundaryStart = body.indexOf(nextBoundary, dataStart);
    if (boundaryStart < 0) fail("invalid_content_type");
    const bytes = body.subarray(dataStart, boundaryStart);
    cursor = boundaryStart + 2 + openingBoundary.length;

    if (hasFilename) {
      if (!FILE_FIELDS.includes(fieldName)) fail("unexpected_file");
      if (Object.prototype.hasOwnProperty.call(files, fieldName)) fail("duplicate_file");
      fileCount += 1;
      if (fileCount > MAX_FILE_COUNT) fail("unexpected_file");
      const limit = PRODUCT_REVIEW_IMPORT_FILE_LIMITS[fieldName];
      if (bytes.byteLength === 0) fail("missing_file");
      if (bytes.byteLength > limit) fail("request_too_large", 413);
      files[fieldName] = { bytes: Uint8Array.from(bytes) };
    } else {
      if (!allowedTextFields.has(fieldName)) fail("unexpected_file");
      if (Object.prototype.hasOwnProperty.call(fields, fieldName)) fail("duplicate_file");
      textFieldCount += 1;
      if (textFieldCount > MAX_TEXT_FIELD_COUNT) fail("unexpected_file");
      fields[fieldName] = decodeTextField(bytes);
    }
  }

  if (!sawClosingBoundary || cursor !== body.length) {
    fail("invalid_content_type");
  }
  for (const fieldName of FILE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(files, fieldName)) fail("missing_file");
  }
  if (fileCount !== FILE_FIELDS.length) fail("missing_file");

  return { files, fields };
}

export async function parseProductReviewImportRequest(
  request,
  { allowedTextFields = [] } = {}
) {
  const boundary = parseBoundary(request.headers.get("content-type"));
  const body = await readCappedBody(request);
  return parseParts(body, boundary, new Set(allowedTextFields));
}
