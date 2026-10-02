import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";

const wrapper =
  readFileSync(
    "scripts/run-face-lab-v2-g-e3-private-wave.mjs",
    "utf8"
  );
const batch =
  readFileSync(
    "scripts/run-face-lab-v2-g-e2b-private-campaign.mjs",
    "utf8"
  );

for (const required of [
  "FACE_LAB_PRIVATE_CAMPAIGN_MODE",
  '"G-E3_WAVE"',
  "run-face-lab-v2-g-e2b-private-campaign.mjs"
]) {
  assert.ok(
    wrapper.includes(
      required
    )
  );
}

for (const required of [
  '"G-E3_WAVE"',
  "g_e3_wave_manifest_invalid",
  "face-lab-g-e3-wave-closeout-v1",
  "wave.closeout.json",
  "FACE_LAB_G_E3_WAVE_CLOSEOUT_READY",
  "FACE_LAB_G_E3_WAVE_HARD_FAILURE_STOP",
  "G-E3_FULL_AGGREGATE",
  "G-E3_NEXT_WAVE",
  "G-E3_FAILURE_ATTRIBUTION"
]) {
  assert.ok(
    batch.includes(
      required
    ),
    "missing G-E3 wave closeout marker: " +
      required
  );
}

assert.equal(
  batch.includes("fetch("),
  false
);

console.log(
  "FACE_LAB_G_E3_PRIVATE_WAVE_CLOSEOUT=PASS"
);
