import dotenv from "dotenv";
import { chromium, type Browser, type Page } from "playwright";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  loadRankingJobs,
  resolveRankingJobUrl,
  type RankingJobConfig,
} from "./lib/ranking-config.js";
import {
  saveRankingSnapshotFile,
  type RankingSnapshotItem,
  type RankingSnapshotPayload,
} from "./lib/snapshot.js";
import {
  createCrawlJob,
  createServiceRoleClient,
  ingestRankingSnapshot,
  refreshCandidatePromotionReviews,
  updateCrawlJob,
  type CandidatePromotionReviewRefreshResult,
  type RankingSnapshotIngestResult,
} from "./lib/supabase.js";

const JSON_LD_SELECTOR = 'script[type="application/ld+json"]';
const DEFAULT_DELAY_MS = 1500;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 45000;
const DEFAULT_RETRIES = 3;
const DEFAULT_HEADLESS = true;
const COLLECTOR_VERSION = "hwahae-ranking-phase1/1";
const REVIEW_RULE_VERSION = "ranking-review-v2";

interface JsonLdProduct {
  name?: string;
  url?: string;
  image?: string;
  brand?: {
    name?: string;
  } | string;
  aggregateRating?: {
    ratingValue?: number | string;
    reviewCount?: number | string;
  };
  offers?: {
    price?: number | string;
    lowPrice?: number | string;
  };
}

interface JsonLdListItem {
  position?: number | string;
  item?: JsonLdProduct;
}

interface HwahaeRankingApiDetail {
  brand?: {
    name?: string;
    alias?: string;
  };
  goods?: {
    id?: number | string;
    product_id?: number | string;
    name?: string;
    price?: number | string;
    image_url?: string;
  };
  product?: {
    id?: number | string;
    name?: string;
    image_url?: string;
    review_count?: number | string;
    review_rating?: number | string;
    price?: number | string;
  };
}

interface HwahaeRankingApiResponse {
  meta?: {
    pagination?: {
      total_count?: number;
      count?: number;
      page?: number;
      page_size?: number;
    };
  };
  data?: {
    details?: HwahaeRankingApiDetail[];
  };
}

interface RuntimeOptions {
  delayMs: number;
  retries: number;
  headless: boolean;
  dryRun: boolean;
  allJobs: boolean;
  withReviewPrep: boolean;
  maxPages: number | null;
  themeIds: number[] | null;
  jobIds: string[] | null;
  configPath?: string;
  includeDisabled: boolean;
  cdpUrl: string | null;
}

interface CrawlSummary {
  jobsCrawled: number;
  snapshotsCreated: number;
  sourceRankingsInserted: number;
  sourceRankingsSkipped: number;
  candidatesInserted: number;
  candidatesReobserved: number;
  pendingIdentityCount: number;
  productsWritten: 0;
  reviewsInserted: number;
  reviewsUpdated: number;
  reviewsDeferred: number;
  reviewsProtectedSkipped: number;
  errorsCount: number;
}

interface ExtractedSnapshot {
  rawJsonLd: unknown[];
  items: RankingSnapshotItem[];
}

function loadEnvironment(): void {
  const currentFile = fileURLToPath(import.meta.url);
  const crawlerDirectory = path.dirname(currentFile);
  const workspaceDirectory = path.resolve(crawlerDirectory, "..");

  const candidateEnvFiles = [
    path.join(crawlerDirectory, ".env"),
    path.join(crawlerDirectory, ".env.local"),
    path.join(workspaceDirectory, ".env"),
    path.join(workspaceDirectory, ".env.local"),
  ];

  for (const envFile of candidateEnvFiles) {
    dotenv.config({ path: envFile, override: false });
  }
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseNumberValue(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalThemeIds(value: string | undefined): number[] | null {
  if (!value) {
    return null;
  }

  const themeIds = value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part));

  return themeIds.length > 0 ? Array.from(new Set(themeIds)) : null;
}

function parseOptionalStringList(value: string | undefined): string[] | null {
  if (!value) {
    return null;
  }

  const values = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return values.length > 0 ? Array.from(new Set(values)) : null;
}

