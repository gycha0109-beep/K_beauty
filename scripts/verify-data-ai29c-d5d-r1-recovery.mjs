#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

const d5cReader = read(
  "lib/server/sunscreen-d5c-canary-authority-reader.js",
);
const protectionRetry = read(
  "lib/server/recommendation-sunscreen-protection-bounded-reader.js",
);
const d5cService = read(
  "lib/server/product-query-spf-canary-service.js",
);
const d5dService = read(
  "lib/server/product-query-spf-production-service.js",
);
const d5dRoute = read(
  "app/api/internal/product-query-spf-production-activation/route.js",
);
const workflow = read(
  ".github/workflows/data-ai5-activation-readiness.yml",
);

const rollback = read(
  "supabase/migrations/20260930212837_data_ai29c_d5d_emergency_rollback_v1.sql",
);
const control = read(
  "supabase/migrations/20260930213348_data_ai29c_d5d_activation_control_v1.sql",
);
const aclFix = read(
  "supabase/migrations/20260930213448_data_ai29c_d5d_activation_control_acl_fix_v1.sql",
);
const returnFix = read(
  "supabase/migrations/20260930213521_data_ai29c_d5d_activation_control_return_fix_v1.sql",
);

// R1-1: D5C authority transport retry is bounded to exactly one retry.
assert.ok(
  d5cReader.includes(
    'D5C_CANARY_TRANSIENT_RETRY_VERSION =\n  "data-ai29c-d5d-r1-d5c-authority-retry-v1"',
  ),
);
assert.ok(d5cReader.includes("TRANSIENT_RETRY_DELAY_MS = 75"));
assert.ok(
  d5cReader.includes(
    'result?.reason === "D5C_CANARY_AUTHORITY_READ_TIMEOUT"',
  ),
);
assert.ok(
  d5cReader.includes(
    'result?.reason === "D5C_CANARY_AUTHORITY_READ_FAILED"',
  ),
);
assert.ok(
  d5cReader.includes(
    "const first = await readD5cSunscreenCanaryAuthorityOnce(productId)",
  ),
);
assert.ok(
  d5cReader.includes(
    "return readD5cSunscreenCanaryAuthorityOnce(productId)",
  ),
);
assert.equal(
  (d5cReader.match(/readD5cSunscreenCanaryAuthorityOnce\(productId\)/g) || [])
    .length,
  3,
  "D5C reader may perform first attempt + at most one retry only",
);

// Semantic/governance failures must not be declared transient.
for (const forbidden of [
  "PRODUCT_NOT_D5C_CANARY_TARGET",
  "D5C_CANARY_RPC_CARDINALITY_INVALID",
  "D5C_CANARY_READ_CONTRACT_VERSION_MISMATCH",
  "D5C_CANARY_SEMANTIC_BUNDLE_INVALID",
]) {
  const retryBlock = d5cReader.slice(
    d5cReader.indexOf("function shouldRetryAuthority"),
    d5cReader.indexOf("function sleep"),
  );
  assert.equal(
    retryBlock.includes(forbidden),
    false,
    "non-transport D5C failure entered retry allowlist: " + forbidden,
  );
}

