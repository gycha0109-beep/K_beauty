import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_ROOT = path.join(
  ROOT,
  "tests",
  "fixtures",
  "product-fact-storage-v1",
  "replay-baseline-v1"
);
const MANIFEST_PATH = path.join(PACKAGE_ROOT, "manifest.json");
const AUTHORITY_PATH = path.join(
  ROOT,
  "docs",
  "architecture",
  "product-fact-replay-baseline-authority-v1.md"
);

let assertionCount = 0;

function assert(condition, code) {
  assertionCount += 1;
  if (!condition) throw new Error(code);
}

function expectFailure(action, expectedCode, mutation) {
  try {
    action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(expectedCode), `${mutation}:unexpected_failure:${message}`);
    return;
  }
  throw new Error(`${mutation}:mutation_not_detected`);
}

function git(args, encoding = "utf8") {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024
  });
  assert(result.status === 0, `git_failed:${args[0]}:${String(result.stderr ?? "").trim()}`);
  return result.stdout;
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n?/g, "\n");
}

function stripSqlComments(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ");
}

function normalizedSql(value) {
  return stripSqlComments(normalizeLineEndings(value)).replace(/\s+/g, " ").trim().toLowerCase();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)))
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(stableValue(value))}\n`;
}

function encodeLength(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(value));
  return buffer;
}

function hashEntries(entries) {
  const hash = createHash("sha256");
  for (const entry of entries) {
    const pathBytes = Buffer.from(entry.path, "utf8");
    const contentBytes = Buffer.from(entry.content, "utf8");
    hash.update(encodeLength(pathBytes.length));
    hash.update(pathBytes);
    hash.update(encodeLength(contentBytes.length));
    hash.update(contentBytes);
  }
  return hash.digest("hex");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function packageFiles(directory = PACKAGE_ROOT, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const candidate = path.join(directory, entry.name);
    const metadata = await lstat(candidate);
    assert(!metadata.isSymbolicLink(), `package_symlink_rejected:${relative}`);
    if (entry.isDirectory()) {
      result.push(...await packageFiles(candidate, relative));
    } else if (entry.isFile()) {
      result.push(relative);
    } else {
      throw new Error(`package_non_regular_file:${relative}`);
    }
  }
  return result.sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
}

function exactAllowlist(actual, expected) {
  assert(new Set(actual).size === actual.length, "package_duplicate_path");
  assert(actual.length === expected.length, `package_allowlist_count:${actual.length}`);
  for (let index = 0; index < expected.length; index += 1) {
    assert(actual[index] === expected[index], `package_allowlist_path:${index}:${actual[index] ?? "missing"}`);
    assert(!actual[index].startsWith("/") && !actual[index].includes(".."), `package_path_escape:${actual[index]}`);
    assert(!actual[index].includes("\\"), `package_path_not_posix:${actual[index]}`);
  }
}

async function canonicalPackageDigest(manifest, files) {
  const entries = [];
  for (const relative of files) {
    const bytes = await readFile(path.join(PACKAGE_ROOT, ...relative.split("/")));
    assert(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), `package_bom:${relative}`);
    let content;
    if (relative === "manifest.json") {
      const semantic = structuredClone(manifest);
      delete semantic.canonical_sha256;
      content = canonicalJson(semantic);
    } else {
      content = normalizeLineEndings(bytes.toString("utf8"));
    }
    entries.push({ path: relative, content });
  }
  return hashEntries(entries);
}

function tableBodies(sql) {
  const clean = stripSqlComments(normalizeLineEndings(sql));
  const matches = [...clean.matchAll(/create\s+table\s+(?!if\s+not\s+exists)(public\.[a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\);/gi)];
  return new Map(matches.map((match) => [match[1].toLowerCase(), match[2].replace(/\s+/g, " ").trim().toLowerCase()]));
}

function removeTableColumn(sql, tableName, columnName) {
  const expression = new RegExp(
    `(create\\s+table\\s+${tableName.replaceAll(".", "\\.")}\\s*\\()([\\s\\S]*?)(\\n\\);)`,
    "i"
  );
  const match = sql.match(expression);
  assert(match, `mutation_table_missing:${tableName}`);
  const columnExpression = new RegExp(`\\n\\s*${columnName}\\s+[^\\n]+`, "i");
  const body = match[2].replace(columnExpression, "");
  assert(body !== match[2], `mutation_column_missing:${tableName}.${columnName}`);
  return sql.replace(expression, `$1${body}$3`);
}

function includesAll(value, fragments, code) {
  for (const fragment of fragments) {
    assert(value.includes(fragment), `${code}:${fragment}`);
  }
}

function validatePredecessor(sql) {
  const bodies = tableBodies(sql);
  const expected = [
    "public.products",
    "public.product_candidates",
    "public.source_rankings",
    "public.recommendation_logs"
  ];
  assert(bodies.size === expected.length, `predecessor_relation_count:${bodies.size}`);
  for (const name of expected) assert(bodies.has(name), `predecessor_relation_missing:${name}`);

  const products = bodies.get("public.products");
  includesAll(products, [
    "id uuid primary key",
    "name text",
    "brand text",
    "category text",
    "price_min integer",
    "price_max integer",
    "buy_link text",
    "image_url text",
    "created_at timestamptz",
    "skin_types text",
    "concerns text",
    "texture text",
    "finish text",
    "irritation_risk text",
    "sensitivity_safe boolean"
  ], "products_predecessor_contract");
  for (const leakage of [
    "normalized_name",
    "normalized_brand",
    "updated_at",
    "product_form",
    "cleansing_profile",
    "review_signals",
    "market_signals",
    "ingredient_signals",
    "is_mens",
    "recommendation_tier",
    "external_id"
  ]) {
    assert(!products.includes(leakage), `products_poststate_leakage:${leakage}`);
  }

  const candidates = bodies.get("public.product_candidates");
  includesAll(candidates, [
    "id uuid primary key",
    "source_name text not null",
    "category_path text",
    "product_name_raw text not null",
    "brand_name_raw text",
    "normalized_name text",
    "normalized_brand text",
    "status text not null default 'new'",
    "created_at timestamptz not null",
    "updated_at timestamptz not null"
  ], "candidate_predecessor_contract");
  for (const leakage of ["review_status", "service_category", "product_form", "external_id"]) {
    assert(!candidates.includes(leakage), `candidate_poststate_leakage:${leakage}`);
  }

  const rankings = bodies.get("public.source_rankings");
  includesAll(rankings, [
    "id uuid primary key",
    "source_name text not null",
    "category_path text not null",
    "rank_position integer not null",
    "product_name text not null",
    "brand_name text",
    "collected_at timestamptz not null"
  ], "source_rankings_predecessor_contract");
  for (const leakage of ["snapshot_id", "candidate_id", "raw_item"]) {
    assert(!rankings.includes(leakage), `source_rankings_poststate_leakage:${leakage}`);
  }

  const logs = bodies.get("public.recommendation_logs");
  includesAll(logs, [
    "id uuid primary key",
    "event_name text not null",
    '"timestamp" timestamptz not null',
    "product_id text",
    "meta_json jsonb",
    "user_id uuid references auth.users(id)"
  ], "recommendation_logs_predecessor_contract");
  assert(!logs.includes("anonymous_write_grant_use_id"), "recommendation_logs_poststate_leakage");

  const normalized = normalizedSql(sql);
  for (const table of expected) {
    includesAll(normalized, [
      `alter table ${table} enable row level security`,
      `revoke all on table ${table} from public, anon, authenticated`,
      `grant all on table ${table} to service_role`
    ], `local_safety_boundary:${table}`);
  }
  assert(!normalized.includes("create table public.product_fact_"), "predecessor_product_fact_leakage");
  assert(!normalized.includes("99999999_local_replay_runtime_contract"), "runtime_adapter_leakage");
}

function validateBridges(
  manifest,
  categoryBridge,
  productBridge,
  cleansingBridge,
  anchorCategory,
  anchorProduct,
  anchorCleansing,
  sourceCleansing
) {
  assert(manifest.ordered_compatibility_bridges.length === 3, "bridge_count");
  const [categoryEntry, productEntry, cleansingEntry] = manifest.ordered_compatibility_bridges;
  assert(categoryEntry.anchor_migration === "20260524054049_reclassify_existing_moisturizers.sql", "category_anchor");
  assert(productEntry.anchor_migration === "20260526_moisturizer_lotion_emulsion_insert.sql", "product_columns_anchor");
  assert(cleansingEntry.bridge_id === "admin-v2-cleansing-profile-precondition-v1", "a1_bridge_id");
  assert(
    cleansingEntry.classification === "repository-owned mid-chain compatibility bridge",
    "a1_bridge_classification"
  );
  assert(cleansingEntry.known_non_historical === true, "a1_bridge_historical_claim");
  assert(
    cleansingEntry.anchor_migration === "20260805220000_admin_product_review_cleanser_metadata_v2.sql",
    "a1_bridge_anchor"
  );
  assert(cleansingEntry.anchor_before_migration === cleansingEntry.anchor_migration, "a1_bridge_anchor_alias");
  assert(cleansingEntry.source_commit === "3af4c99cc30b4632922e52fd2fd7acf916895c89", "a1_source_commit");
  assert(
    cleansingEntry.source_path
      === "tests/fixtures/admin-product-review-v2/20260805215900_product_review_v2_column_adapter.sql",
    "a1_source_path"
  );
  assert(cleansingEntry.source_blob === "972b0825f4ef798887796028dd332b29106c2770", "a1_source_blob");
  assert(categoryEntry.placement === "immediately_before", "category_bridge_placement");
  assert(productEntry.placement === "immediately_before", "product_bridge_placement");
  assert(cleansingEntry.placement === "immediately_before", "a1_bridge_placement");

  const category = normalizedSql(categoryBridge);
  includesAll(category, [
    "alter type public.product_category add value if not exists 'toner_pad'",
    "alter type public.product_category add value if not exists 'ampoule'",
    "alter type public.product_category add value if not exists 'essence'",
    "drop function public.map_product_category(text)"
  ], "category_bridge_action");
  assert(!category.includes("create table"), "category_bridge_creates_relation");

  const product = normalizedSql(productBridge);
  const bridgeFields = [
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
  includesAll(product, bridgeFields, "product_bridge_action");
  assert(!product.includes("create table"), "product_bridge_creates_relation");
  assert(!product.includes("create policy"), "product_bridge_creates_policy");

  const categoryAnchor = normalizedSql(anchorCategory);
  includesAll(categoryAnchor, [
    "'toner_pad'::public.product_category",
    "'ampoule'::public.product_category",
    "'essence'::public.product_category",
    "create or replace function public.map_product_category(input text)"
  ], "category_anchor_contract");
  const productAnchor = normalizedSql(anchorProduct);
  for (const field of bridgeFields.map((value) => value.split(" ")[0])) {
    assert(productAnchor.includes(field), `product_anchor_field:${field}`);
  }

  assert(cleansingEntry.governed_objects.length === 2, "a1_governed_object_count");
  const [enumObject, columnObject] = cleansingEntry.governed_objects;
  assert(enumObject.name === "public.cleansing_profile_type", "a1_enum_object");
  assert(enumObject.classification === "EXECUTION_REQUIRED", "a1_enum_classification");
  assert(
    JSON.stringify(enumObject.enum_labels) === JSON.stringify(["low_ph", "balanced", "deep_clean"]),
    "a1_enum_manifest_labels"
  );
  assert(columnObject.name === "public.products.cleansing_profile", "a1_column_object");
  assert(columnObject.classification === "EXECUTION_REQUIRED", "a1_column_classification");
  assert(columnObject.type === "public.cleansing_profile_type", "a1_column_manifest_type");
  assert(columnObject.nullable === true, "a1_column_manifest_nullability");
  assert(cleansingEntry.mutation_guards.length === 4, "a1_mutation_manifest_count");

  const cleansing = normalizedSql(cleansingBridge);
  const enumMatch = cleansing.match(/create type public\.cleansing_profile_type as enum \(([^)]*)\)/);
  assert(enumMatch, "a1_enum_declaration_missing");
  const enumLabels = [...enumMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert(
    JSON.stringify(enumLabels) === JSON.stringify(["low_ph", "balanced", "deep_clean"]),
    "a1_enum_labels"
  );
  includesAll(cleansing, [
    "begin",
    "create type public.cleansing_profile_type as enum",
    "alter table public.products add column cleansing_profile public.cleansing_profile_type",
    "commit"
  ], "a1_bridge_action");
  for (const forbidden of [
    "if not exists",
    "default",
    "not null",
    "create index",
    "create policy",
    "enable row level security",
    " grant ",
    "updated_at",
    "product_metadata_review_completeness"
  ]) {
    assert(!` ${cleansing} `.includes(forbidden), `a1_bridge_forbidden:${forbidden.trim()}`);
  }
  assert(cleansing === normalizedSql(sourceCleansing), "a1_bridge_source_semantic_mismatch");

  const cleansingAnchor = normalizedSql(anchorCleansing);
  includesAll(cleansingAnchor, [
    "column_name = 'cleansing_profile'",
    "raise exception 'admin_v2_products_cleansing_profile_missing'",
    "p_value not in ('low_ph', 'balanced', 'deep_clean')",
    "attribute.attname = 'cleansing_profile'",
    "$1::%s",
    "updated_at = now()"
  ], "a1_anchor_contract");
}

function validateSentinels(sentinels) {
  assert(sentinels.synthetic_only === true, "sentinels_not_synthetic");
  assert(sentinels.external_urls_allowed === false, "sentinel_external_urls_allowed");
  assert(sentinels.lifecycle.length === 2, "sentinel_lifecycle_count");
  const serialized = canonicalJson(sentinels);
  assert(!/https?:\/\//i.test(serialized), "sentinel_external_url");
  const rows = sentinels.lifecycle.flatMap((entry) => entry.rows ?? []);
  assert(rows.length === 5, `sentinel_row_count:${rows.length}`);
  const tables = rows.map((row) => row.table).sort();
  const expectedTables = [
    "public.product_candidates",
    "public.products",
    "public.products",
    "public.recommendation_logs",
    "public.source_rankings"
  ];
  for (let index = 0; index < expectedTables.length; index += 1) {
    assert(tables[index] === expectedTables[index], `sentinel_table:${index}`);
  }
  const ids = rows.map((row) => row.values.id);
  assert(new Set(ids).size === ids.length, "sentinel_uuid_duplicate");
  for (const id of ids) assert(/^00000000-0000-4000-8000-00000000030[1-5]$/.test(id), `sentinel_uuid:${id}`);
  const timestamps = serialized.match(/2026-04-01T00:0[0-4]:00\.000Z/g) ?? [];
  assert(timestamps.length >= 5, "sentinel_fixed_timestamps_missing");

  const a1Stage = sentinels.lifecycle.find(
    (entry) => entry.stage === "after_admin_v2_cleansing_profile_migrations_before_pre_pf2_fingerprints"
  );
  assert(a1Stage, "a1_sentinel_stage_missing");
  assert(a1Stage.updates.length === 1, "a1_sentinel_update_count");
  assert(a1Stage.expected_rows.length === 2, "a1_sentinel_expected_row_count");
  const update = a1Stage.updates[0];
  assert(update.table === "public.products", "a1_sentinel_update_table");
  assert(update.key.id === "00000000-0000-4000-8000-000000000301", "a1_sentinel_update_id");
  assert(update.values.cleansing_profile === "balanced", "a1_sentinel_non_null_value");
  const expectedById = new Map(a1Stage.expected_rows.map((row) => [row.key.id, row.values.cleansing_profile]));
  assert(expectedById.get("00000000-0000-4000-8000-000000000301") === "balanced", "a1_sentinel_expected_balanced");
  assert(expectedById.get("00000000-0000-4000-8000-000000000305") === null, "a1_sentinel_expected_null");
  assert(sentinels.pre_pf2_preservation_surface.product_fact_table_count === 0, "sentinel_product_fact_count");
  assert(sentinels.pre_pf2_preservation_surface.row_sentinels.length === 5, "sentinel_preservation_row_count");
  assert(
    sentinels.pre_pf2_preservation_surface.schema_and_zero_row_sentinels.includes(
      "public.product_metadata_field_reviews"
    ),
    "sentinel_metadata_review_surface_missing"
  );
  return sha256(canonicalJson(sentinels));
}

function validateMaterializationContract(contract) {
  assert(contract.authority_tier === "UPGRADE", "materialization_authority_tier");
  assert(contract.pre_pf2_repository_sha === "0a0c11b0ee8c64766b730f70a859f2348b79cb5e", "materialization_pre_pf2_sha");
  assert(contract.stages.length === 5, "materialization_stage_count");
  assert(
    contract.stages.includes("a1_cleansing_profile_sentinel_lifecycle"),
    "materialization_a1_sentinel_stage"
  );
  assert(contract.schema_fingerprint.catalog_surface.includes("public.products"), "materialization_products_surface");
  assert(contract.schema_fingerprint.catalog_surface.includes("public.product_metadata_field_reviews"), "materialization_review_surface");
  assert(contract.absence_contract.product_fact_tables.length === 12, "materialization_product_fact_table_count");
  assert(contract.absence_contract.expected_present_count === 0, "materialization_product_fact_absence");
  assert(contract.historical_identity_claimed === false, "materialization_historical_claim");
}

function classifyMissingDependency(providerSql, requiredFragment, ownerSql, ownerFragment, code) {
  const provider = normalizedSql(providerSql);
  const owner = normalizedSql(ownerSql);
  assert(!provider.includes(requiredFragment), `${code}:mutation_provider_still_present`);
  assert(owner.includes(ownerFragment), `${code}:owner_dependency_missing`);
  return code;
}

function mutationSqlWithLineEnding(sqlInputs, lineEnding) {
  return Object.fromEntries(
    Object.entries(sqlInputs).map(([name, value]) => [
      name,
      normalizeLineEndings(value).replaceAll("\n", lineEnding)
    ])
  );
}

function runMutationGuards({
  manifest,
  sqlInputs,
  actualFiles,
  computedDigest
}) {
  const {
    predecessor,
    categoryBridge,
    productBridge,
    cleansingBridge,
    firstMigration,
    categoryAnchor,
    productAnchor,
    cleansingAnchor,
    sourceCleansing,
    sec05
  } = mutationSqlWithLineEnding(sqlInputs, "\n");
  const results = [];
  const validateBridgeSet = (
    candidateManifest = manifest,
    candidateCategory = categoryBridge,
    candidateProduct = productBridge,
    candidateCleansing = cleansingBridge
  ) => validateBridges(
    candidateManifest,
    candidateCategory,
    candidateProduct,
    candidateCleansing,
    categoryAnchor,
    productAnchor,
    cleansingAnchor,
    sourceCleansing
  );
  const mutatedWithoutProducts = predecessor.replace(/create table public\.products[\s\S]*?\n\);/i, "");
  assert(
    classifyMissingDependency(mutatedWithoutProducts, "create table public.products", firstMigration, "alter table public.products", "M1:first_migration:42P01")
      === "M1:first_migration:42P01",
    "M1"
  );
  results.push("M1");

  const convertedColumns = ["category", "texture", "finish", "skin_types", "concerns", "irritation_risk"];
  for (const column of convertedColumns) {
    const mutated = removeTableColumn(predecessor, "public.products", column);
    classifyMissingDependency(mutated, `${column} text`, firstMigration, `alter column ${column} type`, `M2:${column}:first_migration:42703`);
  }
  results.push("M2");

  expectFailure(
    () => validatePredecessor(predecessor.replace("category text", "category public.product_category").replace("skin_types text", "skin_types text[]")),
    "products_predecessor_contract:category text",
    "M3"
  );
  results.push("M3");

  for (const column of ["created_at", "normalized_name", "source_name"]) {
    const mutated = removeTableColumn(predecessor, "public.product_candidates", column);
    const candidateBody = tableBodies(mutated).get("public.product_candidates");
    assert(!candidateBody.includes(`${column} `), `M4:${column}:mutation_provider_still_present`);
    assert(normalizedSql(firstMigration).includes(column), `M4:${column}:owner_dependency_missing`);
  }
  results.push("M4");

  const mutatedRanking = removeTableColumn(predecessor, "public.source_rankings", "collected_at");
  classifyMissingDependency(mutatedRanking, "collected_at timestamptz", firstMigration, "max(sr.collected_at)", "M5:first_migration:42703");
  results.push("M5");

  const mutatedWithoutLogs = predecessor.replace(/create table public\.recommendation_logs[\s\S]*?\n\);/i, "");
  classifyMissingDependency(mutatedWithoutLogs, "create table public.recommendation_logs", sec05, "alter table public.recommendation_logs", "M6:sec05:42P01");
  results.push("M6");

  expectFailure(
    () => validatePredecessor(predecessor.replace("user_id uuid references", "anonymous_write_grant_use_id uuid,\n  user_id uuid references")),
    "recommendation_logs_poststate_leakage",
    "M7"
  );
  results.push("M7");

  for (const label of ["toner_pad", "ampoule", "essence"]) {
    const mutated = categoryBridge.replace(new RegExp(`^.*'${label}'.*\\n`, "m"), "");
    expectFailure(
      () => validateBridgeSet(manifest, mutated),
      `category_bridge_action:alter type public.product_category add value if not exists '${label}'`,
      `M8:${label}`
    );
  }
  results.push("M8");

  expectFailure(
    () => validateBridgeSet(
      manifest,
      categoryBridge.replace(/drop function public\.map_product_category\(text\);/i, "")
    ),
    "category_bridge_action:drop function public.map_product_category(text)",
    "M9"
  );
  results.push("M9");

  const bridgeFields = ["is_mens", "recommendation_tier", "size_ml", "unit_price_per_10ml", "hwahae_url", "external_source", "external_type", "external_id", "source_url"];
  for (const field of bridgeFields) {
    const mutated = productBridge.replace(new RegExp(`\\n\\s*add column ${field}[^,;]+[,;]`, "i"), "");
    expectFailure(
      () => validateBridgeSet(manifest, categoryBridge, mutated),
      `product_bridge_action:${field}`,
      `M10:${field}`
    );
  }
  results.push("M10");

  const wrongOrder = structuredClone(manifest);
  wrongOrder.ordered_compatibility_bridges.reverse();
  expectFailure(
    () => validateBridgeSet(wrongOrder),
    "category_anchor",
    "M11"
  );
  results.push("M11");

  expectFailure(
    () => exactAllowlist([...actualFiles, "unexpected.sql"].sort(), manifest.package_file_allowlist),
    "package_allowlist_count",
    "M12:file"
  );
  expectFailure(
    () => validatePredecessor(`${predecessor}\ncreate table public.unexpected_object (\n  id uuid\n);\n`),
    "predecessor_relation_count",
    "M12:object"
  );
  results.push("M12");

  assert(computedDigest === manifest.canonical_sha256, "M13:baseline_digest_precondition");
  const changedDigest = sha256(`${computedDigest}:mutated-byte`);
  expectFailure(
    () => assert(changedDigest === manifest.canonical_sha256, "canonical_digest_mismatch"),
    "canonical_digest_mismatch",
    "M13"
  );
  results.push("M13");

  const withoutA1 = structuredClone(manifest);
  withoutA1.ordered_compatibility_bridges = withoutA1.ordered_compatibility_bridges.slice(0, 2);
  expectFailure(
    () => validateBridgeSet(withoutA1),
    "bridge_count",
    "A1-M1"
  );
  const cleansingConsumer = normalizedSql(cleansingAnchor);
  includesAll(cleansingConsumer, [
    "raise exception 'admin_v2_products_cleansing_profile_missing'",
    "column_name = 'cleansing_profile'"
  ], "A1-M1:runtime_failure_contract");
  results.push("A1-M1");

  for (const label of ["low_ph", "balanced", "deep_clean"]) {
    const mutated = cleansingBridge.replace(new RegExp(`^\\s*'${label}'[,]?\\r?\\n`, "m"), "");
    expectFailure(
      () => validateBridgeSet(manifest, categoryBridge, productBridge, mutated),
      "a1_enum_labels",
      `A1-M2:${label}`
    );
  }
  results.push("A1-M2");

  const wrongType = cleansingBridge.replace(
    "add column cleansing_profile public.cleansing_profile_type;",
    "add column cleansing_profile text;"
  );
  expectFailure(
    () => validateBridgeSet(manifest, categoryBridge, productBridge, wrongType),
    "a1_bridge_action:alter table public.products add column cleansing_profile public.cleansing_profile_type",
    "A1-M3"
  );
  results.push("A1-M3");

  const wrongA1Anchor = structuredClone(manifest);
  wrongA1Anchor.ordered_compatibility_bridges[2].anchor_migration =
    "20260805220005_admin_product_review_cleanser_metadata_v2_validate.sql";
  wrongA1Anchor.ordered_compatibility_bridges[2].anchor_before_migration =
    "20260805220005_admin_product_review_cleanser_metadata_v2_validate.sql";
  expectFailure(
    () => validateBridgeSet(wrongA1Anchor),
    "a1_bridge_anchor",
    "A1-M4"
  );
  results.push("A1-M4");

  assert(results.length === 17, `mutation_guard_count:${results.length}`);
  return results;
}

async function validateMaterialized(candidate, manifest, expectedLedgerDigest, expectedMigrationCount) {
  const root = path.resolve(ROOT, candidate);
  const allowed = `${path.join(ROOT, "tmp")}${path.sep}`;
  assert(root.startsWith(allowed), "materialized_path_not_local_tmp");
  const marker = await readFile(path.join(root, ".product-fact-local-replay-baseline-v1"), "utf8");
  assert(marker.trim() === manifest.baseline_version, "materialized_marker");
  const materialized = JSON.parse(await readFile(path.join(root, "materialization-manifest.json"), "utf8"));
  assert(materialized.baseline_canonical_sha256 === manifest.canonical_sha256, "materialized_baseline_digest");
  assert(materialized.pre_pf2_repository_sha === manifest.pre_pf2_repository_sha, "materialized_pre_pf2_sha");
  assert(materialized.tracked_migration_count === expectedMigrationCount, "materialized_migration_count");
  assert(materialized.tracked_migration_ledger_sha256 === expectedLedgerDigest, "materialized_ledger_digest");
  assert(materialized.bridge_files.length === 3, "materialized_bridge_count");
  assert(materialized.sentinel_files.length === 1, "materialized_a1_sentinel_file_count");
  assert(!materialized.effective_execution_order.includes(path.posix.basename(manifest.pf2_migration.path)), "materialized_pf2_leakage");
  assert(!materialized.effective_execution_order.some((name) => name.includes("99999999")), "materialized_runtime_adapter_leakage");
  assert(materialized.local_only === true, "materialized_local_only");
  assert(materialized.remote_commands_executed === false, "materialized_remote_command_claim");
  const a1Bridge = path.posix.basename(manifest.ordered_compatibility_bridges[2].path);
  const a1Anchor = manifest.ordered_compatibility_bridges[2].anchor_migration;
  assert(
    materialized.effective_execution_order.indexOf(a1Bridge) + 1
      === materialized.effective_execution_order.indexOf(a1Anchor),
    "materialized_a1_anchor_order"
  );
  assert(
    materialized.effective_execution_order.at(-1)
      === "20260805220011_product_fact_replay_a1_sentinels_v1.sql",
    "materialized_a1_sentinel_order"
  );
}

async function main() {
  const manifestRaw = await readFile(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(manifestRaw);
  const actualFiles = await packageFiles();
  exactAllowlist(actualFiles, manifest.package_file_allowlist);
  const computedDigest = await canonicalPackageDigest(manifest, actualFiles);

  if (process.argv.includes("--print-digest")) {
    console.log(computedDigest);
    return;
  }

  assert(manifest.baseline_version === "product-fact-local-replay-baseline-v1", "baseline_version");
  assert(manifest.authoritative_main === "4e7d660ffb9c47d0a31576e3835a5e16f420b106", "authoritative_main");
  assert(manifest.pre_pf2_repository_sha === "0a0c11b0ee8c64766b730f70a859f2348b79cb5e", "pre_pf2_sha");
  assert(manifest.historical_identity_claimed === false, "historical_identity_claim");
  assert(manifest.hosted_identity_claimed === false, "hosted_identity_claim");
  assert(manifest.production_identity_claimed === false, "production_identity_claim");
  assert(manifest.predecessor_objects.length === 4, "predecessor_object_count");
  assert(manifest.ordered_compatibility_bridges.length === 3, "compatibility_bridge_count");
  assert(computedDigest === manifest.canonical_sha256, `canonical_digest_mismatch:${computedDigest}`);

  const authority = await readFile(AUTHORITY_PATH, "utf8");
  includesAll(normalizedSql(authority), [
    "historical baseline != replay baseline",
    "c3",
    "u2",
    "r2",
    "adapter_requires_revision",
    "pf3_replay_baseline_not_implemented",
    "tracked_chain_gap_requires_governed_bridge",
    "admin-v2-cleansing-profile-precondition-v1"
  ], "authority_contract_marker");

  const predecessor = await readFile(path.join(PACKAGE_ROOT, manifest.predecessor_fixture_paths[0]), "utf8");
  const categoryBridge = await readFile(path.join(PACKAGE_ROOT, manifest.ordered_compatibility_bridges[0].path), "utf8");
  const productBridge = await readFile(path.join(PACKAGE_ROOT, manifest.ordered_compatibility_bridges[1].path), "utf8");
  const cleansingBridge = await readFile(path.join(PACKAGE_ROOT, manifest.ordered_compatibility_bridges[2].path), "utf8");
  const sourceCleansing = Buffer.from(git([
    "show",
    `${manifest.ordered_compatibility_bridges[2].source_commit}:${manifest.ordered_compatibility_bridges[2].source_path}`
  ], null)).toString("utf8");
  const sentinels = JSON.parse(await readFile(path.join(PACKAGE_ROOT, manifest.sentinel_paths[0]), "utf8"));
  const materializationContract = JSON.parse(
    await readFile(path.join(PACKAGE_ROOT, manifest.materialization_contract_paths[0]), "utf8")
  );
  validatePredecessor(predecessor);
  const sentinelDigest = validateSentinels(sentinels);
  validateMaterializationContract(materializationContract);

  const prePf2Names = git([
    "ls-tree",
    "-r",
    "--name-only",
    manifest.pre_pf2_repository_sha,
    "--",
    "supabase/migrations"
  ])
    .split(/\r?\n/)
    .filter((name) => name.endsWith(".sql"))
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
  assert(prePf2Names.length === 35, `pre_pf2_migration_count:${prePf2Names.length}`);
  assert(path.posix.basename(prePf2Names[0]) === manifest.compatible_first_migration, "pre_pf2_first_migration");
  assert(path.posix.basename(prePf2Names.at(-1)) === manifest.compatible_last_pre_pf2_migration, "pre_pf2_last_migration");
  assert(!prePf2Names.includes(manifest.pf2_migration.path), "pre_pf2_contains_pf2");

  const ledgerEntries = prePf2Names.map((name) => ({
    path: name,
    content: Buffer.from(git(["show", `${manifest.pre_pf2_repository_sha}:${name}`], null)).toString("binary")
  }));
  const ledgerHash = createHash("sha256");
  for (const entry of ledgerEntries) {
    const pathBytes = Buffer.from(entry.path, "utf8");
    const contentBytes = Buffer.from(entry.content, "binary");
    ledgerHash.update(encodeLength(pathBytes.length));
    ledgerHash.update(pathBytes);
    ledgerHash.update(encodeLength(contentBytes.length));
    ledgerHash.update(contentBytes);
  }
  const ledgerDigest = ledgerHash.digest("hex");
  assert(
    ledgerDigest === "130a474f7b718a1e468473078467b1798314f91b281f2fdd900a9b9ffde65446",
    "pre_pf2_migration_ledger_digest"
  );

  const readPrePf2 = (name) => Buffer.from(git(["show", `${manifest.pre_pf2_repository_sha}:supabase/migrations/${name}`], null)).toString("utf8");
  const firstMigration = readPrePf2(manifest.compatible_first_migration);
  const categoryAnchor = readPrePf2(manifest.ordered_compatibility_bridges[0].anchor_migration);
  const productAnchor = readPrePf2(manifest.ordered_compatibility_bridges[1].anchor_migration);
  const cleansingAnchor = readPrePf2(manifest.ordered_compatibility_bridges[2].anchor_migration);
  const sec05 = readPrePf2("20260711032649_sec_05_anonymous_write_grants.sql");
  validateBridges(
    manifest,
    categoryBridge,
    productBridge,
    cleansingBridge,
    categoryAnchor,
    productAnchor,
    cleansingAnchor,
    sourceCleansing
  );
  includesAll(normalizedSql(firstMigration), [
    "alter table public.products",
    "alter table public.product_candidates",
    "left join public.source_rankings sr"
  ], "first_migration_predecessor_dependency");
  assert(normalizedSql(sec05).includes("alter table public.recommendation_logs"), "sec05_recommendation_logs_dependency");

  for (const [key, expected] of Object.entries(manifest.source_git_blob_ids)) {
    let actual;
    if (key === "authority_contract") {
      actual = git(["rev-parse", `${manifest.authoritative_main}:docs/architecture/product-fact-replay-baseline-authority-v1.md`]).trim();
    } else if (key === "historical_predecessor_input") {
      actual = git(["rev-parse", "8c1f093c1b9fc2a9af9c86174093759bcdd700a5:supabase/local-replay-test/adapters/00000000_local_replay_predecessor.sql"]).trim();
    } else if (key === "historical_category_bridge_input") {
      actual = git(["rev-parse", "a3cb2c1a923974e4e448a3bc4e1ea0c53381b20e:supabase/local-replay-test/adapters/20260524054048_local_replay_category_mapper_preconditions.sql"]).trim();
    } else if (key === "historical_product_columns_bridge_input") {
      actual = git(["rev-parse", "a3cb2c1a923974e4e448a3bc4e1ea0c53381b20e:supabase/local-replay-test/adapters/20260525_local_replay_untracked_product_columns.sql"]).trim();
    } else if (key === "admin_v2_cleansing_profile_bridge_input") {
      actual = git([
        "rev-parse",
        "3af4c99cc30b4632922e52fd2fd7acf916895c89:tests/fixtures/admin-product-review-v2/20260805215900_product_review_v2_column_adapter.sql"
      ]).trim();
    } else if (key === "pre_pf2_last_migration") {
      actual = git(["rev-parse", `${manifest.pre_pf2_repository_sha}:supabase/migrations/${manifest.compatible_last_pre_pf2_migration}`]).trim();
    } else if (key === "pf2_migration") {
      actual = git(["rev-parse", `${manifest.authoritative_main}:${manifest.pf2_migration.path}`]).trim();
    } else {
      throw new Error(`unexpected_source_git_blob_key:${key}`);
    }
    assert(actual === expected, `source_git_blob_mismatch:${key}`);
  }

  const pf2Bytes = await readFile(path.join(ROOT, ...manifest.pf2_migration.path.split("/")));
  assert(sha256(pf2Bytes) === manifest.pf2_migration.raw_sha256, "pf2_raw_sha256");
  assert(git(["hash-object", manifest.pf2_migration.path]).trim() === manifest.pf2_migration.git_blob_id, "pf2_worktree_blob");

  const historicalPredecessor = Buffer.from(
    git(["show", "8c1f093c1b9fc2a9af9c86174093759bcdd700a5:supabase/local-replay-test/adapters/00000000_local_replay_predecessor.sql"], null)
  );
  assert(sha256(Buffer.from(predecessor, "utf8")) !== sha256(historicalPredecessor), "predecessor_copied_unchanged");
  assert(!manifest.package_file_allowlist.some((name) => name.includes("99999999")), "runtime_adapter_in_allowlist");

  const mutationSqlInputs = {
    predecessor,
    categoryBridge,
    productBridge,
    cleansingBridge,
    firstMigration,
    categoryAnchor,
    productAnchor,
    cleansingAnchor,
    sourceCleansing,
    sec05
  };
  const lfMutationSqlInputs = mutationSqlWithLineEnding(mutationSqlInputs, "\n");
  const crlfMutationSqlInputs = mutationSqlWithLineEnding(mutationSqlInputs, "\r\n");
  assert(
    Object.values(lfMutationSqlInputs).every((value) => !value.includes("\r")),
    "lf_mutation_inputs_not_canonical"
  );
  assert(
    Object.values(crlfMutationSqlInputs).every((value) => value.includes("\r\n")),
    "crlf_mutation_inputs_not_derived"
  );
  const lfMutations = runMutationGuards({
    manifest,
    sqlInputs: lfMutationSqlInputs,
    actualFiles,
    computedDigest
  });
  const crlfMutations = runMutationGuards({
    manifest,
    sqlInputs: crlfMutationSqlInputs,
    actualFiles,
    computedDigest
  });

  const materializedArgument = process.argv.find((value) => value.startsWith("--materialized="));
  if (materializedArgument) {
    await validateMaterialized(
      materializedArgument.slice("--materialized=".length),
      manifest,
      ledgerDigest,
      prePf2Names.length
    );
  }

  console.log(JSON.stringify({
    status: "PASS",
    baseline_version: manifest.baseline_version,
    canonical_sha256: computedDigest,
    package_files: actualFiles.length,
    predecessor_relations: manifest.predecessor_objects.length,
    compatibility_bridges: manifest.ordered_compatibility_bridges.length,
    pre_pf2_migrations: prePf2Names.length,
    pre_pf2_migration_ledger_sha256: ledgerDigest,
    sentinel_definition_sha256: sentinelDigest,
    assertions: assertionCount,
    predecessor_sentinel_rows: sentinels.lifecycle[0].rows.length,
    a1_sentinel_updates: sentinels.lifecycle[1].updates.length,
    mutation_guards: `${lfMutations.length}/17`,
    lf_mutation_guards: `${lfMutations.length}/17`,
    crlf_mutation_guards: `${crlfMutations.length}/17`,
    materialized_checked: Boolean(materializedArgument),
    historical_identity_claimed: false,
    hosted_or_production_access: false
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
