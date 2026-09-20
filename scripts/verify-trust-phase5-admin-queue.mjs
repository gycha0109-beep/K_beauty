import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = {
  navigation: "app/admin/AdminNavigation.js",
  page: "app/admin/products/trust/page.js",
  workbench: "app/admin/products/trust/TrustQueueWorkbench.js",
  loader: "lib/admin/trust-queue.js",
  workflow: ".github/workflows/trust-phase5-admin-queue.yml",
  currentHealth: "scripts/verify-current-main-health.mjs"
};

const content = Object.fromEntries(
  Object.entries(files).map(([key, relativePath]) => [
    key,
    fs.readFileSync(path.join(root, relativePath), "utf8")
  ])
);

let assertions = 0;
function check(condition, message) {
  assertions += 1;
  if (!condition) {
    throw new Error(message);
  }
}

check(content.navigation.includes('href: "/admin/products/trust"'), "TRUST admin navigation route missing");
check(content.navigation.includes("ADMIN_CAPABILITIES.PRODUCTS_READ"), "TRUST nav must reuse products read capability");
check(content.page.includes("requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_READ)"), "page access gate missing");
check(content.page.includes('redirect("/?auth_required=admin")'), "unauthenticated redirect missing");
check(content.page.includes("notFound()"), "forbidden route must fail closed");
check(content.loader.startsWith('import "server-only";'), "loader must be server-only");
check(content.loader.includes("createSupabaseAdminClient"), "server admin client missing");

for (const blocker of [
  "SUBJECT_CREATION_REQUIRED",
  "SUBJECT_CANDIDATE_FOUND",
  "IDENTITY_BLOCKED",
  "VARIANT_CONFLICT",
  "FORMULATION_CONFLICT",
  "MARKET_CONFLICT",
  "REGISTRY_GAP",
  "EVIDENCE_CONFLICT"
]) {
  check(content.loader.includes(`"${blocker}"`), `queue blocker missing: ${blocker}`);
}

for (const table of [
  "product_fact_research_tasks",
  "catalog_trust_intake",
  "trust_source_observations",
  "trust_evidence_candidates",
  "product_fact_current",
  "product_fact_instances",
  "product_fact_review_assignments"
]) {
  check(content.loader.includes(`"${table}"`), `expected read source missing: ${table}`);
}

for (const forbidden of [
  ".insert(",
  ".update(",
  ".delete(",
  ".upsert(",
  ".rpc(",
  "admin_register_product_fact_subject_v1",
  "admin_adopt_trust_evidence_candidate_v1",
  "admin_confirm_product_fact_v1"
]) {
  check(!content.loader.includes(forbidden), `read-only loader contains forbidden operation: ${forbidden}`);
}

const implementation = `${content.page}\n${content.workbench}\n${content.loader}`;
for (const liveValue of [
  "da5df70c-8cdd-4eb2-93b6-ede46c2f171d",
  "15566618-d039-44c5-ad45-6413ee399db3",
  "노스카나인 트러블 세럼",
  "FATION"
]) {
  check(!implementation.includes(liveValue), `Production fixture must not be hard-coded: ${liveValue}`);
}

check(content.workbench.includes("Read only"), "read-only boundary must be visible");
check(content.workbench.includes("Evidence candidate"), "Evidence detail surface missing");
check(content.workbench.includes("Existing Current"), "Current summary surface missing");
check(content.workbench.includes("Governed review"), "governed review summary missing");
check(content.workflow.includes("node-version: 22"), "workflow must use Node 22");
check(content.workflow.includes("node scripts/verify-trust-phase5-admin-queue.mjs"), "focused verifier step missing");
check(!content.workflow.includes("npm run architecture:guard"), "phase workflow must not duplicate canonical architecture guard");
check(!content.workflow.includes("npm run build"), "phase workflow must not duplicate canonical production build");
check(content.currentHealth.includes('run("TRUST Phase 5 admin queue contract"'), "Current Main Health must own Phase 5 static contract");
check(content.currentHealth.includes('run("Architecture guard"'), "Current Main Health must own architecture guard");
check(content.currentHealth.includes('run("Production build"'), "Current Main Health must own production build");

console.log(JSON.stringify({ status: "PASS", assertions }));
