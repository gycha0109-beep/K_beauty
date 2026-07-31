import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { writeSafeLog } from "@/lib/security/error-redaction";

export const PRODUCT_REVIEW_FILTERS = Object.freeze({
  pending: Object.freeze(["queued", "reviewing"]),
  queued: Object.freeze(["queued"]),
  reviewing: Object.freeze(["reviewing"]),
  approved: Object.freeze(["approved"]),
  rejected: Object.freeze(["rejected"]),
  deferred: Object.freeze(["deferred"])
});

export const PRODUCT_REVIEW_DECISIONS = Object.freeze([
  "approve",
  "defer",
  "block"
]);

const LIST_LIMIT = 100;
const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 1000;
const MAX_REQUEST_ID_LENGTH = 200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{32}$/i;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export class ProductReviewOperationError extends Error {
  constructor(code, status = 500) {
    super(code);
    this.name = "ProductReviewOperationError";
    this.code = code;
    this.status = status;
  }
}

function logProductReviewFailure(operation, category) {
  writeSafeLog("warn", {
    event: "admin_product_review_failed",
    category,
    operation,
    dependency: "supabase",
    retryable: category === "database_unavailable"
  });
}

function getAdminClient(operation) {
  const client = createSupabaseAdminClient();

  if (!client) {
    logProductReviewFailure(operation, "configuration_unavailable");
    throw new ProductReviewOperationError("admin_service_unavailable", 503);
  }

  return client;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNullableText(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeHttpUrl(value) {
  const normalized = normalizeNullableText(value);

  if (!normalized || normalized.length > 2048) {
    return null;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function normalizeUuid(value) {
  const normalized = normalizeNullableText(value);
  return normalized && UUID_PATTERN.test(normalized) ? normalized : null;
}

function normalizeHash(value) {
  const normalized = normalizeNullableText(value);
  return normalized && HASH_PATTERN.test(normalized)
    ? normalized.toLowerCase()
    : null;
}

function normalizeTimestamp(value) {
  const normalized = normalizeNullableText(value);
  return normalized && Number.isFinite(Date.parse(normalized))
    ? normalized
    : null;
}

function normalizeRequestId(value) {
  const normalized = normalizeNullableText(value);

  if (
    !normalized ||
    normalized.length < 8 ||
    normalized.length > MAX_REQUEST_ID_LENGTH ||
    !REQUEST_ID_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLimit(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 50;
  }

  return Math.min(parsed, LIST_LIMIT);
}

export function normalizeProductReviewFilter(value) {
  const normalized = String(value ?? "pending").trim().toLowerCase();
  return PRODUCT_REVIEW_FILTERS[normalized] ? normalized : "pending";
}

export function normalizeProductReviewDecision(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return PRODUCT_REVIEW_DECISIONS.includes(normalized) ? normalized : null;
}

export function normalizeProductReviewReason(value) {
  const normalized = String(value ?? "").trim();

  if (
    normalized.length < MIN_REASON_LENGTH ||
    normalized.length > MAX_REASON_LENGTH
  ) {
    return null;
  }

  return normalized;
}

function normalizeCandidate(row) {
  if (!row) {
    return null;
  }

  const promotionPayload = isRecord(row.promotion_payload)
    ? row.promotion_payload
    : {};
  const productPayload = isRecord(promotionPayload.product)
    ? promotionPayload.product
    : {};
  const metadata = isRecord(promotionPayload.metadata)
    ? promotionPayload.metadata
    : {};

  return {
    id: String(row.id),
    sourceName: normalizeNullableText(row.source_name),
    sourceUrl: normalizeHttpUrl(row.source_url),
    externalType: normalizeNullableText(row.external_type),
    externalId: normalizeNullableText(row.external_id),
    categoryPath: normalizeNullableText(row.category_path),
    serviceCategory: normalizeNullableText(row.service_category),
    productForm: normalizeNullableText(row.product_form),
    brandNameRaw: normalizeNullableText(row.brand_name_raw),
    productNameRaw: normalizeNullableText(row.product_name_raw),
    normalizedBrand: normalizeNullableText(row.normalized_brand),
    normalizedName: normalizeNullableText(row.normalized_name),
    canonicalBrand: normalizeNullableText(row.canonical_brand),
    canonicalName: normalizeNullableText(row.canonical_name),
    reviewStatus: normalizeNullableText(row.review_status),
    reviewFlags: normalizeStringArray(row.review_flags),
    matchMethod: normalizeNullableText(row.match_method),
    matchConfidence:
      typeof row.match_confidence === "number" ? row.match_confidence : null,
    matchedProductId: normalizeNullableText(row.matched_product_id),
    duplicateOfProductId: normalizeNullableText(row.duplicate_of_product_id),
    reviewNotes: normalizeNullableText(row.review_notes),
    reviewedBy: normalizeNullableText(row.reviewed_by),
    reviewedAt: normalizeNullableText(row.reviewed_at),
    firstSeenAt: normalizeNullableText(row.first_seen_at),
    lastSeenAt: normalizeNullableText(row.last_seen_at),
    seenCount: Number.isInteger(row.seen_count) ? row.seen_count : null,
    updatedAt: normalizeNullableText(row.updated_at),
    promotion: {
      metadata,
      skinTypes: normalizeStringArray(productPayload.skin_types),
      concerns: normalizeStringArray(productPayload.concerns),
      texture: normalizeNullableText(productPayload.texture),
      finish: normalizeNullableText(productPayload.finish),
      irritationRisk: normalizeNullableText(productPayload.irritation_risk),
      sensitivitySafe:
        typeof productPayload.sensitivity_safe === "boolean"
          ? productPayload.sensitivity_safe
          : null,
      priceMin:
        typeof productPayload.price_min === "number"
          ? productPayload.price_min
          : null,
      priceMax:
        typeof productPayload.price_max === "number"
          ? productPayload.price_max
          : null,
      hasBuyLink: Boolean(normalizeNullableText(productPayload.buy_link)),
      hasImageUrl: Boolean(normalizeNullableText(productPayload.image_url))
    }
  };
}

function normalizeReview(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    candidateId: String(row.candidate_id),
    status: String(row.status),
    priorityScore: Number(row.priority_score ?? 0),
    selectionReason: normalizeNullableText(row.selection_reason),
    evidenceSnapshot: isRecord(row.evidence_snapshot)
      ? row.evidence_snapshot
      : {},
    ruleVersion: normalizeNullableText(row.rule_version),
    firstQueuedAt: normalizeNullableText(row.first_queued_at),
    lastQueuedAt: normalizeNullableText(row.last_queued_at),
    reviewedAt: normalizeNullableText(row.reviewed_at),
    reviewNote: normalizeNullableText(row.review_note),
    approvedProductId: normalizeNullableText(row.approved_product_id),
    updatedAt: normalizeNullableText(row.updated_at)
  };
}

function normalizeProduct(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    brand: normalizeNullableText(row.brand),
    name: normalizeNullableText(row.name),
    normalizedBrand: normalizeNullableText(row.normalized_brand),
    normalizedName: normalizeNullableText(row.normalized_name),
    category: normalizeNullableText(row.category),
    productForm: normalizeNullableText(row.product_form),
    skinTypes: normalizeStringArray(row.skin_types),
    concerns: normalizeStringArray(row.concerns),
    texture: normalizeNullableText(row.texture),
    finish: normalizeNullableText(row.finish),
    irritationRisk: normalizeNullableText(row.irritation_risk),
    sensitivitySafe:
      typeof row.sensitivity_safe === "boolean" ? row.sensitivity_safe : null,
    priceMin: typeof row.price_min === "number" ? row.price_min : null,
    priceMax: typeof row.price_max === "number" ? row.price_max : null,
    hasBuyLink: Boolean(normalizeNullableText(row.buy_link)),
    hasImageUrl: Boolean(normalizeNullableText(row.image_url))
  };
}

async function loadCandidateMap(client, candidateIds, detail = false) {
  if (candidateIds.length === 0) {
    return new Map();
  }

  const summaryColumns = [
    "id",
    "source_name",
    "source_url",
    "external_type",
    "external_id",
    "category_path",
    "service_category",
    "product_form",
    "brand_name_raw",
    "product_name_raw",
    "normalized_brand",
    "normalized_name",
    "canonical_brand",
    "canonical_name",
    "review_status",
    "review_flags",
    "match_method",
    "match_confidence",
    "matched_product_id",
    "duplicate_of_product_id",
    "reviewed_by",
    "reviewed_at",
    "first_seen_at",
    "last_seen_at",
    "seen_count",
    "updated_at"
  ];
  const columns = detail
    ? [...summaryColumns, "promotion_payload", "review_notes"]
    : summaryColumns;

  const { data, error } = await client
    .from("product_candidates")
    .select(columns.join(", "))
    .in("id", candidateIds);

  if (error) {
    logProductReviewFailure("load_candidates", "database_unavailable");
    throw new ProductReviewOperationError("product_review_data_unavailable", 503);
  }

  return new Map(
    (data ?? []).map((row) => {
      const candidate = normalizeCandidate(row);
      return [candidate.id, candidate];
    })
  );
}

export async function loadProductReviewWorkbench({
  filter = "pending",
  candidateId = null,
  limit = 50
} = {}) {
  const client = getAdminClient("load_workbench");
  const normalizedFilter = normalizeProductReviewFilter(filter);
  const statuses = PRODUCT_REVIEW_FILTERS[normalizedFilter];
  const boundedLimit = normalizeLimit(limit);

  const { data: reviewRows, error: reviewError } = await client
    .from("candidate_promotion_reviews")
    .select(
      "id, candidate_id, status, priority_score, selection_reason, rule_version, first_queued_at, last_queued_at, reviewed_at, review_note, approved_product_id, updated_at"
    )
    .in("status", statuses)
    .order("priority_score", { ascending: false })
    .order("last_queued_at", { ascending: false })
    .limit(boundedLimit);

  if (reviewError) {
    logProductReviewFailure("load_review_queue", "database_unavailable");
    throw new ProductReviewOperationError("product_review_data_unavailable", 503);
  }

  const reviews = (reviewRows ?? []).map(normalizeReview);
  const candidateIds = reviews.map((review) => review.candidateId);
  const candidateMap = await loadCandidateMap(client, candidateIds, false);

  const items = reviews.map((review) => ({
    review,
    candidate: candidateMap.get(review.candidateId) ?? null
  }));

  const requestedCandidateId = normalizeNullableText(candidateId);
  const selectedItem =
    items.find((item) => item.review.candidateId === requestedCandidateId) ??
    items[0] ??
    null;

  if (!selectedItem) {
    return {
      filter: normalizedFilter,
      statuses,
      items: [],
      selected: null
    };
  }

  const [{ data: detailReviewRow, error: detailReviewError }, detailCandidateMap] =
    await Promise.all([
      client
        .from("candidate_promotion_reviews")
        .select(
          "id, candidate_id, status, priority_score, selection_reason, evidence_snapshot, rule_version, first_queued_at, last_queued_at, reviewed_at, review_note, approved_product_id, updated_at"
        )
        .eq("candidate_id", selectedItem.review.candidateId)
        .single(),
      loadCandidateMap(client, [selectedItem.review.candidateId], true)
    ]);

  if (detailReviewError) {
    logProductReviewFailure("load_review_detail", "database_unavailable");
    throw new ProductReviewOperationError("product_review_data_unavailable", 503);
  }

  const candidate = detailCandidateMap.get(selectedItem.review.candidateId) ?? null;
  const review = normalizeReview(detailReviewRow);
  const targetProductId =
    candidate?.duplicateOfProductId ?? candidate?.matchedProductId ?? null;
  let matchedProduct = null;

  if (targetProductId) {
    const { data: productRow, error: productError } = await client
      .from("products")
      .select(
        "id, brand, name, normalized_brand, normalized_name, category, product_form, skin_types, concerns, texture, finish, irritation_risk, sensitivity_safe, price_min, price_max, buy_link, image_url"
      )
      .eq("id", targetProductId)
      .maybeSingle();

    if (productError) {
      logProductReviewFailure("load_matched_product", "database_unavailable");
      throw new ProductReviewOperationError("product_review_data_unavailable", 503);
    }

    matchedProduct = normalizeProduct(productRow);
  }

  return {
    filter: normalizedFilter,
    statuses,
    items,
    selected: {
      review,
      candidate,
      matchedProduct
    }
  };
}

function mapRpcError(error, operation) {
  const message = String(error?.message ?? "").toLowerCase();
  let code = "product_review_operation_failed";
  let status = 500;
  let category = "database_unavailable";

  if (message.includes("stale_preflight")) {
    code = "product_review_stale_preflight";
    status = 409;
    category = "stale_preflight";
  } else if (message.includes("preflight_blocked")) {
    code = "product_review_preflight_blocked";
    status = 409;
    category = "validation_failed";
  } else if (message.includes("request_id_conflict")) {
    code = "product_review_request_conflict";
    status = 409;
    category = "idempotency_conflict";
  } else if (message.includes("not_found")) {
    code = "product_review_not_found";
    status = 404;
    category = "not_found";
  } else if (
    message.includes("access_required") ||
    message.includes("capability_required")
  ) {
    code = "product_review_forbidden";
    status = 403;
    category = "access_denied";
  } else if (
    message.includes("invalid") ||
    message.includes("required") ||
    message.includes("blocked")
  ) {
    code = "product_review_invalid_request";
    status = 400;
    category = "validation_failed";
  }

  logProductReviewFailure(operation, category);
  return new ProductReviewOperationError(code, status);
}

function validateOperationInput({ candidateId, decision, reason }) {
  const normalizedCandidateId = normalizeUuid(candidateId);
  const normalizedDecision = normalizeProductReviewDecision(decision);
  const normalizedReason = normalizeProductReviewReason(reason);

  if (!normalizedCandidateId || !normalizedDecision || !normalizedReason) {
    throw new ProductReviewOperationError("product_review_invalid_request", 400);
  }

  return {
    candidateId: normalizedCandidateId,
    decision: normalizedDecision,
    reason: normalizedReason
  };
}

export async function runProductReviewPreflight({
  actorUserId,
  candidateId,
  decision,
  reason
}) {
  const actorId = normalizeUuid(actorUserId);
  const input = validateOperationInput({ candidateId, decision, reason });

  if (!actorId) {
    throw new ProductReviewOperationError("product_review_forbidden", 403);
  }

  const client = getAdminClient("preflight");
  const { data, error } = await client.rpc(
    "admin_preflight_product_candidate_review",
    {
      p_actor_user_id: actorId,
      p_candidate_id: input.candidateId,
      p_decision: input.decision,
      p_reason: input.reason
    }
  );

  if (error) {
    throw mapRpcError(error, "preflight");
  }

  if (!isRecord(data)) {
    logProductReviewFailure("preflight", "invalid_response");
    throw new ProductReviewOperationError("product_review_operation_failed", 500);
  }

  return data;
}

export async function confirmProductReview({
  actorUserId,
  candidateId,
  decision,
  reason,
  candidateUpdatedAt,
  reviewUpdatedAt,
  evidenceHash,
  preflightHash,
  requestId
}) {
  const actorId = normalizeUuid(actorUserId);
  const input = validateOperationInput({ candidateId, decision, reason });
  const expectedCandidateUpdatedAt = normalizeTimestamp(candidateUpdatedAt);
  const expectedReviewUpdatedAt = normalizeTimestamp(reviewUpdatedAt);
  const expectedEvidenceHash = normalizeHash(evidenceHash);
  const expectedPreflightHash = normalizeHash(preflightHash);
  const normalizedRequestId = normalizeRequestId(requestId);

  if (
    !actorId ||
    !expectedCandidateUpdatedAt ||
    !expectedReviewUpdatedAt ||
    !expectedEvidenceHash ||
    !expectedPreflightHash ||
    !normalizedRequestId
  ) {
    throw new ProductReviewOperationError("product_review_invalid_request", 400);
  }

  const client = getAdminClient("confirm");
  const { data, error } = await client.rpc(
    "admin_confirm_product_candidate_review",
    {
      p_actor_user_id: actorId,
      p_candidate_id: input.candidateId,
      p_decision: input.decision,
      p_reason: input.reason,
      p_candidate_updated_at_expected: expectedCandidateUpdatedAt,
      p_review_updated_at_expected: expectedReviewUpdatedAt,
      p_evidence_hash_expected: expectedEvidenceHash,
      p_preflight_hash_expected: expectedPreflightHash,
      p_request_id: normalizedRequestId
    }
  );

  if (error) {
    throw mapRpcError(error, "confirm");
  }

  if (!isRecord(data)) {
    logProductReviewFailure("confirm", "invalid_response");
    throw new ProductReviewOperationError("product_review_operation_failed", 500);
  }

  return data;
}
