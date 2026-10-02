#!/usr/bin/env node

import {
  spawnSync
} from "node:child_process";
import {
  fileURLToPath
} from "node:url";

const campaignDirectory =
  process.argv[2];

if (!campaignDirectory) {
  throw new Error(
    "provide_g_e3_wave_campaign_directory"
  );
}

const runnerPath =
  fileURLToPath(
    new URL(
      "./run-face-lab-v2-g-e2b-private-campaign.mjs",
      import.meta.url
    )
  );

const child =
  spawnSync(
    process.execPath,
    [
      runnerPath,
      campaignDirectory
    ],
    {
      stdio:
        "inherit",
      env: {
        ...process.env,
        FACE_LAB_PRIVATE_CAMPAIGN_MODE:
          "G-E3_WAVE"
      }
    }
  );

if (child.error) {
  throw child.error;
}

if (child.status !== 0) {
  process.exitCode =
    child.status || 1;
}
