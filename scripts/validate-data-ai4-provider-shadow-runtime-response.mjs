#!/usr/bin/env node

import fs from "node:fs";

const [file, expectedSha, httpStatus, expectedScenario] = process.argv.slice(2);

if (!file || !expectedSha || !httpStatus || !expectedScenario) {
  console.error("DATA_AI4_RUNTIME_VALIDATOR_ARGS_INVALID");
  process.exit(64);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {
  console.error("DATA_AI4_RUNTIME_RESPONSE_INVALID_JSON");
  process.exit(65);
}

const safe = {
  result: payload.result || null,
  deploymentSha: payload.deploymentSha || null,
  deploymentRef: payload.deploymentRef || null,
  contractVersion: payload.contractVersion || null,
  scenarioId: payload.scenarioId || null,
  querySha256: payload.querySha256 || null,
  provider: payload.provider || null,
  model: payload.model || null,
  intent: payload.intent || null,
  execution: payload.execution || null,
  scenarioPass: payload.scenarioPass ?? null,
  failures: payload.failures || null,
  persisted: payload.persisted ?? null,
  secretValueExposed: payload.secretValueExposed ?? null,
  queryTextExposed: payload.queryTextExposed ?? null,
  productionWrite: payload.productionWrite ?? null,
  recommendationLogWrite: payload.recommendationLogWrite ?? null,
  publicActivation: payload.publicActivation ?? null
};
console.log(`DATA_AI4_RUNTIME_EVIDENCE=${JSON.stringify(safe)}`);

if (httpStatus !== "200") process.exit(1);
if (payload.deploymentSha !== expectedSha || payload.deploymentRef !== "main") process.exit(2);
if (payload.result !== "PASS" || payload.scenarioPass !== true) process.exit(3);
if (payload.contractVersion !== "product-query-provider-shadow-v1") process.exit(4);
if (payload.scenarioId !== expectedScenario) process.exit(5);
if (payload.provider !== "openai") process.exit(6);
if (typeof payload.model !== "string" || !payload.model) process.exit(7);
if (!/^[0-9a-f]{64}$/.test(String(payload.querySha256 || ""))) process.exit(8);
if (!payload.intent || typeof payload.intent !== "object") process.exit(9);
if (!payload.execution || typeof payload.execution !== "object") process.exit(10);
if (!Number.isInteger(payload.execution.candidateCount) || payload.execution.candidateCount < 1) {
  process.exit(11);
}
if (payload.persisted !== false) process.exit(12);
if (payload.secretValueExposed !== false || payload.queryTextExposed !== false) process.exit(13);
if (payload.productionWrite !== false || payload.recommendationLogWrite !== false) process.exit(14);
if (payload.publicActivation !== false) process.exit(15);
if (!Array.isArray(payload.failures) || payload.failures.length !== 0) process.exit(16);

if (expectedScenario === "ko_category_only_cleanser") {
  if (payload.execution.status !== "insufficient_supported_intent") process.exit(17);
  if (payload.execution.resultCount !== 0) process.exit(18);
} else if (payload.execution.status !== "ranked" || payload.execution.resultCount < 1) {
  process.exit(19);
}

if (expectedScenario === "ko_acne_treatment_pregnancy_unresolved") {
  if (payload.execution.constraintStatus !== "partial") process.exit(20);
  if (
    !Array.isArray(payload.execution.unresolvedTerms) ||
    payload.execution.unresolvedTerms.length < 1
  ) {
    process.exit(21);
  }
}

console.log(`DATA_AI4_RUNTIME_VALIDATOR_PASS=${expectedScenario}`);
