#!/usr/bin/env node
// Static contract for local-only Docker PG17 acceptance infrastructure.
// Passing this does NOT imply any SQL was executed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const schema = read("docs/taxonomy-ai/sql/d8k5-selected-option-evidence-schema-review-only.sql");
const reader = read("docs/taxonomy-ai/sql/d8k5-selected-option-private-read-review-only.sql");
const fixture = read("tests/fixtures/product-offers/d8k7-selected-option-local-pg17.sql");
const runner = read("scripts/product-evidence/run-d8k7-local-pg17.mjs");
let checks = 0;
function eq(a,b) { assert.equal(a,b);checks++; }
function yes(s,re){ assert.match(s,re);checks++; }
function no(s,re){ assert.doesNotMatch(s,re);checks++; }

eq((schema.match(/^create table public\./gm)||[]).length,2);
eq((schema.match(/^commit;$/gm)||[]).length,1);
eq((schema.match(/^begin;$/gm)||[]).length,1);
assert(schema.length < 9000, "SQL corruption/repetition threshold");checks++;
yes(schema,/create table public\.product_offer_option_observations/);
yes(schema,/create table public\.product_offer_option_reviews/);
yes(schema,/collector_actor_key ~ '\^\[a-z0-9\]/);
yes(schema,/source_evidence_sha256 ~ '\^\[a-f0-9\]\{64\}\$'/);
yes(schema,/reviewer_actor_key ~ '\^\[a-z0-9\]/);
yes(schema,/evidence_sha256 ~ '\^\[a-f0-9\]\{64\}\$'/);
yes(schema,/unique \(observation_id, reviewed_at\)/);
yes(schema,/shipping_price_basis = 'unknown' and shipping_price_krw is null/);
yes(schema,/shipping_price_basis = 'seller_published_flat'/);
yes(schema,/enable row level security/g);
yes(schema,/revoke all on public\.product_offer_option_reviews/);
no(schema,/create policy .* to anon/i);
yes(reader,/latest_review as \(/);
yes(reader,/r\.review_rank = 1/);
yes(reader,/r\.verdict = 'verified'/);
yes(reader,/r\.reviewer_actor_key <> ranked\.collector_actor_key/);
yes(reader,/r\.evidence_sha256 = ranked\.source_evidence_sha256/);
yes(reader,/bounded as \(/);
yes(reader,/limit 257/);
yes(reader,/into v_count, v_options from bounded/);
yes(reader,/to recommendation_admission_runtime/);
yes(reader,/revoke all on function public\.read_selected_offer_option_evidence_v1/);
no(reader,/grant execute[^;]*to\s+anon|grant execute[^;]*to\s+service_role/);
yes(fixture,/D8K7_PG17_SQL_ACCEPTANCE_PASS/);
yes(fixture,/D8K7_REVOCATION_OLD_PRICE_FALLBACK/);
yes(fixture,/D8K7_NEW_UNREVIEWED_KIT_FALLBACK/);
yes(fixture,/D8K7_INVALID_SHIPPING_BASIS_ACCEPTED/);
yes(fixture,/generate_series\(1,257\)/);
yes(fixture,/D8K7_65_PRODUCT_LIMIT_ALLOWED/);
yes(fixture,/D8K7_ROLE_PERMISSION_BOUNDARY_FAILED/);
yes(runner,/const IMAGE = "postgres:17"/);
yes(runner,/--network=none/);
yes(runner,/--pull=never/);
yes(runner,/--tmpfs/);
yes(runner,/assertLocalDaemon\(\)/);
yes(runner,/DOCKER_HOST/);
yes(runner,/D8K7_LOCAL_DOCKER_PG17_PASS/);
yes(runner,/docker\(\["rm", "--force", CONTAINER\]/);
no(runner,/docker\(\["(?:volume|system|image)",\s*"(?:prune|rm|delete)"/);
no(runner,/\.env\.local|SUPABASE_SERVICE_ROLE_KEY|https:\/\/[^'"]*supabase\.co/);
console.log(JSON.stringify({
 status:"PASS",stage:"D8K7_LOCAL_PG17_HARNESS_STATIC",
 assertions:checks,actualPostgresExecuted:false,networkUsed:false,
 productionAccess:false,priceDisplayAuthorized:false
}));
