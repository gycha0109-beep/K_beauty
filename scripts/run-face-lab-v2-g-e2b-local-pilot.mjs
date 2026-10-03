#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  spawnSync
} from "node:child_process";
import {
  fileURLToPath
} from "node:url";
import dotenv from "dotenv";

const ENV_FILE =
  path.resolve(
    process.cwd(),
    ".env.local"
  );

const REQUIRED_SECRETS =
  Object.freeze([
    "FACE_LAB_E2E_EMAIL_A",
    "FACE_LAB_E2E_PASSWORD_A",
    "FACE_LAB_E2E_EMAIL_B",
    "FACE_LAB_E2E_PASSWORD_B"
  ]);

async function loadLocalEnv() {
  const exists =
    await fs.access(
      ENV_FILE
    )
      .then(() => true)
      .catch(() => false);

  if (exists) {
    dotenv.config({
      path:
        ENV_FILE,
      override:
        false,
      quiet:
        true
    });
  }

  const missing =
    REQUIRED_SECRETS
      .filter(
        (name) =>
          !String(
            process.env[name] ||
              ""
          )
            .trim()
      );

  if (missing.length) {
    throw new Error(
      "missing_face_lab_local_e2e_secrets:" +
        missing.join(",")
    );
  }
}

async function newestCompletedCampaign(
  root
) {
  const entries =
    await fs.readdir(
      root,
      {
        withFileTypes:
          true
      }
    );

  const candidates =
    [];

  for (
    const entry of
    entries
  ) {
    if (
      !entry
        .isDirectory()
    ) {
      continue;
    }

    const directory =
      path.join(
        root,
        entry.name
      );
    const manifestPath =
      path.join(
        directory,
        "manifest.json"
      );

    const stat =
      await fs.stat(
        manifestPath
      )
        .catch(
          () => null
        );

    if (!stat) {
      continue;
    }

    const manifest =
      JSON.parse(
        await fs.readFile(
          manifestPath,
          "utf8"
        )
      );

    if (
      manifest
        .schemaVersion !==
          "face-lab-g-e2b-provider-pilot-e2e-v1" ||
      manifest.status !==
        "complete" ||
      manifest.caseCount !==
        8
    ) {
      continue;
    }

    candidates.push({
      directory,
      manifest,
      mtimeMs:
        stat.mtimeMs
    });
  }

  candidates.sort(
    (left, right) =>
      right.mtimeMs -
      left.mtimeMs
  );

  return candidates[0] ||
    null;
}

await loadLocalEnv();

const runnerPath =
  fileURLToPath(
    new URL(
      "./run-face-lab-v2-simulation-provider-pilot-e2e.mjs",
      import.meta.url
    )
  );

const child =
  spawnSync(
    process.execPath,
    [runnerPath],
    {
      stdio:
        "inherit",
      env: {
        ...process.env,
        CI:
          "",
        FACE_LAB_E2E_INTENTS:
          "4",
        FACE_LAB_E2E_GENERATIONS:
          "2",
        FACE_LAB_E2E_PERSIST_OUTPUTS:
          "1",
        FACE_LAB_E2E_MAX_OUTPUTS:
          "8",
        FACE_LAB_E2E_LIVE_APPROVAL:
          "I_ACCEPT_OPENAI_IMAGE_COST",
        FACE_LAB_E2E_BOOTSTRAP_USERS:
          "1"
      }
    }
  );

if (
  child.error
) {
  throw child.error;
}

if (
  child.status !== 0
) {
  process.exitCode =
    child.status || 1;
} else {
  const campaignRoot =
    path.resolve(
      process.cwd(),
      "private",
      "face-lab-g-e2b"
    );
  const latest =
    await newestCompletedCampaign(
      campaignRoot
    );

  if (!latest) {
    throw new Error(
      "completed_private_campaign_not_found"
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        verdict:
          "FACE_LAB_G_E2B_LOCAL_PILOT_READY_FOR_HUMAN_REVIEW",
        campaignId:
          latest.manifest
            .campaignId,
        caseCount:
          latest.manifest
            .caseCount,
        campaignDirectory:
          path.relative(
            process.cwd(),
            latest.directory
          ),
        reviewBoardUrl:
          "http://localhost:3001/face-lab-test/pilot-review",
        nextCommands: [
          "npm run dev",
          "open the review board URL and select the campaign directory"
        ]
      },
      null,
      2
    )
  );
}
