import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL = path.join(ROOT, "supabase", "local-replay-test");
const ADAPTERS = path.join(LOCAL, "adapters");

const paths = {
  predecessor: path.join(ADAPTERS, "00000000_local_replay_predecessor.sql"),
  categoryMapperPreconditions: path.join(
    ADAPTERS,
    "20260524054048_local_replay_category_mapper_preconditions.sql"
  ),
  bridge: path.join(ADAPTERS, "20260525_local_replay_untracked_product_columns.sql"),
  runtime: path.join(ADAPTERS, "99999999_local_replay_runtime_contract.sql"),
  config: path.join(LOCAL, "project-template", "config.toml"),
  seed: path.join(LOCAL, "project-template", "seed.sql"),
  prepare: path.join(ROOT, "scripts", "prepare-local-supabase-replay.mjs"),
  firstMigration: path.join(ROOT, "supabase", "migrations", "20260410_safe_review_and_promotion_layer.sql"),
  categoryMapperReplacement: path.join(ROOT, "supabase", "migrations", "20260524054049_reclassify_existing_moisturizers.sql"),
  bridgeAnchor: path.join(ROOT, "supabase", "migrations", "20260526_moisturizer_lotion_emulsion_insert.sql")
};

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function normalized(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function tableBody(sql, name) {
  const expression = new RegExp(
    `create\\s+table\\s+${name.replaceAll(".", "\\.")}\\s*\\(([\\s\\S]*?)\\n\\);`,
    "i"
  );
  const match = sql.match(expression);
  assert(match, `missing_table:${name}`);
  return normalized(match[1]);
}

function functionTextArgumentName(sql, qualifiedName) {
  const expression = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+${qualifiedName.replaceAll(".", "\\.")}\\s*\\(\\s*([a-z_][a-z0-9_]*)\\s+text\\s*\\)`,
    "i"
  );
  const match = sql.match(expression);
  assert(match, `missing_text_function:${qualifiedName}`);
  return match[1].toLowerCase();
}

function includesAll(value, fragments, code) {
  for (const fragment of fragments) {
    assert(value.includes(fragment), `${code}:${fragment}`);
  }
}

async function main() {
  const entries = await Promise.all(
    Object.entries(paths).map(async ([key, file]) => [key, await readFile(file, "utf8")])
  );
  const files = Object.fromEntries(entries);
  const predecessor = normalized(files.predecessor);
  const categoryMapperPreconditions = normalized(files.categoryMapperPreconditions);
  const bridge = normalized(files.bridge);
  const runtime = normalized(files.runtime);
  const firstMigration = normalized(files.firstMigration);
  const categoryMapperReplacement = normalized(files.categoryMapperReplacement);
  const bridgeAnchor = normalized(files.bridgeAnchor);
  const seed = normalized(files.seed);
  const prepare = normalized(files.prepare);

  assert(!/create\s+table\s+if\s+not\s+exists\s+public\.(products|product_candidates|source_rankings|recommendation_logs)/i.test(files.predecessor), "core_create_hides_drift");

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
  assert(predecessor.includes("alter table public.recommendation_logs enable row level security"), "recommendation_logs_rls_missing");

  const bridgeColumns = [
    "is_mens boolean not null default false",
    "recommendation_tier text",
    "size_ml numeric",
    "unit_price_per_10ml numeric",
    "hwahae_url text",
    "external_source text",
    "external_type text",
    "external_id text",
    "source_url text"
  ];
  includesAll(bridge, bridgeColumns, "bridge_column_missing");
  assert(!bridge.includes("create table"), "bridge_creates_table");
  assert(!bridge.includes("create policy"), "bridge_changes_policy");

  for (const column of bridgeColumns.map((value) => value.split(" ")[0])) {
    assert(bridgeAnchor.includes(column), `bridge_anchor_changed:${column}`);
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
    "grant select on table public.products to anon, authenticated",
    "grant all on table public.products to service_role",
    "create policy \"public can read products\""
  ], "runtime_contract_gap");
  assert(!runtime.includes("analysis_request"), "runtime_adapter_reimplements_guard");
  assert(!runtime.includes("anonymous_write_grant"), "runtime_adapter_reimplements_later_grant_contract");

  includesAll(files.config, [
    'project_id = "kbeauty-local-replay-test"',
    "port = 56321",
    "port = 56322",
    "shadow_port = 56320"
  ], "local_config_gap");

  assert(seed.includes("local replay gentle cleanser"), "synthetic_seed_missing");
  assert(seed.includes("on conflict (normalized_brand, normalized_name) do nothing"), "synthetic_seed_not_idempotent");
  assert(!/https?:\/\//i.test(files.seed), "synthetic_seed_contains_external_url");

  includesAll(prepare, [
    'const output_marker = ".kbeauty-local-replay-workspace"',
    'path.join(repository_root, "tmp")',
    "tracked_migration_copy_hash_mismatch",
    "local_replay_output_contains_symlink_component"
  ], "prepare_guard_gap");

  const order = [
    "20260524054048_local_replay_category_mapper_preconditions.sql",
    "20260524054049_reclassify_existing_moisturizers.sql",
    "20260525_local_replay_untracked_product_columns.sql",
    "20260526_moisturizer_lotion_emulsion_insert.sql"
  ].sort((left, right) => left.localeCompare(right, "en"));
  assert(order[0].startsWith("20260524054048_"), "category_precondition_order_invalid");
  assert(order[1].startsWith("20260524054049_"), "category_replacement_order_invalid");
  assert(order[2].startsWith("20260525_"), "mixed_version_order_invalid");

  console.log(JSON.stringify({
    status: "PASS",
    predecessorTables: 4,
    localAdapters: 4,
    syntheticSeedProducts: 5,
    mapperArgumentCompatibility: `${originalMapperArgument}->drop->${replacementMapperArgument}`
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
