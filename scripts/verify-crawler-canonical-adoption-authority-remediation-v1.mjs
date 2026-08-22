import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  CRAWLER_CANONICAL_STRUCTURAL_ADOPTION_VERSION,
  CRAWLER_IDENTITY_RESOLUTION_VERSION,
  IDENTITY_RESOLUTION_STATES,
  RECOMMENDATION_SEMANTIC_DENYLIST,
  STRUCTURAL_CANONICAL_FIELDS,
  analyzeCrawlerIdentityObservation,
  evaluateStructuralAdoption,
} from "../lib/crawler-canonical-adoption-authority-v1.mjs";

const ROOT = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const sha256 = (text) => crypto.createHash("sha256").update(text, "utf8").digest("hex");

const migrationPath = "supabase/migrations/20260822125500_crawler_canonical_adoption_authority_remediation_v1.sql";
const migration = read(migrationPath);
const fixtures = JSON.parse(read("fixtures/crawler-governance/canonical-adoption-authority-remediation-v1.json"));

assert(
  CRAWLER_CANONICAL_STRUCTURAL_ADOPTION_VERSION === "crawler-canonical-product-structural-adoption-v1",
  "structural contract version drift",
);
assert(
  CRAWLER_IDENTITY_RESOLUTION_VERSION === "crawler-identity-resolution-v1",
  "identity contract version drift",
);
assert(STRUCTURAL_CANONICAL_FIELDS.length === 13, "structural field allowlist drift");
assert(RECOMMENDATION_SEMANTIC_DENYLIST.length === 6, "semantic denylist drift");
assert(IDENTITY_RESOLUTION_STATES.length === 6, "identity state inventory drift");

for (const field of RECOMMENDATION_SEMANTIC_DENYLIST) {
  assert(
    migration.includes(`alter table public.products alter column ${field} drop not null;`),
    `new non-legacy unknown semantics are not nullable: ${field}`,
  );
}

for (const state of [
  "resolved",
  "unresolved",
  "identity_ambiguous",
  "variant_scope_conflict",
  "formulation_scope_conflict",
  "reformulation_candidate",
]) {
  assert(migration.includes(`'${state}'`), `identity state missing from migration: ${state}`);
}

const structuralStart = migration.indexOf("create or replace function public.promote_product_candidate_structural_v1");
const structuralEnd = migration.indexOf("revoke all on function public.promote_product_candidate_structural_v1", structuralStart);
assert(structuralStart >= 0 && structuralEnd > structuralStart, "structural promotion function missing");
const structuralFunction = migration.slice(structuralStart, structuralEnd);
for (const field of RECOMMENDATION_SEMANTIC_DENYLIST) {
  assert(!structuralFunction.includes(field), `structural promotion references forbidden semantic field: ${field}`);
}
for (const field of [
  "name",
  "brand",
  "category",
  "product_form",
  "normalized_name",
  "normalized_brand",
  "external_source",
  "external_type",
  "external_id",
  "source_url",
]) {
  assert(structuralFunction.includes(field), `structural promotion missing structural field: ${field}`);
}
assert(structuralFunction.includes("identity_resolution_state is distinct from 'resolved'"), "unresolved identity is not fail-closed");
assert(structuralFunction.includes("identity_ambiguous"), "normalization collision state is not preserved");
assert(structuralFunction.includes("count(*)::integer"), "collision multiplicity is not checked");
assert(structuralFunction.includes("insert into public.products"), "structural product insert missing");
assert(structuralFunction.includes("promotion_payload = (coalesce(promotion_payload, '{}'::jsonb) - 'product')"), "legacy semantic product payload is not stripped at promotion");

const wrapperStart = migration.indexOf("create or replace function public.promote_product_candidate(\n");
const wrapperEnd = migration.indexOf("revoke all on function public.promote_product_candidate(uuid, text)", wrapperStart);
assert(wrapperStart >= 0 && wrapperEnd > wrapperStart, "historical promotion entrypoint wrapper missing");
const wrapper = migration.slice(wrapperStart, wrapperEnd);
assert(wrapper.includes("promote_product_candidate_structural_v1"), "legacy promotion entrypoint bypasses structural boundary");
for (const field of RECOMMENDATION_SEMANTIC_DENYLIST) {
  assert(!wrapper.includes(field), `legacy promotion wrapper retains semantic write: ${field}`);
}

