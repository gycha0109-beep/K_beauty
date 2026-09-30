import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildCanaryActivationSignal,
} from "./trust-phase8i4g-canary-activation-signal.mjs";

const waitingSnapshot = {
  contract: "trust-phase8i4g-read-only-canary-snapshot-v1",
  phase: "8I-4G",
  state: "WAITING_FOR_REAL_READY_FOR_8I4",
  authority: "READ_ONLY_DETECTION_NO_CONFIRMATION",
  automatic_confirmation: false,
  snapshot_digest: "a".repeat(64),
  candidate_count: 0,
  candidates: [],
};

const detectedSnapshot = {
  ...waitingSnapshot,
  state: "REAL_READY_DETECTED_REQUIRES_ADMIN_PREFLIGHT",
  snapshot_digest: "b".repeat(64),
  candidate_count: 1,
  candidates: [
    {
      case_id: "11111111-1111-4111-8111-111111111111",
      evaluation_id: "22222222-2222-4222-8222-222222222222",
      canary_rank: 1,
      candidate_locator: "https://must-not-leak.example/path",
      historical_source_ids: ["s1", "s2"],
      incident_ids: ["i1", "i2", "i3"],
      result_payload: { secret: "must-not-leak" },
    },
  ],
};

const waiting = buildCanaryActivationSignal(waitingSnapshot);
assert.equal(waiting.state, "WAITING_FOR_REAL_READY_FOR_8I4");
assert.equal(waiting.automatic_confirmation, false);
assert.equal(waiting.first_candidate_evaluation_id, null);

const detected = buildCanaryActivationSignal(detectedSnapshot);
assert.equal(
  detected.state,
  "FIRST_REAL_CANARY_ADMIN_ATTENTION_REQUIRED",
);
assert.equal(detected.authority, "READ_ONLY_SIGNAL_NO_PREFLIGHT_NO_CONFIRMATION");
assert.equal(detected.automatic_confirmation, false);
assert.equal(
  detected.first_candidate_evaluation_id,
  detectedSnapshot.candidates[0].evaluation_id,
);
assert.equal(detected.historical_source_count, 2);
assert.equal(detected.incident_count, 3);
const serializedSignal = JSON.stringify(detected);
assert.equal(serializedSignal.includes("must-not-leak.example"), false);
assert.equal(serializedSignal.includes("must-not-leak"), false);

const activationScript = fs.readFileSync(
  "scripts/trust-phase8i4g-canary-activation-signal.mjs",
  "utf8",
);
const workflow = fs.readFileSync(
  ".github/workflows/trust-phase8h3-relocation-revalidation.yml",
  "utf8",
);
const adminService = fs.readFileSync(
  "lib/admin/trust-grouped-relocation.js",
  "utf8",
);
const workbench = fs.readFileSync(
  "app/admin/products/trust/relocations/TrustGroupedRelocationWorkbench.js",
  "utf8",
);

for (const forbidden of [
  "admin_confirm_trust_official_source_grouped_relocation_v1",
  "admin_confirm_trust_official_source_relocation_v1",
  "admin_preflight_trust_official_source_grouped_relocation_v1",
]) {
  assert.equal(
    activationScript.includes(forbidden),
    false,
    `activation signal gained forbidden authority: ${forbidden}`,
  );
}

for (const required of [
  "trust-phase8i4g-canary-activation-signal.mjs",
  "Phase 8I-4G activation signal",
]) {
  assert.ok(workflow.includes(required), `workflow missing: ${required}`);
}
assert.equal(
  workflow.includes("admin_confirm_trust_official_source_grouped_relocation_v1"),
  false,
  "scheduled workflow must not gain grouped confirmation authority",
);

for (const required of [
  "get_trust_official_source_transport_drift_case_v1",
  "get_trust_official_source_transport_drift_cases_v1",
  "loadGovernedDriftCase",
  "loadGovernedReadyEvaluations",
  "loadLatestEvaluationForCase",
  "verifyCurrentReadyEvaluation",
  "loadFirstEligibleRealCanaryEvaluationId",
  "STALE_REAL_CANARY_REQUIRES_REEVALUATION",
  "FIRST_REAL_CANARY_REQUIRES_SCHEDULED_PROVENANCE",
  "FIRST_REAL_CANARY_CANDIDATE_NOT_FIRST",
  "LATEST_EVALUATION_",
  "trust-phase8i4g-first-real-canary-closure-pack-v1",
  "FIRST_REAL_CANARY_CLOSED_PASS",
  "FIRST_REAL_CANARY_HALTED_REVIEW_REQUIRED",
  "nextGroupedConfirmationAllowed",
]) {
  assert.ok(adminService.includes(required), `admin service missing: ${required}`);
}

for (const forbiddenTable of [
  '"trust_official_source_transport_drift_evaluations"',
  '"trust_official_source_transport_drift_cases"',
  '"trust_official_source_transport_drift_case_incidents"',
]) {
  assert.equal(
    adminService.includes(forbiddenTable),
    false,
    `Admin grouped relocation must use governed drift RPCs, not direct table reads: ${forbiddenTable}`,
  );
}

for (const required of [
  "confirmArmed",
  "첫 Real Canary 최종 확인 단계 열기",
  "첫 Real Canary Relocation 확정 + 검증 실행",
  "Source relocation만 수행합니다",
  "Closure pack",
  "Next grouped confirmation",
]) {
  assert.ok(workbench.includes(required), `workbench missing: ${required}`);
}

console.log(
  JSON.stringify(
    {
      contract: "trust-phase8i4g-canary-activation-verification-v1",
      result: "PASS",
      scheduled_signal: "READ_ONLY",
      stale_candidate: "HOLD",
      explicit_human_confirmation: true,
      closure_pack_bounded: true,
      automatic_confirmation: false,
    },
    null,
    2,
  ),
);
