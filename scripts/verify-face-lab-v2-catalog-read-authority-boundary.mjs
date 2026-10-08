#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const serverReader = read("lib/server/face-lab-catalog-product-try-on-reader.js");
const readCore = read("lib/face-lab-v2/catalog-product-try-on-read-core.js");
const subjectSchema = read("supabase/migrations/20260809115932_product_fact_storage_v1.sql");
const admissionMigration = read("supabase/migrations/20260822083000_v21_admission_g3a_pf_authority_read_v1.sql");
const taxonomyMigration = read("supabase/migrations/20260913201050_data_taxonomy1_shadow_catalog_taxonomy_foundation_v1.sql");

// Verify the existing user-facing reader cannot silently become a privileged
// Product Fact, shadow taxonomy or paid Provider transport.
assert.match(serverReader, /import "server-only";/);
assert.match(serverReader, /createServerSupabaseClient/);
assert.match(serverReader, /supabase\.auth\.getUser\(\)/);
assert.match(serverReader, /\.from\("products"\)\s*\.select\("id"\)/);
assert.doesNotMatch(serverReader, /\.from\("(?:product_fact_subjects|catalog_taxonomy_versions|catalog_taxonomy_terms|product_catalog_taxonomy_assignments)"\)/);
assert.doesNotMatch(serverReader, /\b(?:service_role|recommendation_admission_runtime|executeOpenAiImageEdit)\b/);
assert.match(readCore, /approved_try_on_projection_unavailable/);
assert.match(readCore, /buildFaceLabCatalogProductTryOnSelection\(bundle\)/);

// The Product Fact table is not a user-queryable Variant/Subject projection.
assert.match(subjectSchema, /variant_key text,/);
assert.match(subjectSchema, /revoke all on table public\.product_fact_subjects\s+from public, anon, authenticated, service_role;/i);
assert.match(subjectSchema, /grant select on table public\.product_fact_subjects to service_role;/i);

// The G3A reader is for a separate, narrowly scoped Recommendation role.
// It does not currently project the Subject variant_key required by Try-On.
assert.match(admissionMigration,
  /grant execute on function public\.read_recommendation_admission_authority_v1\(uuid\)\s+to recommendation_admission_runtime;/i);
const subjectProjection = admissionMigration.match(
  /select jsonb_build_object\(([\s\S]*?)\)\s+into v_subject\s+from public\.product_fact_subjects s/i
)?.[1];
assert.ok(subjectProjection, "G3A Subject projection must be inspectable");
assert.doesNotMatch(subjectProjection, /'variant_key'/i);

// Initial taxonomy and catalog classification authority is explicitly shadow.
// Repository migration evidence does NOT prove the current hosted DB state.
assert.match(taxonomyMigration,
  /insert into public\.catalog_taxonomy_versions\s*\([\s\S]*?\) values \(\s*'catalog-taxonomy-v1',\s*'shadow',\s*'shadow_only'/i);
assert.match(taxonomyMigration,
  /revoke all on table public\.catalog_taxonomy_versions from public, anon, authenticated, service_role;/i);
assert.match(taxonomyMigration,
  /grant select on table public\.catalog_taxonomy_versions to service_role;/i);
assert.match(taxonomyMigration,
  /'catalog-taxonomy-v1:category:lip_color'[^\n]*'reserved'/i);

console.log(JSON.stringify({
  status: "PASS",
  scope: "repository_static_boundary_only",
  existingCatalogIdentityRead: "authenticated_products_id",
  approvedTryOnProjection: "not_connected",
  subjectVariantRead: "not_authorized_for_face_lab",
  canonicalTaxonomyHostedState: "not_verified",
  governedCategoryAndCapabilityEvidence: "not_connected",
  currentServiceTryOnReady: false,
  hostedDatabaseReads: 0,
  paidProviderCalls: 0
}));
