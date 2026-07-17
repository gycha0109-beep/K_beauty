import assert from "node:assert/strict";
import {
  FAILURE_CATEGORIES,
  JourneyFailure,
  countDuplicateSourceTuples,
  hashIdentifier,
  normalizeBaseUrl,
  resolveConflictBody,
  validateEnvironmentGuard
} from "./premium-browser-journey-core.mjs";

const baseUrl = normalizeBaseUrl("https://preview.example.test");
validateEnvironmentGuard({
  baseUrl,
  environment: "preview",
  expectedHost: "preview.example.test",
  expectedSha: "a".repeat(40),
  deploymentSha: "a".repeat(40),
  productionConfirmation: ""
});

assert.throws(
  () => validateEnvironmentGuard({
    baseUrl,
    environment: "preview",
    expectedHost: "wrong.example.test",
    expectedSha: "a".repeat(40),
    deploymentSha: "a".repeat(40),
    productionConfirmation: ""
  }),
  (error) => error instanceof JourneyFailure && error.code === "unexpected_target_host"
);

assert.throws(
  () => validateEnvironmentGuard({
    baseUrl,
    environment: "preview",
    expectedHost: "preview.example.test",
    expectedSha: "a".repeat(40),
    deploymentSha: "b".repeat(40),
    productionConfirmation: ""
  }),
  (error) => error instanceof JourneyFailure && error.code === "deployment_sha_mismatch"
);

assert.throws(
  () => validateEnvironmentGuard({
    baseUrl,
    environment: "production",
    expectedHost: "preview.example.test",
    expectedSha: "a".repeat(40),
    deploymentSha: "a".repeat(40),
    productionConfirmation: ""
  }),
  (error) => error instanceof JourneyFailure && error.code === "production_execution_not_confirmed"
);

assert.match(hashIdentifier("user-1"), /^sha256:[0-9a-f]{64}$/);
assert.deepEqual(
  resolveConflictBody({ ko: { currentProducts: [{ status: "not_using", category: "sunscreen" }] } }, "ko"),
  { currentProducts: [{ status: "not_using", category: "sunscreen" }], locale: "ko" }
);
assert.throws(
  () => resolveConflictBody({ accessToken: "forbidden" }, "ko"),
  (error) => error instanceof JourneyFailure && error.category === FAILURE_CATEGORIES.PRECONDITION
);
assert.equal(countDuplicateSourceTuples([
  { report_type: "premium", source_type: "premium_report_session", source_session_id: "a" },
  { report_type: "premium", source_type: "premium_report_session", source_session_id: "a" },
  { report_type: "premium", source_type: "premium_report_session", source_session_id: "b" }
]), 1);
assert.equal(countDuplicateSourceTuples([]), 0);

console.log("premium browser journey contract verification passed");
