import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SOURCE_NAME = "hwahae";

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
  status: "new";
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

export function createServiceRoleClient(): SupabaseClient {
  return createClient(getRequiredEnv("SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
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

  let insertedCount = 0;
  let skippedCount = 0;

  for (const candidate of deduplicatedCandidates.values()) {
    const { data: existing, error: lookupError } = await client
      .from("product_candidates")
      .select("id")
      .eq("normalized_name", candidate.normalized_name)
      .eq("normalized_brand", candidate.normalized_brand)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Failed to lookup product candidate: ${lookupError.message}`);
    }

    if (existing) {
      skippedCount += 1;
      continue;
    }

    const { error: insertError } = await client.from("product_candidates").insert(candidate);

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
