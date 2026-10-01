#!/usr/bin/env node

import fs from "node:fs";

const TRANSIENT_FAILURE_CLASSES = new Set([
  "PRODUCT_QUERY_AI_TRANSIENT_PROVIDER_FAILURE",
  "PRODUCT_QUERY_AI_REQUEST_FAILED",
  "PRODUCT_QUERY_AI_TIMEOUT"
]);

const NONRETRYABLE_PROVIDER_FAILURE_CLASSES = new Set([
  "PRODUCT_QUERY_AI_PROVIDER_REJECTED",
  "PRODUCT_QUERY_AI_UNAVAILABLE"
]);

const [file, expectedSha, httpStatus, expectedScenario, expectedBudget] =
  process.argv.slice(2);

if (!file || !expectedSha || !httpStatus || !expectedScenario || !expectedBudget) {
  console.error("DATA_AI28_BUDGET_PROBE_ARGS_INVALID");
  process.exit(64);
}

const isDefaultBudget = expectedBudget === "default";
const budget = isDefaultBudget ? null : Number(expectedBudget);
if (!isDefaultBudget && ![400, 600, 800].includes(budget)) {
  console.error("DATA_AI28_BUDGET_PROBE_BUDGET_INVALID");
  process.exit(65);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {
  console.error("DATA_AI28_BUDGET_PROBE_RESPONSE_INVALID_JSON");
  process.exit(66);
}

if (
  payload.deploymentSha !== expectedSha ||
  payload.deploymentRef !== "main" ||
  payload.scenarioId !== expectedScenario ||
  (isDefaultBudget
    ? payload.outputBudget !== null
    : payload.outputBudget !== budget)
) {
  console.error("DATA_AI28_BUDGET_PROBE_SCOPE_MISMATCH");
  process.exit(67);
}

if (
  payload.secretValueExposed !== false ||
  payload.queryTextExposed !== false ||
  payload.productionWrite !== false ||
  payload.recommendationLogWrite !== false ||
  payload.publicActivation !== false ||
  !Number.isInteger(payload.providerAttempts) ||
  payload.providerAttempts < 1 ||
  payload.providerAttempts > 2 ||
  payload.providerRetryUsed !== (payload.providerAttempts > 1)
) {
  console.error("DATA_AI28_BUDGET_PROBE_SAFETY_BOUNDARY_FAILED");
  process.exit(68);
}

if (httpStatus === "200") {
  if (
    payload.result !== "PASS" ||
    payload.scenarioPass !== true ||
    payload.provider !== "openai" ||
    typeof payload.model !== "string" ||
    !payload.model
  ) {
    console.error("DATA_AI28_BUDGET_PROBE_SUCCESS_CONTRACT_INVALID");
    process.exit(69);
  }

  process.stdout.write(
    payload.providerRetryUsed ? "completed_retried" : "completed"
  );
  process.exit(0);
}

if (payload.result !== "FAIL_CLOSED") {
  console.error("DATA_AI28_BUDGET_PROBE_FAILURE_NOT_CLOSED");
  process.exit(70);
}

const failureClass = String(payload.providerResultClass || "");
const protocolKind = String(payload.protocolFailureKind || "");

if (
  failureClass === "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE" &&
  protocolKind === "incomplete"
) {
  const incompleteReason = String(payload.incompleteReason || "unknown");
  if (
    !["max_output_tokens", "content_filter", "other", "unknown"].includes(
      incompleteReason
    )
  ) {
    console.error("DATA_AI28_BUDGET_PROBE_INCOMPLETE_REASON_INVALID");
    process.exit(71);
  }
  process.stdout.write("incomplete");
  process.exit(0);
}

if (
  failureClass === "PRODUCT_QUERY_AI_SCHEMA_REJECTED" &&
  protocolKind === "schema_rejected"
) {
  process.stdout.write("schema_rejected");
  process.exit(0);
}

if (
  failureClass === "PRODUCT_QUERY_AI_RESPONSE_INVALID" &&
  protocolKind === "invalid_output"
) {
  process.stdout.write("invalid_output");
  process.exit(0);
}

if (
  failureClass === "PRODUCT_QUERY_AI_REFUSED" &&
  protocolKind === "refusal"
) {
  process.stdout.write("refusal");
  process.exit(0);
}

if (TRANSIENT_FAILURE_CLASSES.has(failureClass)) {
  if (
    payload.providerAttempts !== 2 ||
    payload.providerRetryUsed !== true
  ) {
    console.error(
      `DATA_AI28E_TRANSIENT_RETRY_CONTRACT_VIOLATION=${failureClass}:providerAttempts=${payload.providerAttempts}`
    );
    process.stdout.write("other_failure");
    process.exit(0);
  }

  console.error(
    `DATA_AI28E_TRANSIENT_EXHAUSTED=${failureClass}:providerAttempts=${payload.providerAttempts}`
  );
  process.stdout.write("transient_exhausted");
  process.exit(0);
}

if (NONRETRYABLE_PROVIDER_FAILURE_CLASSES.has(failureClass)) {
  if (
    payload.providerAttempts !== 1 ||
    payload.providerRetryUsed !== false
  ) {
    console.error(
      `DATA_AI28E_NONRETRYABLE_CONTRACT_VIOLATION=${failureClass}:providerAttempts=${payload.providerAttempts}`
    );
    process.stdout.write("other_failure");
    process.exit(0);
  }

  console.error(
    `DATA_AI28E_NONRETRYABLE_PROVIDER_FAILURE=${failureClass}:providerAttempts=${payload.providerAttempts}`
  );
  process.stdout.write("nonretryable_provider_failure");
  process.exit(0);
}

console.error(
  `DATA_AI28E_UNKNOWN_FAILURE=${failureClass || "missing"}:providerAttempts=${payload.providerAttempts}`
);
process.stdout.write("other_failure");
