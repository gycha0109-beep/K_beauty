#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  createHash
} from "node:crypto";
import {
  spawnSync
} from "node:child_process";
import {
  fileURLToPath
} from "node:url";
import dotenv from "dotenv";
import {
  getFaceLabGE3CalibrationWavePlan
} from "../lib/face-lab-v2/evaluation/simulation-g-e3-calibration-plan.js";

const ENV_FILE =
  path.resolve(
    process.cwd(),
    ".env.local"
  );
const DEFAULT_SOURCE_IMAGE =
  "public/test-assets/kakao-test-face.png";
const MODES =
  new Set([
    "precheck",
    "canary",
    "approve",
    "reject",
    "resume"
  ]);
const REQUIRED_SECRETS =
  Object.freeze([
    "FACE_LAB_E2E_EMAIL_A",
    "FACE_LAB_E2E_PASSWORD_A",
    "FACE_LAB_E2E_EMAIL_B",
    "FACE_LAB_E2E_PASSWORD_B"
  ]);
const TARGET_CASE_COUNT = 8;

function sha256(value) {
  return createHash(
    "sha256"
  )
    .update(value)
    .digest("hex");
}

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

async function loadLocalEnv({
  requireSecrets
}) {
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

  if (!requireSecrets) {
    return;
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

async function readJsonIfPresent(
  filePath
) {
  try {
    return JSON.parse(
      await fs.readFile(
        filePath,
        "utf8"
      )
    );
  } catch (error) {
    if (
      error?.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
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
    JSON.stringify(
      value,
      null,
      2
    ) + "\n",
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

function assertLocalBaseUrl() {
  const raw =
    process.env
      .FACE_LAB_E2E_BASE_URL ||
    "http://localhost:3001";
  const url =
    new URL(raw);
  const localHosts =
    new Set([
      "localhost",
      "127.0.0.1",
      "[::1]"
    ]);

  if (
    !localHosts.has(
      url.hostname
    )
  ) {
    throw new Error(
      "g_e3_local_base_url_required"
    );
  }

  return url.origin;
}

function expectedCaseNames(
  intentOffset
) {
  const names = [];

  for (
    let intentIndex = 0;
    intentIndex < 4;
    intentIndex += 1
  ) {
    const intentGroupId =
      "intent-" +
      String(
        intentOffset +
          intentIndex +
          1
      ).padStart(
        2,
        "0"
      );

    for (
      let generationIndex = 1;
      generationIndex <= 2;
      generationIndex += 1
    ) {
      names.push(
        intentGroupId +
          "-g" +
          generationIndex
      );
    }
  }

  return names;
}

function validateWaveManifest({
  manifest,
  expectedStatus,
  campaignId,
  waveId,
  intentOffset
}) {
  const wavePlan =
    getFaceLabGE3CalibrationWavePlan(
      waveId
    );

  if (!wavePlan) {
    throw new Error(
      "g_e3_wave_plan_missing"
    );
  }

  if (
    !manifest ||
    manifest.schemaVersion !==
      "face-lab-g-e2b-provider-pilot-e2e-v1" ||
    manifest.status !==
      expectedStatus ||
    manifest.campaignId !==
      campaignId ||
    manifest.calibrationStage !==
      "G-E3" ||
    manifest.campaignRootName !==
      "face-lab-g-e3" ||
    manifest.waveId !==
      waveId ||
    manifest.intentOffset !==
      intentOffset ||
    manifest.intentCount !== 4 ||
    manifest.generationsPerIntent !==
      2 ||
    manifest.intentPlanVersion !==
      wavePlan.planVersion ||
    manifest.surveyProfileVersion !==
      wavePlan.surveyProfileVersion ||
    JSON.stringify(
      manifest.intentKeys
    ) !==
      JSON.stringify(
        wavePlan.targetKeys
      ) ||
    !Array.isArray(
      manifest.cases
    ) ||
    manifest.cases.length >
      TARGET_CASE_COUNT
  ) {
    throw new Error(
      "g_e3_wave_manifest_invalid"
    );
  }

  const expectedNames =
    expectedCaseNames(
      intentOffset
    );
  const actualNames =
    manifest.cases.map(
      (item) =>
        item?.caseName ||
        null
    );

  for (
    let index = 0;
    index <
      manifest.cases.length;
    index += 1
  ) {
    const item =
      manifest.cases[index];
    const targetIndex =
      Math.floor(
        index / 2
      );
    const expectedTargetKey =
      wavePlan
        .targetKeys[
          targetIndex
        ];

    if (
      item?.targetKey !==
        expectedTargetKey ||
      item
        ?.presentationPreference !==
        "masculine_examples" ||
      item?.changeTolerance !==
        "moderate"
    ) {
      throw new Error(
        "g_e3_wave_case_plan_binding_invalid"
      );
    }
  }

  if (
    JSON.stringify(
      actualNames
    ) !==
    JSON.stringify(
      expectedNames.slice(
        0,
        actualNames.length
      )
    )
  ) {
    throw new Error(
      "g_e3_wave_case_prefix_invalid"
    );
  }

  if (
    expectedStatus ===
      "complete" &&
    manifest.cases.length !==
      TARGET_CASE_COUNT
  ) {
    throw new Error(
      "g_e3_wave_complete_case_count_invalid"
    );
  }

  return manifest;
}

function assertPathConfined(
  root,
  candidate
) {
  const resolvedRoot =
    path.resolve(root);
  const resolved =
    path.resolve(
      root,
      candidate
    );

  if (
    resolved !==
      resolvedRoot &&
    !resolved.startsWith(
      resolvedRoot +
        path.sep
    )
  ) {
    throw new Error(
      "g_e3_canary_path_invalid"
    );
  }

  return resolved;
}

async function assertGateBinding({
  gate,
  checkpoint,
  waveDirectory,
  requiredStatus
}) {
  if (
    !gate ||
    gate.schemaVersion !==
      "face-lab-g-e3-canary-gate-v1" ||
    gate.status !==
      requiredStatus ||
    checkpoint.cases.length < 1
  ) {
    throw new Error(
      requiredStatus ===
        "approved"
        ? "g_e3_canary_approval_required"
        : "g_e3_canary_review_gate_invalid"
    );
  }

  const canaryCase =
    checkpoint.cases[0];
  const outputPath =
    assertPathConfined(
      waveDirectory,
      canaryCase.outputFile
    );
  const outputBytes =
    await fs.readFile(
      outputPath
    );
  const actualOutputSha256 =
    sha256(outputBytes);

  const bindingChecks = [
    gate.campaignId ===
      checkpoint.campaignId,
    gate.waveId ===
      checkpoint.waveId,
    gate.caseName ===
      canaryCase.caseName,
    gate.caseId ===
      canaryCase.caseId,
    gate.sourceSha256 ===
      checkpoint.sourceSha256,
    gate.outputSha256 ===
      canaryCase.outputSha256,
    gate.outputSha256 ===
      actualOutputSha256,
    gate.renderSpecSha256 ===
      canaryCase.renderSpecSha256,
    gate.simulationVersion ===
      canaryCase.simulationVersion,
    gate.instructionVersion ===
      canaryCase.instructionVersion,
    gate.providerConfigVersion ===
      canaryCase.providerConfigVersion,
    gate.providerConfigFingerprint ===
      canaryCase.providerConfigFingerprint,
    gate.intentPlanVersion ===
      checkpoint.intentPlanVersion,
    gate.surveyProfileVersion ===
      checkpoint.surveyProfileVersion
  ];

  if (
    bindingChecks.some(
      (value) => !value
    )
  ) {
    throw new Error(
      "g_e3_canary_approval_binding_mismatch"
    );
  }

  return canaryCase;
}

function makeGate({
  checkpoint,
  canaryCase
}) {
  return {
    schemaVersion:
      "face-lab-g-e3-canary-gate-v1",
    status:
      "awaiting_review",
    campaignId:
      checkpoint.campaignId,
    waveId:
      checkpoint.waveId,
    caseName:
      canaryCase.caseName,
    caseId:
      canaryCase.caseId,
    sourceSha256:
      checkpoint.sourceSha256,
    outputSha256:
      canaryCase.outputSha256,
    renderSpecSha256:
      canaryCase.renderSpecSha256,
    simulationVersion:
      canaryCase.simulationVersion,
    instructionVersion:
      canaryCase.instructionVersion,
    providerConfigVersion:
      canaryCase.providerConfigVersion,
    providerConfigFingerprint:
      canaryCase.providerConfigFingerprint,
    intentPlanVersion:
      checkpoint.intentPlanVersion,
    surveyProfileVersion:
      checkpoint.surveyProfileVersion,
    targetKey:
      canaryCase.targetKey,
    presentationPreference:
      canaryCase.presentationPreference,
    providerAttemptCount:
      canaryCase.providerAttemptCount ??
      null,
    estimatedCostNanoUsd:
      canaryCase.estimatedCostNanoUsd ??
      null,
    pricingVersion:
      canaryCase.pricingVersion ??
      null,
    createdAt:
      new Date().toISOString()
  };
}

function projectState({
  previous,
  campaignId,
  sourceSha256,
  runtimeBinding,
  waveId,
  status,
  completedCases,
  complete,
  evaluationPlanVersion,
  surveyProfileVersion
}) {
  const plan =
    getFaceLabGE3CalibrationWavePlan(
      waveId
    );
  const resolvedEvaluationPlanVersion =
    evaluationPlanVersion ||
    plan?.planVersion ||
    null;
  const resolvedSurveyProfileVersion =
    surveyProfileVersion ||
    plan?.surveyProfileVersion ||
    null;
  const sameCampaign =
    previous?.campaignId ===
      campaignId &&
    previous
      ?.evaluationPlanVersion ===
      resolvedEvaluationPlanVersion &&
    previous
      ?.surveyProfileVersion ===
      resolvedSurveyProfileVersion
      ? previous
      : null;
  const completedWaves =
    new Set(
      Array.isArray(
        sameCampaign
          ?.completedWaves
      )
        ? sameCampaign
            .completedWaves
        : []
    );

  if (complete) {
    completedWaves.add(
      waveId
    );
  }

  return {
    schemaVersion:
      "face-lab-g-e3-local-campaign-state-v2",
    campaignId,
    evaluationPlanVersion:
      resolvedEvaluationPlanVersion,
    surveyProfileVersion:
      resolvedSurveyProfileVersion,
    sourceSha256:
      sourceSha256 ||
      sameCampaign
        ?.sourceSha256 ||
      null,
    runtimeBinding:
      runtimeBinding ||
      sameCampaign
        ?.runtimeBinding ||
      null,
    waveStates: {
      ...(
        sameCampaign
          ?.waveStates ||
        {}
      ),
      [waveId]: {
        status,
        completedCases,
        updatedAt:
          new Date().toISOString()
      }
    },
    completedWaves:
      [...completedWaves]
        .sort()
  };
}

function runProvider({
  runnerPath,
  campaignId,
  waveId,
  intentOffset,
  newOutputBudget
}) {
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
          FACE_LAB_E2E_BASE_URL:
            process.env
              .FACE_LAB_E2E_BASE_URL ||
            "http://localhost:3001",
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
          FACE_LAB_E2E_NEW_OUTPUT_BUDGET:
            String(
              newOutputBudget
            ),
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
    return false;
  }

  return true;
}

const waveNumber =
  Number(
    process.argv[2]
  );
const mode =
  String(
    process.argv[3] || ""
  )
    .trim()
    .toLowerCase();

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

if (
  !MODES.has(
    mode
  )
) {
  throw new Error(
    "g_e3_run_mode_required"
  );
}

const waveId =
  "wave-0" +
  waveNumber;
const intentOffset =
  (waveNumber - 1) * 4;
const wavePlan =
  getFaceLabGE3CalibrationWavePlan(
    waveId
  );

if (!wavePlan) {
  throw new Error(
    "g_e3_wave_plan_missing"
  );
}

if (
  wavePlan.intentOffset !==
    intentOffset ||
  wavePlan.targetKeys.length !==
    4
) {
  throw new Error(
    "g_e3_wave_plan_window_invalid"
  );
}

await loadLocalEnv({
  requireSecrets:
    mode === "precheck" ||
    mode === "canary" ||
    mode === "resume"
});

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
const previousState =
  await readJsonIfPresent(
    statePath
  );
const explicitCampaignId =
  safeCampaignId(
    process.argv[4]
  );
const previousPlanCompatible =
  previousState
    ?.evaluationPlanVersion ===
      wavePlan.planVersion &&
  previousState
    ?.surveyProfileVersion ===
      wavePlan.surveyProfileVersion;
const continuationState =
  previousPlanCompatible
    ? previousState
    : null;
const previousCampaignId =
  safeCampaignId(
    continuationState
      ?.campaignId
  );

if (
  waveNumber > 1 &&
  explicitCampaignId &&
  previousCampaignId &&
  explicitCampaignId !==
    previousCampaignId
) {
  throw new Error(
    "g_e3_campaign_id_mismatch"
  );
}

let campaignId =
  explicitCampaignId ||
  previousCampaignId ||
  (
    waveNumber === 1 &&
    (
      mode === "precheck" ||
      mode === "canary"
    )
      ? defaultCampaignId()
      : null
  );

if (!campaignId) {
  throw new Error(
    "g_e3_campaign_id_missing"
  );
}

if (
  waveNumber > 1 &&
  previousCampaignId !==
    campaignId
) {
  throw new Error(
    "g_e3_campaign_id_mismatch"
  );
}

const waveDirectory =
  path.join(
    campaignRoot,
    campaignId,
    waveId
  );
const checkpointPath =
  path.join(
    waveDirectory,
    "manifest.checkpoint.json"
  );
const manifestPath =
  path.join(
    waveDirectory,
    "manifest.json"
  );
const gatePath =
  path.join(
    waveDirectory,
    "canary-gate.json"
  );
const runnerPath =
  fileURLToPath(
    new URL(
      "./run-face-lab-v2-simulation-provider-pilot-e2e.mjs",
      import.meta.url
    )
  );

if (
  mode === "precheck" ||
  mode === "canary" ||
  mode === "resume"
) {
  assertLocalBaseUrl();
}

if (
  mode === "precheck"
) {
  const sourcePath =
    path.resolve(
      process.cwd(),
      process.env
        .FACE_LAB_E2E_IMAGE_PATH ||
        DEFAULT_SOURCE_IMAGE
    );

  await fs.access(
    sourcePath
  );

  const checkpoint =
    await readJsonIfPresent(
      checkpointPath
    );
  const manifest =
    await readJsonIfPresent(
      manifestPath
    );
  const gate =
    await readJsonIfPresent(
      gatePath
    );

  if (checkpoint) {
    validateWaveManifest({
      manifest:
        checkpoint,
      expectedStatus:
        "partial",
      campaignId,
      waveId,
      intentOffset
    });
  }

  if (manifest) {
    validateWaveManifest({
      manifest,
      expectedStatus:
        "complete",
      campaignId,
      waveId,
      intentOffset
    });
  }

  await writeJson(
    statePath,
    projectState({
      previous:
        continuationState,
      campaignId,
      sourceSha256:
        checkpoint
          ?.sourceSha256 ||
        manifest
          ?.sourceSha256 ||
        null,
      runtimeBinding:
        checkpoint
          ?.runtimeBinding ||
        manifest
          ?.runtimeBinding ||
        null,
      waveId,
      status:
        manifest
          ? "complete"
          : gate?.status ===
              "approved"
            ? "canary_approved"
            : checkpoint
              ? "canary_generated"
              : "prechecked",
      completedCases:
        manifest
          ?.cases
          ?.length ||
        checkpoint
          ?.cases
          ?.length ||
        0,
      complete:
        Boolean(
          manifest
        )
    })
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        verdict:
          "FACE_LAB_G_E3_PRECHECK_PASS",
        campaignId,
        waveId,
        providerCalls: 0,
        baseUrl:
          assertLocalBaseUrl(),
        existingCheckpointCases:
          checkpoint
            ?.cases
            ?.length ||
          0,
        canaryGateStatus:
          gate
            ?.status ||
          null,
        complete:
          Boolean(
            manifest
          ),
        intentKeys:
          [...wavePlan.targetKeys],
        presentationPreference:
          wavePlan
            .surveyProfile
            .presentationPreference,
        changeTolerance:
          wavePlan
            .surveyProfile
            .changeTolerance
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (
  mode === "canary"
) {
  const existingManifest =
    await readJsonIfPresent(
      manifestPath
    );
  const existingCheckpoint =
    await readJsonIfPresent(
      checkpointPath
    );
  const existingGate =
    await readJsonIfPresent(
      gatePath
    );

  if (existingManifest) {
    throw new Error(
      "g_e3_wave_already_complete"
    );
  }

  if (
    existingCheckpoint ||
    existingGate
  ) {
    throw new Error(
      "g_e3_canary_already_started"
    );
  }

  const ran =
    runProvider({
      runnerPath,
      campaignId,
      waveId,
      intentOffset,
      newOutputBudget: 1
    });

  if (!ran) {
    process.exit(
      process.exitCode || 1
    );
  }

  const manifestAfter =
    await readJsonIfPresent(
      manifestPath
    );
  const checkpoint =
    validateWaveManifest({
      manifest:
        await readJsonIfPresent(
          checkpointPath
        ),
      expectedStatus:
        "partial",
      campaignId,
      waveId,
      intentOffset
    });

  if (
    manifestAfter ||
    checkpoint.cases.length !==
      1
  ) {
    throw new Error(
      "g_e3_canary_hard_stop_failed"
    );
  }

  if (
    continuationState
      ?.sourceSha256 &&
    previousState
      .sourceSha256 !==
      checkpoint.sourceSha256
  ) {
    throw new Error(
      "g_e3_source_binding_mismatch"
    );
  }

  if (
    continuationState
      ?.runtimeBinding
  ) {
    assertRuntimeBinding(
      continuationState
        .runtimeBinding,
      checkpoint
        .runtimeBinding
    );
  }

  const canaryCase =
    checkpoint.cases[0];
  const gate =
    makeGate({
      checkpoint,
      canaryCase
    });

  await writeJson(
    gatePath,
    gate
  );
  await writeJson(
    statePath,
    projectState({
      previous:
        continuationState,
      campaignId,
      sourceSha256:
        checkpoint
          .sourceSha256,
      runtimeBinding:
        checkpoint
          .runtimeBinding,
      waveId,
      status:
        "canary_generated",
      completedCases: 1,
      complete: false
    })
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        verdict:
          "FACE_LAB_G_E3_CANARY_READY_FOR_REVIEW",
        campaignId,
        waveId,
        targetCaseCount:
          TARGET_CASE_COUNT,
        completedCaseCount: 1,
        remainingCaseCount: 7,
        generatedCaseCount:
          checkpoint
            .resumeTelemetry
            ?.generatedCaseCount ??
          1,
        providerAttemptCount:
          canaryCase
            .providerAttemptCount ??
          null,
        estimatedCostNanoUsd:
          canaryCase
            .estimatedCostNanoUsd ??
          null,
        pricingVersion:
          canaryCase
            .pricingVersion ??
          null,
        targetKey:
          canaryCase
            .targetKey,
        presentationPreference:
          canaryCase
            .presentationPreference,
        reviewBoardUrl:
          "http://localhost:3001/face-lab-test/pilot-review",
        nextCommand:
          "npm run run:face-lab-v2-g-e3-wave -- " +
          waveNumber +
          " approve"
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (
  mode === "approve" ||
  mode === "reject"
) {
  const checkpoint =
    validateWaveManifest({
      manifest:
        await readJsonIfPresent(
          checkpointPath
        ),
      expectedStatus:
        "partial",
      campaignId,
      waveId,
      intentOffset
    });
  const gate =
    await readJsonIfPresent(
      gatePath
    );

  if (
    checkpoint.cases.length !==
      1
  ) {
    throw new Error(
      "g_e3_canary_review_case_count_invalid"
    );
  }

  await assertGateBinding({
    gate,
    checkpoint,
    waveDirectory,
    requiredStatus:
      "awaiting_review"
  });

  const nextGate = {
    ...gate,
    status:
      mode === "approve"
        ? "approved"
        : "rejected",
    approvedAt:
      mode === "approve"
        ? new Date()
            .toISOString()
        : null,
    rejectedAt:
      mode === "reject"
        ? new Date()
            .toISOString()
        : null
  };

  await writeJson(
    gatePath,
    nextGate
  );
  await writeJson(
    statePath,
    projectState({
      previous:
        continuationState,
      campaignId,
      sourceSha256:
        checkpoint
          .sourceSha256,
      runtimeBinding:
        checkpoint
          .runtimeBinding,
      waveId,
      status:
        mode === "approve"
          ? "canary_approved"
          : "canary_rejected",
      completedCases: 1,
      complete: false
    })
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        verdict:
          mode === "approve"
            ? "FACE_LAB_G_E3_CANARY_APPROVED"
            : "FACE_LAB_G_E3_CANARY_REJECTED",
        campaignId,
        waveId,
        providerCalls: 0,
        nextCommand:
          mode === "approve"
            ? "npm run run:face-lab-v2-g-e3-wave -- " +
              waveNumber +
              " resume"
            : null
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (
  mode === "resume"
) {
  const completeBefore =
    await readJsonIfPresent(
      manifestPath
    );

  if (completeBefore) {
    const manifest =
      validateWaveManifest({
        manifest:
          completeBefore,
        expectedStatus:
          "complete",
        campaignId,
        waveId,
        intentOffset
      });

    await writeJson(
      statePath,
      projectState({
        previous:
          previousState,
        campaignId,
        sourceSha256:
          manifest
            .sourceSha256,
        runtimeBinding:
          manifest
            .runtimeBinding,
        waveId,
        status:
          "complete",
        completedCases:
          TARGET_CASE_COUNT,
        complete: true
      })
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          verdict:
            "FACE_LAB_G_E3_WAVE_ALREADY_COMPLETE",
          campaignId,
          waveId,
          providerCalls: 0,
          caseCount:
            TARGET_CASE_COUNT
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const checkpoint =
    validateWaveManifest({
      manifest:
        await readJsonIfPresent(
          checkpointPath
        ),
      expectedStatus:
        "partial",
      campaignId,
      waveId,
      intentOffset
    });
  const gate =
    await readJsonIfPresent(
      gatePath
    );

  await assertGateBinding({
    gate,
    checkpoint,
    waveDirectory,
    requiredStatus:
      "approved"
  });

  if (
    continuationState
      ?.sourceSha256 &&
    previousState
      .sourceSha256 !==
      checkpoint.sourceSha256
  ) {
    throw new Error(
      "g_e3_source_binding_mismatch"
    );
  }

  if (
    continuationState
      ?.runtimeBinding
  ) {
    assertRuntimeBinding(
      continuationState
        .runtimeBinding,
      checkpoint
        .runtimeBinding
    );
  }

  const remaining =
    TARGET_CASE_COUNT -
    checkpoint.cases.length;
  const newOutputBudget =
    Math.max(
      1,
      remaining
    );

  const ran =
    runProvider({
      runnerPath,
      campaignId,
      waveId,
      intentOffset,
      newOutputBudget
    });

  if (!ran) {
    process.exit(
      process.exitCode || 1
    );
  }

  const manifest =
    validateWaveManifest({
      manifest:
        await readJsonIfPresent(
          manifestPath
        ),
      expectedStatus:
        "complete",
      campaignId,
      waveId,
      intentOffset
    });

  await assertGateBinding({
    gate:
      await readJsonIfPresent(
        gatePath
      ),
    checkpoint:
      manifest,
    waveDirectory,
    requiredStatus:
      "approved"
  });

  if (
    continuationState
      ?.runtimeBinding
  ) {
    assertRuntimeBinding(
      continuationState
        .runtimeBinding,
      manifest.runtimeBinding
    );
  }

  await writeJson(
    statePath,
    projectState({
      previous:
        continuationState,
      campaignId,
      sourceSha256:
        manifest
          .sourceSha256,
      runtimeBinding:
        manifest
          .runtimeBinding,
      waveId,
      status:
        "complete",
      completedCases:
        TARGET_CASE_COUNT,
      complete: true
    })
  );

  const expectedIntentIds =
    Array.from(
      {
        length: 4
      },
      (
        _,
        index
      ) =>
        "intent-" +
        String(
          intentOffset +
            index +
            1
        ).padStart(
          2,
          "0"
        )
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
          expectedIntentIds[0] +
          ".." +
          expectedIntentIds[3],
        caseCount:
          TARGET_CASE_COUNT,
        reusedCaseCount:
          manifest
            .resumeTelemetry
            ?.reusedCaseCount ??
          null,
        generatedCaseCount:
          manifest
            .resumeTelemetry
            ?.generatedCaseCount ??
          null,
        costTelemetry:
          manifest
            .costTelemetry ||
          null,
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
          "npm run run:face-lab-v2-g-e3-private-wave -- " +
            JSON.stringify(
              path.relative(
                process.cwd(),
                waveDirectory
              )
            )
        ]
      },
      null,
      2
    )
  );
}
