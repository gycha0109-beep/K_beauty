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
  updateCrawlJob,
  type RankingSnapshotIngestResult,
} from "./lib/supabase.js";

const JSON_LD_SELECTOR = 'script[type="application/ld+json"]';
const DEFAULT_DELAY_MS = 1500;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 45000;
const DEFAULT_RETRIES = 3;
const DEFAULT_HEADLESS = true;
const COLLECTOR_VERSION = "hwahae-ranking-phase1/1";

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

interface RuntimeOptions {
  delayMs: number;
  retries: number;
  headless: boolean;
  dryRun: boolean;
  withReviewPrep: boolean;
  maxPages: number | null;
  themeIds: number[] | null;
  jobIds: string[] | null;
  configPath?: string;
  includeDisabled: boolean;
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
  const configPath = optionMap.get("config") ?? process.env.HWAHAE_RANKING_JOBS_CONFIG;

  return {
    delayMs: parseNumberValue(optionMap.get("delay-ms") ?? process.env.HWAHAE_DELAY_MS, DEFAULT_DELAY_MS),
    retries: Math.max(1, parseNumberValue(optionMap.get("retries") ?? process.env.HWAHAE_RETRIES, DEFAULT_RETRIES)),
    headless: hasHeadedFlag ? false : parseBooleanFlag(process.env.HWAHAE_HEADLESS, DEFAULT_HEADLESS),
    dryRun: hasDryRunFlag || parseBooleanFlag(process.env.HWAHAE_DRY_RUN, false),
    withReviewPrep: optionMap.has("with-review-prep"),
    maxPages: Number.isFinite(parsedMaxPages) ? parsedMaxPages : null,
    themeIds,
    jobIds,
    configPath,
    includeDisabled: optionMap.has("include-disabled"),
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

  const snapshot = await withRetry(`extract ranking job ${job.id}`, options.retries, async () =>
    extractRankingSnapshotFromJsonLd(page, sourceUrl, job.limit),
  );

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

function printSummary(summary: CrawlSummary, dryRun: boolean): void {
  console.log("");
  console.log(dryRun ? "Crawl summary (dry-run)" : "Crawl summary");
  console.log(`- jobs crawled: ${summary.jobsCrawled}`);
  console.log(`- snapshots created: ${summary.snapshotsCreated}`);
  console.log(`- source_rankings new rows: ${summary.sourceRankingsInserted}`);
  console.log(`- source_rankings skipped duplicates: ${summary.sourceRankingsSkipped}`);
  console.log(`- product_candidates new candidates: ${summary.candidatesInserted}`);
  console.log(`- product_candidates reobserved: ${summary.candidatesReobserved}`);
  console.log(`- identity collisions/pending matches: ${summary.pendingIdentityCount}`);
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
      includeDisabled: options.includeDisabled,
      themeIds: options.themeIds,
      maxPages: options.maxPages,
    });
    const filteredJobs = options.jobIds
      ? jobs.filter((job) => options.jobIds?.includes(job.id))
      : jobs;

    if (filteredJobs.length === 0) {
      console.warn("No ranking jobs matched the current filters.");
    } else {
      console.log(`Discovered ${filteredJobs.length} ranking job(s) to crawl.`);
    }

    browser = await chromium.launch({ headless: options.headless });

    const page = await browser.newPage({
      locale: "en-US",
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