// R1-2: legacy protection read uses the same bounded transport-only rule.
assert.ok(
  protectionRetry.includes(
    '"data-ai29c-d5d-r1-protection-bounded-retry-v1"',
  ),
);
assert.ok(protectionRetry.includes("RETRY_DELAY_MS = 75"));
assert.ok(
  protectionRetry.includes('"PF_PROTECTION_AUTHORITY_READ_TIMEOUT"'),
);
assert.ok(
  protectionRetry.includes('"PF_PROTECTION_AUTHORITY_READ_FAILED"'),
);
assert.equal(
  (
    protectionRetry.match(
      /readRecommendationSunscreenProtectionAuthorities\(/g,
    ) || []
  ).length,
  2,
  "legacy protection authority must perform at most two attempts",
);

// R1-3: both D5C and D5D consume the bounded protection reader.
for (const service of [d5cService, d5dService]) {
  assert.ok(
    service.includes(
      "readRecommendationSunscreenProtectionAuthoritiesWithBoundedRetry",
    ),
  );
}
assert.ok(d5cService.includes("legacyProtectionReadAttempts"));
assert.ok(d5cService.includes("legacyProtectionRetried"));
assert.ok(d5dService.includes("legacyProtectionReadAttempts"));
assert.ok(d5dService.includes("legacyProtectionRetried"));

// R1-4: emergency rollback ledger is explicit and leaves SPF OFF.
assert.ok(
  rollback.includes("set enabled = false"),
);
assert.ok(
  rollback.includes(
    "automatic_rollback_after_d5c_regression",
  ),
);
assert.ok(
  rollback.includes(
    "where scope = 'authenticated_product_query_beta'",
  ),
);

// R1-5: admin kill-switch control is auditable and unavailable to runtime.
assert.ok(
  control.includes(
    "sunscreen_spf_runtime_activation_audit_v1",
  ),
);
assert.ok(
  control.includes(
    "admin_set_data_ai29c_d5d_spf_runtime_activation_v1",
  ),
);
assert.ok(
  control.includes("D5D_R1_RUNTIME_SETTER_EXECUTE_FORBIDDEN"),
);
assert.ok(
  control.includes("D5D_R1_RUNTIME_AUDIT_SELECT_FORBIDDEN"),
);
assert.ok(
  aclFix.includes("D5D_R1_RUNTIME_UPDATE_FORBIDDEN"),
);
assert.ok(
  aclFix.includes(
    "grant update (enabled, activated_by, updated_at)",
  ),
);
assert.ok(
  returnFix.includes(
    "grant execute on function public.admin_set_data_ai29c_d5d_spf_runtime_activation_v1(boolean, text)\n  to postgres",
  ),
);
assert.equal(
  returnFix.includes(
    "grant execute on function public.admin_set_data_ai29c_d5d_spf_runtime_activation_v1(boolean, text)\n  to recommendation_admission_runtime",
  ),
  false,
);

// R1-6: activation state is visible only through the existing OIDC internal
// probe and is not a public switch-management surface.
assert.ok(
  d5dService.includes(
    "readD5dSpfProductionActivationProbeState",
  ),
);
assert.ok(d5dService.includes('caseId: "switch_state"'));
assert.ok(d5dRoute.includes('"switch_state"'));
assert.ok(
  d5dRoute.includes("verifyDataAi5GitHubActionsOidcToken"),
);
assert.equal(
  d5dRoute.includes(
    "admin_set_data_ai29c_d5d_spf_runtime_activation_v1",
  ),
  false,
);

// R1-7: runtime CI detects switch state first. OFF means D5D activation probes
// are skipped while D5C + existing activation-readiness still execute.
assert.ok(
  workflow.includes(
    "Detect D5D SPF activation switch",
  ),
);
assert.ok(
  workflow.includes(
    'if: steps.spf-switch.outputs.enabled == \'true\'',
  ),
);
assert.ok(
  workflow.includes(
    "Probe D5C SPF internal canary cases twice",
  ),
);
assert.ok(
  workflow.includes("Probe activation-readiness cases twice"),
);
assert.ok(
  workflow.includes(
    "run_deployed_probe",
  ),
);
assert.ok(
  workflow.includes(
    "github.event_name == 'workflow_dispatch'",
  ),
);

// R1-8: recovery does not broaden Product Query activation boundaries.
for (const boundary of [
  "authenticatedBetaOnly: true",
  "publicSearchCutover: false",
  "providerInvoked: false",
  "rawQueryAccepted: false",
  "profileRead: false",
  "historyRead: false",
  "productionWrite: false",
  "recommendationLogWrite: false",
  "uvaActivated: false",
  "waterResistanceApplied: false",
  "persistence: false",
]) {
  assert.ok(
    d5dService.includes(boundary),
    "D5D-R1 boundary missing: " + boundary,
  );
}

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-D5D-R1",
    switchStateAfterRollback: "OFF",
    d5cAuthorityMaxAttempts: 2,
    legacyProtectionMaxAttempts: 2,
    retryScope: [
      "D5C_CANARY_AUTHORITY_READ_TIMEOUT",
      "D5C_CANARY_AUTHORITY_READ_FAILED",
      "PF_PROTECTION_AUTHORITY_READ_TIMEOUT",
      "PF_PROTECTION_AUTHORITY_READ_FAILED",
    ],
    activationControl: "postgres_admin_only",
    decision:
      "D5D_R1_RECOVERY_CONTRACT_READY_SWITCH_OFF_DEPLOYMENT_REQUIRED",
  }),
);
