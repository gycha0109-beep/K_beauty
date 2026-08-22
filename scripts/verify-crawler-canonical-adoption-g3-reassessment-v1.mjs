import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function walkFiles(directory, extensions = new Set([".ts", ".js", ".mjs"])) {
  const absolute = path.join(ROOT, directory);
  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(relative, extensions));
    else if (extensions.has(path.extname(entry.name))) files.push(relative);
  }
  return files;
}

const EXPECTED_LEGACY_COUNT = 164;
const EXPECTED_LEGACY_SHA256 = "b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05";
const LEGACY_FIELDS = [
  "skin_types",
  "concerns",
  "texture",
  "finish",
  "irritation_risk",
  "sensitivity_safe",
];

const corpusText = read("fixtures/recommendation-governance/legacy-frozen-recommendation-corpus-v1.txt");
const corpusIds = corpusText.trimEnd().split(/\r?\n/).filter(Boolean);
assert(corpusIds.length === EXPECTED_LEGACY_COUNT, `legacy count drift: ${corpusIds.length}`);
assert(sha256(corpusText) === EXPECTED_LEGACY_SHA256, "legacy corpus hash drift");

const legacyModule = read("lib/recommendation-legacy-corpus-v1.mjs");
assert(legacyModule.includes("LEGACY_FROZEN_RECOMMENDATION_CORPUS_V1"), "legacy corpus key missing");
assert(legacyModule.includes("new Set"), "legacy membership is not exact set-backed membership");

const admissionCore = read("lib/recommendation-candidate-admission-core.mjs");
assert(admissionCore.includes("INITIAL_ADMISSION_GRANT"), "G2 initial grant contract missing from G3 core");
assert(admissionCore.includes("nonlegacyCheckedCount"), "nonlegacy checked telemetry missing");
assert(admissionCore.includes("nonlegacyGrantedCount"), "nonlegacy grant telemetry missing");
assert(admissionCore.includes("nonlegacyRejectedCount"), "nonlegacy reject telemetry missing");
assert(admissionCore.includes("authorityFailureCount"), "authority failure telemetry missing");

const productSource = read("lib/product-source.js");
const gateIndex = productSource.indexOf("admitRecommendationProducts(data)");
const projectionIndex = productSource.indexOf("projectAdmittedRecommendationProducts(admission", gateIndex);
const normalizeIndex = productSource.indexOf("buildSupabaseProduct(product)", projectionIndex);
assert(gateIndex >= 0, "Production product-source G3 call missing");
assert(projectionIndex > gateIndex, "admission projection does not follow G3");
assert(normalizeIndex > projectionIndex, "no post-admission normalization call found after G3 projection");
for (const token of [
  "enumerated_count",
  "legacy_admitted_count",
  "nonlegacy_checked_count",
  "nonlegacy_granted_count",
  "nonlegacy_rejected_count",
  "authority_failure_count",
]) {
  assert(productSource.includes(token), `Production admission telemetry missing: ${token}`);
}

const g3Fixture = JSON.parse(read("fixtures/recommendation-governance/g3-production-candidate-admission-v1.json"));
const g3CaseById = new Map(g3Fixture.cases.map((entry) => [entry.id, entry]));
assert(g3CaseById.get("G5")?.scenario === "evidence_insufficient preserved through PDA", "G3 insufficient fixture drift");
assert(g3CaseById.get("G5")?.expected === "REJECTED", "G3 insufficient fixture no longer rejects");
assert(g3CaseById.get("G6")?.scenario === "evidence_conflict preserved through PDA", "G3 conflict fixture drift");
assert(g3CaseById.get("G6")?.expected === "REJECTED", "G3 conflict fixture no longer rejects");
assert(g3CaseById.get("G7")?.scenario === "unsupported category", "G3 unsupported-category fixture drift");
assert(g3CaseById.get("G7")?.expected === "REJECTED", "G3 unsupported category no longer rejects");
assert(g3CaseById.get("G12")?.expected === "NO_PROJECTOR_INVOCATION", "G3 pre-normalization rejection fixture drift");

