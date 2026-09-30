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
  console.error("DATA_AI29C_D5D_RUNTIME_VALIDATOR_ARGS_INVALID");
  process.exit(64);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {
  console.error("DATA_AI29C_D5D_RUNTIME_RESPONSE_INVALID_JSON");
  process.exit(65);
}

const safe = {
  result: payload.result || null,
  failureClass: payload.failureClass ?? null,
  deploymentSha: payload.deploymentSha || null,
  deploymentRef: payload.deploymentRef || null,
  version: payload.version || null,
  caseId: payload.caseId || null,
  status: payload.status || null,
  candidateCount: payload.candidateCount ?? null,
  resultCount: payload.resultCount ?? null,
  activation: payload.activation || null,
  gate: payload.gate || null,
  pass: payload.pass ?? null,
  failures: payload.failures || null,
  publicSearchCutover: payload.publicSearchCutover ?? null,
  repeatOrdinal,
};
console.log(
  `DATA_AI29C_D5D_RUNTIME_EVIDENCE=${JSON.stringify(safe)}`,
);

if (httpStatus !== "200") process.exit(1);
if (
  payload.deploymentSha !== expectedSha ||
  payload.deploymentRef !== "main"
) {
  process.exit(2);
}
if (payload.result !== "PASS" || payload.pass !== true) {
  process.exit(3);
}
if (payload.failureClass !== null) process.exit(4);
if (
  payload.version !==
  "data-ai29c-d5d-spf-production-activation-v1"
) {
  process.exit(5);
}
if (payload.caseId !== expectedCaseId) process.exit(6);
if (payload.status !== "ranked") process.exit(7);
if (payload.candidateCount !== 14) process.exit(8);
if (
  !Array.isArray(payload.failures) ||
  payload.failures.length !== 0
) {
  process.exit(9);
}
if (payload.publicSearchCutover !== false) process.exit(10);

const activation = payload.activation || {};
if (activation.switchEnabled !== true) process.exit(11);
if (activation.activated !== true) process.exit(12);
if (activation.fallbackReason !== null) process.exit(13);
if (activation.productionSunscreenCount !== 11) process.exit(14);
if (activation.targetGrantedCount !== 3) process.exit(15);
if (activation.combinedSunscreenCount !== 14) process.exit(16);
if (activation.legacySpfEligibleCount !== 11) process.exit(17);
if (
  !["dedicated", "admission_shadow_fallback"].includes(
    activation.protectionCredentialMode,
  )
) {
  process.exit(18);
}
if (activation.publicSearchCutover !== false) process.exit(19);
if (activation.uvaActivated !== false) process.exit(20);
if (activation.waterResistanceApplied !== false) process.exit(21);

const gate = payload.gate || {};
if (expectedCaseId === "outdoor_live") {
  if (gate.axisApplied !== true) process.exit(22);
  if (gate.authorityComplete !== true) process.exit(23);
  if (gate.adjustmentCount !== 14) process.exit(24);
} else if (expectedCaseId === "non_outdoor_live") {
  if (gate.axisApplied === true) process.exit(25);
} else {
  process.exit(26);
}

const limits = payload.limits || {};
if (
  limits.authenticatedBetaOnly !== true ||
  limits.publicSearchCutover !== false ||
  limits.providerInvoked !== false ||
  limits.rawQueryAccepted !== false ||
  limits.profileRead !== false ||
  limits.historyRead !== false ||
  limits.productionWrite !== false ||
  limits.recommendationLogWrite !== false ||
  limits.uvaActivated !== false ||
  limits.waterResistanceApplied !== false ||
  limits.persistence !== false
) {
  process.exit(27);
}

console.log(
  `DATA_AI29C_D5D_RUNTIME_VALIDATOR_PASS=${expectedCaseId}:repeat_${repeatOrdinal}`,
);
