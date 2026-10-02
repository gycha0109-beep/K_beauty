#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  spawnSync
} from "node:child_process";
import {
  fileURLToPath
} from "node:url";
import {
  aggregateFaceLabSimulationCalibration
} from "../lib/face-lab-v2/evaluation/simulation-calibration.js";
import {
  buildFaceLabSimulationPilotCloseout
} from "../lib/face-lab-v2/evaluation/simulation-pilot-closeout.js";
import {
  faceLabPrivateArtifactStem
} from "../lib/face-lab-v2/evaluation/private-artifact-filename.js";

const campaignDirectory =
  path.resolve(
    process.argv[2] ||
    process.env
      .FACE_LAB_G_E2B_PRIVATE_CAMPAIGN ||
    ""
  );

if (
  !campaignDirectory ||
  campaignDirectory ===
    path.resolve("")
) {
  throw new Error(
    "Provide the private G-E2B campaign directory"
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

if (
  !findPrivateRoot(
    campaignDirectory
  )
) {
  throw new Error(
    "campaign_directory_must_be_under_private"
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

const names =
  await fs.readdir(
    campaignDirectory
  );
const runSpecNames =
  names.filter(
    (name) =>
      name.endsWith(
        ".pilot-case-run.json"
      )
  );

assert.equal(
  runSpecNames.length,
  8,
  "g_e2b_requires_exactly_eight_reviewed_run_specs"
);

const descriptors = [];

for (
  const name of
  runSpecNames
) {
  const runSpecPath =
    path.join(
      campaignDirectory,
      name
    );
  const runSpec =
    await readJson(
      runSpecPath
    );
  const capturePath =
    path.resolve(
      campaignDirectory,
      runSpec
        .captureManifestPath
    );

  if (
    path.dirname(
      capturePath
    ) !==
      campaignDirectory
  ) {
    throw new Error(
      "capture_manifest_must_remain_in_campaign_directory"
    );
  }

  const capture =
    await readJson(
      capturePath
    );
  const stem =
    faceLabPrivateArtifactStem(
      capture.caseId
    );

  if (!stem) {
    throw new Error(
      "campaign_case_id_invalid"
    );
  }

  descriptors.push({
    name,
    runSpec,
    runSpecPath,
    caseId:
      capture.caseId,
    stem
  });
}

descriptors.sort(
  (left, right) => {
    const groupOrder =
      String(
        left.runSpec
          .intentGroupId
      ).localeCompare(
        String(
          right.runSpec
            .intentGroupId
        )
      );

    return groupOrder ||
      left.runSpec
        .generationIndex -
        right.runSpec
          .generationIndex;
  }
);

const campaignIds =
  new Set(
    descriptors.map(
      (item) =>
        item.runSpec
          .campaignId
    )
  );
assert.equal(
  campaignIds.size,
  1,
  "campaign_id_mismatch"
);

const intentGroups =
  new Map();

for (
  const item of
  descriptors
) {
  const group =
    item.runSpec
      .intentGroupId;
  const generations =
    intentGroups.get(
      group
    ) || [];

  generations.push(
    item.runSpec
      .generationIndex
  );
  intentGroups.set(
    group,
    generations
  );
}

assert.equal(
  intentGroups.size,
  4,
  "g_e2b_requires_four_intent_groups"
);

for (
  const generations of
  intentGroups.values()
) {
  assert.deepEqual(
    generations.sort(
      (a, b) =>
        a - b
    ),
    [1, 2],
    "each_intent_group_requires_generation_1_and_2"
  );
}

const runnerPath =
  fileURLToPath(
    new URL(
      "./run-face-lab-v2-simulation-pilot-case.mjs",
      import.meta.url
    )
  );

const caseFailures =
  [];
const readyCaseIds =
  new Set();

for (
  const item of
  descriptors
) {
  const result =
    spawnSync(
      process.execPath,
      [
        runnerPath,
        item.runSpecPath
      ],
      {
        encoding: "utf8",
        stdio: [
          "ignore",
          "pipe",
          "inherit"
        ]
      }
    );

  const stdout =
    String(
      result.stdout || ""
    ).trim();
  let payload = null;

  if (stdout) {
    try {
      payload =
        JSON.parse(
          stdout
        );
    } catch {
      payload = null;
    }

    console.log(stdout);
  }

  if (
    result.status === 0
  ) {
    readyCaseIds.add(
      item.caseId
    );
    continue;
  }

  caseFailures.push({
    caseId:
      item.caseId,
    intentGroupId:
      item.runSpec
        .intentGroupId,
    generationIndex:
      item.runSpec
        .generationIndex,
    reason:
      payload?.reason ||
      "pilot_case_runner_failed",
    calibrationReason:
      payload
        ?.calibrationReason ||
      null,
    incompleteCheckId:
      payload
        ?.incompleteCheckId ||
      null,
    evidenceVerdict:
      payload
        ?.evidenceVerdict ||
      null,
    hardFailureCodes:
      Array.isArray(
        payload
          ?.hardFailureCodes
      )
        ? payload
            .hardFailureCodes
        : null,
    reviewFindingCodes:
      Array.isArray(
        payload
          ?.reviewFindingCodes
      )
        ? payload
            .reviewFindingCodes
        : null,
    evidenceCheckStatuses:
      payload &&
      typeof payload
        .evidenceCheckStatuses ===
        "object" &&
      payload
        .evidenceCheckStatuses !==
        null &&
      !Array.isArray(
        payload
          .evidenceCheckStatuses
      )
        ? payload
            .evidenceCheckStatuses
        : null
  });
}

const campaignId =
  [...campaignIds][0];

function acceptedNotAssessableFailure(
  failure
) {
  return (
    failure.reason ===
      "pilot_case_calibration_case_invalid" &&
    failure.calibrationReason ===
      "evidence_packet_evaluation_incomplete" &&
    typeof failure
      .incompleteCheckId ===
      "string" &&
    failure.evidenceVerdict ===
      "not_evaluated" &&
    Array.isArray(
      failure.hardFailureCodes
    ) &&
    failure.hardFailureCodes
      .length === 0 &&
    Array.isArray(
      failure.reviewFindingCodes
    ) &&
    failure
      .evidenceCheckStatuses &&
    typeof failure
      .evidenceCheckStatuses ===
      "object"
  );
}

const acceptedNotAssessable =
  caseFailures.filter(
    acceptedNotAssessableFailure
  );
const blockingFailures =
  caseFailures.filter(
    (failure) =>
      !acceptedNotAssessableFailure(
        failure
      )
  );

if (
  blockingFailures.length
) {
  const blockerReport = {
    ok: false,
    verdict:
      "FACE_LAB_G_E2B_CASE_PROCESSING_BLOCKED",
    campaignId,
    reviewedCaseCount:
      descriptors.length,
    readyCaseCount:
      readyCaseIds.size,
    acceptedNotAssessableCaseCount:
      acceptedNotAssessable
        .length,
    blockedCaseCount:
      blockingFailures.length,
    blockers:
      blockingFailures,
    remediation:
      "Resolve only the listed technical or invalid-review blockers. Valid not_assessable Human Review observations are accepted separately."
  };

  await writeJson(
    path.join(
      campaignDirectory,
      "campaign.blockers.json"
    ),
    blockerReport
  );

  console.log(
    JSON.stringify(
      blockerReport,
      null,
      2
    )
  );
  process.exitCode = 2;
} else {
  const admittedDescriptors =
    descriptors.filter(
      (item) =>
        readyCaseIds.has(
          item.caseId
        )
    );
  const calibrationCases =
    [];

  for (
    const item of
    admittedDescriptors
  ) {
    const casePath =
      path.join(
        campaignDirectory,
        `${item.stem}.calibration-case.json`
      );

    calibrationCases.push(
      await readJson(
        casePath
      )
    );
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
      buildFaceLabSimulationPilotCloseout({
        campaignId,
        expectedCaseCount:
          descriptors.length,
        expectedIntentGroupCount:
          intentGroups.size,
        reviewedCaseCount:
          descriptors.length,
        aggregate,
        acceptedNotAssessable
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
      const aggregateInput = {
        campaignId,
        casePaths:
          admittedDescriptors.map(
            (item) =>
              `./${item.stem}.calibration-case.json`
          ),
        acceptedNotAssessable:
          acceptedNotAssessable.map(
            (item) => ({
              caseId:
                item.caseId,
              intentGroupId:
                item.intentGroupId,
              generationIndex:
                item.generationIndex,
              incompleteCheckId:
                item.incompleteCheckId
            })
          )
      };

      await writeJson(
        path.join(
          campaignDirectory,
          "campaign.aggregate-input.json"
        ),
        aggregateInput
      );
      await writeJson(
        path.join(
          campaignDirectory,
          "campaign.aggregate.json"
        ),
        aggregate
      );
      await writeJson(
        path.join(
          campaignDirectory,
          "campaign.closeout.json"
        ),
        closeout
      );

      await fs.rm(
        path.join(
          campaignDirectory,
          "campaign.blockers.json"
        ),
        {
          force: true
        }
      );

      console.log(
        JSON.stringify(
          {
            ok: true,
            verdict:
              closeout
                .protocol
                .hardFailureStop
                ? "FACE_LAB_G_E2C_HARD_FAILURE_STOP"
                : "FACE_LAB_G_E2C_PILOT_CLOSEOUT_READY",
            campaignId,
            reviewedCaseCount:
              closeout
                .coverage
                .reviewedCaseCount,
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
            nextStage:
              closeout
                .nextStage,
            aggregatePath:
              "./campaign.aggregate.json",
            closeoutPath:
              "./campaign.closeout.json"
          },
          null,
          2
        )
      );
    }
  }
}