const adminConfirmStart = migration.indexOf("create or replace function public.admin_confirm_product_candidate_structural_adoption_v1");
const adminConfirmEnd = migration.indexOf("revoke all on function public.admin_confirm_product_candidate_structural_adoption_v1", adminConfirmStart);
assert(adminConfirmStart >= 0 && adminConfirmEnd > adminConfirmStart, "structural admin confirmation boundary missing");
const adminConfirm = migration.slice(adminConfirmStart, adminConfirmEnd);
assert(adminConfirm.includes("admin_require_product_review_actor"), "structural confirmation lacks explicit admin authority check");
assert(adminConfirm.includes("identity_resolution_state = 'resolved'"), "structural confirmation does not persist resolved identity");
assert(adminConfirm.includes("promotion_payload = (coalesce(promotion_payload, '{}'::jsonb) - 'product')"), "structural confirmation does not strip legacy semantic payload");
for (const field of RECOMMENDATION_SEMANTIC_DENYLIST) {
  assert(!adminConfirm.includes(field), `structural confirmation references forbidden semantic field: ${field}`);
}

for (const signature of [
  "public.admin_set_product_candidate_identity_resolution_v1(uuid, uuid, text, jsonb, text)",
  "public.promote_product_candidate_structural_v1(uuid, text)",
  "public.promote_product_candidate(uuid, text)",
  "public.admin_confirm_product_candidate_structural_adoption_v1(uuid, text, jsonb)",
]) {
  const grant = `grant execute on function ${signature}\n  to service_role;`;
  assert(migration.includes(grant), `service_role-only explicit grant missing: ${signature}`);
  const revokeStart = migration.lastIndexOf("revoke all on function", migration.indexOf(grant));
  const revokeBlock = migration.slice(revokeStart, migration.indexOf(grant));
  for (const role of ["public", "anon", "authenticated"]) {
    assert(revokeBlock.includes(role), `public role revoke missing for ${signature}: ${role}`);
  }
}

for (const test of [...fixtures.structural, ...fixtures.identity]) {
  const result = evaluateStructuralAdoption(test);
  assert(result.allowed === test.expectedAllowed, `${test.id} allowed mismatch`);
  assert(result.reason === test.expectedReason, `${test.id} reason mismatch: ${result.reason}`);
  if (test.repeat) {
    const repeat = evaluateStructuralAdoption(test);
    assert(JSON.stringify(result) === JSON.stringify(repeat), `${test.id} is not deterministic`);
  }
}

for (const signalFixture of fixtures.normalizationSignals) {
  const first = analyzeCrawlerIdentityObservation({ brand: signalFixture.brand, name: signalFixture.name });
  const second = analyzeCrawlerIdentityObservation({ brand: signalFixture.brand, name: signalFixture.name });
  assert(JSON.stringify(first) === JSON.stringify(second), "identity analysis is not deterministic");
  assert(first.normalizedName === signalFixture.expectedNormalizedName, "comparison normalization mismatch");
  assert((first.volumeMarkers.length > 0) === signalFixture.expectedVolumeMarker, "volume signal preservation mismatch");
  assert((first.renewalMarkers.length > 0) === signalFixture.expectedRenewalMarker, "renewal signal preservation mismatch");
  assert(first.rawName === signalFixture.name, "raw identity was not preserved");
}
assert(
  analyzeCrawlerIdentityObservation({ brand: "Example Brand", name: "Barrier Serum 50 ml" }).comparisonKey ===
    analyzeCrawlerIdentityObservation({ brand: "Example Brand", name: "Barrier Serum 100 ml" }).comparisonKey,
  "normalization collision fixture does not exercise a collision",
);
assert(
  analyzeCrawlerIdentityObservation({ brand: "Example Brand", name: "Barrier Serum 50 ml" }).rawName !==
    analyzeCrawlerIdentityObservation({ brand: "Example Brand", name: "Barrier Serum 100 ml" }).rawName,
  "variant evidence collapsed into authoritative identity",
);

const legacyText = read("fixtures/recommendation-governance/legacy-frozen-recommendation-corpus-v1.txt");
const legacyIds = legacyText.trimEnd().split(/\r?\n/).filter(Boolean);
assert(legacyIds.length === 164, `legacy count drift: ${legacyIds.length}`);
assert(
  sha256(legacyText) === "b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05",
  "legacy corpus hash drift",
);

