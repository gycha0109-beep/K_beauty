import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ExistingProductSnapshot,
  ExportStatus,
  IntakeDatabaseSnapshot,
  ReviewExportSourceRecord,
} from "./review-export-contract.js";

interface ReviewRow {
  candidate_id: string;
  status: ExportStatus;
  priority_score: number;
  selection_reason: string;
  evidence_snapshot: unknown;
  rule_version: string;
  first_queued_at: string;
  last_queued_at: string;
  review_note: string | null;
  updated_at: string;
}

interface CandidateRow {
  id: string;
  source_name: string;
  external_type: string | null;
  external_id: string | null;
  source_url: string | null;
  category_path: string | null;
  product_name_raw: string;
  brand_name_raw: string;
  normalized_name: string;
  normalized_brand: string;
  service_category: string | null;
  product_form: string | null;
  canonical_name: string | null;
  canonical_brand: string | null;
  review_status: string;
  review_flags: string[] | null;
  match_method: string | null;
  match_confidence: number | null;
  matched_product_id: string | null;
  duplicate_of_product_id: string | null;
  promotion_payload: unknown;
  promotion_version: string | null;
  updated_at: string;
}

interface RankingEvidenceRow {
  candidate_id: string;
  evidence_snapshot: unknown;
}

function databaseReadError(): Error {
  return new Error("review_export_database_read_failed");
}

function asProductSnapshot(row: Record<string, unknown>): ExistingProductSnapshot {
  return {
    id: String(row.id),
    normalized_brand: String(row.normalized_brand ?? ""),
    normalized_name: String(row.normalized_name ?? ""),
    brand: typeof row.brand === "string" ? row.brand : null,
    name: typeof row.name === "string" ? row.name : null,
    category: typeof row.category === "string" ? row.category : null,
    product_form: typeof row.product_form === "string" ? row.product_form : null,
  };
}

async function findExistingProductMatch(
  client: SupabaseClient,
  candidate: CandidateRow,
): Promise<ExistingProductSnapshot | null> {
  const referencedId = candidate.duplicate_of_product_id ?? candidate.matched_product_id;
  let referenced: ExistingProductSnapshot | null = null;

  if (referencedId) {
    const { data, error } = await client
      .from("products")
      .select(
        "id, normalized_brand, normalized_name, brand, name, category, product_form",
      )
      .eq("id", referencedId)
      .maybeSingle();

    if (error) throw databaseReadError();
    if (!data) throw new Error("review_export_missing_referenced_product");
    referenced = asProductSnapshot(data as Record<string, unknown>);
  }

  const { data: normalizedRows, error: normalizedError } = await client
    .from("products")
    .select("id, normalized_brand, normalized_name, brand, name, category, product_form")
    .eq("normalized_brand", candidate.normalized_brand)
    .eq("normalized_name", candidate.normalized_name)
    .limit(2);

  if (normalizedError) throw databaseReadError();
  if ((normalizedRows?.length ?? 0) > 1) {
    throw new Error("review_export_ambiguous_normalized_product_match");
  }

  const normalized = normalizedRows?.[0]
    ? asProductSnapshot(normalizedRows[0] as Record<string, unknown>)
    : null;

  if (
    referenced &&
    (referenced.normalized_brand !== candidate.normalized_brand ||
      referenced.normalized_name !== candidate.normalized_name)
  ) {
    throw new Error("review_export_conflicting_product_identity");
  }

  if (referenced && normalized && referenced.id !== normalized.id) {
    throw new Error("review_export_conflicting_product_identity");
  }

  return referenced ?? normalized;
}

export async function loadReviewExportRecords(
  client: SupabaseClient,
  options: {
    status: ExportStatus;
    limit: number;
    candidateId?: string;
  },
): Promise<ReviewExportSourceRecord[]> {
  let reviewQuery = client
    .from("candidate_promotion_reviews")
    .select(
      "candidate_id, status, priority_score, selection_reason, evidence_snapshot, rule_version, first_queued_at, last_queued_at, review_note, updated_at",
    )
    .eq("status", options.status)
    .order("priority_score", { ascending: false })
    .order("candidate_id", { ascending: true })
    .limit(Math.min(options.limit * 5, 500));

  if (options.candidateId) {
    reviewQuery = reviewQuery.eq("candidate_id", options.candidateId);
  }

  const { data: reviewData, error: reviewError } = await reviewQuery;
  if (reviewError) throw databaseReadError();

  const reviews = (reviewData ?? []) as ReviewRow[];
  const candidateIds = reviews.map((review) => review.candidate_id);
  if (candidateIds.length === 0) return [];

  const [{ data: candidateData, error: candidateError }, { data: evidenceData, error: evidenceError }] =
    await Promise.all([
      client
        .from("product_candidates")
        .select(
          "id, source_name, external_type, external_id, source_url, category_path, product_name_raw, brand_name_raw, normalized_name, normalized_brand, service_category, product_form, canonical_name, canonical_brand, review_status, review_flags, match_method, match_confidence, matched_product_id, duplicate_of_product_id, promotion_payload, promotion_version, updated_at",
        )
        .in("id", candidateIds),
      client
        .from("candidate_ranking_evidence_summary")
        .select("candidate_id, evidence_snapshot")
        .in("candidate_id", candidateIds),
    ]);

  if (candidateError || evidenceError) throw databaseReadError();

  const candidates = new Map(
    ((candidateData ?? []) as CandidateRow[]).map((candidate) => [candidate.id, candidate]),
  );
  const rankingEvidence = new Map(
    ((evidenceData ?? []) as RankingEvidenceRow[]).map((row) => [
      row.candidate_id,
      row.evidence_snapshot,
    ]),
  );
  const records: ReviewExportSourceRecord[] = [];

  for (const review of reviews) {
    const candidate = candidates.get(review.candidate_id);
    if (!candidate) {
      throw new Error("review_export_candidate_not_found");
    }

    if (["approved", "promoted", "rejected"].includes(candidate.review_status)) {
      continue;
    }

    if (!candidate.external_type?.trim() || !candidate.external_id?.trim()) {
      continue;
    }

    const existingProductMatch = await findExistingProductMatch(client, candidate);
    records.push({
      candidate,
      review,
      rankingEvidence: rankingEvidence.get(candidate.id) ?? review.evidence_snapshot,
      existingProductMatch,
    });
    if (records.length >= options.limit) break;
  }

  return records;
}

