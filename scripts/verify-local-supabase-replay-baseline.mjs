import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL = path.join(ROOT, "supabase", "local-replay-test");
const ADAPTERS = path.join(LOCAL, "adapters");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");

const EXPECTED_ADAPTERS = [
  "00000000_local_replay_predecessor.sql",
  "20260524054048_local_replay_category_mapper_preconditions.sql",
  "20260525_local_replay_untracked_product_columns.sql",
  "99999999_local_replay_runtime_contract.sql"
];

const CATEGORY_MAPPER_ANCHOR = "20260524054049_reclassify_existing_moisturizers.sql";
const BRIDGE_ANCHOR = "20260526_moisturizer_lotion_emulsion_insert.sql";
const FIRST_TRACKED_MIGRATION = "20260410_safe_review_and_promotion_layer.sql";

const paths = {
  predecessor: path.join(ADAPTERS, EXPECTED_ADAPTERS[0]),
  categoryMapperPreconditions: path.join(ADAPTERS, EXPECTED_ADAPTERS[1]),
  bridge: path.join(ADAPTERS, EXPECTED_ADAPTERS[2]),
  runtime: path.join(ADAPTERS, EXPECTED_ADAPTERS[3]),
  config: path.join(LOCAL, "project-template", "config.toml"),
  seed: path.join(LOCAL, "project-template", "seed.sql"),
  prepare: path.join(ROOT, "scripts", "prepare-local-supabase-replay.mjs"),
  workflow: path.join(ROOT, ".github", "workflows", "local-supabase-replay-guard.yml"),
  firstMigration: path.join(MIGRATIONS, FIRST_TRACKED_MIGRATION),
  categoryMapperReplacement: path.join(MIGRATIONS, CATEGORY_MAPPER_ANCHOR),
  bridgeAnchor: path.join(MIGRATIONS, BRIDGE_ANCHOR)
};

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function stripSqlComments(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ");
}