const productSource = read("lib/product-source.js");
const g3Index = productSource.indexOf("admitRecommendationProducts(data)");
const projectionIndex = productSource.indexOf("projectAdmittedRecommendationProducts(admission", g3Index);
const postAdmissionNormalizationIndex = productSource.indexOf("buildSupabaseProduct(product)", projectionIndex);
assert(g3Index >= 0, "G3 Production admission call missing");
assert(projectionIndex > g3Index, "G3 projection ordering drift");
assert(postAdmissionNormalizationIndex > projectionIndex, "normalization is not downstream of G3 admission");

const g3Fixture = JSON.parse(read("fixtures/recommendation-governance/g3-production-candidate-admission-v1.json"));
const byId = new Map(g3Fixture.cases.map((entry) => [entry.id, entry]));
assert(byId.get("G1")?.expected === "INITIAL_ADMISSION_GRANT", "later governed grant compatibility missing");
assert(byId.get("G3")?.expected === "REJECTED", "missing PF is not rejected");
assert(byId.get("G5")?.expected === "REJECTED", "evidence_insufficient is not rejected");
assert(byId.get("G6")?.expected === "REJECTED", "evidence_conflict is not rejected");
assert(byId.get("G7")?.expected === "REJECTED", "unsupported category is not rejected");
assert(byId.get("G12")?.expected === "NO_PROJECTOR_INVOCATION", "rejected non-legacy can reach normalization");

const crawlerSupabase = read("crawler/lib/supabase.ts");
const promotionCallStart = crawlerSupabase.indexOf("export async function promoteApprovedCandidate");
const promotionCallEnd = crawlerSupabase.indexOf("async function getProductDetailRecord", promotionCallStart);
const promotionCall = crawlerSupabase.slice(promotionCallStart, promotionCallEnd);
assert(promotionCall.includes('client.rpc("promote_product_candidate"'), "crawler promotion does not use governed RPC boundary");
for (const field of RECOMMENDATION_SEMANTIC_DENYLIST) {
  assert(!promotionCall.includes(field), `crawler promotion helper directly asserts semantic field: ${field}`);
}

const enrichmentStart = crawlerSupabase.indexOf("export async function updateProductDetailsIfMissing");
const enrichment = crawlerSupabase.slice(enrichmentStart);
for (const field of RECOMMENDATION_SEMANTIC_DENYLIST) {
  assert(!enrichment.includes(field), `crawler direct product enrichment writes semantic field: ${field}`);
}
for (const allowed of ["buy_link", "image_url", "price_min", "price_max"]) {
  assert(enrichment.includes(allowed), `expected structural enrichment field missing: ${allowed}`);
}

const forbiddenAuthorityTokens = [
  "read_recommendation_admission_authority_v1",
  "INITIAL_ADMISSION_GRANT",
  "initial-admission-grant-policy-v1",
  "product_fact_current",
  "product_fact_confirmations",
  "product_fact_instances",
];
function walk(directory) {
  const absolute = path.join(ROOT, directory);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(relative);
    return /\.(?:ts|js|mjs)$/u.test(entry.name) ? [relative] : [];
  });
}
for (const file of walk("crawler")) {
  const text = read(file);
  for (const token of forbiddenAuthorityTokens) {
    assert(!text.includes(token), `crawler runtime authority shortcut found: ${file} -> ${token}`);
  }
}

const vercel = JSON.parse(read("vercel.json"));
assert(!Object.prototype.hasOwnProperty.call(vercel, "crons"), "crawler scheduler is active in Vercel");

const result = {
  stage: "CRAWLER-CANONICAL-ADOPTION-AUTHORITY-REMEDIATION",
  status: "PASS",
  structuralContract: CRAWLER_CANONICAL_STRUCTURAL_ADOPTION_VERSION,
  identityContract: CRAWLER_IDENTITY_RESOLUTION_VERSION,
  structuralFixtures: Object.fromEntries(fixtures.structural.map((item) => [item.id, "PASS"])),
  identityFixtures: Object.fromEntries(fixtures.identity.map((item) => [item.id, "PASS"])),
  recommendationSemanticWriteCount: 0,
  legacyCount: legacyIds.length,
  legacySha256: sha256(legacyText),
  g3MissingPf: "REJECTED",
  g3RejectedProjectorInvocations: 0,
  crawlerScheduled: false,
  resumeGate: {
    R1: "PASS",
    R2: "PASS",
    R3: "PASS",
    R4: "PASS",
    R5: "PASS",
    R6: "PASS",
    R7: "PASS",
    R8: "PASS",
    R9: "PASS",
    R10: "PASS",
  },
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
