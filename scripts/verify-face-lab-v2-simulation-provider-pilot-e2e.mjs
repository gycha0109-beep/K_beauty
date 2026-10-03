import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runner = readFileSync(
  new URL("./run-face-lab-v2-simulation-provider-pilot-e2e.mjs", import.meta.url),
  "utf8"
);

for (const required of [
  "FACE_LAB_E2E_EMAIL_A",
  "FACE_LAB_E2E_PASSWORD_A",
  "FACE_LAB_E2E_EMAIL_B",
  "FACE_LAB_E2E_PASSWORD_B",
  "FACE_LAB_E2E_PERSIST_OUTPUTS",
  "FACE_LAB_E2E_INTENTS",
  "FACE_LAB_E2E_GENERATIONS",
  "FACE_LAB_E2E_MAX_OUTPUTS",
  "FACE_LAB_E2E_LIVE_APPROVAL",
  "I_ACCEPT_OPENAI_IMAGE_COST",
  "face_lab_e2e_output_budget_exceeded_",
  "face-lab-g-e2b",
  "repeat_generation_render_spec_mismatch",
  "campaign_runtime_binding_mismatch",
  "review_provider_binding_mismatch",
  "face_lab_e2e_accounts_must_be_distinct",
  "Idempotency-Key",
  "Bearer",
  "privateRoot",
  "basename(privateRoot) !== \"private\""
]) {
  assert.ok(runner.includes(required), `missing provider pilot E2E contract marker: ${required}`);
}

assert.match(
  runner,
  /parseBoundedInt\("FACE_LAB_E2E_INTENTS",\s*4,\s*1,\s*4\)/
);
assert.match(
  runner,
  /parseBoundedInt\("FACE_LAB_E2E_GENERATIONS",\s*2,\s*1,\s*2\)/
);
assert.ok(
  runner.includes("sequence % 2 === 0 || !accountB ? accountA : accountB"),
  "provider pilot must split generation load across A/B"
);
assert.ok(
  runner.includes("persistOutputs ? outputFile : null"),
  "CI-safe no-output mode missing"
);
assert.ok(
  !runner.includes("console.log(credentials"),
  "credentials must never be logged"
);
assert.ok(
  !runner.includes("console.log(accountA.accessToken") &&
    !runner.includes("console.log(accountB.accessToken"),
  "access tokens must never be logged"
);
assert.ok(
  !runner.includes("shortHash(") && !runner.includes("userHash"),
  "account identifiers must not be hashed or persisted"
);
assert.ok(
  !runner.includes("reviewTicket: simulation.meta.reviewTicket,\n            analysis"),
  "review ticket must not be persisted in review input"
);
assert.ok(
  runner.includes("reviewTicket: simulation.meta.reviewTicket,\n        analysis"),
  "review ticket must only be used for the immediate template request"
);

console.log("Face Lab G-E2B provider pilot E2E contract verification passed.");

const workflow = readFileSync(
  new URL("../.github/workflows/face-lab-v2-provider-pilot-smoke.yml", import.meta.url),
  "utf8"
);

assert.doesNotMatch(
  workflow,
  /\n\s*push:\s*\n/,
  "paid Face Lab provider workflow must not run on push"
);
assert.match(
  workflow,
  /workflow_dispatch:/
);
assert.match(
  workflow,
  /FACE_LAB_E2E_MAX_OUTPUTS/
);
assert.match(
  workflow,
  /I_ACCEPT_OPENAI_IMAGE_COST/
);

const simulationRoute = readFileSync(
  new URL("../app/api/face-lab-simulation-test/route.js", import.meta.url),
  "utf8"
);
const localPilot = readFileSync(
  new URL("./run-face-lab-v2-g-e2b-local-pilot.mjs", import.meta.url),
  "utf8"
);
const localWave = readFileSync(
  new URL("./run-face-lab-v2-g-e3-local-wave.mjs", import.meta.url),
  "utf8"
);

assert.match(
  simulationRoute,
  /FACE_LAB_SIMULATION_TEST_ENABLED/
);
assert.match(
  simulationRoute,
  /process\.env\.NODE_ENV\s*===\s*"production"/
);
assert.match(
  simulationRoute,
  /simulation_test_disabled/
);
assert.match(
  localPilot,
  /http:\/\/localhost:3001/
);
assert.match(
  localWave,
  /http:\/\/localhost:3001/
);
