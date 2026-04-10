import dotenv from "dotenv";
import { chromium, type Browser, type Page } from "playwright";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { normalizeBrandName, normalizeProductName } from "./lib/normalize.js";
import { runReviewPrep } from "./review-prep.js";
import {
  createCrawlJob,
  createServiceRoleClient,
  insertSourceRankings,
  updateCrawlJob,
  upsertProductCandidates,
  type ProductCandidateInsert,
  type SourceRankingInsert,
} from "./lib/supabase.js";

const SOURCE_NAME = "hwahae";
const BASE_URL = "https://www.hwahae.com/en/rankings";
const JSON_LD_SELECTOR = 'script[type="application/ld+json"]';
const DEFAULT_DELAY_MS = 1500;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 45000;
const DEFAULT_RETRIES = 3;
const DEFAULT_HEADLESS = true;

const CATEGORY_CONFIG = [
  { key: "skincare/toner", themeId: 5106, categoryPath: "skincare/toner" },
  { key: "skincare/serum", themeId: 5126, categoryPath: "skincare/serum" },
  { key: "skincare/cream", themeId: 5138, categoryPath: "skincare/cream" },
  { key: "skincare/suncare", themeId: 5297, categoryPath: "skincare/suncare" },
  { key: "cleansing/cleansing", themeId: 5178, categoryPath: "cleansing/cleansing" },
] as const;

interface RankingCategorySeed {
  key: string;
  themeId: number;
  categoryPath: string;
  url: string;
}

interface JsonLdProduct {
  name?: string;
  url?: string;
  image?: string;
  brand?: {
    name?: string;
  };
  aggregateRating?: {
    ratingValue?: number | string;
    reviewCount?: number | string;
  };
}

interface JsonLdListItem {
  position?: number | string;
  item?: JsonLdProduct;
}

interface ExtractedRankingItem {
  rankPosition: number;
  productName: string;
  brandName: string;
  rating: number | null;
  reviewCount: number | null;
  thumbnailUrl: string | null;
  sourceUrl: string;
}

interface RuntimeOptions {
  delayMs: number;
  retries: number;
  headless: boolean;
  dryRun: boolean;
  withReviewPrep: boolean;
  maxPages: number | null;
  themeIds: number[] | null;
}

interface CrawlSummary {
  categoriesCrawled: number;
  rowsInserted: number;
  candidatesInserted: number;
  errorsCount: number;
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

  const maxPagesArg = optionMap.get("max-pages") ?? process.env.HWAHAE_MAX_PAGES;
  const parsedMaxPages = maxPagesArg ? Number.parseInt(maxPagesArg, 10) : Number.NaN;
  const hasHeadedFlag = optionMap.has("headed");
  const hasDryRunFlag = optionMap.has("dry-run");

