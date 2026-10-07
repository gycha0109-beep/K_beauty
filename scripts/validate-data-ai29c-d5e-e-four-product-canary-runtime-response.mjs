#!/usr/bin/env node

import fs from "node:fs";

const [
  file,
  expectedSha,
  httpStatus,
  expectedCaseId,
  repeatOrdinal,
] = process.argv.slice(2);

if (
  !file ||
  !expectedSha ||
  !httpStatus ||
  !expectedCaseId ||
  !repeatOrdinal
) {
  console.error("DATA_AI29C_D5E_E_RUNTIME_VALIDATOR_ARGS_INVALID");
  process.exit(64);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {
  console.error("DATA_AI29C_D5E_E_RUNTIME_RESPONSE_INVALID_JSON");
  process.exit(65);
}

const safe = {
  result: payload.result || null,
  failureClass: payload.failureClass ?? null,
  deploymentSha: payload.deploymentSha || null,
  deploymentRef: payload.deploymentRef || null,
  contractVersion: payload.contractVersion || null,
  caseId: payload.caseId || null,
  currentProductionSunscreenCount:
    payload.currentProductionSunscreenCount ?? null,
  canaryTargetCount: payload.canaryTargetCount ?? null,
  canaryGrantedCount: payload.canaryGrantedCount ?? null,
  combinedSunscreenCount: payload.combinedSunscreenCount ?? null,
  legacySpfEligibleCount: payload.legacySpfEligibleCount ?? null,
  execution: payload.execution || null,
  rollbackReady: payload.rollbackReady ?? null,
  casePass: payload.casePass ?? null,
  failures: payload.failures || null,
  persisted: payload.persisted ?? null,
  secretValueExposed: payload.secretValueExposed ?? null,
  queryTextExposed: payload.queryTextExposed ?? null,
  productionWrite: payload.productionWrite ?? null,
  recommendationLogWrite:
    payload.recommendationLogWrite ?? null,
  publicActivation: payload.publicActivation ?? null,
  repeatOrdinal,
};
console.log(
  `DATA_AI29C_D5E_E_RUNTIME_EVIDENCE=${JSON.stringify(safe)}`,
);

if (httpStatus !== "200") process.exit(1);
if (
  payload.deploymentSha !== expectedSha ||
  payload.deploymentRef !== "main"
) {
  process.exit(2);
}
if (payload.result !== "PASS" || payload.casePass !== true) {
  process.exit(3);
}
if (payload.failureClass !== null) process.exit(4);
if (
  payload.contractVersion !==
  "data-ai29c-d5e-e-four-product-internal-canary-v1"
) {
  process.exit(5);
}
if (payload.caseId !== expectedCaseId) process.exit(6);
if (payload.currentProductionSunscreenCount !== 11) process.exit(7);
if (payload.canaryTargetCount !== 4) process.exit(8);
if (payload.canaryGrantedCount !== 4) process.exit(9);
if (payload.combinedSunscreenCount !== 15) process.exit(10);
if (payload.legacySpfEligibleCount !== 11) process.exit(11);
if (!Array.isArray(payload.canaryAdmission)) process.exit(12);
if (
  payload.canaryAdmission.length !== 4 ||
  payload.canaryAdmission.some(
    (row) =>
      row?.authorityResolved !== true ||
      row?.grant !== true ||
      row?.decision !== "SUNSCREEN_INITIAL_ADMISSION_GRANT",
  )
) {
  process.exit(13);
}
if (!payload.execution || typeof payload.execution !== "object") {
  process.exit(14);
}
if (payload.execution.candidateCount !== 15) process.exit(15);
if (
  payload.persisted !== false ||
  payload.secretValueExposed !== false ||
  payload.queryTextExposed !== false
) {
  process.exit(16);
}
if (
  payload.productionWrite !== false ||
  payload.recommendationLogWrite !== false ||
  payload.publicActivation !== false
) {
  process.exit(17);
}
if (
  !Array.isArray(payload.failures) ||
  payload.failures.length !== 0
) {
  process.exit(18);
}

const gate = payload.execution.gate || {};
if (expectedCaseId === "outdoor_spf_on") {
  if (payload.execution.status !== "ranked") process.exit(19);
  if (gate.axisApplied !== true) process.exit(20);
  if (gate.authorityComplete !== true) process.exit(21);
  if (gate.adjustments?.length !== 15) process.exit(22);
  if (
    !Array.isArray(payload.execution.rankableSignals) ||
    !payload.execution.rankableSignals.includes("outdoor_exposure")
  ) {
    process.exit(23);
  }

  const deltaById = new Map(
    (gate.adjustments || []).map((row) => [
      row.productId,
      row.spfDelta,
    ]),
  );
  if (
    deltaById.get("a6994fcd-302f-4e63-acbe-91a3f17a5a65") !== 2 ||
    deltaById.get("b90bf992-07ae-4f49-a3a4-d90ea6d4a858") !== 4 ||
    deltaById.get("7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17") !== 4 ||
    deltaById.get("888eca86-af25-4a12-b9ea-47922d83f520") !== 6
  ) {
    process.exit(24);
  }
} else if (expectedCaseId === "rollback_off") {
  if (
    payload.execution.status !==
    "insufficient_supported_intent"
  ) {
    process.exit(25);
  }
  if (payload.execution.resultCount !== 0) process.exit(26);
  if (
    !Array.isArray(payload.execution.rankableSignals) ||
    payload.execution.rankableSignals.length !== 0
  ) {
    process.exit(27);
  }
  if (payload.rollbackReady !== true) process.exit(28);
} else if (expectedCaseId === "non_outdoor_control") {
  if (payload.execution.status !== "ranked") process.exit(29);
  if (gate.axisApplied === true) process.exit(30);
  if (
    Array.isArray(payload.execution.rankableSignals) &&
    payload.execution.rankableSignals.includes("outdoor_exposure")
  ) {
    process.exit(31);
  }
} else {
  process.exit(32);
}

console.log(
  `DATA_AI29C_D5E_E_RUNTIME_VALIDATOR_PASS=${expectedCaseId}:repeat_${repeatOrdinal}`,
);
