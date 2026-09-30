#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  D5C_SUNSCREEN_CANARY_PRODUCT_IDS,
  D5C_SUNSCREEN_CANARY_REQUIRED_FACT_KEYS,
} from "../lib/sunscreen-d5c-canary-authority-contract.mjs";
import {
  projectSunscreenSpfFact,
} from "../lib/sunscreen-protection-projection.mjs";

const read = (file) => fs.readFileSync(file, "utf8");

const migration = read(
  "supabase/migrations/20260930202522_data_ai29c_d5c_bounded_canary_authority_v1.sql",
);
const contract = read(
  "lib/sunscreen-d5c-canary-authority-contract.mjs",
);
const reader = read(
  "lib/server/sunscreen-d5c-canary-authority-reader.js",
);
const service = read(
  "lib/server/product-query-spf-canary-service.js",
);
const route = read(
  "app/api/internal/product-query-spf-canary/route.js",
);
const validator = read(
  "scripts/validate-data-ai29c-d5c-spf-canary-runtime-response.mjs",
);
const dataAi5Workflow = read(
  ".github/workflows/data-ai5-activation-readiness.yml",
);
const productSource = read("lib/product-source.js");
const recommendation = read(
  "lib/product-query-recommendation.js",
);

const targetIds = [
  "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
  "a6994fcd-302f-4e63-acbe-91a3f17a5a65",
  "b90bf992-07ae-4f49-a3a4-d90ea6d4a858",
];

// D5C-1: target set is exact, bounded, immutable in code and database.
assert.deepEqual(
  [...D5C_SUNSCREEN_CANARY_PRODUCT_IDS],
  targetIds,
);
assert.deepEqual(
  [...D5C_SUNSCREEN_CANARY_REQUIRED_FACT_KEYS],
  ["spf_value", "uva_label", "uv_filter_type"],
);
for (const productId of targetIds) {
  assert.ok(contract.includes(productId));
  assert.ok(migration.includes(productId));
  assert.ok(service.includes(productId));
  assert.equal(
    productSource.includes(productId),
    false,
    "D5C target leaked into normal Product source: " + productId,
  );
}

// D5C-2: DB boundary is a narrow SECURITY DEFINER RPC. Runtime receives
// execute only, never raw taxonomy/semantic reads or direct semantic RPC.
assert.ok(
  migration.includes(
    "read_data_ai29c_d5c_sunscreen_canary_authority_v1",
  ),
);
assert.ok(migration.includes("security definer"));
assert.ok(migration.includes("set search_path = ''"));
assert.ok(
  migration.includes(
    "revoke all on function public.read_data_ai29c_d5c_sunscreen_canary_authority_v1(uuid)",
  ),
);
assert.ok(
  migration.includes(
    "grant execute on function public.read_data_ai29c_d5c_sunscreen_canary_authority_v1(uuid)",
  ),
);
assert.ok(
  migration.includes("to recommendation_admission_runtime"),
);
assert.ok(
  migration.includes("D5C_RUNTIME_RAW_TAXONOMY_SELECT_FORBIDDEN"),
);
assert.ok(
  migration.includes("D5C_RUNTIME_RAW_SEMANTIC_SELECT_FORBIDDEN"),
);
assert.ok(
  migration.includes("D5C_RUNTIME_DIRECT_SEMANTIC_RPC_FORBIDDEN"),
);
assert.ok(
  migration.includes("D5C_OWNER_SCHEMA_CREATE_FORBIDDEN"),
);
assert.ok(
  migration.includes(
    "revoke create on schema public from recommendation_admission_reader_owner",
  ),
);
assert.ok(
  migration.includes(
    "p_product_id not in",
  ),
);
assert.ok(
  migration.includes(
    "'PRODUCT_NOT_D5C_CANARY_TARGET'",
  ),
);