  return {
    delayMs: parseNumberValue(optionMap.get("delay-ms") ?? process.env.HWAHAE_DELAY_MS, DEFAULT_DELAY_MS),
    retries: Math.max(1, parseNumberValue(optionMap.get("retries") ?? process.env.HWAHAE_RETRIES, DEFAULT_RETRIES)),
    headless: hasHeadedFlag ? false : parseBooleanFlag(process.env.HWAHAE_HEADLESS, DEFAULT_HEADLESS),
    dryRun: hasDryRunFlag || parseBooleanFlag(process.env.HWAHAE_DRY_RUN, false),
    withReviewPrep: optionMap.has("with-review-prep"),
    maxPages: Number.isFinite(parsedMaxPages) ? parsedMaxPages : null,
    themeIds,
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

function getConfiguredCategorySeeds(options: RuntimeOptions): RankingCategorySeed[] {
  let seeds = CATEGORY_CONFIG.map((category) => ({
    key: category.key,
    themeId: category.themeId,
    categoryPath: category.categoryPath,
    url: `${BASE_URL}?english_name=category&theme_id=${category.themeId}`,
  }));

  if (options.themeIds) {
    const themeIdSet = new Set(options.themeIds);
    seeds = seeds.filter((seed) => themeIdSet.has(seed.themeId));
  }

  if (options.maxPages !== null) {
    seeds = seeds.slice(0, options.maxPages);
  }

  return seeds;
}

async function extractRankingItemsFromJsonLd(page: Page, rankingPageUrl: string): Promise<ExtractedRankingItem[]> {
  const rawJsonBlocks = await page.locator(JSON_LD_SELECTOR).evaluateAll((elements) =>
    elements
      .map((element) => element.textContent)
      .filter((value): value is string => Boolean(value))
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

  return itemListBlock.itemListElement
    .map((entry, index) => {
      const product = entry.item;
      const rankPosition = coerceNumber(entry.position) ?? index + 1;
      const productName = product?.name?.trim() ?? "";
      const brandName = product?.brand?.name?.trim() ?? "";

      if (!productName || !brandName) {
        return null;
      }

      return {
        rankPosition,
        productName,
        brandName,
        rating: coerceNumber(product?.aggregateRating?.ratingValue),
        reviewCount: coerceNumber(product?.aggregateRating?.reviewCount),
        thumbnailUrl: product?.image?.trim() || null,
        sourceUrl: product?.url?.trim() || rankingPageUrl,
      } satisfies ExtractedRankingItem;
    })
    .filter((entry): entry is ExtractedRankingItem => entry !== null);
}

async function crawlCategoryPage(
  page: Page,
  seed: RankingCategorySeed,
  options: RuntimeOptions,
): Promise<ExtractedRankingItem[]> {
  await withRetry(`load category ${seed.themeId}`, options.retries, async () => {
    await page.goto(seed.url, {
      waitUntil: "domcontentloaded",
      timeout: DEFAULT_NAVIGATION_TIMEOUT_MS,
    });
  });

  await page.waitForSelector(JSON_LD_SELECTOR, {
    timeout: DEFAULT_NAVIGATION_TIMEOUT_MS,
    state: "attached",
  });
  await sleep(options.delayMs);

  return withRetry(`extract category ${seed.themeId}`, options.retries, async () =>
    extractRankingItemsFromJsonLd(page, seed.url),
  );
}

function buildSourceRankingRows(
  categoryPath: string,
  collectedAt: string,
  items: ExtractedRankingItem[],
): SourceRankingInsert[] {
  return items.map((item) => ({
    source_name: SOURCE_NAME,
    category_path: categoryPath,
    rank_position: item.rankPosition,
    product_name: item.productName,
    brand_name: item.brandName,
    rating: item.rating,
    review_count: item.reviewCount,
    thumbnail_url: item.thumbnailUrl,
    source_url: item.sourceUrl,
    collected_at: collectedAt,
  }));
}

function buildProductCandidateRows(
  categoryPath: string,
  items: ExtractedRankingItem[],
): ProductCandidateInsert[] {
  return items.map((item) => ({
    source_name: SOURCE_NAME,
    category_path: categoryPath,
    product_name_raw: item.productName,
    brand_name_raw: item.brandName,
    normalized_name: normalizeProductName(item.productName),
    normalized_brand: normalizeBrandName(item.brandName),
    status: "new",
    review_status: "new",
  }));
}

function printSummary(summary: CrawlSummary, dryRun: boolean): void {
  console.log("");
  console.log("Crawl summary");
  console.log(`- categories crawled: ${summary.categoriesCrawled}`);
  console.log(`- rows inserted${dryRun ? " (would insert)" : ""}: ${summary.rowsInserted}`);
  console.log(`- candidates inserted${dryRun ? " (would insert)" : ""}: ${summary.candidatesInserted}`);
  console.log(`- errors count: ${summary.errorsCount}`);
}

async function run(): Promise<void> {
  loadEnvironment();

  const options = parseArgs(process.argv.slice(2));
  const client = options.dryRun ? null : createServiceRoleClient();
  let browser: Browser | null = null;
  let crawlJobId: number | string | null = null;
  let summaryPrinted = false;
  const summary: CrawlSummary = {
    categoriesCrawled: 0,
    rowsInserted: 0,
    candidatesInserted: 0,
    errorsCount: 0,
  };
  const errorLogs: string[] = [];

  try {
    if (client) {
      const crawlJob = await createCrawlJob(client);
      crawlJobId = crawlJob.id;
    }

    browser = await chromium.launch({ headless: options.headless });

    const page = await browser.newPage({
      locale: "en-US",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    });

    const seeds = getConfiguredCategorySeeds(options);

    if (seeds.length === 0) {
      console.warn("No category pages matched the current filters.");
    } else {
      console.log(`Discovered ${seeds.length} category pages to crawl.`);
    }

    for (const [index, seed] of seeds.entries()) {
      console.log(`[${index + 1}/${seeds.length}] Crawling ${seed.categoryPath} (${seed.url})`);

      try {
        const items = await crawlCategoryPage(page, seed, options);
        const collectedAt = new Date().toISOString();
        const rankingRows = buildSourceRankingRows(seed.categoryPath, collectedAt, items);
        const candidateRows = buildProductCandidateRows(seed.categoryPath, items);

        summary.categoriesCrawled += 1;

        if (client) {
          const sourceRankingResult = await insertSourceRankings(client, rankingRows);
          const candidateResult = await upsertProductCandidates(client, candidateRows);

          summary.rowsInserted += sourceRankingResult.insertedCount;
          summary.candidatesInserted += candidateResult.insertedCount;
        } else {
          summary.rowsInserted += rankingRows.length;
          summary.candidatesInserted += candidateRows.length;
          console.log(`[dry-run] Prepared ${rankingRows.length} source ranking rows for ${seed.categoryPath}`);
        }
      } catch (error) {
        summary.errorsCount += 1;
        const errorMessage = `[${seed.categoryPath}] ${formatError(error)}`;
        errorLogs.push(errorMessage);
        console.error(errorMessage);
      }
    }

    if (client && crawlJobId !== null) {
      await updateCrawlJob(client, crawlJobId, {
        status: summary.errorsCount > 0 ? "failed" : "completed",
        itemCount: summary.rowsInserted,
        errorLog: errorLogs.join("\n\n"),
      });
    }

    printSummary(summary, options.dryRun);
    summaryPrinted = true;

    if (summary.errorsCount > 0) {
      throw new Error(`Crawler finished with ${summary.errorsCount} category error(s).`);
    }

    if (options.withReviewPrep) {
      if (options.dryRun) {
        console.log("");
        console.log("[with-review-prep] Skipped automatic review prep because crawl ran in dry-run mode.");
      } else {
        console.log("");
        console.log("[with-review-prep] Starting automatic review prep for pending candidates...");
        await runReviewPrep({
          limit: Math.max(100, summary.candidatesInserted),
          dryRun: false,
        });
      }
    }
  } catch (error) {
    if (client && crawlJobId !== null) {
      await updateCrawlJob(client, crawlJobId, {
        status: "failed",
        itemCount: summary.rowsInserted,
        errorLog: [errorLogs.join("\n\n"), formatError(error)].filter(Boolean).join("\n\n"),
      });
    }

    if (!summaryPrinted && (summary.categoriesCrawled > 0 || summary.errorsCount > 0)) {
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
