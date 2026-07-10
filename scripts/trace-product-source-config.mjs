import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "product-source-config-trace.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "product-source-config-trace.md");
const ALIAS_LOADER = path.join(ROOT, "scripts", "node-next-alias-loader.mjs");
const ALIAS_LOADER_ENV = "PRODUCT_SOURCE_CONFIG_TRACE_ALIAS_LOADER";

const ENV_FILES = [".env", ".env.local", ".env.development", ".env.development.local"];
const PRODUCT_SOURCE_KEYS = [
  {
    keyName: "SUPABASE_URL",
    sourceFile: "lib/product-source.js",
    requiredFor: "product source URL fallback for getSupabaseConfig"
  },
  {
    keyName: "NEXT_PUBLIC_SUPABASE_URL",
    sourceFile: "lib/product-source.js",
    requiredFor: "product source URL fallback for getSupabaseConfig"
  },
  {
    keyName: "SUPABASE_ANON_KEY",
    sourceFile: "lib/product-source.js",
    requiredFor: "read-only Supabase client key fallback for getSupabaseConfig"
  },
  {
    keyName: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    sourceFile: "lib/product-source.js",
    requiredFor: "read-only Supabase client key fallback for getSupabaseConfig"
  },
  {
    keyName: "SUPABASE_SERVICE_ROLE_KEY",
    sourceFile: "lib/product-source.js",
    requiredFor: "not required by getRecommendationProducts read-only product source"
  }
];
const FILES_INSPECTED = [
  "lib/product-source.js",
  "lib/skin-match-decision-engine.js",
  "app/api/analyze/route.js",
  "scripts/inspect-read-only-scorer-compatible-product-source.mjs",
  "scripts/verify-read-only-scorer-compatible-product-source.mjs",
  "scripts/run-pure-engine-target-scenario-replay.mjs",
  "scripts/verify-pure-engine-target-scenario-replay.mjs",
  "docs/reviews/read-only-scorer-compatible-product-source-20260709.md",
  "docs/reviews/evaluator-boundary-pure-engine-target-replay-20260703.md",
  ".codex/AI_WORK_LOG.md"
];

let loadedModules = null;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function sortObject(input = {}) {
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)));
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortDeep(item)])
    );
  }
  return value;
}

function increment(map, key, amount = 1) {
  const normalized = normalizeText(key) || "unknown";
  map[normalized] = (map[normalized] || 0) + amount;
}

async function parseEnvFileKeys(fileName) {
  const filePath = path.join(ROOT, fileName);

  if (!existsSync(filePath)) {
    return {
      fileName,
      exists: false,
      keys: []
    };
  }

  const source = await readFile(filePath, "utf8");
  const keys = [];

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) {
      keys.push(match[1]);
    }
  }

  return {
    fileName,
    exists: true,
    keys: Array.from(new Set(keys)).sort()
  };
}

async function inspectEnvFiles() {
  const files = [];
  for (const fileName of ENV_FILES) {
    files.push(await parseEnvFileKeys(fileName));
  }
  return files;
}

function hasKeyInEnvFiles(envFiles, keyName) {
  return envFiles.some((file) => file.keys.includes(keyName));
}

function hasProcessKey(keyName) {
  return Boolean(process.env[keyName]);
}

function buildRequiredConfigKeys(envFiles) {
  return PRODUCT_SOURCE_KEYS.map((entry) => {
    const isPresentInProcessEnv = hasProcessKey(entry.keyName);
    const isPresentInEnvFile = hasKeyInEnvFiles(envFiles, entry.keyName);

    return {
      keyName: entry.keyName,
      presenceOnly: true,
      sourceFile: entry.sourceFile,
      requiredFor: entry.requiredFor,
      isPresent: isPresentInProcessEnv || isPresentInEnvFile,
      isPresentInProcessEnv,
      isPresentInEnvFile,
      valuePrinted: false
    };
  });
}

