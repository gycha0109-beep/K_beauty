import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";

const source =
  readFileSync(
    "scripts/run-face-lab-v2-g-e2b-local-pilot.mjs",
    "utf8"
  );

for (
  const required of
  [
    '".env.local"',
    '"FACE_LAB_E2E_EMAIL_A"',
    '"FACE_LAB_E2E_PASSWORD_A"',
    '"FACE_LAB_E2E_EMAIL_B"',
    '"FACE_LAB_E2E_PASSWORD_B"',
    'FACE_LAB_E2E_INTENTS:',
    '"4"',
    'FACE_LAB_E2E_GENERATIONS:',
    '"2"',
    'FACE_LAB_E2E_PERSIST_OUTPUTS:',
    '"1"',
    'FACE_LAB_E2E_BOOTSTRAP_USERS:',
    '"1"',
    "run-face-lab-v2-simulation-provider-pilot-e2e.mjs",
    "private",
    "face-lab-g-e2b",
    "manifest.json",
    "FACE_LAB_G_E2B_LOCAL_PILOT_READY_FOR_HUMAN_REVIEW",
    "http://localhost:3001/face-lab-test/pilot-review"
  ]
) {
  assert.ok(
    source.includes(
      required
    ),
    `local pilot launcher missing contract fragment: ${required}`
  );
}

for (
  const forbidden of
  [
    "console.log(process.env",
    "console.log(REQUIRED_SECRETS",
    "FACE_LAB_E2E_PASSWORD_A:",
    "FACE_LAB_E2E_PASSWORD_B:"
  ]
) {
  assert.equal(
    source.includes(
      forbidden
    ),
    false,
    `local pilot launcher must not print or hard-code credentials: ${forbidden}`
  );
}

assert.ok(
  source.includes(
    "spawnSync"
  ),
  "local pilot launcher must delegate to the canonical provider runner"
);

console.log(
  "FACE_LAB_G_E2B_LOCAL_LAUNCHER=PASS"
);
