import assert from "node:assert/strict";
import fs from "node:fs";

const contract = fs.readFileSync(
  "docs/evidence/trust-phase8i4g-real-canary-contract-v1.md",
  "utf8",
);
const adminService = fs.readFileSync(
  "lib/admin/trust-grouped-relocation.js",
  "utf8",
);
const closureService = fs.readFileSync(
  "lib/admin/trust-grouped-relocation-canary.js",
  "utf8",
);
const workbench = fs.readFileSync(
  "app/admin/products/trust/relocations/TrustGroupedRelocationWorkbench.js",
  "utf8",
);
const workflow = fs.readFileSync(
  ".github/workflows/trust-phase8h3-relocation-revalidation.yml",
  "utf8",
);

for (const required of [
  "Relocation confirm + canary verification",
  "trust.phase8i4g.first_real_canary_verification",
  "A PASS audit opens later grouped confirmations.",
  "no PASS closure audit",
  "fail-closes further grouped mutation",
]) {
  assert.ok(contract.includes(required), "8I-4G closure contract missing: " + required);
}

for (const required of [
  "captureFirstRealCanaryAuthoritySnapshot",
  "verifyFirstRealCanaryClosure",
  "recordFirstRealCanaryClosureAudit",
  "loadFirstRealCanaryClosureState",
  "trust_grouped_relocation_canary_closure_required",
  "trust_grouped_relocation_canary_snapshot_failed",
  "admin_confirm_trust_official_source_grouped_relocation_v1",
  "HALT_FURTHER_GROUPED_CONFIRMATIONS",
  "OPEN_AFTER_FIRST_REAL_CANARY_PASS",
]) {
  assert.ok(adminService.includes(required), "admin service missing: " + required);
}

assert.ok(
  adminService.includes(
    'p_request_id: requestIdFor(normalizedPreflightHash)',
  ),
  "idempotent replay must reuse the exact confirmation request ID",
);
assert.ok(
  adminService.match(
    /admin_confirm_trust_official_source_grouped_relocation_v1/g,
  )?.length >= 2,
  "first-real canary path must contain initial confirmation and exact replay",
);

for (const required of [
  "FIRST_REAL_CANARY_AUDIT_ACTION",
  "trust.phase8i4g.first_real_canary_verification",
  "record_admin_audit_event",
  "product_fact_scope_digest",
  "historical_evidence_source_digest",
  "historical_evidence_binding_digest",
  "recommendation_scope_digest",
  "verifyCanaryProtectedAuthorityInvariant",
  "verifyCanaryGroupedLineage",
  "verifyCanaryIdempotentReplay",
  "verifyPhase8h3CanaryHandoff",
  "FIRST_REAL_CANARY_CLOSED",
  "HALT_FURTHER_GROUPED_CONFIRMATIONS",
]) {
  assert.ok(closureService.includes(required), "closure service missing: " + required);
}

for (const forbidden of [
  "Product Fact Current =",
  "semanticSameChanged: \"same\"",
  "semanticSameChanged: \"changed\"",
]) {
  assert.equal(
    closureService.includes(forbidden),
    false,
    "closure service must not resolve Product Fact semantic authority: " + forbidden,
  );
}

for (const required of [
  "첫 Real Canary Relocation 확정 + 검증",
  "Phase 8I-4G canary verification",
  "추가 grouped relocation은 canary closeout 검토 전까지",
  "차단됩니다.",
]) {
  assert.ok(workbench.includes(required), "workbench missing: " + required);
}

assert.equal(
  workflow.includes(
    "admin_confirm_trust_official_source_grouped_relocation_v1",
  ),
  false,
  "scheduled workflow must never gain confirmation authority",
);

console.log(
  JSON.stringify(
    {
      contract: "trust-phase8i4g-canary-closure-static-verification-v1",
      result: "PASS",
      explicit_admin_confirm_plus_verification: true,
      exact_idempotent_replay: true,
      pass_audit_required_for_next_grouped_confirmation: true,
      scheduler_confirmation_path: false,
      semantic_authority: false,
    },
    null,
    2,
  ),
);