function resolveMissingConfigReasons({ beforeDotenvPresence, afterDotenvPresence, envFiles }) {
  const reasons = [];
  const processEnvHasUrl = beforeDotenvPresence.SUPABASE_URL || beforeDotenvPresence.NEXT_PUBLIC_SUPABASE_URL;
  const processEnvHasAnon =
    beforeDotenvPresence.SUPABASE_ANON_KEY || beforeDotenvPresence.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const effectiveHasUrl = afterDotenvPresence.SUPABASE_URL || afterDotenvPresence.NEXT_PUBLIC_SUPABASE_URL;
  const effectiveHasAnon =
    afterDotenvPresence.SUPABASE_ANON_KEY || afterDotenvPresence.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!processEnvHasUrl || !processEnvHasAnon) {
    reasons.push("phase23_direct_node_process_env_missing_product_source_config");
  }

  if (!effectiveHasUrl || !effectiveHasAnon) {
    reasons.push("read_only_product_source_unavailable_missing_config");
  }

  if (
    (!processEnvHasUrl || !processEnvHasAnon) &&
    envFiles.some((file) =>
      file.exists &&
      (file.keys.includes("NEXT_PUBLIC_SUPABASE_URL") || file.keys.includes("SUPABASE_URL")) &&
      (file.keys.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY") || file.keys.includes("SUPABASE_ANON_KEY"))
    )
  ) {
    reasons.push("env_file_has_required_keys_but_direct_node_script_did_not_load_env_file");
  }

  return Array.from(new Set(reasons)).sort();
}