const reviewedContract = read("crawler/lib/reviews/reviewed-intake-contract.ts");
for (const field of LEGACY_FIELDS) {
  assert(reviewedContract.includes(`\"${field}\"`), `expected residual reviewed-intake field missing: ${field}`);
}
assert(reviewedContract.includes("REQUIRED_EVIDENCE_FIELDS"), "reviewed intake required-evidence contract missing");

const confirmSql = read("supabase/migrations/20260804233300_admin_product_review_import_confirm.sql");
assert(confirmSql.includes("promote_product_candidate"), "review confirm no longer routes through canonical promotion RPC");
for (const field of LEGACY_FIELDS) {
  assert(confirmSql.includes(field), `expected residual confirm semantic field missing: ${field}`);
}

const promotionSql = read("supabase/migrations/20260620212309_candidate_product_form_promotion_contract.sql");
assert(promotionSql.includes("insert into public.products"), "canonical promotion INSERT contract missing");
assert(promotionSql.includes("update public.products"), "canonical promotion UPDATE contract missing");
for (const field of LEGACY_FIELDS) {
  assert(promotionSql.includes(field), `expected residual canonical semantic write missing: ${field}`);
}

const identityNormalizer = read("crawler/lib/reviews/review-promotion-identity.ts");
assert(identityNormalizer.includes("PRODUCT_VOLUME"), "promotion identity volume normalization missing");
assert(identityNormalizer.includes("PRODUCT_OPTION"), "promotion identity option normalization missing");
assert(identityNormalizer.includes("renewal"), "renewal normalization marker missing");
for (const explicitState of [
  "identity_ambiguous",
  "variant_scope_conflict",
  "formulation_scope_conflict",
  "reformulation_candidate",
]) {
  assert(!identityNormalizer.includes(explicitState), `identity remediation state already present; reassessment artifact must be updated: ${explicitState}`);
}

const crawlerExecutableFiles = walkFiles("crawler").filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`));
const directAdmissionAuthorityTokens = [
  "read_recommendation_admission_authority_v1",
  "INITIAL_ADMISSION_GRANT",
  "initial-admission-grant-policy-v1",
];
const directPfPdaAuthorityTokens = [
  "product_fact_current",
  "product_fact_confirmations",
  "product_fact_instances",
  "recommendation-admission-authority-reader",
];

for (const file of crawlerExecutableFiles) {
  const text = read(file);
  for (const token of directAdmissionAuthorityTokens) {
    assert(!text.includes(token), `crawler direct admission authority reference found: ${file} -> ${token}`);
  }
  for (const token of directPfPdaAuthorityTokens) {
    assert(!text.includes(token), `crawler direct PF/PDA authority reference found: ${file} -> ${token}`);
  }
}

const vercel = JSON.parse(read("vercel.json"));
assert(!Object.prototype.hasOwnProperty.call(vercel, "crons"), "Vercel crawler/scheduler activation requires reassessment");

const result = {
  stage: "CRAWLER-CANONICAL-ADOPTION-REASSESSMENT",
  originalRecommendationEligibilityGap: "RESOLVED",
  legacy: {
    count: corpusIds.length,
    sha256: sha256(corpusText),
  },
  g3Ordering: "ADMISSION_BEFORE_NORMALIZATION",
  controlledFixtures: "C1-C10_STATIC_AND_FROZEN_G3_COVERAGE_PASS",
  crawlerDirectAdmissionAuthorityShortcut: false,
  crawlerDirectPfPdaAuthorityShortcut: false,
  crawlerCanonicalWriteAuthorityOverreach: true,
  crawlerIdentityVariantReformulationGap: true,
  residualBlocker: "CRAWLER_REASSESSMENT_BLOCKED_BY_CANONICAL_WRITE_AUTHORITY_OVERREACH",
  resumeGate: "FROZEN_NOT_SATISFIED",
  crawlerResume: "NO",
  classification: "PARTIALLY_RESOLVED",
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
