import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";

const source =
  readFileSync(
    "scripts/run-face-lab-v2-g-e3-local-wave.mjs",
    "utf8"
  );
const provider =
  readFileSync(
    "scripts/run-face-lab-v2-simulation-provider-pilot-e2e.mjs",
    "utf8"
  );

for (const required of [
  '".env.local"',
  '"FACE_LAB_E2E_EMAIL_A"',
  '"FACE_LAB_E2E_PASSWORD_A"',
  '"FACE_LAB_E2E_EMAIL_B"',
  '"FACE_LAB_E2E_PASSWORD_B"',
  "FACE_LAB_E2E_INTENT_OFFSET",
  "FACE_LAB_E2E_CAMPAIGN_ROOT",
  "FACE_LAB_E2E_CALIBRATION_STAGE",
  "FACE_LAB_E2E_WAVE_ID",
  '"face-lab-g-e3"',
  '"G-E3"',
  "current-campaign.json",
  "g_e3_campaign_runtime_binding_mismatch_",
  "g_e3_source_binding_mismatch",
  "FACE_LAB_G_E3_WAVE_READY_FOR_HUMAN_REVIEW"
]) {
  assert.ok(
    source.includes(
      required
    ),
    "missing G-E3 wave launcher marker: " +
      required
  );
}

assert.ok(
  provider.includes(
    'parseBoundedInt("FACE_LAB_E2E_INTENT_OFFSET", 0, 0, 11)'
  )
);
assert.ok(
  provider.includes(
    "intentOffset + intentCount > 12"
  )
);
assert.ok(
  provider.includes(
    '["face-lab-g-e2b", "face-lab-g-e3"]'
  )
);
assert.ok(
  provider.includes(
    '["G-E2B", "G-E3"]'
  )
);
assert.ok(
  provider.includes(
    "globalIndex + 1"
  )
);

for (const forbidden of [
  "console.log(credentials",
  "console.log(accountA.accessToken",
  "console.log(accountB.accessToken"
]) {
  assert.equal(
    source.includes(
      forbidden
    ),
    false
  );
}

console.log(
  "FACE_LAB_G_E3_LOCAL_WAVE_LAUNCHER=PASS"
);
