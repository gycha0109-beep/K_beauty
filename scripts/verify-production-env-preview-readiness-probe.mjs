import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PRODUCTION_ENV_PREVIEW_READINESS_PROBE_BRANCH,
  PRODUCTION_ENV_PREVIEW_READINESS_PROBE_FLAG,
  PRODUCTION_ENV_PREVIEW_READINESS_RESPONSE_FIELDS,
  executeProductionEnvPreviewReadinessProbe
} from "../lib/production-env-preview-readiness-probe.js";

const secret = (byte) => Buffer.alloc(32, byte).toString("base64url");
const analysisSecret = secret(1);
const grantSecret = secret(2);
const previewEnv = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: PRODUCTION_ENV_PREVIEW_READINESS_PROBE_BRANCH,
  [PRODUCTION_ENV_PREVIEW_READINESS_PROBE_FLAG]: "1",
  ANALYSIS_REQUEST_GUARD_SECRET: analysisSecret,
  ANONYMOUS_WRITE_GRANT_SECRET: grantSecret,
  WRITE_ACCESS_TOKEN_SECRET: secret(3),
  SUPABASE_SERVICE_ROLE_KEY: secret(4),
  OPENAI_API_KEY: secret(5),
  PREMIUM_RELEASE_MODE: "beta_open"
};

const ready = executeProductionEnvPreviewReadinessProbe(previewEnv);
assert.equal(ready.status, 200);
assert.equal(ready.response.ready, true);
assert.deepEqual(ready.response.stopReasons, []);
assert.deepEqual(Object.keys(ready.response), PRODUCTION_ENV_PREVIEW_READINESS_RESPONSE_FIELDS);

const invalidCases = [
  ["missing analysis secret", { ANALYSIS_REQUEST_GUARD_SECRET: undefined }, "analysisRequestGuardSecretConfigured"],
  ["missing grant secret", { ANONYMOUS_WRITE_GRANT_SECRET: "" }, "anonymousWriteGrantSecretConfigured"],
  ["invalid analysis format", { ANALYSIS_REQUEST_GUARD_SECRET: "not+base64url" }, "analysisRequestGuardSecretFormatValid"],
  ["short grant secret", { ANONYMOUS_WRITE_GRANT_SECRET: Buffer.alloc(31, 6).toString("base64url") }, "anonymousWriteGrantSecretFormatValid"],
  ["same secrets", { ANONYMOUS_WRITE_GRANT_SECRET: analysisSecret }, "secretsDistinct"],
  ["existing secret reuse", { WRITE_ACCESS_TOKEN_SECRET: analysisSecret }, "secretsIndependentFromExistingSecrets"],
  ["premium mode mismatch", { PREMIUM_RELEASE_MODE: "coming_soon" }, "premiumReleaseModeBetaOpen"]
];

for (const [label, override, reason] of invalidCases) {
  const result = executeProductionEnvPreviewReadinessProbe({ ...previewEnv, ...override });
  assert.equal(result.status, 200, label);
  assert.equal(result.response.ready, false, label);
  assert(result.response.stopReasons.includes(reason), label);
}

const deniedEnvironments = [
  { ...previewEnv, VERCEL_ENV: "production" },
  { ...previewEnv, VERCEL_GIT_COMMIT_REF: "main" },
  { ...previewEnv, VERCEL_GIT_COMMIT_REF: "another-preview-branch" },
  { ...previewEnv, [PRODUCTION_ENV_PREVIEW_READINESS_PROBE_FLAG]: "0" },
  { ...previewEnv, [PRODUCTION_ENV_PREVIEW_READINESS_PROBE_FLAG]: undefined }
];
for (const envLike of deniedEnvironments) {
  assert.deepEqual(executeProductionEnvPreviewReadinessProbe(envLike), { allowed: false, status: 404 });
}

const serialized = JSON.stringify(ready.response);
for (const value of Object.values(previewEnv)) {
  if (typeof value === "string" && value.length >= 32) assert.equal(serialized.includes(value), false);
}
for (const forbiddenField of ["length", "hash", "prefix", "suffix", "value", "raw", "token", "key"] ) {
  assert.equal(Object.keys(ready.response).some((field) => field.toLowerCase().includes(forbiddenField)), false);
}

const routeSource = await readFile(
  new URL("../app/api/internal/production-env-preview-readiness-probe/route.js", import.meta.url),
  "utf8"
);
const helperSource = await readFile(
  new URL("../lib/production-env-preview-readiness-probe.js", import.meta.url),
  "utf8"
);
for (const source of [routeSource, helperSource]) {
  assert.doesNotMatch(
    source,
    /console\.|\bfetch\s*\(|createClient\s*\(|from\s+["'][^"']*supabase|storage\s*\.|\.rpc\s*\(|\/api\/(?:analyze|face-reading|results|track)/i
  );
}

console.log("verify-production-env-preview-readiness-probe passed");