async function loadEnvFilesPresenceOnly() {
  const dotenv = await import("dotenv");
  const loaded = [];

  for (const fileName of ENV_FILES) {
    const filePath = path.join(ROOT, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    const result = dotenv.config({
      path: filePath,
      override: false,
      quiet: true
    });

    loaded.push({
      fileName,
      loaded: !result.error,
      keyNames: result.parsed ? Object.keys(result.parsed).sort() : []
    });
  }

  return loaded;
}

async function loadProductModules() {
  if (loadedModules) {
    return loadedModules;
  }

  const [productSource, recommendationScoring] = await Promise.all([
    import("../lib/product-source.js"),
    import("../lib/recommendation-scoring.ts")
  ]);

  loadedModules = {
    getRecommendationProducts: productSource.getRecommendationProducts,
    isProductSourceUnavailableError: productSource.isProductSourceUnavailableError,
    getProductCategorySlot: recommendationScoring.getProductCategorySlot
  };

  return loadedModules;
}

function summarizeProducts(products, getProductCategorySlot) {
  const categoryDistribution = {};
  const slotDistribution = {};
  const fieldCoverage = {
    id: 0,
    name: 0,
    brand: 0,
    category: 0,
    product_form: 0,
    skin_types: 0,
    concerns: 0,
    texture: 0,
    finish: 0,
    irritation_risk: 0,
    sensitivity_safe: 0,
    ingredient_signals: 0,
    market_signals: 0,
    review_signals: 0
  };
  const missingRequiredFieldDistribution = {};
  let scorerCompatibleCount = 0;

  for (const product of products) {
    const slot = getProductCategorySlot(product);
    const missing = [];

    if (!normalizeText(product?.id)) missing.push("id");
    if (!normalizeText(product?.name)) missing.push("name");
    if (!normalizeText(product?.brand)) missing.push("brand");
    if (!slot) missing.push("authorized_recommendation_category");

    if (missing.length === 0) {
      scorerCompatibleCount += 1;
    } else {
      for (const key of missing) {
        increment(missingRequiredFieldDistribution, key);
      }
    }

    increment(categoryDistribution, product?.category);
    increment(slotDistribution, slot || "unauthorized");

    for (const key of Object.keys(fieldCoverage)) {
      const value = product?.[key];
      if (Array.isArray(value) ? value.length > 0 : value != null && value !== "") {
        fieldCoverage[key] += 1;
      }
    }
  }

  return {
    rowCount: products.length,
    scorerCompatibleCount,
    scorerIncompatibleCount: products.length - scorerCompatibleCount,
    categoryDistribution: sortObject(categoryDistribution),
    slotDistribution: sortObject(slotDistribution),
    fieldCoverage,
    missingRequiredFieldDistribution: sortObject(missingRequiredFieldDistribution)
  };
}

async function runReadOnlyAvailabilitySmoke() {
  const { getRecommendationProducts, getProductCategorySlot, isProductSourceUnavailableError } =
    await loadProductModules();

  try {
    const products = await getRecommendationProducts();
    return {
      status: "available",
      reason: null,
      queryType: "supabase_read_only_select_products_via_getRecommendationProducts",
      serviceRoleRequired: false,
      rowsRead: products.length,
      productDataPrinted: false,
      ...summarizeProducts(products, getProductCategorySlot)
    };
  } catch (error) {
    return {
      status: "unavailable",
      reason: isProductSourceUnavailableError(error)
        ? error.reason || "product_source_unavailable"
        : "unexpected_error",
      safeErrorClass: error?.name || "Error",
      queryType: "supabase_read_only_select_products_via_getRecommendationProducts",
      serviceRoleRequired: false,
      rowsRead: 0,
      productDataPrinted: false,
      rowCount: 0,
      scorerCompatibleCount: 0,
      scorerIncompatibleCount: 0,
      categoryDistribution: {},
      slotDistribution: {},
      fieldCoverage: {},
      missingRequiredFieldDistribution: {}
    };
  }
}

async function inspectLocalFixtureFeasibility() {
  const candidates = [
    {
      source: "tmp/functional-shadow-captures/*.json",
      status: existsSync(path.join(ROOT, "tmp", "functional-shadow-captures"))
        ? "available_sanitized_capture_rows"
        : "not_available",
      scorerCompatibleNow: false,
      reason: "capture sanitizer removes name and brand, so rows do not satisfy the existing scorer required-field filter"
    },
    {
      source: "data/hwahae-review-signals",
      status: existsSync(path.join(ROOT, "data", "hwahae-review-signals"))
        ? "available_review_signal_raw_material"
        : "not_available",
      scorerCompatibleNow: false,
      reason: "review-signal files are source material, not an exported getRecommendationProducts-compatible product loader"
    },
    {
      source: "data/hwahae",
      status: existsSync(path.join(ROOT, "data", "hwahae"))
        ? "available_import_source_material"
        : "not_available",
      scorerCompatibleNow: false,
      reason: "import/source files are not a current read-only scorer-compatible product source entrypoint"
    },
    {
      source: "data/promo-seeds.json",
      status: existsSync(path.join(ROOT, "data", "promo-seeds.json"))
        ? "available_non_product_seed"
        : "not_available",
      scorerCompatibleNow: false,
      reason: "promo seed data is not product source data for the recommendation scorer"
    }
  ];

  return {
    currentlyUsableLocalScorerCompatibleSource: candidates.some((candidate) => candidate.scorerCompatibleNow),
    candidates
  };
}

function buildEntrypoints() {
  return [
    {
      name: "getRecommendationProducts",
      sourceFile: "lib/product-source.js",
      calls: [
        "loadRecommendationProducts",
        "fetchSupabaseProducts",
        "getSupabaseConfig",
        "createClient(...).from(\"products\").select(\"*\").order(\"created_at\", { ascending: false }).limit(500)"
      ],
      readOnly: true,
      writes: false
    },
    {
      name: "buildSkinMatchDecisionBundle",
      sourceFile: "lib/skin-match-decision-engine.js",
      calls: [
        "options.products when provided",
        "getRecommendationProducts when options.products is absent"
      ],
      readOnly: true,
      writes: false
    },
    {
      name: "POST /api/analyze",
      sourceFile: "app/api/analyze/route.js",
      calls: [
        "fetchCurrentProductSnapshotsByIds for selected current products",
        "buildSkinMatchDecisionBundle without options.products",
        "dev-only candidate diagnostics only when FUNCTIONAL_SHADOW_CAPTURE=1"
      ],
      readOnlyProductQuery: true,
      routeHasOtherMutations: true
    }
  ];
}

function buildRouteProductSourcePath() {
  return {
    routeFile: "app/api/analyze/route.js",
    routeInvokedByThisTrace: false,
    path: [
      "Next runtime loads environment files",
      "POST(request)",
      "buildSkinMatchDecisionBundle(formInput, { includeCandidateSourceDiagnostics })",
      "getRecommendationProducts()",
      "getSupabaseConfig()",
      "Supabase anon read-only client",
      "products table select"
    ],
    importantDifference:
      "The route also enters guard/session/premium-store mutation paths, so it is not a safe no-write capture path."
  };
}

function buildScriptProductSourcePath() {
  return {
    phase22File: "scripts/run-pure-engine-target-scenario-replay.mjs",
    phase23File: "scripts/inspect-read-only-scorer-compatible-product-source.mjs",
    routeInvoked: false,
    path: [
      "direct Node process",
      "alias loader for @ imports",
      "buildSkinMatchDecisionBundle or getRecommendationProducts",
      "getSupabaseConfig reads process.env only"
    ],
    missingConfigReason:
      "Direct Node scripts do not automatically load .env.local unless dotenv or an equivalent env loader is used."
  };
}

function buildReadOnlyQueryFeasibility(availabilitySmoke, missingConfigReasons) {
  return {
    feasibleWithAnonKey: availabilitySmoke.status === "available",
    serviceRoleRequired: false,
    currentStatus: availabilitySmoke.status,
    currentReason: availabilitySmoke.reason,
    rowsRead: availabilitySmoke.rowsRead,
    safeAggregateOnly: true,
    productNamesPrinted: false,
    productBrandsPrinted: false,
    purchaseUrlsPrinted: false,
    blocker:
      availabilitySmoke.status === "available"
        ? null
        : missingConfigReasons.includes("read_only_product_source_unavailable_missing_config")
          ? "read_only_product_source_unavailable_missing_config"
          : availabilitySmoke.reason === "query_failed"
            ? "read_only_product_source_query_failed"
            : availabilitySmoke.reason || "unknown"
  };
}

function buildRecommendedSourceStrategy(availabilitySmoke, localFixtureFeasibility) {
  if (availabilitySmoke.status === "available" && availabilitySmoke.scorerCompatibleCount > 0) {
    return {
      recommendation: "phase25_rerun_pure_engine_replay_with_read_only_product_source",
      rationale:
        "The existing read-only Supabase product source can provide scorer-compatible rows without route invocation."
    };
  }

  if (availabilitySmoke.reason === "missing_config") {
    return {
      recommendation: "provide_read_only_supabase_url_and_anon_key_to_direct_node_scripts_or_load_env_file_before_phase25",
      rationale:
        "The product source does not require service role credentials, but direct Node scripts need URL and anon key in process.env."
    };
  }

  if (!localFixtureFeasibility.currentlyUsableLocalScorerCompatibleSource) {
    return {
      recommendation: "do_not_use_sanitized_capture_rows_as_scorer_source",
      rationale:
        "Current local artifacts are not a scorer-compatible product source because sanitized captures omit required scorer fields."
    };
  }

  return {
    recommendation: "investigate_read_only_query_failure_before_replay",
    rationale:
      "A query/config issue must be resolved before Phase 25 can produce candidate rows."
  };
}

function presenceMap(keys) {
  return Object.fromEntries(keys.map((key) => [key, hasProcessKey(key)]));
}

function buildConfigPresenceSnapshot(label, presence) {
  return {
    label,
    hasUrl:
      Boolean(presence.SUPABASE_URL) ||
      Boolean(presence.NEXT_PUBLIC_SUPABASE_URL),
    hasAnonKey:
      Boolean(presence.SUPABASE_ANON_KEY) ||
      Boolean(presence.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasServiceRoleKey: Boolean(presence.SUPABASE_SERVICE_ROLE_KEY),
    keyPresence: presence,
    valuesPrinted: false
  };
}

function makeMarkdown(artifact) {
  const keyRows = artifact.requiredConfigKeys
    .map((item) =>
      `| ${item.keyName} | ${item.isPresentInProcessEnv} | ${item.isPresentInEnvFile} | ${item.requiredFor} |`
    )
    .join("\n");

  return `# Product Source Config Trace - 2026-07-09

This document records Phase 24 product source config trace and read-only availability diagnostics. It is not approval to change product data or runtime recommendation policy.

## Summary

- Route invoked: ${artifact.routeInvoked}
- Supabase write executed: ${artifact.supabaseWriteExecuted}
- Runtime mutation: ${artifact.runtimeMutation}
- Read-only source status: ${artifact.readOnlyQueryFeasibility.currentStatus}
- Read-only rows read: ${artifact.readOnlyQueryFeasibility.rowsRead}
- Recommended next strategy: ${artifact.recommendedSourceStrategy.recommendation}

## Required Config Keys

| Key | Present in process.env | Present in env file | Required for |
| --- | --- | --- | --- |
${keyRows}

## Missing Config Reasons

${artifact.missingConfigReasons.map((item) => `- ${item}`).join("\n") || "- none"}

## Product Source Entrypoint

The current product source entrypoint is \`getRecommendationProducts()\` in \`lib/product-source.js\`. It reads Supabase \`products\` through an anon read-only client when URL and anon key config are present.

## Route vs Script Difference

The route runs under Next.js environment loading, but direct Node scripts only see \`process.env\` unless they explicitly load env files. The route also has guard/session/premium-store mutation paths, so this trace does not call it.

## Read-only Availability

- Status: ${artifact.readOnlyQueryFeasibility.currentStatus}
- Blocker: ${artifact.readOnlyQueryFeasibility.blocker || "none"}
- Service role required: ${artifact.readOnlyQueryFeasibility.serviceRoleRequired}
- Product names printed: ${artifact.readOnlyQueryFeasibility.productNamesPrinted}
- Product brands printed: ${artifact.readOnlyQueryFeasibility.productBrandsPrinted}

## Phase 25 Return Point

If read-only scorer-compatible rows are available, rerun pure engine replay in Phase 25 with the existing product source. If not, provide URL and anon key config to the direct Node environment or add an approved read-only env loading path before replay.
`;
}

export async function traceProductSourceConfig({ generatedAt = new Date().toISOString() } = {}) {
  const envFiles = await inspectEnvFiles();
  const beforeDotenvPresence = presenceMap(PRODUCT_SOURCE_KEYS.map((entry) => entry.keyName));
  const dotenvLoads = await loadEnvFilesPresenceOnly();
  const afterDotenvPresence = presenceMap(PRODUCT_SOURCE_KEYS.map((entry) => entry.keyName));
  const requiredConfigKeys = buildRequiredConfigKeys(envFiles);
  const missingConfigReasons = resolveMissingConfigReasons({
    beforeDotenvPresence,
    afterDotenvPresence,
    envFiles
  });
  const availabilitySmoke = await runReadOnlyAvailabilitySmoke();
  const localFixtureFeasibility = await inspectLocalFixtureFeasibility();
  const readOnlyQueryFeasibility = buildReadOnlyQueryFeasibility(availabilitySmoke, missingConfigReasons);
  const recommendedSourceStrategy = buildRecommendedSourceStrategy(
    availabilitySmoke,
    localFixtureFeasibility
  );

  return sortDeep({
    traceVersion: "product-source-config-trace-v1",
    generatedAt,
    filesInspected: FILES_INSPECTED,
    configPresence: [
      buildConfigPresenceSnapshot("before_env_file_load", beforeDotenvPresence),
      buildConfigPresenceSnapshot("after_env_file_load", afterDotenvPresence)
    ],
    envFilesInspected: envFiles.map((file) => ({
      fileName: file.fileName,
      exists: file.exists,
      keyNames: file.keys,
      valuesPrinted: false
    })),
    envFileLoads: dotenvLoads.map((item) => ({
      fileName: item.fileName,
      loaded: item.loaded,
      keyNames: item.keyNames,
      valuesPrinted: false
    })),
    productSourceEntrypoints: buildEntrypoints(),
    requiredConfigKeys,
    missingConfigReasons,
    routeProductSourcePath: buildRouteProductSourcePath(),
    scriptProductSourcePath: buildScriptProductSourcePath(),
    readOnlyAvailabilitySmoke: availabilitySmoke,
    readOnlyQueryFeasibility,
    localFixtureFeasibility,
    scorerCompatibleContractSummary: {
      phase23Source: "docs/reviews/read-only-scorer-compatible-product-source-20260709.md",
      minimumRequiredFields: [
        "id",
        "name",
        "brand",
        "authorized_recommendation_category"
      ],
      productFormRole:
        "product_form participates in serum and moisturizer subcategory authorization when present",
      sanitizedCaptureGap:
        "Phase 22 fallback capture rows omit name and brand, so they cannot satisfy the existing scorer filter."
    },
    recommendedSourceStrategy,
    limitations: [
      "does_not_invoke_api_analyze",
      "does_not_execute_supabase_write",
      "does_not_change_runtime_recommendation_policy",
      "read_only_smoke_reports_aggregate_coverage_only",
      "phase25_replay_not_executed_in_this_phase"
    ],
    routeInvoked: false,
    apiAnalyzeInvoked: false,
    supabaseWriteExecuted: false,
    runtimeMutation: false,
    syntheticProductsUsed: false
  });
}

async function main() {
  const result = await traceProductSourceConfig();
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(JSON_OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(MD_OUTPUT, makeMarkdown(result), "utf8");

  console.log("product source config trace complete");
  console.log(`read-only status: ${result.readOnlyQueryFeasibility.currentStatus}`);
  console.log(`read-only rows read: ${result.readOnlyQueryFeasibility.rowsRead}`);
  console.log(`recommended strategy: ${result.recommendedSourceStrategy.recommendation}`);
  console.log(`wrote ${JSON_OUTPUT}`);
  console.log(`wrote ${MD_OUTPUT}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.env[ALIAS_LOADER_ENV] !== "1") {
    const child = spawnSync(process.execPath, [
      "--experimental-loader",
      pathToFileURL(ALIAS_LOADER).href,
      process.argv[1],
      ...process.argv.slice(2)
    ], {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        [ALIAS_LOADER_ENV]: "1"
      }
    });

    process.exitCode = child.status || 0;
  } else {
    main().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  }
}