export interface IntakeSnapshotLoadRequest {
  candidateIds: string[];
  productIds: string[];
  normalizedIdentities: Array<{
    normalizedBrand: string;
    normalizedName: string;
  }>;
}

export async function loadIntakeDatabaseSnapshot(
  client: SupabaseClient,
  request: IntakeSnapshotLoadRequest,
): Promise<IntakeDatabaseSnapshot> {
  const uniqueCandidateIds = [...new Set(request.candidateIds)];
  const uniqueProductIds = [...new Set(request.productIds.filter(Boolean))];
  const [candidateResponse, reviewResponse] = await Promise.all([
    client
      .from("product_candidates")
      .select(
        "id, source_name, external_type, external_id, source_url, category_path, product_name_raw, brand_name_raw, canonical_name, canonical_brand, service_category, product_form, review_flags, promotion_payload, promotion_version, updated_at, review_status, normalized_brand, normalized_name, matched_product_id, duplicate_of_product_id",
      )
      .in("id", uniqueCandidateIds),
    client
      .from("candidate_promotion_reviews")
      .select("candidate_id, status, rule_version, evidence_snapshot, updated_at")
      .in("candidate_id", uniqueCandidateIds),
  ]);

  if (candidateResponse.error || reviewResponse.error) throw databaseReadError();

  const productMap = new Map<string, ExistingProductSnapshot>();

  if (uniqueProductIds.length > 0) {
    const { data, error } = await client
      .from("products")
      .select("id, normalized_brand, normalized_name, brand, name, category, product_form")
      .in("id", uniqueProductIds);

    if (error) throw databaseReadError();
    for (const row of data ?? []) {
      const product = asProductSnapshot(row as Record<string, unknown>);
      productMap.set(product.id, product);
    }
  }

  const uniqueIdentities = new Map(
    request.normalizedIdentities.map((identity) => [
      `${identity.normalizedBrand}\u0000${identity.normalizedName}`,
      identity,
    ]),
  );
  for (const identity of uniqueIdentities.values()) {
    if (!identity.normalizedBrand || !identity.normalizedName) continue;

    const { data, error } = await client
      .from("products")
      .select("id, normalized_brand, normalized_name, brand, name, category, product_form")
      .eq("normalized_brand", identity.normalizedBrand)
      .eq("normalized_name", identity.normalizedName)
      .limit(2);

    if (error) throw databaseReadError();
    if ((data?.length ?? 0) > 1) {
      throw new Error("reviewed_identity_ambiguous_existing_products");
    }

    if (data?.[0]) {
      const product = asProductSnapshot(data[0] as Record<string, unknown>);
      productMap.set(product.id, product);
    }
  }

  return {
    candidates: new Map(
      (candidateResponse.data ?? []).map((row) => [
        String(row.id),
        {
          id: String(row.id),
          source_name: String(row.source_name),
          external_type:
            typeof row.external_type === "string" ? row.external_type : null,
          external_id: typeof row.external_id === "string" ? row.external_id : null,
          source_url: typeof row.source_url === "string" ? row.source_url : null,
          category_path:
            typeof row.category_path === "string" ? row.category_path : null,
          product_name_raw: String(row.product_name_raw),
          brand_name_raw: String(row.brand_name_raw),
          canonical_name:
            typeof row.canonical_name === "string" ? row.canonical_name : null,
          canonical_brand:
            typeof row.canonical_brand === "string" ? row.canonical_brand : null,
          service_category:
            typeof row.service_category === "string" ? row.service_category : null,
          product_form:
            typeof row.product_form === "string" ? row.product_form : null,
          review_flags: Array.isArray(row.review_flags)
            ? row.review_flags.map(String)
            : [],
          promotion_payload: row.promotion_payload,
          promotion_version:
            typeof row.promotion_version === "string"
              ? row.promotion_version
              : null,
          updated_at: String(row.updated_at),
          review_status: String(row.review_status),
          normalized_brand: String(row.normalized_brand),
          normalized_name: String(row.normalized_name),
          matched_product_id:
            typeof row.matched_product_id === "string" ? row.matched_product_id : null,
          duplicate_of_product_id:
            typeof row.duplicate_of_product_id === "string"
              ? row.duplicate_of_product_id
              : null,
        },
      ]),
    ),
    reviews: new Map(
      (reviewResponse.data ?? []).map((row) => [
        String(row.candidate_id),
        {
          candidate_id: String(row.candidate_id),
          status: String(row.status),
          rule_version: String(row.rule_version),
          evidence_snapshot: row.evidence_snapshot,
          updated_at: String(row.updated_at),
        },
      ]),
    ),
    products: productMap,
  };
}
