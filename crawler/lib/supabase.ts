import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeCanonicalBrandName,
  normalizeCanonicalProductName,
} from "./normalize.js";
import {
  buildCandidateObservation,
  validateRankingSnapshotIngestPayload,
  type RankingSnapshotIngestPayload,
} from "./ranking-ingest.js";
import type { RankingJobConfig } from "./ranking-config.js";
import type { RankingSnapshotItem, RankingSnapshotPayload } from "./snapshot.js";
import type {
  CandidateForReview,
  MatchableProductRecord,
  ProductForm,
  ReviewStatus,
  ServiceCategory,
} from "./review.js";
import {
  isCanonicalServiceCategory,
  isTreatmentProductForm,
} from "./review.js";

const SOURCE_NAME = "hwahae";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

type ProductCandidateColumnSupport = {
  legacyStatus: boolean;
  reviewStatus: boolean;
  updatedAt: boolean;
  productForm: boolean;
};

let productCandidateColumnSupportPromise: Promise<ProductCandidateColumnSupport> | null = null;

export interface SourceRankingInsert {
  source_name: string;
  category_path: string;
  rank_position: number;
  product_name: string;
  brand_name: string;
  rating: number | null;
  review_count: number | null;
  thumbnail_url: string | null;
  source_url: string;
  collected_at: string;
}

export interface ProductCandidateInsert {
  source_name: string;
  category_path: string;
  product_name_raw: string;
  brand_name_raw: string;
  normalized_name: string;
  normalized_brand: string;
  status?: "new";
  review_status?: "new";
}

export type CrawlJobStatus = "running" | "completed" | "failed";

export interface CrawlJobRecord {
  id: number | string;
}

export interface SourceRankingInsertResult {
  insertedCount: number;
  skippedCount: number;
}

export interface ProductCandidateUpsertResult {
  insertedCount: number;
  skippedCount: number;
}

export interface RankingSnapshotIngestResult {
  snapshotId: string;
  snapshotCreated: boolean;
  sourceRankingsInserted: number;
  sourceRankingsSkipped: number;
  candidatesInserted: number;
  candidatesReobserved: number;
  pendingIdentityCount: number;
  productsWritten: 0;
}

export interface CandidatePromotionReviewRefreshResult {
  ruleVersion: string;
  candidatesExamined: number;
  reviewsInserted: number;
  reviewsUpdated: number;
  protectedReviewsSkipped: number;
  productsWritten: 0;
}

export interface PendingPromotionReviewRow {
  candidate_id: string;
  brand_name_raw: string | null;
  product_name_raw: string | null;
  status: string;
  priority_score: number;
  selection_reason: string;
  evidence_snapshot: Json | Record<string, unknown>;
  first_queued_at: string | null;
  last_queued_at: string | null;
  review_note: string | null;
}

export interface ProductCandidateReviewUpdate {
  service_category?: ServiceCategory | null;
  product_form?: ProductForm | null;
  canonical_name?: string | null;
  canonical_brand?: string | null;
  matched_product_id?: string | null;
  duplicate_of_product_id?: string | null;
  review_status?: ReviewStatus;
  review_notes?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  promotion_payload?: Json | Record<string, unknown> | null;
  match_method?: string | null;
  match_confidence?: number | null;
  review_flags?: string[] | null;
  promotion_version?: string | null;
}

export interface PromotionRpcResult {
  action: string;
  candidate_id: string;
  product_id?: string | null;
  review_status?: string | null;
  missing_flags?: string[];
}

export interface ApprovedCandidateRecord {
  id: string;
  canonical_name: string | null;
  canonical_brand: string | null;
  review_status: string | null;
  reviewed_at: string | null;
  created_at: string | null;
}