// D5C-3: runtime reader is bound to the existing admission runtime credential
// and exact pooler role. No Supabase JS/service-role bypass is introduced.
assert.ok(reader.includes('import "server-only"'));
assert.ok(
  reader.includes(
    '"RECOMMENDATION_ADMISSION_DATABASE_URL"',
  ),
);
assert.ok(
  reader.includes('"recommendation_admission_runtime"'),
);
assert.ok(
  reader.includes(
    '"read_data_ai29c_d5c_sunscreen_canary_authority_v1"',
  ),
);
assert.ok(
  reader.includes(
    "recommendation_admission_runtime.bygrczggxfuisupcevaz",
  ) ||
    reader.includes(
      "${D5C_CANARY_RUNTIME_ROLE}.${PROJECT_REF}",
    ),
);
assert.equal(reader.includes("@supabase/supabase-js"), false);
assert.equal(reader.includes("SUPABASE_SERVICE_ROLE"), false);
assert.equal(reader.includes("service_role"), false);
assert.ok(reader.includes("rawTaxonomySelectDenied"));
assert.ok(reader.includes("rawSemanticSelectDenied"));
assert.ok(reader.includes("directSemanticRpcDenied"));

// D5C-4: canary admission reuses existing governance/scoring authorities.
assert.ok(service.includes('import "server-only"'));
for (const authority of [
  "getRecommendationProducts",
  "evaluateSunscreenInitialAdmissionGrant",
  "projectEstablishedSunscreenSemantics",
  "readRecommendationSunscreenProtectionAuthorities",
  "projectSunscreenProtectionAuthority",
  "projectSunscreenSpfFact",
  "rankStructuredProductQueryFromProducts",
]) {
  assert.ok(
    service.includes(authority),
    "D5C service missing existing authority: " + authority,
  );
}
assert.ok(
  service.includes("EXPECTED_LEGACY_SUNSCREEN_COUNT = 11"),
);
assert.ok(
  service.includes("CANARY_TARGET_ALREADY_IN_PRODUCTION"),
);
assert.ok(
  service.includes("CANARY_ADMISSION_NOT_COMPLETE"),
);
assert.ok(
  service.includes("LEGACY_SPF_AUTHORITY_INCOMPLETE"),
);
assert.ok(
  service.includes("safe.candidateCount !== 14"),
);
assert.ok(
  service.includes("safe.gate.adjustments.length !== 14"),
);
assert.ok(
  service.includes("LEGACY_SPF_DELTA_NOT_UNIFORM"),
);

// D5C-5: only the three frozen canary cases exist.
for (const caseId of [
  "outdoor_spf_on",
  "rollback_off",
  "non_outdoor_control",
]) {
  assert.ok(service.includes(`id: "${caseId}"`));
  assert.ok(dataAi5Workflow.includes(caseId));
}
assert.ok(service.includes('"rollback_off"'));
assert.ok(service.includes("rollbackReady"));
assert.ok(service.includes("ROLLBACK_OFF_RANKED_ANYWAY"));
assert.ok(service.includes("NON_OUTDOOR_SPF_APPLIED"));
assert.ok(service.includes("OUTDOOR_SIGNAL_NOT_PROMOTED"));

// D5C-6: SPF only. UVA and water cannot become eligible in the new-canary
// projection even when their facts exist for admission authority.
assert.ok(
  service.includes(
    "// D5C deliberately refuses to activate the other protection axes.",
  ),
);
assert.ok(
  service.includes("uva: Object.freeze({"),
);
assert.ok(
  service.includes("waterResistance: Object.freeze({"),
);
assert.ok(
  (service.match(/eligible: false/g) || []).length >= 2,
);

// D5C-7: canonical SPF projection is reused; no duplicate bucket formula.
assert.equal(
  projectSunscreenSpfFact({
    value_number: 20,
  }).bucket,
  "spf_15_29",
);
assert.equal(
  projectSunscreenSpfFact({
    value_number: 35,
  }).bucket,
  "spf_30_49",
);
assert.equal(
  projectSunscreenSpfFact({
    value_number: 40,
  }).bucket,
  "spf_30_49",
);
assert.equal(
  projectSunscreenSpfFact({
    value_number: 50,
  }).bucket,
  "spf_50_plus_band",
);

