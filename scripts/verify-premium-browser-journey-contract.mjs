import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FAILURE_CATEGORIES,
  JourneyFailure,
  countDuplicateSourceTuples,
  hashIdentifier,
  inspectStorageState,
  normalizeBaseUrl,
  resolveConflictBody,
  scanArtifactDirectoryForSecrets,
  validateEnvironmentGuard,
  writeArtifactSet
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


assert.deepEqual(
  inspectStorageState(
    { cookies: [{ name: "sb-project-auth-token", domain: "preview.example.test", path: "/", secure: true }] },
    "preview.example.test"
  ),
  { authCookieCount: 1, targetHost: "preview.example.test" }
);
assert.throws(
  () => inspectStorageState(
    { cookies: [{ name: "sb-project-auth-token", domain: "other.example.test", path: "/", secure: true }] },
    "preview.example.test"
  ),
  (error) => error instanceof JourneyFailure && error.code === "target_host_cookie_backed_auth_missing"
);
assert.throws(
  () => resolveConflictBody({ ACCESS_TOKEN: "forbidden" }, "ko"),
  (error) => error instanceof JourneyFailure && error.category === FAILURE_CATEGORIES.PRECONDITION
);

const artifactDir = await mkdtemp(join(tmpdir(), "premium-browser-contract-"));
try {
  await writeArtifactSet({
    artifactDir,
    manifest: { runId: "contract-run", targetHost: "preview.example.test" },
    steps: [],
    responses: [{ leaked: "contract-secret-value" }],
    persistence: { createdSavedReportIds: [] },
    verdict: { passed: false },
    summary: "contract"
  });
  await assert.rejects(
    () => scanArtifactDirectoryForSecrets(artifactDir, ["contract-secret-value"]),
    (error) => error instanceof JourneyFailure && error.code === "secret_material_detected_in_artifact"
  );
} finally {
  await rm(artifactDir, { recursive: true, force: true });
}

const runnerSource = readFileSync(new URL("./run-premium-browser-journey.mjs", import.meta.url), "utf8");
const cleanupSource = readFileSync(new URL("./cleanup-premium-browser-journey.mjs", import.meta.url), "utf8");
const coreSource = readFileSync(new URL("./premium-browser-journey-core.mjs", import.meta.url), "utf8");
const suiteSource = readFileSync(new URL("./run-security-closeout-verifier-suite.mjs", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
assert.match(runnerSource, /cookie-auth-boundary/);
assert.match(runnerSource, /responses:\s*\[\]/);
assert.match(runnerSource, /artifact_quarantine_scan_failed/);
assert.match(cleanupSource, /production_cleanup_not_confirmed/);
assert.match(coreSource, /report_type=eq\.premium&source_type=eq\.premium_report_session/);
assert.match(suiteSource, /verify-premium-browser-journey-contract\.mjs/);
assert.equal(
  packageJson.scripts["verify:premium-browser-journey"],
  "node scripts/run-premium-browser-journey.mjs"
);

console.log("premium browser journey contract verification passed");