export interface ProductCandidateStatusRecord {
  id: string;
  product_name_raw: string | null;
  brand_name_raw: string | null;
  canonical_name: string | null;
  canonical_brand: string | null;
  review_status: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface CandidateSourceContext {
  source_service_category: string | null;
  source_category_key: string | null;
  source_product_form: string | null;
  source_context_conflict: boolean;
  source_context_status: "valid" | "missing" | "malformed" | "incomplete" | "invalid_combination" | "conflict";
}

export interface ProductCandidateListRecord {
  id: string;
  source_name: string | null;
  service_category: string | null;
  product_form?: string | null;
  brand_name_raw: string | null;
  product_name_raw: string | null;
  canonical_brand: string | null;
  canonical_name: string | null;
  review_status: string | null;
  review_flags: string[] | null;
  match_method: string | null;
  match_confidence: number | null;
  matched_product_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface PromotionReportRow {
  candidate_id: string;
  canonical_brand: string | null;
  canonical_name: string | null;
  review_status: string | null;
  matched_product_id: string | null;
  duplicate_of_product_id: string | null;
  promotion_payload: Json | Record<string, unknown> | null;
  review_notes: string | null;
  review_flags: string[] | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface EnrichQueueRecord {
  id: string;
  brand: string | null;
  name: string | null;
  category: string | null;
  buy_link: string | null;
  image_url: string | null;
  price_min: number | null;
  price_max: number | null;
  updated_at: string | null;
  latest_promoted_at: string | null;
}

export interface ProductDetailRecord {
  id: string;
  brand: string | null;
  name: string | null;
  category: string | null;
  buy_link: string | null;
  image_url: string | null;
  price_min: number | null;
  price_max: number | null;
  updated_at: string | null;
}

export interface ProductDetailUpdateInput {
  buy_link?: string | null;
  image_url?: string | null;
  price_min?: number | null;
  price_max?: number | null;
}

export interface ProductDetailUpdateResult {
  before: ProductDetailRecord;
  after: ProductDetailRecord;
  applied_fields: string[];
  skipped_fields: string[];
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function trimErrorLog(errorLog: string | null | undefined, maxLength = 4000): string | null {
  if (!errorLog) {
    return null;
  }

  return errorLog.length > maxLength ? `${errorLog.slice(0, maxLength - 3)}...` : errorLog;
}

function formatSupabaseError(error: {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}): string {
  const extras = [
    error.code ? `code=${error.code}` : null,
    error.details ? `details=${error.details}` : null,
    error.hint ? `hint=${error.hint}` : null,
  ].filter(Boolean);

  return extras.length > 0
    ? `${error.message} (${extras.join(", ")})`
    : error.message;
}

function isMissingColumnError(errorMessage: string, columnName: string): boolean {
  const normalizedMessage = errorMessage.toLowerCase();
  const normalizedColumnName = columnName.toLowerCase();

  return (
    normalizedMessage.includes(`'${normalizedColumnName}'`) ||
    normalizedMessage.includes(`"${normalizedColumnName}"`) ||
    normalizedMessage.includes(`column ${normalizedColumnName} does not exist`) ||
    normalizedMessage.includes(`.${normalizedColumnName} does not exist`)
  );
}

function normalizeOptionalTextValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function isMissingTextValue(value: string | null | undefined): boolean {
  return normalizeOptionalTextValue(value) === null;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasMissingEnrichmentField(product: ProductDetailRecord): boolean {
  return (
    isMissingTextValue(product.buy_link) ||
    isMissingTextValue(product.image_url) ||
    !isFiniteNumber(product.price_min) ||
    !isFiniteNumber(product.price_max)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function normalizeNullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeSourceContextText(value: unknown): string | null {
  return normalizeNullableText(value)?.toLowerCase() ?? null;
}

function collectEvidenceObservations(evidenceSnapshot: unknown): Record<string, unknown>[] {
  if (!isRecord(evidenceSnapshot)) {
    return [];
  }

  const observations: Record<string, unknown>[] = [];
  for (const concern of getRecordArray(evidenceSnapshot.concerns)) {
    observations.push(...getRecordArray(concern.observations));
  }

  if (isRecord(evidenceSnapshot.popularity)) {
    observations.push(...getRecordArray(evidenceSnapshot.popularity.observations));
  }

  return observations;
}

function getUnresolvedSourceContext(
  sourceContextStatus: CandidateSourceContext["source_context_status"],
): CandidateSourceContext {
  return {
    source_service_category: null,
    source_category_key: null,
    source_product_form: null,
    source_context_conflict: sourceContextStatus === "conflict",
    source_context_status: sourceContextStatus,
  };
}

function isValidSourceContextObservation(observation: {
  serviceCategory: string | null;
  sourceProductForm: string | null;
}): boolean {
  if (!isCanonicalServiceCategory(observation.serviceCategory)) {
    return false;
  }

  if (observation.serviceCategory === "treatment") {
    return observation.sourceProductForm === null || isTreatmentProductForm(observation.sourceProductForm);
  }

  return true;
}

export function extractCandidateSourceContext(evidenceSnapshot: unknown): CandidateSourceContext {
  if (!isRecord(evidenceSnapshot)) {
    return getUnresolvedSourceContext("malformed");
  }

  const rawObservations = collectEvidenceObservations(evidenceSnapshot);

  if (rawObservations.length === 0) {
    return getUnresolvedSourceContext("missing");
  }

  const observations = collectEvidenceObservations(evidenceSnapshot)
    .map((observation) => ({
      serviceCategory: normalizeSourceContextText(observation.service_category),
      sourceCategoryKey: normalizeSourceContextText(observation.source_category_key),
      sourceProductForm: normalizeSourceContextText(observation.source_product_form),
      collectedAt: normalizeNullableText(observation.collected_at),
    }))
    .filter((observation) => observation.serviceCategory || observation.sourceCategoryKey || observation.sourceProductForm)
    .sort((left, right) => String(right.collectedAt ?? "").localeCompare(String(left.collectedAt ?? "")));

  if (observations.length === 0) {
    return getUnresolvedSourceContext("incomplete");
  }

  const invalidObservation = observations.find((observation) => !isValidSourceContextObservation(observation));

  if (invalidObservation) {
    return {
      source_service_category: invalidObservation.serviceCategory,
      source_category_key: invalidObservation.sourceCategoryKey,
      source_product_form: invalidObservation.sourceProductForm,
      source_context_conflict: false,
      source_context_status: invalidObservation.serviceCategory ? "invalid_combination" : "incomplete",
    };
  }

  const latest = observations[0];
  const contextKeys = new Set(
    observations.map((observation) =>
      [
        observation.serviceCategory ?? "",
        observation.sourceCategoryKey ?? "",
        observation.sourceProductForm ?? "",
      ].join("::"),
    ),
  );

  if (contextKeys.size > 1) {
    return getUnresolvedSourceContext("conflict");
  }

  return {
    source_service_category: latest?.serviceCategory ?? null,
    source_category_key: latest?.sourceCategoryKey ?? null,
    source_product_form: latest?.sourceProductForm ?? null,
    source_context_conflict: false,
    source_context_status: "valid",
  };
}

async function loadCandidateSourceContexts(
  client: SupabaseClient,
  candidateIds: string[],
): Promise<Map<string, CandidateSourceContext>> {
  if (candidateIds.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from("candidate_ranking_evidence_summary")
    .select("candidate_id, evidence_snapshot")
    .in("candidate_id", candidateIds);

  if (error) {
    throw new Error(`Failed to load candidate ranking evidence context: ${formatSupabaseError(error)}`);
  }

  return new Map(
    (data ?? []).map((row) => [
      String((row as { candidate_id: string }).candidate_id),
      extractCandidateSourceContext((row as { evidence_snapshot?: Json | Record<string, unknown> | null }).evidence_snapshot),
    ]),
  );
}

function compareIsoDateDescending(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }

  if (left && right) {
    return right.localeCompare(left);
  }

  if (left) {
    return -1;
  }

  if (right) {
    return 1;
  }

  return 0;
}

async function hasTableColumn(
  client: SupabaseClient,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const { error } = await client.from(tableName).select(columnName).limit(1);

  if (!error) {
    return true;
  }

  if (isMissingColumnError(error.message, columnName)) {
    return false;
  }

  throw new Error(`Failed to inspect column ${tableName}.${columnName}: ${error.message}`);
}

async function getProductCandidateColumnSupport(client: SupabaseClient): Promise<ProductCandidateColumnSupport> {
  if (!productCandidateColumnSupportPromise) {
    productCandidateColumnSupportPromise = Promise.all([
      hasTableColumn(client, "product_candidates", "status"),
      hasTableColumn(client, "product_candidates", "review_status"),
      hasTableColumn(client, "product_candidates", "updated_at"),
      hasTableColumn(client, "product_candidates", "product_form"),
    ]).then(([legacyStatus, reviewStatus, updatedAt, productForm]) => ({
      legacyStatus,
      reviewStatus,
      updatedAt,
      productForm,
    }));
  }

  return productCandidateColumnSupportPromise;
}

export function createServiceRoleClient(): SupabaseClient {
  return createClient(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createCrawlJob(client: SupabaseClient): Promise<CrawlJobRecord> {
  const { data, error } = await client
    .from("crawl_jobs")
    .insert({
      source_name: SOURCE_NAME,
      status: "running",
      started_at: new Date().toISOString(),
      item_count: 0,
      error_log: null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create crawl job: ${error.message}`);
  }

  return data as CrawlJobRecord;
}

export async function updateCrawlJob(
  client: SupabaseClient,
  jobId: number | string,
  input: {
    status: CrawlJobStatus;
    itemCount: number;
    errorLog?: string | null;
  },
): Promise<void> {
  const { error } = await client
    .from("crawl_jobs")
    .update({
      status: input.status,
      item_count: input.itemCount,
      error_log: trimErrorLog(input.errorLog),
      ended_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to update crawl job ${jobId}: ${error.message}`);
  }
}

export async function insertSourceRankings(
  client: SupabaseClient,
  rankings: SourceRankingInsert[],
): Promise<SourceRankingInsertResult> {
  if (rankings.length === 0) {
    return {
      insertedCount: 0,
      skippedCount: 0,
    };
  }

  const [firstRanking] = rankings;
  const dayStart = new Date(firstRanking.collected_at);
  dayStart.setUTCHours(0, 0, 0, 0);

  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const { data: existingRows, error: lookupError } = await client
    .from("source_rankings")
    .select("source_name, category_path, rank_position, product_name")
    .eq("source_name", firstRanking.source_name)
    .eq("category_path", firstRanking.category_path)
    .gte("collected_at", dayStart.toISOString())
    .lt("collected_at", dayEnd.toISOString());

  if (lookupError) {
    throw new Error(`Failed to lookup existing source rankings: ${lookupError.message}`);
  }

  const existingKeys = new Set(
    (existingRows ?? []).map((row) =>
      [
        row.source_name,
        row.category_path,
        row.rank_position,
        String(row.product_name).toLowerCase().trim(),
      ].join("::"),
    ),
  );

  const deduplicatedRows = new Map<string, SourceRankingInsert>();

  for (const ranking of rankings) {
    const key = [
      ranking.source_name,
      ranking.category_path,
      ranking.rank_position,
      ranking.product_name.toLowerCase().trim(),
    ].join("::");

    if (!existingKeys.has(key)) {
      deduplicatedRows.set(key, ranking);
    }
  }

  const rowsToInsert = Array.from(deduplicatedRows.values());

  if (rowsToInsert.length === 0) {
    return {
      insertedCount: 0,
      skippedCount: rankings.length,
    };
  }

  const { error } = await client.from("source_rankings").insert(rowsToInsert);

  if (error) {
    throw new Error(`Failed to insert source rankings: ${error.message}`);
  }

  return {
    insertedCount: rowsToInsert.length,
    skippedCount: rankings.length - rowsToInsert.length,
  };
}

function getCandidateCategoryPath(job: RankingJobConfig): string {
  return job.serviceCategory;
}

function buildCandidateLookupQuery(
  client: SupabaseClient,
  observation: ReturnType<typeof buildCandidateObservation>,
) {
  if (observation.externalType && observation.externalId) {
    return client
      .from("product_candidates")
      .select("id, first_seen_at, seen_count")
      .eq("source_name", observation.sourceName)
      .eq("external_type", observation.externalType)
      .eq("external_id", observation.externalId)
      .limit(2);
  }

  return client
    .from("product_candidates")
    .select("id, first_seen_at, seen_count")
    .eq("source_name", observation.sourceName)
    .eq("normalized_brand", observation.normalizedBrand)
    .eq("normalized_name", observation.normalizedName)
    .limit(2);
}

async function observeProductCandidate(
  client: SupabaseClient,
  observation: ReturnType<typeof buildCandidateObservation>,
): Promise<{ candidateId: string | null; action: "inserted" | "reobserved" | "pending_collision" }> {
  const { data: existingRows, error: lookupError } = await buildCandidateLookupQuery(client, observation);

  if (lookupError) {
    throw new Error(`Failed to lookup product candidate: ${formatSupabaseError(lookupError)}`);
  }

  if ((existingRows?.length ?? 0) > 1) {
    return {
      candidateId: null,
      action: "pending_collision",
    };
  }

  const existing = existingRows?.[0] as { id: string; seen_count?: number | null } | undefined;

  if (existing?.id) {
    const { error: updateError } = await client
      .from("product_candidates")
      .update({
        source_url: observation.sourceUrl,
        last_seen_at: observation.observedAt,
        seen_count: Math.max(0, Number(existing.seen_count ?? 0)) + 1,
        latest_price: observation.latestPrice,
        latest_raw_source: observation.latestRawSource as unknown as Json,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`Failed to update product candidate ${existing.id}: ${formatSupabaseError(updateError)}`);
    }

    return {
      candidateId: existing.id,
      action: "reobserved",
    };
  }

  const payload: Record<string, unknown> = {
    source_name: observation.sourceName,
    category_path: observation.categoryPath,
    product_name_raw: observation.productNameRaw,
    brand_name_raw: observation.brandNameRaw,
    normalized_name: observation.normalizedName,
    normalized_brand: observation.normalizedBrand,
    external_type: observation.externalType,
    external_id: observation.externalId,
    source_url: observation.sourceUrl,
    first_seen_at: observation.observedAt,
    last_seen_at: observation.observedAt,
    seen_count: 1,
    latest_price: observation.latestPrice,
    latest_raw_source: observation.latestRawSource as unknown as Json,
  };
  const columnSupport = await getProductCandidateColumnSupport(client);

  if (columnSupport.legacyStatus) {
    payload.status = "new";
  }

  if (columnSupport.reviewStatus) {
    payload.review_status = "new";
  }

  const { data, error: insertError } = await client
    .from("product_candidates")
    .insert(payload)
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to insert product candidate: ${formatSupabaseError(insertError)}`);
  }

  return {
    candidateId: String((data as { id: string }).id),
    action: "inserted",
  };
}

export async function ingestRankingSnapshot(
  client: SupabaseClient,
  input: RankingSnapshotIngestPayload,
): Promise<RankingSnapshotIngestResult> {
  validateRankingSnapshotIngestPayload(input);

  const { data, error } = await client.rpc("ingest_ranking_snapshot", {
    p_ingest_key: input.ingestKey,
    p_snapshot: {
      snapshotHash: input.snapshotHash,
      job: input.job,
      sourceUrl: input.sourceUrl,
      collectedAt: input.collectedAt,
      collectorVersion: input.collectorVersion,
      rawPayload: input.rawPayload,
      items: input.items,
    },
  });

  if (error) {
    throw new Error(`Failed to ingest ranking snapshot: ${formatSupabaseError(error)}`);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Failed to ingest ranking snapshot: RPC returned an invalid response.");
  }

  const result = data as Record<string, unknown>;

  return {
    snapshotId: String(result.snapshot_id),
    snapshotCreated: Boolean(result.snapshot_created),
    sourceRankingsInserted: Number(result.source_rankings_inserted ?? 0),
    sourceRankingsSkipped: Number(result.source_rankings_skipped ?? 0),
    candidatesInserted: Number(result.candidates_inserted ?? 0),
    candidatesReobserved: Number(result.candidates_reobserved ?? 0),
    pendingIdentityCount: Number(result.pending_identity_count ?? 0),
    productsWritten: 0,
  };
}

export async function refreshCandidatePromotionReviews(
  client: SupabaseClient,
  ruleVersion: string,
): Promise<CandidatePromotionReviewRefreshResult> {
  const { data, error } = await client.rpc("refresh_candidate_promotion_reviews", {
    p_rule_version: ruleVersion,
  });

  if (error) {
    throw new Error(`Failed to refresh candidate promotion reviews: ${formatSupabaseError(error)}`);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Failed to refresh candidate promotion reviews: RPC returned an invalid response.");
  }

  const result = data as Record<string, unknown>;

  return {
    ruleVersion: String(result.rule_version ?? ruleVersion),
    candidatesExamined: Number(result.candidates_examined ?? 0),
    reviewsInserted: Number(result.reviews_inserted ?? 0),
    reviewsUpdated: Number(result.reviews_updated ?? 0),
    protectedReviewsSkipped: Number(result.protected_reviews_skipped ?? 0),
    productsWritten: 0,
  };
}

export async function listPendingPromotionReviews(
  client: SupabaseClient,
  limit = 50,
): Promise<PendingPromotionReviewRow[]> {
  const { data, error } = await client
    .from("candidate_promotion_reviews")
    .select(`
      candidate_id,
      status,
      priority_score,
      selection_reason,
      evidence_snapshot,
      first_queued_at,
      last_queued_at,
      review_note,
      product_candidates (
        brand_name_raw,
        product_name_raw
      )
    `)
    .in("status", ["queued", "reviewing"])
    .order("priority_score", { ascending: false })
    .order("last_queued_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list pending promotion reviews: ${formatSupabaseError(error)}`);
  }

  return (data ?? []).map((row) => {
    const candidate = (row as { product_candidates?: { brand_name_raw?: string | null; product_name_raw?: string | null } | null })
      .product_candidates;

    return {
      candidate_id: String((row as { candidate_id: string }).candidate_id),
      brand_name_raw: candidate?.brand_name_raw ?? null,
      product_name_raw: candidate?.product_name_raw ?? null,
      status: String((row as { status: string }).status),
      priority_score: Number((row as { priority_score: number }).priority_score ?? 0),
      selection_reason: String((row as { selection_reason: string }).selection_reason ?? ""),
      evidence_snapshot: (row as { evidence_snapshot: Json | Record<string, unknown> }).evidence_snapshot,
      first_queued_at: (row as { first_queued_at?: string | null }).first_queued_at ?? null,
      last_queued_at: (row as { last_queued_at?: string | null }).last_queued_at ?? null,
      review_note: (row as { review_note?: string | null }).review_note ?? null,
    };
  });
}

function buildCandidateInsertPayload(
  candidate: ProductCandidateInsert,
  columnSupport: ProductCandidateColumnSupport,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    source_name: candidate.source_name,
    category_path: candidate.category_path,
    product_name_raw: candidate.product_name_raw,
    brand_name_raw: candidate.brand_name_raw,
    normalized_name: candidate.normalized_name,
    normalized_brand: candidate.normalized_brand,
  };

  if (columnSupport.legacyStatus) {
    payload.status = candidate.status ?? "new";
  }

  if (columnSupport.reviewStatus) {
    payload.review_status = candidate.review_status ?? "new";
  }

  return payload;
}

export async function upsertProductCandidates(
  client: SupabaseClient,
  candidates: ProductCandidateInsert[],
): Promise<ProductCandidateUpsertResult> {
  if (candidates.length === 0) {
    return {
      insertedCount: 0,
      skippedCount: 0,
    };
  }

  const deduplicatedCandidates = new Map<string, ProductCandidateInsert>();

  for (const candidate of candidates) {
    const key = [
      candidate.source_name,
      candidate.category_path,
      candidate.normalized_brand,
      candidate.normalized_name,
    ].join("::");

    deduplicatedCandidates.set(key, candidate);
  }

  const columnSupport = await getProductCandidateColumnSupport(client);
  let insertedCount = 0;
  let skippedCount = 0;

  for (const candidate of deduplicatedCandidates.values()) {
    const { data: existingRows, error: lookupError } = await client
      .from("product_candidates")
      .select("id")
      .eq("source_name", candidate.source_name)
      .eq("category_path", candidate.category_path)
      .eq("normalized_name", candidate.normalized_name)
      .eq("normalized_brand", candidate.normalized_brand)
      .limit(1);

    if (lookupError) {
      throw new Error(`Failed to lookup product candidate: ${lookupError.message}`);
    }

    if ((existingRows?.length ?? 0) > 0) {
      skippedCount += 1;
      continue;
    }

    const { error: insertError } = await client
      .from("product_candidates")
      .insert(buildCandidateInsertPayload(candidate, columnSupport));

    if (insertError) {
      throw new Error(`Failed to insert product candidate: ${insertError.message}`);
    }

    insertedCount += 1;
  }

  return {
    insertedCount,
    skippedCount: skippedCount + (candidates.length - deduplicatedCandidates.size),
  };
}

export async function ensureReviewWorkflowReady(client: SupabaseClient): Promise<void> {
  const columnSupport = await getProductCandidateColumnSupport(client);

  if (!columnSupport.reviewStatus) {
    throw new Error(
      "Review workflow columns are not available yet. Apply the review/promotion SQL migration before running this command.",
    );
  }
}

export async function getPendingReviewCandidates(
  client: SupabaseClient,
  limit = 100,
): Promise<CandidateForReview[]> {
  await ensureReviewWorkflowReady(client);

  const { data, error } = await client
    .from("product_candidates")
    .select(
      "id, source_name, category_path, product_name_raw, brand_name_raw, normalized_name, normalized_brand",
    )
    .eq("review_status", "new")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load pending review candidates: ${error.message}`);
  }

  const candidates = (data ?? []) as CandidateForReview[];
  const sourceContextByCandidateId = await loadCandidateSourceContexts(
    client,
    candidates.map((candidate) => candidate.id),
  );

  return candidates.map((candidate) => ({
    ...candidate,
    ...(sourceContextByCandidateId.get(candidate.id) ?? getUnresolvedSourceContext("missing")),
  }));
}

export async function listProductsForMatching(client: SupabaseClient): Promise<MatchableProductRecord[]> {
  const preferredSelect =
    "id, name, brand, normalized_name, normalized_brand, category, product_form, skin_types, concerns, texture, finish, irritation_risk, sensitivity_safe, price_min, price_max, buy_link, image_url";

  const { data, error } = await client.from("products").select(preferredSelect).limit(1000);

  if (error && !isMissingColumnError(error.message, "normalized_name")) {
    throw new Error(`Failed to load products for matching: ${error.message}`);
  }

  if (!error) {
    return (data ?? []).map((product) => ({
      ...(product as Omit<MatchableProductRecord, "normalized_name" | "normalized_brand">),
      normalized_name:
        normalizeCanonicalProductName((product as { normalized_name?: string; name?: string }).normalized_name) ||
        normalizeCanonicalProductName((product as { name?: string }).name),
      normalized_brand:
        normalizeCanonicalBrandName((product as { normalized_brand?: string; brand?: string }).normalized_brand) ||
        normalizeCanonicalBrandName((product as { brand?: string }).brand),
    }));
  }

  const fallbackSelect =
    "id, name, brand, category, product_form, skin_types, concerns, texture, finish, irritation_risk, sensitivity_safe, price_min, price_max, buy_link, image_url";

  const { data: fallbackData, error: fallbackError } = await client
    .from("products")
    .select(fallbackSelect)
    .limit(1000);

  if (fallbackError) {
    throw new Error(`Failed to load products for matching: ${fallbackError.message}`);
  }

  return (fallbackData ?? []).map((product) => ({
    ...(product as Omit<MatchableProductRecord, "normalized_name" | "normalized_brand">),
    normalized_name: normalizeCanonicalProductName((product as { name?: string }).name),
    normalized_brand: normalizeCanonicalBrandName((product as { brand?: string }).brand),
  }));
}

export async function updateProductCandidateReview(
  client: SupabaseClient,
  candidateId: string,
  input: ProductCandidateReviewUpdate,
): Promise<void> {
  await ensureReviewWorkflowReady(client);

  const columnSupport = await getProductCandidateColumnSupport(client);
  const payload: Record<string, unknown> = { ...input };

  if (!columnSupport.productForm) {
    delete payload.product_form;
  }

  if (columnSupport.updatedAt) {
    payload.updated_at = new Date().toISOString();
  }

  const { error } = await client.from("product_candidates").update(payload).eq("id", candidateId);

  if (error) {
    throw new Error(`Failed to update product candidate ${candidateId}: ${error.message}`);
  }
}

export async function getProductCandidateById(
  client: SupabaseClient,
  candidateId: string,
): Promise<ProductCandidateStatusRecord> {
  await ensureReviewWorkflowReady(client);

  const { data, error } = await client
    .from("product_candidates")
    .select(
      "id, product_name_raw, brand_name_raw, canonical_name, canonical_brand, review_status, reviewed_at, reviewed_by",
    )
    .eq("id", candidateId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load product candidate ${candidateId}: ${formatSupabaseError(error)}`);
  }

  if (!data) {
    throw new Error(`Product candidate ${candidateId} does not exist.`);
  }

  return data as ProductCandidateStatusRecord;
}

export async function setProductCandidateReviewStatus(
  client: SupabaseClient,
  candidateId: string,
  reviewStatus: Extract<ReviewStatus, "approved" | "rejected">,
  reviewedBy = "cli",
): Promise<ProductCandidateStatusRecord> {
  const candidate = await getProductCandidateById(client, candidateId);

  if (candidate.review_status === "promoted") {
    throw new Error(`Product candidate ${candidateId} is already promoted and cannot be changed.`);
  }

  const reviewedAt = new Date().toISOString();

  await updateProductCandidateReview(client, candidateId, {
    review_status: reviewStatus,
    reviewed_at: reviewedAt,
    reviewed_by: reviewedBy,
  });

  return {
    ...candidate,
    review_status: reviewStatus,
    reviewed_at: reviewedAt,
    reviewed_by: reviewedBy,
  };
}

export async function getApprovedCandidates(
  client: SupabaseClient,
  limit = 100,
  candidateId?: string,
): Promise<ApprovedCandidateRecord[]> {
  await ensureReviewWorkflowReady(client);

  let query = client
    .from("product_candidates")
    .select("id, canonical_name, canonical_brand, review_status, reviewed_at, created_at")
    .eq("review_status", "approved")
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (candidateId) {
    query = query.eq("id", candidateId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load approved candidates: ${formatSupabaseError(error)}`);
  }

  return (data ?? []) as ApprovedCandidateRecord[];
}

export async function listProductCandidates(
  client: SupabaseClient,
  input: {
    statuses: ReviewStatus[];
    limit: number;
  },
): Promise<ProductCandidateListRecord[]> {
  await ensureReviewWorkflowReady(client);
  const columnSupport = await getProductCandidateColumnSupport(client);
  const selectColumns = [
    "id",
    "source_name",
    "service_category",
    ...(columnSupport.productForm ? ["product_form"] : []),
    "brand_name_raw",
    "product_name_raw",
    "canonical_brand",
    "canonical_name",
    "review_status",
    "review_flags",
    "match_method",
    "match_confidence",
    "matched_product_id",
    "reviewed_by",
    "reviewed_at",
  ].join(", ");

  const { data, error } = await client
    .from("product_candidates")
    .select(selectColumns)
    .in("review_status", input.statuses)
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(input.limit);

  if (error) {
    throw new Error(`Failed to list product candidates: ${formatSupabaseError(error)}`);
  }

  return (data ?? []) as unknown as ProductCandidateListRecord[];
}

export async function listPromotionReportRows(
  client: SupabaseClient,
  input: {
    statuses: ReviewStatus[];
    limit: number;
    reviewedAfter?: string;
  },
): Promise<PromotionReportRow[]> {
  await ensureReviewWorkflowReady(client);

  let query = client
    .from("product_candidates")
    .select(
      "id, canonical_brand, canonical_name, review_status, matched_product_id, duplicate_of_product_id, promotion_payload, review_notes, review_flags, reviewed_by, reviewed_at",
    )
    .in("review_status", input.statuses)
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .limit(input.limit);

  if (input.reviewedAfter) {
    query = query.gte("reviewed_at", input.reviewedAfter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list promotion report rows: ${formatSupabaseError(error)}`);
  }

  return (data ?? []).map((row) => ({
    candidate_id: (row as { id: string }).id,
    canonical_brand: (row as { canonical_brand: string | null }).canonical_brand,
    canonical_name: (row as { canonical_name: string | null }).canonical_name,
    review_status: (row as { review_status: string | null }).review_status,
    matched_product_id: (row as { matched_product_id: string | null }).matched_product_id,
    duplicate_of_product_id: (row as { duplicate_of_product_id: string | null }).duplicate_of_product_id,
    promotion_payload: (row as { promotion_payload: Json | Record<string, unknown> | null }).promotion_payload,
    review_notes: (row as { review_notes: string | null }).review_notes,
    review_flags: (row as { review_flags: string[] | null }).review_flags,
    reviewed_by: (row as { reviewed_by: string | null }).reviewed_by,
    reviewed_at: (row as { reviewed_at: string | null }).reviewed_at,
  }));
}

export async function countPromotionFailures(
  client: SupabaseClient,
  input: {
    reviewedAfter?: string;
  },
): Promise<number> {
  await ensureReviewWorkflowReady(client);

  let query = client
    .from("product_candidates")
    .select("id", { count: "exact", head: true })
    .or("review_notes.ilike.%Promotion blocked:%");

  if (input.reviewedAfter) {
    query = query.gte("reviewed_at", input.reviewedAfter);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count promotion failures: ${formatSupabaseError(error)}`);
  }

  return count ?? 0;
}

export async function promoteApprovedCandidate(
  client: SupabaseClient,
  candidateId: string,
  actor: string,
): Promise<PromotionRpcResult> {
  await ensureReviewWorkflowReady(client);

  const { data, error } = await client.rpc("promote_product_candidate", {
    p_candidate_id: candidateId,
    p_actor: actor,
  });

  if (error) {
    throw new Error(`Failed to promote candidate ${candidateId}: ${formatSupabaseError(error)}`);
  }

  if (Array.isArray(data)) {
    return (data[0] ?? null) as PromotionRpcResult;
  }

  if (!data) {
    throw new Error(`Failed to promote candidate ${candidateId}: RPC returned no data`);
  }

  return data as PromotionRpcResult;
}

async function getProductDetailRecord(client: SupabaseClient, productId: string): Promise<ProductDetailRecord> {
  const { data, error } = await client
    .from("products")
    .select("id, brand, name, category, buy_link, image_url, price_min, price_max, updated_at")
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load product ${productId}: ${formatSupabaseError(error)}`);
  }

  if (!data) {
    throw new Error(`Product ${productId} does not exist.`);
  }

  return data as ProductDetailRecord;
}

export async function listProductsForEnrichment(
  client: SupabaseClient,
  input: {
    limit: number;
  },
): Promise<EnrichQueueRecord[]> {
  const [productResponse, promotedCandidateResponse] = await Promise.all([
    client
      .from("products")
      .select("id, brand, name, category, buy_link, image_url, price_min, price_max, updated_at")
      .limit(5000),
    client
      .from("product_candidates")
      .select("matched_product_id, duplicate_of_product_id, reviewed_at")
      .eq("review_status", "promoted")
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(5000),
  ]);

  if (productResponse.error) {
    throw new Error(`Failed to load products for enrichment: ${formatSupabaseError(productResponse.error)}`);
  }

  if (promotedCandidateResponse.error) {
    throw new Error(
      `Failed to load promoted product candidate targets: ${formatSupabaseError(promotedCandidateResponse.error)}`,
    );
  }

  const latestPromotionByProductId = new Map<string, string>();

  for (const row of promotedCandidateResponse.data ?? []) {
    const candidateRow = row as {
      matched_product_id?: string | null;
      duplicate_of_product_id?: string | null;
      reviewed_at?: string | null;
    };
    const targetProductId = candidateRow.duplicate_of_product_id ?? candidateRow.matched_product_id;
    const reviewedAt = candidateRow.reviewed_at ?? null;

    if (!targetProductId || !reviewedAt || latestPromotionByProductId.has(targetProductId)) {
      continue;
    }

    latestPromotionByProductId.set(targetProductId, reviewedAt);
  }

  const queue = ((productResponse.data ?? []) as ProductDetailRecord[])
    .filter((product) => hasMissingEnrichmentField(product))
    .map((product) => ({
      ...product,
      latest_promoted_at: latestPromotionByProductId.get(product.id) ?? null,
    }))
    .sort((left, right) => {
      const promotionComparison = compareIsoDateDescending(left.latest_promoted_at, right.latest_promoted_at);

      if (promotionComparison !== 0) {
        return promotionComparison;
      }

      return compareIsoDateDescending(left.updated_at, right.updated_at);
    });

  return queue.slice(0, input.limit);
}

export async function updateProductDetailsIfMissing(
  client: SupabaseClient,
  productId: string,
  input: ProductDetailUpdateInput,
): Promise<ProductDetailUpdateResult> {
  const before = await getProductDetailRecord(client, productId);
  const updatePayload: Record<string, unknown> = {};
  const appliedFields: string[] = [];
  const skippedFields: string[] = [];

  if ("buy_link" in input) {
    const nextValue = normalizeOptionalTextValue(input.buy_link);

    if (!nextValue) {
      skippedFields.push("buy_link(no_input)");
    } else if (!isMissingTextValue(before.buy_link)) {
      skippedFields.push("buy_link(existing)");
    } else {
      updatePayload.buy_link = nextValue;
      appliedFields.push("buy_link");
    }
  }

  if ("image_url" in input) {
    const nextValue = normalizeOptionalTextValue(input.image_url);

    if (!nextValue) {
      skippedFields.push("image_url(no_input)");
    } else if (!isMissingTextValue(before.image_url)) {
      skippedFields.push("image_url(existing)");
    } else {
      updatePayload.image_url = nextValue;
      appliedFields.push("image_url");
    }
  }

  if ("price_min" in input) {
    if (!isFiniteNumber(input.price_min)) {
      skippedFields.push("price_min(no_input)");
    } else if (isFiniteNumber(before.price_min)) {
      skippedFields.push("price_min(existing)");
    } else {
      updatePayload.price_min = input.price_min;
      appliedFields.push("price_min");
    }
  }

  if ("price_max" in input) {
    if (!isFiniteNumber(input.price_max)) {
      skippedFields.push("price_max(no_input)");
    } else if (isFiniteNumber(before.price_max)) {
      skippedFields.push("price_max(existing)");
    } else {
      updatePayload.price_max = input.price_max;
      appliedFields.push("price_max");
    }
  }

  if (appliedFields.length === 0) {
    return {
      before,
      after: before,
      applied_fields: appliedFields,
      skipped_fields: skippedFields,
    };
  }

  const { data, error } = await client
    .from("products")
    .update({
      ...updatePayload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .select("id, brand, name, category, buy_link, image_url, price_min, price_max, updated_at")
    .single();

  if (error) {
    throw new Error(`Failed to update product ${productId}: ${formatSupabaseError(error)}`);
  }

  return {
    before,
    after: data as ProductDetailRecord,
    applied_fields: appliedFields,
    skipped_fields: skippedFields,
  };
}
