import crypto from "node:crypto";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;
const DANGEROUS_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function normalizeCanonicalValue(value: unknown, path: string): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`canonical_json_non_finite_number:${path}`);
    }

    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeCanonicalValue(item, `${path}[${index}]`));
  }

  if (typeof value === "object" && value) {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = Object.create(null);

    for (const key of Object.keys(record).sort()) {
      if (DANGEROUS_OBJECT_KEYS.has(key)) {
        throw new Error(`canonical_json_dangerous_key:${path}.${key}`);
      }

      if (record[key] === undefined) {
        throw new Error(`canonical_json_undefined:${path}.${key}`);
      }

      normalized[key] = normalizeCanonicalValue(record[key], `${path}.${key}`);
    }

    return normalized;
  }

  throw new Error(`canonical_json_unsupported_value:${path}`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeCanonicalValue(value, "$"));
}

export function sha256Utf8(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function sha256Bytes(value: Uint8Array): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function isSha256(value: string): boolean {
  return SHA256_PATTERN.test(value);
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function hashesEqual(left: string, right: string): boolean {
  if (!isSha256(left) || !isSha256(right)) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function normalizeUtcTimestamp(value: string): string {
  const parsed = new Date(value);

  if (!value || Number.isNaN(parsed.getTime())) {
    throw new Error("invalid_utc_timestamp");
  }

  return parsed.toISOString();
}

export function sanitizeCsvFormula(value: string): string {
  return FORMULA_PREFIX_PATTERN.test(value) ? `'${value}` : value;
}

export function assertSafeSourceUrl(value: string): string {
  if (value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("unsafe_source_url");
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("unsafe_source_url");
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname) {
    throw new Error("unsafe_source_url");
  }

  if (
    parsed.hostname === "localhost" ||
    parsed.hostname.endsWith(".localhost") ||
    parsed.hostname.endsWith(".") ||
    parsed.hostname
      .split(".")
      .some((label) => label.toLowerCase().startsWith("xn--")) ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1" ||
    /^10\./.test(parsed.hostname) ||
    /^192\.168\./.test(parsed.hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(parsed.hostname) ||
    /^169\.254\./.test(parsed.hostname)
  ) {
    throw new Error("unsafe_source_url");
  }

  return parsed.toString();
}

export function buildEvidenceVersion(ruleVersion: string, evidenceSnapshot: unknown): string {
  return sha256Utf8(
    canonicalJson({
      evidence_snapshot: evidenceSnapshot ?? null,
      rule_version: ruleVersion,
    }),
  );
}

export function buildEvidenceIntegrityHash(
  evidenceRowWithoutHash: Record<string, unknown>,
): string {
  return sha256Utf8(canonicalJson(evidenceRowWithoutHash));
}

export interface RowIntegrityInput {
  schema_version: string;
  export_batch_id: string;
  candidate_id: string;
  candidate_updated_at: string;
  review_queue_updated_at: string;
  evidence_version: string;
  source_external_id: string | null;
  source_product_url: string | null;
  normalized_brand: string;
  normalized_name: string;
  existing_product_match_id: string | null;
  evidence_integrity_hash: string;
}

export function buildRowIntegrityHash(input: RowIntegrityInput): string {
  return sha256Utf8(
    canonicalJson({
      schema_version: input.schema_version,
      export_batch_id: input.export_batch_id,
      candidate_id: input.candidate_id,
      candidate_updated_at: normalizeUtcTimestamp(input.candidate_updated_at),
      review_queue_updated_at: normalizeUtcTimestamp(input.review_queue_updated_at),
      evidence_version: input.evidence_version,
      source_external_id: input.source_external_id,
      source_product_url: input.source_product_url,
      normalized_brand: input.normalized_brand,
      normalized_name: input.normalized_name,
      existing_product_match_id: input.existing_product_match_id,
      evidence_integrity_hash: input.evidence_integrity_hash,
    }),
  );
}

export function buildCandidateIdsHash(candidateIds: string[]): string {
  return sha256Utf8(`${[...candidateIds].sort().join("\n")}\n`);
}

export function assertJsonValueSafety(
  value: unknown,
  options: { maxDepth: number; path?: string } = { maxDepth: 20 },
): void {
  const path = options.path ?? "$";

  function visit(current: unknown, depth: number, currentPath: string): void {
    if (depth > options.maxDepth) {
      throw new Error(`json_depth_exceeded:${currentPath}`);
    }

    if (!current || typeof current !== "object") {
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, depth + 1, `${currentPath}[${index}]`));
      return;
    }

    for (const [key, nested] of Object.entries(current as Record<string, unknown>)) {
      if (DANGEROUS_OBJECT_KEYS.has(key)) {
        throw new Error(`json_dangerous_key:${currentPath}.${key}`);
      }

      visit(nested, depth + 1, `${currentPath}.${key}`);
    }
  }

  visit(value, 0, path);
}
