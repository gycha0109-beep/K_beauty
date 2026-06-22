import { loadRankingJobs } from "./lib/ranking-config.js";

const EXPECTED_CATEGORIES = [
  "toner",
  "toner_pad",
  "lotion_emulsion",
  "cream",
  "gel",
  "balm",
  "sunscreen",
  "essence_ampoule_serum",
  "cleansing_foam",
] as const;

const EXPECTED_CONTEXTS = [
  "category_all",
  "hydration",
  "soothing",
  "moisturizing",
  "pores",
  "brightening",
  "anti_aging",
  "trouble",
  "exfoliation",
] as const;

const CONTEXT_LABELS: Record<(typeof EXPECTED_CONTEXTS)[number], string> = {
  category_all: "all",
  hydration: "hyd",
  soothing: "soa",
  moisturizing: "moi",
  pores: "por",
  brightening: "bri",
  anti_aging: "age",
  trouble: "tro",
  exfoliation: "exf",
};

const LEGACY_SPLIT_CATEGORIES = new Set(["serum", "ampoule", "essence"]);

type ExpectedContext = (typeof EXPECTED_CONTEXTS)[number];

function getJobContext(job: {
  rankingScope: string;
  rankingFilter: string;
}): string {
  if (job.rankingScope === "category_all" && job.rankingFilter === "all") {
    return "category_all";
  }

  return job.rankingFilter;
}

function formatCell(value: string, width: number): string {
  return value.padEnd(width, " ");
}

function hasEndpoint(job: { themeId?: number; url?: string }): boolean {
  return typeof job.themeId === "number" || Boolean(job.url);
}

const jobs = await loadRankingJobs({
  includeDisabled: true,
});

const violations: string[] = [];
const expectedCategorySet = new Set<string>(EXPECTED_CATEGORIES);
const expectedContextSet = new Set<string>(EXPECTED_CONTEXTS);
const jobsByCategoryContext = new Map<string, (typeof jobs)[number]>();

if (jobs.length !== EXPECTED_CATEGORIES.length * EXPECTED_CONTEXTS.length) {
  violations.push(
    `Expected ${EXPECTED_CATEGORIES.length * EXPECTED_CONTEXTS.length} jobs, found ${jobs.length}.`,
  );
}

for (const job of jobs) {
  const context = getJobContext(job);
  const category = job.sourceCategoryKey;

  if (!expectedCategorySet.has(category)) {
    violations.push(`${job.id}: unexpected source_category_key ${category}.`);
  }

  if (!expectedContextSet.has(context)) {
    violations.push(`${job.id}: unexpected ranking context ${context}.`);
  }

  const key = `${category}::${context}`;
  if (jobsByCategoryContext.has(key)) {
    violations.push(`${job.id}: duplicate source_category_key + context ${key}.`);
  } else {
    jobsByCategoryContext.set(key, job);
  }

  if (LEGACY_SPLIT_CATEGORIES.has(category)) {
    violations.push(`${job.id}: split essence/ampoule/serum category is not allowed.`);
  }

  if (category === "essence_ampoule_serum") {
    if (job.serviceCategory !== "treatment") {
      violations.push(`${job.id}: essence_ampoule_serum must use service_category=treatment.`);
    }

    if (job.sourceProductForm !== null) {
      violations.push(`${job.id}: essence_ampoule_serum must keep source_product_form=null.`);
    }
  }

  const expectedEvidenceType = context === "category_all" ? "popularity" : "concern_relevance";
  if (job.evidenceType !== expectedEvidenceType) {
    violations.push(`${job.id}: evidence_type must be ${expectedEvidenceType}.`);
  }

  if (!job.enabled && !job.disabledReason) {
    violations.push(`${job.id}: disabled job must define disabled_reason.`);
  }

  if (job.enabled && !hasEndpoint(job)) {
    violations.push(`${job.id}: enabled job must define themeId or url.`);
  }
}

for (const category of EXPECTED_CATEGORIES) {
  for (const context of EXPECTED_CONTEXTS) {
    const key = `${category}::${context}`;
    if (!jobsByCategoryContext.has(key)) {
      violations.push(`Missing job for ${key}.`);
    }
  }
}

const enabledCount = jobs.filter((job) => job.enabled).length;
const disabledCount = jobs.length - enabledCount;

console.log("Ranking job matrix audit");
console.log(`total=${jobs.length} enabled=${enabledCount} disabled=${disabledCount}`);
console.log("");

const header = [
  formatCell("category", 26),
  ...EXPECTED_CONTEXTS.map((context) => formatCell(CONTEXT_LABELS[context], 4)),
  formatCell("total", 7),
  formatCell("enabled", 8),
  "status",
].join("");
console.log(header);
console.log("-".repeat(header.length));

for (const category of EXPECTED_CATEGORIES) {
  const categoryJobs = jobs.filter((job) => job.sourceCategoryKey === category);
  const enabledInCategory = categoryJobs.filter((job) => job.enabled).length;
  const cells = EXPECTED_CONTEXTS.map((context) => {
    const job = jobsByCategoryContext.get(`${category}::${context}`);
    if (!job) {
      return formatCell("M", 4);
    }

    return formatCell(job.enabled ? "Y" : "-", 4);
  });
  const categoryViolations = violations.filter((violation) => violation.includes(category));

  console.log(
    [
      formatCell(category, 26),
      ...cells,
      formatCell(String(categoryJobs.length), 7),
      formatCell(String(enabledInCategory), 8),
      categoryViolations.length > 0 ? "FAIL" : "OK",
    ].join(""),
  );
}

if (violations.length > 0) {
  console.log("");
  console.error("Matrix audit failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log("");
  console.log("Matrix audit passed.");
}