function normalized(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizedSql(value) {
  return normalized(stripSqlComments(value));
}

function tableBody(sql, name) {
  const withoutComments = stripSqlComments(sql);
  const expression = new RegExp(
    `create\\s+table\\s+${name.replaceAll(".", "\\.")}\\s*\\(([\\s\\S]*?)\\n\\);`,
    "i"
  );
  const match = withoutComments.match(expression);
  assert(match, `missing_table:${name}`);
  return normalized(match[1]);
}

function functionTextArgumentName(sql, qualifiedName) {
  const withoutComments = stripSqlComments(sql);
  const expression = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+${qualifiedName.replaceAll(".", "\\.")}\\s*\\(\\s*([a-z_][a-z0-9_]*)\\s+text\\s*\\)`,
    "i"
  );
  const match = withoutComments.match(expression);
  assert(match, `missing_text_function:${qualifiedName}`);
  return match[1].toLowerCase();
}

function cteColumnNames(sql, cteName) {
  const withoutComments = stripSqlComments(sql);
  const expression = new RegExp(
    `(?:with|,)\\s+${cteName}\\s*\\(([\\s\\S]*?)\\)\\s+as\\s*\\(`,
    "i"
  );
  const match = withoutComments.match(expression);
  assert(match, `missing_cte:${cteName}`);
  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/^"|"$/g, "").toLowerCase())
    .filter(Boolean);
}

function includesAll(value, fragments, code) {
  for (const fragment of fragments) {
    assert(value.includes(fragment), `${code}:${fragment}`);
  }
}

function exactSet(actual, expected, code) {
  assert(actual.length === expected.length, `${code}:count:${actual.length}`);
  for (let index = 0; index < expected.length; index += 1) {
    assert(actual[index] === expected[index], `${code}:${index}:${actual[index] ?? "missing"}`);
  }
}

async function sqlFiles(directory) {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));
}

async function main() {
  const entries = await Promise.all(
    Object.entries(paths).map(async ([key, file]) => [key, await readFile(file, "utf8")])
  );
  const files = Object.fromEntries(entries);

  const predecessor = normalizedSql(files.predecessor);
  const categoryMapperPreconditions = normalizedSql(files.categoryMapperPreconditions);
  const bridge = normalizedSql(files.bridge);
  const runtime = normalizedSql(files.runtime);
  const firstMigration = normalizedSql(files.firstMigration);
  const categoryMapperReplacement = normalizedSql(files.categoryMapperReplacement);
  const seed = normalizedSql(files.seed);
  const prepare = normalized(files.prepare);
  const workflow = files.workflow;
  const normalizedWorkflow = normalized(workflow);

  const adapterNames = await sqlFiles(ADAPTERS);
  exactSet(adapterNames, EXPECTED_ADAPTERS, "unexpected_local_adapter_set");

  const migrationNames = await sqlFiles(MIGRATIONS);
  for (const adapterName of EXPECTED_ADAPTERS) {
    assert(!migrationNames.includes(adapterName), `local_adapter_in_production_migrations:${adapterName}`);
  }

  const replayOrder = [...migrationNames, ...adapterNames]
    .sort((left, right) => left.localeCompare(right, "en"));
  const predecessorIndex = replayOrder.indexOf(EXPECTED_ADAPTERS[0]);
  const firstTrackedIndex = replayOrder.indexOf(FIRST_TRACKED_MIGRATION);
  const categoryPreconditionIndex = replayOrder.indexOf(EXPECTED_ADAPTERS[1]);
  const categoryAnchorIndex = replayOrder.indexOf(CATEGORY_MAPPER_ANCHOR);
  const bridgeIndex = replayOrder.indexOf(EXPECTED_ADAPTERS[2]);
  const bridgeAnchorIndex = replayOrder.indexOf(BRIDGE_ANCHOR);
  const runtimeIndex = replayOrder.indexOf(EXPECTED_ADAPTERS[3]);

  assert(predecessorIndex === 0, "predecessor_not_first");
  assert(firstTrackedIndex > predecessorIndex, "first_tracked_not_after_predecessor");
  assert(
    categoryPreconditionIndex >= 0 && categoryPreconditionIndex + 1 === categoryAnchorIndex,
    "category_precondition_not_immediately_before_anchor"
  );
  assert(
    bridgeIndex >= 0 && bridgeIndex + 1 === bridgeAnchorIndex,
    "bridge_not_immediately_before_anchor"
  );
  assert(runtimeIndex === replayOrder.length - 1, "runtime_adapter_not_last");

  assert(
    !/create\s+table\s+if\s+not\s+exists\s+public\.(products|product_candidates|source_rankings|recommendation_logs)/i.test(
      stripSqlComments(files.predecessor)
    ),
    "core_create_hides_drift"
  );

  const products = tableBody(files.predecessor, "public.products");
  includesAll(products, [
    "id uuid primary key default gen_random_uuid()",
    "category text",
    "skin_types text",
    "concerns text",
    "texture text",
    "finish text",
    "irritation_risk text",
    "sensitivity_safe boolean"
  ], "products_predecessor_gap");
  for (const tracked of ["normalized_name", "normalized_brand", "product_form", "review_signals"]) {
    assert(!products.includes(tracked), `products_predecessor_contains_tracked_component:${tracked}`);
  }

  const candidates = tableBody(files.predecessor, "public.product_candidates");
  includesAll(candidates, [
    "id uuid primary key default gen_random_uuid()",
    "source_name text not null",
    "category_path text",
    "product_name_raw text not null",
    "brand_name_raw text",
    "normalized_name text",
    "normalized_brand text",
    "status text not null default 'new'"
  ], "candidate_predecessor_gap");
  for (const tracked of ["review_status", "product_form", "external_id"]) {
    assert(!candidates.includes(tracked), `candidate_predecessor_contains_tracked_component:${tracked}`);
  }

  const rankings = tableBody(files.predecessor, "public.source_rankings");
  includesAll(rankings, [
    "id uuid primary key default gen_random_uuid()",
    "source_name text not null",
    "category_path text not null",
    "rank_position integer not null",
    "product_name text not null",
    "collected_at timestamptz not null default now()"
  ], "source_rankings_predecessor_gap");
  for (const tracked of ["snapshot_id", "candidate_id", "raw_item"]) {
    assert(!rankings.includes(tracked), `source_rankings_contains_tracked_component:${tracked}`);
  }

  const logs = tableBody(files.predecessor, "public.recommendation_logs");
  includesAll(logs, [
    "id uuid primary key default gen_random_uuid()",
    "event_name text not null",
    "product_id text",
    "is_top_pick boolean not null default false",
    "session_id text",
    "feature_name text",
    "result_type text",
    "meta_json jsonb default '{}'::jsonb",
    "user_id uuid references auth.users(id) on delete set null"
  ], "recommendation_logs_predecessor_gap");
  assert(!logs.includes("anonymous_write_grant_use_id"), "recommendation_logs_contains_later_linkage");
  includesAll(predecessor, [
    "alter table public.recommendation_logs enable row level security",
    "revoke all on table public.recommendation_logs from anon, authenticated",
    "grant all on table public.recommendation_logs to service_role"
  ], "recommendation_logs_security_gap");

  const bridgeColumns = [
    "is_mens",
    "recommendation_tier",
    "size_ml",
    "unit_price_per_10ml",
    "hwahae_url",
    "external_source",
    "external_type",
    "external_id",
    "source_url"
  ];
  includesAll(bridge, [
    "is_mens boolean not null default false",
    "recommendation_tier text",
    "size_ml numeric",
    "unit_price_per_10ml numeric",
    "hwahae_url text",
    "external_source text",
    "external_type text",
    "external_id text",
    "source_url text"
  ], "bridge_column_missing");
  assert(!bridge.includes("create table"), "bridge_creates_table");
  assert(!bridge.includes("create policy"), "bridge_changes_policy");

  const anchorColumns = cteColumnNames(files.bridgeAnchor, "rows");
  for (const column of bridgeColumns) {
    assert(anchorColumns.includes(column), `bridge_anchor_column_missing:${column}`);
  }

  assert(firstMigration.includes("alter table public.products"), "first_migration_products_dependency_changed");
  assert(!firstMigration.includes("create table public.products"), "first_migration_now_creates_products");
  assert(firstMigration.includes("alter table public.product_candidates"), "first_migration_candidate_dependency_changed");
  assert(firstMigration.includes("left join public.source_rankings sr"), "first_migration_ranking_dependency_changed");

  const originalMapperArgument = functionTextArgumentName(
    files.firstMigration,
    "public.map_product_category"
  );
  const replacementMapperArgument = functionTextArgumentName(
    files.categoryMapperReplacement,
    "public.map_product_category"
  );
  assert(originalMapperArgument === "value", `unexpected_original_mapper_argument:${originalMapperArgument}`);
  assert(replacementMapperArgument === "input", `unexpected_replacement_mapper_argument:${replacementMapperArgument}`);
  includesAll(categoryMapperPreconditions, [
    "alter type public.product_category add value if not exists 'toner_pad'",
    "alter type public.product_category add value if not exists 'ampoule'",
    "alter type public.product_category add value if not exists 'essence'",
    "drop function public.map_product_category(text)"
  ], "category_mapper_precondition_gap");
  assert(
    categoryMapperReplacement.includes(`public.normalize_basic_text(${replacementMapperArgument})`),
    "category_mapper_body_argument_mismatch"
  );

  includesAll(runtime, [
    "create unique index products_external_unique",
    "alter table public.products enable row level security",
    "revoke all on table public.products from public, anon, authenticated",
    "grant select on table public.products to anon, authenticated",
    "grant all on table public.products to service_role",
    "create policy \"public can read products\""
  ], "runtime_contract_gap");
  assert(!runtime.includes("analysis_request"), "runtime_adapter_reimplements_guard");
  assert(!runtime.includes("anonymous_write_grant"), "runtime_adapter_reimplements_later_grant_contract");

  const runtimeStatements = stripSqlComments(files.runtime)
    .split(";")
    .map(normalized)
    .filter(Boolean);
  for (const statement of runtimeStatements.filter((value) => value.startsWith("grant "))) {
    if (/\bto\s+(anon|authenticated)\b/i.test(statement)) {
      assert(
        /^grant select on table public\.products to anon, authenticated$/i.test(statement),
        `browser_role_non_select_grant:${statement}`
      );
    }
  }
  for (const statement of runtimeStatements.filter((value) => value.startsWith("create policy "))) {
    assert(statement.includes(" for select "), `non_select_product_policy:${statement}`);
  }

  includesAll(files.config, [
    'project_id = "kbeauty-local-replay-test"',
    "port = 56321",
    "port = 56322",
    "shadow_port = 56320"
  ], "local_config_gap");

  const seedRowExpectations = [
    ["00000000-0000-4000-8000-000000000101", "Local Replay Gentle Cleanser"],
    ["00000000-0000-4000-8000-000000000102", "Local Replay Hydrating Toner"],
    ["00000000-0000-4000-8000-000000000103", "Local Replay Calming Serum"],
    ["00000000-0000-4000-8000-000000000104", "Local Replay Barrier Cream"],
    ["00000000-0000-4000-8000-000000000105", "Local Replay Daily Sunscreen"]
  ];
  const seedUuids = [...files.seed.matchAll(/'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/gi)]
    .map((match) => match[0].slice(1, -1).toLowerCase());
  exactSet(
    seedUuids,
    seedRowExpectations.map(([uuid]) => uuid),
    "synthetic_seed_uuid_set_changed"
  );
  assert((seed.match(/insert into public\.products/g) ?? []).length === 1, "synthetic_seed_insert_count_changed");

  const seedSource = stripSqlComments(files.seed);
  for (let index = 0; index < seedRowExpectations.length; index += 1) {
    const [uuid, name] = seedRowExpectations[index];
    const start = seedSource.indexOf(`'${uuid}'`);
    const nextUuid = seedRowExpectations[index + 1]?.[0] ?? null;
    const end = nextUuid
      ? seedSource.indexOf(`'${nextUuid}'`, start + 1)
      : seedSource.toLowerCase().indexOf("on conflict", start + 1);
    assert(start >= 0 && end > start, `synthetic_seed_row_boundary_invalid:${uuid}`);
    const row = seedSource.slice(start, end);
    includesAll(
      row,
      [`'${name}'`, "'Replay Lab'", "'replay lab'"],
      `synthetic_seed_row_contract_changed:${uuid}`
    );
  }
  assert(seed.includes("on conflict (normalized_brand, normalized_name) do nothing"), "synthetic_seed_not_idempotent");
  assert(!/https?:\/\//i.test(files.seed), "synthetic_seed_contains_external_url");

  includesAll(prepare, [
    'const output_marker = ".kbeauty-local-replay-workspace"',
    'path.join(repository_root, "tmp")',
    "tracked_migration_copy_hash_mismatch",
    "local_replay_output_contains_symlink_component",
    "refusing_to_remove_unmarked_output_directory"
  ], "prepare_guard_gap");

  const supabaseVersions = [...workflow.matchAll(/supabase@([0-9]+\.[0-9]+\.[0-9]+)/g)]
    .map((match) => match[1]);
  assert(supabaseVersions.length >= 4, "workflow_supabase_invocations_missing");
  assert(supabaseVersions.every((version) => version === "2.82.0"), "workflow_supabase_version_not_pinned");
  includesAll(normalizedWorkflow, [
    "npm run db:replay:verify",
    "npm run db:replay:prepare",
    "npm run architecture:guard",
    "npm run build",
    "git diff --check",
    "for attempt in 1 2",
    "db lint --local --workdir tmp/local-supabase-replay",
    "verify anonymous product boundary",
    "assert_denied post",
    "assert_denied patch",
    "assert_denied delete",
    "upload sanitized replay diagnostics",
    "tmp/local-supabase-replay-diagnostics/*.log",
    "best-effort stop after failure"
  ], "workflow_contract_gap");
  assert(!workflow.includes("products?select=id&limit=5"), "workflow_read_limit_allows_extra_seed_rows");
  assert(!workflow.includes("tmp/local-supabase-replay-*.log"), "workflow_uploads_unsanitized_logs");
  const successfulCleanupBlock = workflow.match(
    /- name:\s*Stop isolated Supabase([\s\S]*?)(?=\n\s*- name:)/i
  );
  assert(successfulCleanupBlock, "successful_cleanup_step_missing");
  assert(
    !/continue-on-error:\s*true/i.test(successfulCleanupBlock[1]),
    "successful_cleanup_failure_is_hidden"
  );

  console.log(JSON.stringify({
    status: "PASS",
    predecessorTables: 4,
    localAdapters: adapterNames.length,
    syntheticSeedProducts: seedUuids.length,
    mapperArgumentCompatibility: `${originalMapperArgument}->drop->${replacementMapperArgument}`,
    dynamicBoundaryChecks: ["exact_anon_read", "anon_insert_denied", "anon_update_denied", "anon_delete_denied"]
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