// D5C-8: internal route inherits the trusted GitHub Actions OIDC boundary,
// accepts exactly caseId, and is main-deployment only.
assert.ok(
  route.includes('ALLOWED_DEPLOYMENT_REFS = new Set(["main"])'),
);
assert.ok(
  route.includes("verifyDataAi5GitHubActionsOidcToken"),
);
assert.ok(route.includes("ALLOWED_CASE_IDS"));
assert.ok(
  route.includes(
    'bodyKeys.length !== 1',
  ) &&
    route.includes('bodyKeys[0] !== "caseId"'),
);
assert.equal(route.includes("body?.query"), false);
assert.ok(route.includes("queryTextExposed: false"));
assert.ok(route.includes("productionWrite: false"));
assert.ok(route.includes("recommendationLogWrite: false"));
assert.ok(route.includes("publicActivation: false"));

// No public Product Query route imports the D5C canary service.
function allFiles(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const name of fs.readdirSync(root)) {
    const full = path.join(root, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...allFiles(full));
    else out.push(full);
  }
  return out;
}
for (const file of allFiles("app/api")) {
  if (file === "app/api/internal/product-query-spf-canary/route.js") {
    continue;
  }
  if (!/\.(js|mjs|cjs|ts|tsx)$/.test(file)) continue;
  assert.equal(
    read(file).includes("product-query-spf-canary-service"),
    false,
    "D5C canary service leaked to another route: " + file,
  );
}

// D5C-9: runtime evidence validator freezes the 11+3=14 shape and rollback.
for (const needle of [
  'payload.currentProductionSunscreenCount !== 11',
  'payload.canaryTargetCount !== 3',
  'payload.canaryGrantedCount !== 3',
  'payload.combinedSunscreenCount !== 14',
  'payload.legacySpfEligibleCount !== 11',
  'expectedCaseId === "outdoor_spf_on"',
  'expectedCaseId === "rollback_off"',
  'expectedCaseId === "non_outdoor_control"',
  'payload.rollbackReady !== true',
]) {
  assert.ok(
    validator.includes(needle),
    "D5C validator missing: " + needle,
  );
}

// D5C-10: deployed canary is push-main only, uses the same short-lived OIDC
// token, fixed case IDs, and must execute every case twice.
assert.ok(
  dataAi5Workflow.includes(
    "Probe D5C SPF internal canary cases twice",
  ),
);
assert.ok(
  dataAi5Workflow.includes(
    "/api/internal/product-query-spf-canary",
  ),
);
assert.ok(
  dataAi5Workflow.includes(
    "validate-data-ai29c-d5c-spf-canary-runtime-response.mjs",
  ),
);
assert.ok(
  dataAi5Workflow.includes(
    "test \"$pass_count\" -eq 6",
  ),
);
assert.ok(
  dataAi5Workflow.includes("for repeat in 1 2"),
);
assert.equal(
  dataAi5Workflow.includes("SUNSCREEN_SPF_OUTDOOR_RANKING_ENABLED: true"),
  false,
  "D5C must not set a deployment-wide SPF env flag",
);

// D5C-11: Product Query default remains OFF outside the explicit canary call.
assert.ok(
  recommendation.includes("spfRuntimeGateDefault: false"),
);
assert.equal(
  recommendation.includes(
    "process.env.SUNSCREEN_SPF_OUTDOOR_RANKING_ENABLED",
  ),
  false,
);

// D5C-12: no persistent/public authority flips are encoded in the canary.
for (const boundary of [
  "permanentCandidateAdmissionMutation: false",
  "productionRankingChanged: false",
  "productionCutoverAuthorized: false",
  "outdoorRankableSignalAuthorized: false",
  "publicActivation: false",
  "uvaActivated: false",
  "waterResistanceApplied: false",
  "persistence: false",
]) {
  assert.ok(
    service.includes(boundary),
    "D5C boundary missing: " + boundary,
  );
}

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-D5C",
    currentProductionSunscreenCount: 11,
    canaryTargetCount: 3,
    combinedCanaryCount: 14,
    cases: [
      "outdoor_spf_on",
      "rollback_off",
      "non_outdoor_control",
    ],
    deployedRepeatsPerCase: 2,
    decision:
      "D5C_BOUNDED_INTERNAL_CANARY_CONTRACT_READY_DEPLOYED_PROBE_REQUIRED",
  }),
);
