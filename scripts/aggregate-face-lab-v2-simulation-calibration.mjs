#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  aggregateFaceLabSimulationCalibration
} from "../lib/face-lab-v2/evaluation/simulation-calibration.js";

const manifestPath =
  process.argv[2] ||
  process.env.FACE_LAB_SIMULATION_CALIBRATION_AGGREGATE_INPUT;

if (!manifestPath) {
  throw new Error(
    "Provide a calibration aggregate manifest path"
  );
}

const resolvedManifestPath =
  path.resolve(manifestPath);
const baseDirectory =
  path.dirname(
    resolvedManifestPath
  );
const manifest =
  JSON.parse(
    await fs.readFile(
      resolvedManifestPath,
      "utf8"
    )
  );

if (
  !Array.isArray(
    manifest.casePaths
  ) ||
  !manifest.casePaths.length
) {
  throw new Error(
    "casePaths must be a non-empty array"
  );
}

const cases = [];

for (
  const rawPath of
  manifest.casePaths
) {
  if (
    typeof rawPath !== "string" ||
    !rawPath.trim()
  ) {
    throw new Error(
      "casePaths entries must be local paths"
    );
  }

  const casePath =
    path.resolve(
      baseDirectory,
      rawPath.trim()
    );

  cases.push(
    JSON.parse(
      await fs.readFile(
        casePath,
        "utf8"
      )
    )
  );
}

const result =
  aggregateFaceLabSimulationCalibration({
    campaignId:
      manifest.campaignId,
    cases
  });

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);

if (result.status !== "ready") {
  process.exitCode = 1;
}