function parseArgs(argv: string[]): RuntimeOptions {
  const optionMap = new Map<string, string | undefined>();

  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      continue;
    }

    const [rawKey, rawValue] = argument.slice(2).split("=", 2);
    optionMap.set(rawKey, rawValue);
  }

  const themeIds =
    parseOptionalThemeIds(optionMap.get("theme-ids")) ??
    parseOptionalThemeIds(process.env.HWAHAE_THEME_IDS);
  const jobIds =
    parseOptionalStringList(optionMap.get("job-ids")) ??
    parseOptionalStringList(process.env.HWAHAE_JOB_IDS);
  const maxPagesArg = optionMap.get("max-pages") ?? process.env.HWAHAE_MAX_PAGES;
  const parsedMaxPages = maxPagesArg ? Number.parseInt(maxPagesArg, 10) : Number.NaN;
  const hasHeadedFlag = optionMap.has("headed");
  const hasDryRunFlag = optionMap.has("dry-run");
  const allJobs = optionMap.has("all");
  const configPath = optionMap.get("config") ?? process.env.HWAHAE_RANKING_JOBS_CONFIG;

  if (allJobs && jobIds) {
    throw new Error("Cannot use --all with --job-ids. Use exactly one job selection mode.");
  }

  return {
    delayMs: parseNumberValue(optionMap.get("delay-ms") ?? process.env.HWAHAE_DELAY_MS, DEFAULT_DELAY_MS),
    retries: Math.max(1, parseNumberValue(optionMap.get("retries") ?? process.env.HWAHAE_RETRIES, DEFAULT_RETRIES)),
    headless: hasHeadedFlag ? false : parseBooleanFlag(process.env.HWAHAE_HEADLESS, DEFAULT_HEADLESS),
    dryRun: hasDryRunFlag || parseBooleanFlag(process.env.HWAHAE_DRY_RUN, false),
    allJobs,
    withReviewPrep: optionMap.has("with-review-prep"),
    maxPages: Number.isFinite(parsedMaxPages) ? parsedMaxPages : null,
    themeIds,
    jobIds,
    configPath,
    includeDisabled: optionMap.has("include-disabled"),
    cdpUrl: optionMap.get("cdp-url") ?? process.env.HWAHAE_CDP_URL ?? null,
  };
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function withRetry<T>(label: string, retries: number, fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < retries) {
    attempt += 1;

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= retries) {
        break;
      }

      console.warn(`[retry] ${label} failed on attempt ${attempt}/${retries}: ${formatError(error)}`);
      await sleep(1000 * attempt);
    }
  }

  throw lastError;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function coerceNumber(value: number | string | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalizedValue = value.replace(/,/g, "").trim();
    const parsed = Number.parseFloat(normalizedValue);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getBrandName(product: JsonLdProduct | undefined): string {
  const brand = product?.brand;

  if (typeof brand === "string") {
    return brand.trim();
  }

  return brand?.name?.trim() ?? "";
}

function parseExternalFromUrl(url: string): { externalType: string | null; externalId: string | null } {
  const match = url.match(/\/(goods|products|product)\/(\d+)/i);

  if (!match) {
    return {
      externalType: null,
      externalId: null,
    };
  }

  return {
    externalType: match[1] === "product" ? "products" : match[1],
    externalId: match[2],
  };
}

function normalizeRawItem(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {
    value: String(value ?? ""),
  };
}

function extractItemProduct(entry: JsonLdListItem & JsonLdProduct): JsonLdProduct | undefined {
  return entry.item ?? entry;
}

function parseRankingItems(
  itemListElement: JsonLdListItem[],
  rankingPageUrl: string,
  limit: number,
): RankingSnapshotItem[] {
  return itemListElement
    .map((entry, index) => {
      const product = extractItemProduct(entry as JsonLdListItem & JsonLdProduct);
      const rankPosition = coerceNumber(entry.position) ?? index + 1;
      const productName = product?.name?.trim() ?? "";
      const brandName = getBrandName(product);

      if (!productName || !brandName) {
        return null;
      }

      const sourceUrl = product?.url?.trim() || rankingPageUrl;
      const external = parseExternalFromUrl(sourceUrl);
      const price = coerceNumber(product?.offers?.price) ?? coerceNumber(product?.offers?.lowPrice);

      return {
        rankPosition,
        productName,
        brandName,
        rating: coerceNumber(product?.aggregateRating?.ratingValue),
        reviewCount: coerceNumber(product?.aggregateRating?.reviewCount),
        thumbnailUrl: product?.image?.trim() || null,
        sourceUrl,
        price,
        externalType: external.externalType,
        externalId: external.externalId,
        rawItem: normalizeRawItem(entry),
      } satisfies RankingSnapshotItem;
    })
    .filter((entry): entry is RankingSnapshotItem => entry !== null)
    .slice(0, limit);
}

function buildHwahaeRankingApiUrl(themeId: number, pageNumber: number, pageSize = 20): string {
  return `https://gateway.hwahae.co.kr/v14/rankings/${themeId}/details?page=${pageNumber}&page_size=${pageSize}`;
}

function parseRankingItemsFromHwahaeApi(
  responses: Array<{ page: number; response: HwahaeRankingApiResponse }>,
  limit: number,
): RankingSnapshotItem[] {
  const pageSize = responses[0]?.response.meta?.pagination?.page_size ?? 20;

  return responses
    .flatMap(({ page, response }) =>
      (response.data?.details ?? []).map((detail, index): RankingSnapshotItem | null => {
        const rankPosition = (page - 1) * pageSize + index + 1;
        const productId = detail.product?.id ?? detail.goods?.product_id;
        const goodsId = detail.goods?.id;
        const productName = detail.product?.name?.trim() || detail.goods?.name?.trim() || "";
        const brandName = detail.brand?.name?.trim() || detail.brand?.alias?.trim() || "";
        const sourceUrl = goodsId
          ? `https://www.hwahae.co.kr/goods/${goodsId}`
          : productId
            ? `https://www.hwahae.co.kr/products/${productId}`
            : "https://www.hwahae.co.kr";

        if (!productName || !brandName || !productId) {
          return null;
        }

        return {
          rankPosition,
          productName,
          brandName,
          rating: coerceNumber(detail.product?.review_rating),
          reviewCount: coerceNumber(detail.product?.review_count),
          thumbnailUrl: detail.product?.image_url?.trim() || detail.goods?.image_url?.trim() || null,
          sourceUrl,
          price: coerceNumber(detail.goods?.price) ?? coerceNumber(detail.product?.price),
          externalType: "products",
          externalId: String(productId),
          rawItem: normalizeRawItem({
            rankPosition,
            page,
            detail,
          }),
        } satisfies RankingSnapshotItem;
      }),
    )
    .filter((entry): entry is RankingSnapshotItem => entry !== null)
    .slice(0, limit);
}

async function extractRankingSnapshotFromJsonLd(
  page: Page,
  rankingPageUrl: string,
  limit: number,
): Promise<ExtractedSnapshot> {
  const rawJsonBlocks = await page.locator(JSON_LD_SELECTOR).evaluateAll((elements) =>
    elements
      .map((element) => element.textContent)
      .filter((value): value is string => Boolean(value)),
  );

  const parsedBlocks = rawJsonBlocks.flatMap((rawBlock) => {
    try {
      const parsed = JSON.parse(rawBlock) as unknown;
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  });

  const itemListBlock = parsedBlocks
    .filter((entry): entry is { "@type"?: string; itemListElement?: JsonLdListItem[] } => {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      return (entry as { "@type"?: string })["@type"] === "ItemList";
    })
    .sort((left, right) => (right.itemListElement?.length ?? 0) - (left.itemListElement?.length ?? 0))[0];

  if (!itemListBlock?.itemListElement?.length) {
    throw new Error(`Unable to find ItemList JSON-LD on ${rankingPageUrl}`);
  }

  return {
    rawJsonLd: parsedBlocks,
    items: parseRankingItems(itemListBlock.itemListElement, rankingPageUrl, limit),
  };
}

async function extractRankingSnapshotFromHwahaeGateway(
  page: Page,
  job: RankingJobConfig,
  sourceUrl: string,
): Promise<ExtractedSnapshot> {
  if (job.source !== "hwahae" || typeof job.themeId !== "number") {
    throw new Error(`Ranking job ${job.id} cannot use Hwahae gateway collector without a themeId.`);
  }

  const pageSize = 20;
  const requiredPages = Math.ceil(job.requestedLimit / pageSize);
  const responses: Array<{ page: number; response: HwahaeRankingApiResponse }> = [];

  for (let pageNumber = 1; pageNumber <= requiredPages; pageNumber += 1) {
    const apiUrl = buildHwahaeRankingApiUrl(job.themeId, pageNumber, pageSize);
    const apiResponse = await page.request.get(apiUrl, {
      headers: {
        accept: "application/json",
        referer: sourceUrl,
      },
    });

    if (!apiResponse.ok()) {
      throw new Error(`Hwahae ranking API failed: ${apiResponse.status()} ${apiResponse.statusText()}`);
    }

    const response = (await apiResponse.json()) as HwahaeRankingApiResponse;
    const pagination = response.meta?.pagination;

    if (pagination?.page !== pageNumber) {
      throw new Error(`Hwahae ranking API returned page ${pagination?.page ?? "unknown"} for requested page ${pageNumber}.`);
    }

    responses.push({ page: pageNumber, response });
  }

  const items = parseRankingItemsFromHwahaeApi(responses, job.limit);
  const positions = items.map((item) => item.rankPosition);
  const expectedPositions = Array.from({ length: job.requestedLimit }, (_value, index) => index + 1);
  const duplicateExternalIds = new Set<string>();
  const seenExternalIds = new Set<string>();

  for (const item of items) {
    const key = `${item.externalType ?? ""}:${item.externalId ?? ""}`;
    if (seenExternalIds.has(key)) {
      duplicateExternalIds.add(key);
    }
    seenExternalIds.add(key);
  }

  if (items.length < job.requestedLimit) {
    throw new Error(
      `Hwahae gateway collector returned ${items.length} item(s), below requested_limit ${job.requestedLimit}.`,
    );
  }

  if (positions.join(",") !== expectedPositions.join(",")) {
    throw new Error(`Hwahae gateway collector returned non-contiguous ranks: ${positions.join(",")}.`);
  }

  if (duplicateExternalIds.size > 0) {
    throw new Error(`Hwahae gateway collector returned duplicate product identities: ${Array.from(duplicateExternalIds).join(",")}.`);
  }

  return {
    rawJsonLd: [
      {
        "@type": "HwahaeRankingGatewaySnapshot",
        sourceUrl,
        requestedLimit: job.requestedLimit,
        apiResponses: responses,
      },
    ],
    items,
  };
}

async function crawlRankingJob(
  page: Page,
  job: RankingJobConfig,
  options: RuntimeOptions,
): Promise<{ sourceUrl: string; snapshot: ExtractedSnapshot }> {
  const sourceUrl = resolveRankingJobUrl(job);

  await withRetry(`load ranking job ${job.id}`, options.retries, async () => {
    await page.goto(sourceUrl, {
      waitUntil: "domcontentloaded",
      timeout: DEFAULT_NAVIGATION_TIMEOUT_MS,
    });
  });

  await page.waitForSelector(JSON_LD_SELECTOR, {
    timeout: DEFAULT_NAVIGATION_TIMEOUT_MS,
    state: "attached",
  });
  await sleep(options.delayMs);

  const snapshot = await withRetry(`extract ranking job ${job.id}`, options.retries, async () => {
    const jsonLdSnapshot = await extractRankingSnapshotFromJsonLd(page, sourceUrl, job.limit);

    if (jsonLdSnapshot.items.length >= job.requestedLimit) {
      return jsonLdSnapshot;
    }

    if (job.requestedLimit <= 20) {
      return jsonLdSnapshot;
    }

    return extractRankingSnapshotFromHwahaeGateway(page, job, sourceUrl);
  });

  return {
    sourceUrl,
    snapshot,
  };
}

function mergeIngestResult(summary: CrawlSummary, result: RankingSnapshotIngestResult): void {
  summary.sourceRankingsInserted += result.sourceRankingsInserted;
  summary.sourceRankingsSkipped += result.sourceRankingsSkipped;
  summary.candidatesInserted += result.candidatesInserted;
  summary.candidatesReobserved += result.candidatesReobserved;
  summary.pendingIdentityCount += result.pendingIdentityCount;
}

function mergeReviewRefreshResult(summary: CrawlSummary, result: CandidatePromotionReviewRefreshResult): void {
  summary.reviewsInserted += result.reviewsInserted;
  summary.reviewsUpdated += result.reviewsUpdated;
  summary.reviewsDeferred += result.reviewsDeferred;
  summary.reviewsProtectedSkipped += result.protectedReviewsSkipped;
}

function shouldRefreshPromotionReviews(options: RuntimeOptions): boolean {
  return (
    !options.dryRun &&
    !options.jobIds &&
    !options.themeIds &&
    options.maxPages === null &&
    !options.includeDisabled
  );
}

function printSummary(summary: CrawlSummary, dryRun: boolean): void {
  console.log("");
  console.log(dryRun ? "Crawl summary (dry-run)" : "Crawl summary");
  console.log(`- jobs crawled: ${summary.jobsCrawled}`);
  console.log(`- jobs succeeded: ${summary.jobsCrawled}`);
  console.log(`- jobs failed: ${summary.errorsCount}`);
  console.log(`- snapshots created: ${summary.snapshotsCreated}`);
  console.log(`- ranking observations created: ${summary.sourceRankingsInserted}`);
  console.log(`- source_rankings new rows: ${summary.sourceRankingsInserted}`);
  console.log(`- source_rankings skipped duplicates: ${summary.sourceRankingsSkipped}`);
  console.log(`- product_candidates new candidates: ${summary.candidatesInserted}`);
  console.log(`- product_candidates reobserved: ${summary.candidatesReobserved}`);
  console.log(`- identity collisions/pending matches: ${summary.pendingIdentityCount}`);
  console.log(`- candidate_promotion_reviews new rows: ${summary.reviewsInserted}`);
  console.log(`- candidate_promotion_reviews updated rows: ${summary.reviewsUpdated}`);
  console.log(`- candidate_promotion_reviews deferred rows: ${summary.reviewsDeferred}`);
  console.log(`- candidate_promotion_reviews protected skipped: ${summary.reviewsProtectedSkipped}`);
  console.log(`- products writes: ${summary.productsWritten}`);
  console.log(`- errors count: ${summary.errorsCount}`);
}

async function run(): Promise<void> {
  loadEnvironment();

  const currentFile = fileURLToPath(import.meta.url);
  const crawlerDirectory = path.dirname(currentFile);
  const workspaceDirectory = path.resolve(crawlerDirectory, "..");
  const options = parseArgs(process.argv.slice(2));
  const client = options.dryRun ? null : createServiceRoleClient();
  let browser: Browser | null = null;
  let crawlJobId: number | string | null = null;
  let summaryPrinted = false;
  const summary: CrawlSummary = {
    jobsCrawled: 0,
    snapshotsCreated: 0,
    sourceRankingsInserted: 0,
    sourceRankingsSkipped: 0,
    candidatesInserted: 0,
    candidatesReobserved: 0,
    pendingIdentityCount: 0,
    productsWritten: 0,
    reviewsInserted: 0,
    reviewsUpdated: 0,
    reviewsDeferred: 0,
    reviewsProtectedSkipped: 0,
    errorsCount: 0,
  };
  const errorLogs: string[] = [];

  try {
    if (client) {
      const crawlJob = await createCrawlJob(client);
      crawlJobId = crawlJob.id;
    }

    const jobs = await loadRankingJobs({
      configPath: options.configPath,
      includeDisabled: options.allJobs ? false : options.includeDisabled,
      themeIds: options.themeIds,
      maxPages: options.maxPages,
    });
    console.log(`Enabled jobs discovered: ${jobs.filter((job) => job.enabled).length}`);

    const filteredJobs = options.jobIds
      ? jobs.filter((job) => options.jobIds?.includes(job.id))
      : jobs;

    if (filteredJobs.length === 0) {
      console.warn("No ranking jobs matched the current filters.");
    } else {
      console.log(`Discovered ${filteredJobs.length} ranking job(s) to crawl.`);
    }

    browser = options.cdpUrl
      ? await chromium.connectOverCDP(options.cdpUrl)
      : await chromium.launch({ headless: options.headless });

    const page = await browser.newPage({
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    });

    for (const [index, job] of filteredJobs.entries()) {
      console.log(
        `[${index + 1}/${filteredJobs.length}] Crawling ${job.id} (${job.serviceCategory}/${job.rankingScope}/${job.rankingFilter})`,
      );

      try {
        const { sourceUrl, snapshot } = await crawlRankingJob(page, job, options);
        const collectedAt = new Date().toISOString();
        const payload: RankingSnapshotPayload = {
          job,
          sourceUrl,
          collectedAt,
          collectorVersion: COLLECTOR_VERSION,
          rawJsonLd: snapshot.rawJsonLd,
          items: snapshot.items,
        };
        const savedSnapshot = await saveRankingSnapshotFile(payload, {
          workspaceRoot: workspaceDirectory,
        });

        summary.jobsCrawled += 1;
        console.log(`- items collected: ${snapshot.items.length}/${job.requestedLimit}`);
        console.log(`- snapshot file: ${path.relative(workspaceDirectory, savedSnapshot.filePath)}`);
        console.log(`- snapshot hash: ${savedSnapshot.snapshotHash}`);
        console.log(`- ingest key: ${savedSnapshot.ingestKey}`);

        if (client) {
          const ingestResult = await ingestRankingSnapshot(client, {
            ingestKey: savedSnapshot.ingestKey,
            snapshotHash: savedSnapshot.snapshotHash,
            job,
            sourceUrl,
            collectedAt,
            collectorVersion: COLLECTOR_VERSION,
            rawPayload: savedSnapshot.payload,
            items: snapshot.items,
          });
          if (ingestResult.snapshotCreated) {
            summary.snapshotsCreated += 1;
          }
          mergeIngestResult(summary, ingestResult);
        } else {
          const uniqueCandidateKeys = new Set(
            snapshot.items.map((item) =>
              item.externalType && item.externalId
                ? `${job.source}::${item.externalType}::${item.externalId}`
                : `${job.source}::${item.brandName.toLowerCase()}::${item.productName.toLowerCase()}`,
            ),
          );

          summary.snapshotsCreated += 1;
          summary.sourceRankingsInserted += snapshot.items.length;
          summary.candidatesInserted += uniqueCandidateKeys.size;
          console.log(
            `[dry-run] Prepared snapshot, ${snapshot.items.length} source ranking row(s), and ${uniqueCandidateKeys.size} candidate upsert candidate(s).`,
          );
        }
      } catch (error) {
        summary.errorsCount += 1;
        const errorMessage = `[${job.id}] ${formatError(error)}`;
        errorLogs.push(errorMessage);
        console.error(errorMessage);
      }
    }

    if (client && crawlJobId !== null) {
      await updateCrawlJob(client, crawlJobId, {
        status: summary.errorsCount > 0 ? "failed" : "completed",
        itemCount: summary.sourceRankingsInserted,
        errorLog: errorLogs.join("\n\n"),
      });
    }

    if (options.withReviewPrep) {
      console.log("");
      console.log("[with-review-prep] Skipped. Phase 1 ranking collection does not run review prep or promotion.");
    }

    if (summary.errorsCount === 0 && summary.jobsCrawled > 0 && shouldRefreshPromotionReviews(options)) {
      if (client) {
        const refreshResult = await refreshCandidatePromotionReviews(client, REVIEW_RULE_VERSION);
        mergeReviewRefreshResult(summary, refreshResult);
        console.log("");
        console.log(
          `[review-refresh] rule=${refreshResult.ruleVersion}, examined=${refreshResult.candidatesExamined}, inserted=${refreshResult.reviewsInserted}, updated=${refreshResult.reviewsUpdated}, deferred=${refreshResult.reviewsDeferred}, protected=${refreshResult.protectedReviewsSkipped}`,
        );
      }
    } else if (options.dryRun) {
      console.log("");
      console.log("[dry-run] Skipped candidate_promotion_reviews refresh.");
    } else if (options.jobIds || options.themeIds || options.maxPages !== null || options.includeDisabled) {
      console.log("");
      console.log("[review-refresh] Skipped because this was a filtered crawl.");
    } else if (summary.errorsCount > 0) {
      console.log("");
      console.log("[review-refresh] Skipped because one or more ranking jobs failed.");
    }

    printSummary(summary, options.dryRun);
    summaryPrinted = true;

    if (summary.errorsCount > 0) {
      throw new Error(`Crawler finished with ${summary.errorsCount} ranking job error(s).`);
    }
  } catch (error) {
    if (client && crawlJobId !== null) {
      await updateCrawlJob(client, crawlJobId, {
        status: "failed",
        itemCount: summary.sourceRankingsInserted,
        errorLog: [errorLogs.join("\n\n"), formatError(error)].filter(Boolean).join("\n\n"),
      });
    }

    if (!summaryPrinted && (summary.jobsCrawled > 0 || summary.errorsCount > 0)) {
      printSummary(summary, options.dryRun);
    }

    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

run().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
