#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  buildFaceLabSimulationCalibrationCase
} from "../lib/face-lab-v2/evaluation/simulation-calibration.js";

const manifestPath =
  process.argv[2] ||
  process.env.FACE_LAB_SIMULATION_CALIBRATION_CASE_INPUT;

if (!manifestPath) {
  throw new Error(
    "Provide a calibration-case manifest path"
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

function resolveLocalPath(value, label) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      label +
      " must be a non-empty local path"
    );
  }

  return path.resolve(
    baseDirectory,
    value.trim()
  );
}

async function readJson(
  value,
  label
) {
  const filePath =
    resolveLocalPath(
      value,
      label
    );

  return JSON.parse(
    await fs.readFile(
      filePath,
      "utf8"
    )
  );
}

const [
  packet,
  identityScopeReview,
  routeColorReview
] = await Promise.all([
  readJson(
    manifest.evidencePacketPath,
    "evidencePacketPath"
  ),
  readJson(
    manifest.identityScopeReviewPath,
    "identityScopeReviewPath"
  ),
  readJson(
    manifest.routeColorReviewPath,
    "routeColorReviewPath"
  )
]);

const result =
  buildFaceLabSimulationCalibrationCase({
    campaignId:
      manifest.campaignId,
    intentGroupId:
      manifest.intentGroupId,
    generationIndex:
      manifest.generationIndex,
    changeIntensity:
      manifest.changeIntensity,
    routeSelectionState:
      manifest.routeSelectionState,
    packet,
    identityScopeReview,
    routeColorReview
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
