#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  aggregateFaceLabSimulationCalibration
} from "../lib/face-lab-v2/evaluation/simulation-calibration.js";
import {
  buildFaceLabGE3FullCalibrationCloseout
} from "../lib/face-lab-v2/evaluation/simulation-g-e3-full-calibration-closeout.js";

const campaignDirectory =
  path.resolve(
    process.argv[2] ||
    process.env
      .FACE_LAB_G_E3_CAMPAIGN_DIRECTORY ||
    ""
  );

if (
  !campaignDirectory ||
  campaignDirectory ===
    path.resolve("")
) {
  throw new Error(
    "provide_g_e3_campaign_directory"
  );
}

function findPrivateRoot(
  directory
) {
  let current =
    path.resolve(directory);

  while (true) {
    if (
      path.basename(current) ===
        "private"
    ) {
      return current;
    }

    const parent =
      path.dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

const privateRoot =
  findPrivateRoot(
    campaignDirectory
  );

if (!privateRoot) {
  throw new Error(
    "g_e3_campaign_must_be_under_private"
  );
}

if (
  path.basename(
    path.dirname(
      campaignDirectory
    )
  ) !== "face-lab-g-e3"
) {
  throw new Error(
    "g_e3_campaign_directory_invalid"
  );
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

function resolveContainedPath(
  baseDirectory,
  value
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      "g_e3_case_path_invalid"
    );
  }

  const resolved =
    path.resolve(
      baseDirectory,
      value.trim()
    );
  const relative =
    path.relative(
      baseDirectory,
      resolved
    );

  if (
    relative.startsWith("..") ||
    path.isAbsolute(
      relative
    )
  ) {
    throw new Error(
      "g_e3_case_path_escape"
    );
  }

  return resolved;
}

const waveSpecs = [
  {
    waveId:
      "wave-01",
    intentOffset: 0
  },
  {
    waveId:
      "wave-02",
    intentOffset: 4
  },
  {
    waveId:
      "wave-03",
    intentOffset: 8
  }
];

const calibrationCases =
  [];
const acceptedNotAssessable =
  [];
const waves =
  [];
let campaignId = null;

for (
  const waveSpec of
  waveSpecs
) {
  const waveDirectory =
    path.join(
      campaignDirectory,
      waveSpec.waveId
    );
  const manifest =
    await readJson(
      path.join(
        waveDirectory,
        "manifest.json"
      )
    );
  const waveCloseout =
    await readJson(
      path.join(
        waveDirectory,
        "wave.closeout.json"
      )
    );
  const aggregateInput =
    await readJson(
      path.join(
        waveDirectory,
        "campaign.aggregate-input.json"
      )
    );

  if (
    manifest.calibrationStage !==
      "G-E3" ||
    manifest.waveId !==
      waveSpec.waveId ||
    manifest.intentOffset !==
      waveSpec.intentOffset ||
    manifest.intentCount !== 4 ||
    manifest.generationsPerIntent !==
      2 ||
    manifest.caseCount !== 8
  ) {
    throw new Error(
      "g_e3_wave_manifest_invalid_" +
        waveSpec.waveId
    );
  }

  if (!campaignId) {
    campaignId =
      manifest.campaignId;
  }

  if (
    !campaignId ||
    manifest.campaignId !==
      campaignId ||
    waveCloseout.campaignId !==
      campaignId ||
    waveCloseout.waveId !==
      waveSpec.waveId ||
    waveCloseout.intentOffset !==
      waveSpec.intentOffset ||
    waveCloseout.status !==
      "ready"
  ) {
    throw new Error(
      "g_e3_wave_binding_invalid_" +
        waveSpec.waveId
    );
  }

  if (
    waveCloseout
      ?.protocol
      ?.hardFailureStop ===
      true ||
    waveCloseout
      ?.calibrationSummary
      ?.hardFailureCaseCount >
      0
  ) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          verdict:
            "FACE_LAB_G_E3_HARD_FAILURE_STOP",
          campaignId,
          waveId:
            waveSpec.waveId
        },
        null,
        2
      )
    );
    process.exitCode = 2;
    process.exit();
  }

  if (
    !Array.isArray(
      aggregateInput
        .casePaths
    ) ||
    !Array.isArray(
      waveCloseout
        ?.acceptedNotAssessable
        ?.observations
    )
  ) {
    throw new Error(
      "g_e3_wave_closeout_structure_invalid_" +
        waveSpec.waveId
    );
  }

  for (
    const casePath of
    aggregateInput
      .casePaths
  ) {
    calibrationCases.push(
      await readJson(
        resolveContainedPath(
          waveDirectory,
          casePath
        )
      )
    );
  }

  acceptedNotAssessable.push(
    ...waveCloseout
      .acceptedNotAssessable
      .observations
  );

  waves.push({
    waveId:
      waveSpec.waveId,
    intentOffset:
      waveSpec.intentOffset,
    reviewedCaseCount:
      waveCloseout
        .coverage
        .reviewedCaseCount,
    hardFailureCaseCount:
      waveCloseout
        .calibrationSummary
        .hardFailureCaseCount
  });
}

const aggregate =
  aggregateFaceLabSimulationCalibration({
    campaignId,
    cases:
      calibrationCases
  });

if (
  aggregate.status !==
    "ready"
) {
  console.log(
    JSON.stringify(
      aggregate,
      null,
      2
    )
  );
  process.exitCode = 1;
} else {
  const closeout =
    buildFaceLabGE3FullCalibrationCloseout({
      campaignId,
      aggregate,
      acceptedNotAssessable,
      waves
    });

  if (
    closeout.status !==
      "ready"
  ) {
    console.log(
      JSON.stringify(
        closeout,
        null,
        2
      )
    );
    process.exitCode = 1;
  } else {
    await writeJson(
      path.join(
        campaignDirectory,
        "full-calibration.aggregate-input.json"
      ),
      {
        campaignId,
        waves:
          waveSpecs.map(
            (wave) =>
              `./${wave.waveId}`
          ),
        admittedCalibrationCaseCount:
          calibrationCases.length,
        acceptedNotAssessableCaseCount:
          acceptedNotAssessable
            .length
      }
    );
    await writeJson(
      path.join(
        campaignDirectory,
        "full-calibration.aggregate.json"
      ),
      aggregate
    );
    await writeJson(
      path.join(
        campaignDirectory,
        "full-calibration.closeout.json"
      ),
      closeout
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          verdict:
            "FACE_LAB_G_E3_FULL_CALIBRATION_EVIDENCE_READY",
          campaignId,
          reviewedOutputCount:
            closeout
              .coverage
              .reviewedOutputCount,
          admittedCalibrationCaseCount:
            closeout
              .coverage
              .admittedCalibrationCaseCount,
          acceptedNotAssessableCaseCount:
            closeout
              .coverage
              .acceptedNotAssessableCaseCount,
          hardFailureCaseCount:
            closeout
              .calibrationSummary
              .hardFailureCaseCount,
          decisionState:
            closeout
              .decisionState,
          aggregatePath:
            "./full-calibration.aggregate.json",
          closeoutPath:
            "./full-calibration.closeout.json"
        },
        null,
        2
      )
    );
  }
}
