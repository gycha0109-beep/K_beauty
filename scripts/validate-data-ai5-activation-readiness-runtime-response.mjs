#!/usr/bin/env node

import fs from "node:fs";

const [file, expectedSha, httpStatus, expectedCaseId, repeatOrdinal] =
  process.argv.slice(2);

if (!file || !expectedSha || !httpStatus || !expectedCaseId || !repeatOrdinal) {
  console.error("DATA_AI5_RUNTIME_VALIDATOR_ARGS_INVALID");
  process.exit(64);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {
  console.error("DATA_AI5_RUNTIME_RESPONSE_INVALID_JSON");
  process.exit(65);
}

const safe = {
  result: payload.result || null,
  failureClass: payload.failureClass ?? null,
  deploymentSha: payload.deploymentSha || null,
  deploymentRef: payload.deploymentRef || null,
  contractVersion: payload.contractVersion || null,
  caseId: payload.caseId || null,
  family: payload.family || null,
  querySha256: payload.querySha256 || null,
  provider: payload.provider || null,
  model: payload.model || null,
  latencyMs: payload.latencyMs ?? null,
  intent: payload.intent || null,
  execution: payload.execution || null,
  casePass: payload.casePass ?? null,
  failures: payload.failures || null,
  persisted: payload.persisted ?? null,
  secretValueExposed: payload.secretValueExposed ?? null,
  queryTextExposed: payload.queryTextExposed ?? null,
  productionWrite: payload.productionWrite ?? null,
  recommendationLogWrite: payload.recommendationLogWrite ?? null,
  publicActivation: payload.publicActivation ?? null,
  repeatOrdinal
};
console.log(`DATA_AI5_RUNTIME_EVIDENCE=${JSON.stringify(safe)}`);

if (httpStatus !== "200") process.exit(1);
if (payload.deploymentSha !== expectedSha || payload.deploymentRef !== "main") process.exit(2);
if (payload.result !== "PASS" || payload.casePass !== true) process.exit(3);
if (payload.failureClass !== null) process.exit(4);
if (payload.contractVersion !== "product-query-activation-readiness-v1") process.exit(5);
if (payload.caseId !== expectedCaseId) process.exit(6);
if (payload.provider !== "openai") process.exit(7);
if (typeof payload.model !== "string" || !payload.model) process.exit(8);
if (!/^[0-9a-f]{64}$/.test(String(payload.querySha256 || ""))) process.exit(9);
if (!Number.isInteger(payload.latencyMs) || payload.latencyMs < 0) process.exit(10);
if (!payload.intent || typeof payload.intent !== "object") process.exit(11);
if (!payload.execution || typeof payload.execution !== "object") process.exit(12);
if (!Number.isInteger(payload.execution.candidateCount) || payload.execution.candidateCount < 1) {
  process.exit(13);
}
if (payload.persisted !== false) process.exit(14);
if (payload.secretValueExposed !== false || payload.queryTextExposed !== false) process.exit(15);
if (payload.productionWrite !== false || payload.recommendationLogWrite !== false) process.exit(16);
if (payload.publicActivation !== false) process.exit(17);
if (!Array.isArray(payload.failures) || payload.failures.length !== 0) process.exit(18);

console.log(`DATA_AI5_RUNTIME_VALIDATOR_PASS=${expectedCaseId}:repeat_${repeatOrdinal}`);
