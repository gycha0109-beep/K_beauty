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

function safeCampaignId(value) {
  const normalized =
    String(value || "")
      .trim();

  return /^[A-Za-z0-9._-]{6,80}$/.test(
    normalized
  )
    ? normalized
    : null;
}

function defaultCampaignId() {
  return (
    "G-E3-CAL-" +
    new Date()
      .toISOString()
      .replace(
        /[-:.TZ]/g,
        ""
      )
      .slice(0, 14)
  );
}

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
    REQUIRED_SECRETS.filter(
      (name) =>
        !String(
          process.env[name] || ""
        ).trim()
    );

  if (missing.length) {
    throw new Error(
      "missing_face_lab_local_e2e_secrets:" +
        missing.join(",")
    );
  }
}

async function readJson(
  filePath
) {
  return JSON.parse(
    await fs.readFile(
      filePath,
      "utf8"
    )
  );
}

async function writeJson(
  filePath,
  value
) {
  await fs.mkdir(
    path.dirname(filePath),
    {
      recursive: true
    }
  );
  await fs.writeFile(
    filePath,
    `${JSON.stringify(
      value,
      null,
      2
    )}\n`,
    "utf8"
  );
}

function assertRuntimeBinding(
  expected,
  actual
) {
  const fields = [
    "simulationVersion",
    "instructionVersion",
    "renderSpecVersion",
    "providerConfigVersion",
    "providerConfigFingerprint"
  ];

  for (const field of fields) {
    if (
      expected?.[field] !==
        actual?.[field]
    ) {
      throw new Error(
        "g_e3_campaign_runtime_binding_mismatch_" +
          field
      );
    }
  }
}

const waveNumber =
  Number(
    process.argv[2]
  );

if (
  !Number.isInteger(
    waveNumber
  ) ||
  waveNumber < 1 ||
  waveNumber > 3
) {
  throw new Error(
    "provide_g_e3_wave_number_1_to_3"
  );
}

await loadLocalEnv();

const campaignRoot =
  path.resolve(
    process.cwd(),
    "private",
    "face-lab-g-e3"
  );
const statePath =
  path.join(
    campaignRoot,
    "current-campaign.json"
  );
const explicitCampaignId =
  safeCampaignId(
    process.argv[3]
  );
const priorState =
  await readJson(
    statePath
  ).catch(
    () => null
  );

let campaignId =
  explicitCampaignId ||
  (
    waveNumber === 1
      ? defaultCampaignId()
      : safeCampaignId(
          priorState
            ?.campaignId
        )
  );

if (!campaignId) {
  throw new Error(
    "g_e3_campaign_id_missing"
  );
}

if (
  priorState &&
  waveNumber > 1 &&
  priorState.campaignId !==
    campaignId
) {
  throw new Error(
    "g_e3_campaign_id_mismatch"
  );
}

const waveId =
  `wave-0${waveNumber}`;
const intentOffset =
  (waveNumber - 1) * 4;
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
        CI: "",
        FACE_LAB_E2E_INTENTS:
          "4",
        FACE_LAB_E2E_INTENT_OFFSET:
          String(
            intentOffset
          ),
        FACE_LAB_E2E_GENERATIONS:
          "2",
        FACE_LAB_E2E_PERSIST_OUTPUTS:
          "1",
        FACE_LAB_E2E_MAX_OUTPUTS:
          "8",
        FACE_LAB_E2E_LIVE_APPROVAL:
          "I_ACCEPT_OPENAI_IMAGE_COST",
        FACE_LAB_E2E_BOOTSTRAP_USERS:
          "1",
        FACE_LAB_E2E_CAMPAIGN_ROOT:
          "face-lab-g-e3",
        FACE_LAB_E2E_CALIBRATION_STAGE:
          "G-E3",
        FACE_LAB_E2E_WAVE_ID:
          waveId,
        FACE_LAB_E2E_CAMPAIGN_ID:
          campaignId
      }
    }
  );

if (child.error) {
  throw child.error;
}

if (child.status !== 0) {
  process.exitCode =
    child.status || 1;
} else {
  const waveDirectory =
    path.join(
      campaignRoot,
      campaignId,
      waveId
    );
  const manifest =
    await readJson(
      path.join(
        waveDirectory,
        "manifest.json"
      )
    );

  if (
    manifest.status !==
      "complete" ||
    manifest.campaignId !==
      campaignId ||
    manifest.calibrationStage !==
      "G-E3" ||
    manifest.waveId !==
      waveId ||
    manifest.intentOffset !==
      intentOffset ||
    manifest.intentCount !== 4 ||
    manifest.generationsPerIntent !==
      2 ||
    manifest.caseCount !== 8 ||
    !Array.isArray(
      manifest.cases
    ) ||
    manifest.cases.length !== 8
  ) {
    throw new Error(
      "g_e3_wave_manifest_invalid"
    );
  }

  const expectedIntentIds =
    Array.from(
      {
        length: 4
      },
      (
        _,
        index
      ) =>
        `intent-${String(
          intentOffset +
            index +
            1
        ).padStart(
          2,
          "0"
        )}`
    );
  const actualIntentIds =
    [
      ...new Set(
        manifest.cases.map(
          (item) =>
            item
              .intentGroupId
        )
      )
    ].sort();

  if (
    JSON.stringify(
      actualIntentIds
    ) !==
    JSON.stringify(
      expectedIntentIds
    )
  ) {
    throw new Error(
      "g_e3_wave_intent_window_mismatch"
    );
  }

  if (
    priorState
      ?.runtimeBinding
  ) {
    assertRuntimeBinding(
      priorState
        .runtimeBinding,
      manifest.runtimeBinding
    );
  }

  if (
    priorState
      ?.sourceSha256 &&
    priorState
      .sourceSha256 !==
      manifest.sourceSha256
  ) {
    throw new Error(
      "g_e3_source_binding_mismatch"
    );
  }

  const completedWaves =
    [
      ...new Set([
        ...(
          Array.isArray(
            priorState
              ?.completedWaves
          )
            ? priorState
                .completedWaves
            : []
        ),
        waveId
      ])
    ].sort();

  await writeJson(
    statePath,
    {
      schemaVersion:
        "face-lab-g-e3-local-campaign-state-v1",
      campaignId,
      sourceSha256:
        manifest.sourceSha256,
      runtimeBinding:
        manifest.runtimeBinding,
      completedWaves
    }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        verdict:
          "FACE_LAB_G_E3_WAVE_READY_FOR_HUMAN_REVIEW",
        campaignId,
        waveId,
        intentRange:
          `${expectedIntentIds[0]}..${expectedIntentIds[3]}`,
        caseCount: 8,
        completedWaveCount:
          completedWaves.length,
        waveDirectory:
          path.relative(
            process.cwd(),
            waveDirectory
          ),
        reviewBoardUrl:
          "http://localhost:3001/face-lab-test/pilot-review",
        nextCommands: [
          "npm run dev",
          "open the review board and select this wave directory",
          `npm run run:face-lab-v2-g-e3-private-wave -- "${path.relative(
            process.cwd(),
            waveDirectory
          )}"`
        ]
      },
      null,
      2
    )
  );
}
