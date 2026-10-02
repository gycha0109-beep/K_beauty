#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  canonicalizeImageBytes,
  detectImageSignature
} from "../lib/image-upload-boundary-core.js";
import {
  FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION
} from "../lib/face-lab-v2/evaluation/simulation-identity-scope-review.js";
import {
  FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION
} from "../lib/face-lab-v2/evaluation/simulation-route-color-review.js";
import {
  FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION
} from "../lib/face-lab-v2/evaluation/simulation-pilot-capture.js";
import {
  buildFaceLabSimulationPilotCaseArtifacts
} from "../lib/face-lab-v2/evaluation/simulation-pilot-case-runner.js";

const runSpecPath =
  process.argv[2] ||
  process.env.FACE_LAB_SIMULATION_PILOT_CASE_INPUT;

if (!runSpecPath) {
  throw new Error(
    "Provide a private pilot-case run spec path"
  );
}

const resolvedRunSpecPath =
  path.resolve(runSpecPath);
const privateDirectory =
  path.dirname(
    resolvedRunSpecPath
  );

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
    privateDirectory
  );

if (!privateRoot) {
  throw new Error(
    "pilot_case_run_spec_must_be_under_private_directory"
  );
}

function isObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function resolveContainedPath(
  baseDirectory,
  value,
  label
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `${label}_must_be_a_local_path`
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
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `${label}_must_remain_in_private_directory`
    );
  }

  return resolved;
}

async function readJson(
  filePath,
  label
) {
  const parsed =
    JSON.parse(
      await fs.readFile(
        filePath,
        "utf8"
      )
    );

  if (!isObject(parsed)) {
    throw new Error(
      `${label}_must_be_an_object`
    );
  }

  return parsed;
}

async function writeJsonAtomic(
  filePath,
  value
) {
  const temporaryPath =
    `${filePath}.tmp-${process.pid}`;

  try {
    await fs.writeFile(
      temporaryPath,
      `${JSON.stringify(
        value,
        null,
        2
      )}\n`,
      {
        encoding: "utf8",
        flag: "w"
      }
    );
    await fs.rename(
      temporaryPath,
      filePath
    );
  } catch (error) {
    await fs.rm(
      temporaryPath,
      {
        force: true
      }
    ).catch(() => {});
    throw error;
  }
}

const runSpec =
  await readJson(
    resolvedRunSpecPath,
    "run_spec"
  );
const captureManifestPath =
  resolveContainedPath(
    privateDirectory,
    runSpec.captureManifestPath,
    "capture_manifest_path"
  );
const captureManifest =
  await readJson(
    captureManifestPath,
    "capture_manifest"
  );

if (
  captureManifest.captureVersion !==
    FACE_LAB_SIMULATION_PILOT_CAPTURE_VERSION
) {
  throw new Error(
    "capture_manifest_version_invalid"
  );
}

const captureDirectory =
  path.dirname(
    captureManifestPath
  );

if (
  captureDirectory !==
    privateDirectory
) {
  throw new Error(
    "capture_manifest_must_be_in_same_private_directory"
  );
}

const sourceImagePath =
  resolveContainedPath(
    captureDirectory,
    captureManifest
      .sourceImagePath,
    "source_image_path"
  );
const outputImagePath =
  resolveContainedPath(
    captureDirectory,
    captureManifest
      .outputImagePath,
    "output_image_path"
  );

const rawSourceImageBytes =
  await fs.readFile(
    sourceImagePath
  );
const outputImageBytes =
  await fs.readFile(
    outputImagePath
  );

if (
  !detectImageSignature(
    outputImageBytes
  )
) {
  throw new Error(
    "output_image_signature_invalid"
  );
}

const canonicalSource =
  await canonicalizeImageBytes({
    bytes:
      rawSourceImageBytes,
    declaredMimeType:
      captureManifest
        .sourceMimeType
  });

if (!canonicalSource.ok) {
  throw new Error(
    `source_image_canonicalization_${canonicalSource.code || "failed"}`
  );
}

if (
  !Array.isArray(
    captureManifest
      .checkEvidencePaths
  ) ||
  captureManifest
    .checkEvidencePaths
    .length !== 2
) {
  throw new Error(
    "capture_review_paths_invalid"
  );
}

let identityScopeReview = null;
let routeColorReview = null;

for (
  const reviewPathValue of
  captureManifest
    .checkEvidencePaths
) {
  const reviewPath =
    resolveContainedPath(
      captureDirectory,
      reviewPathValue,
      "review_path"
    );
  const review =
    await readJson(
      reviewPath,
      "review"
    );

  if (
    review.reviewVersion ===
      FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION &&
    !identityScopeReview
  ) {
    identityScopeReview =
      review;
    continue;
  }

  if (
    review.reviewVersion ===
      FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION &&
    !routeColorReview
  ) {
    routeColorReview =
      review;
    continue;
  }

  throw new Error(
    "capture_review_set_invalid"
  );
}

if (
  !identityScopeReview ||
  !routeColorReview
) {
  throw new Error(
    "capture_review_set_incomplete"
  );
}

const result =
  buildFaceLabSimulationPilotCaseArtifacts({
    runSpec,
    captureManifest,
    canonicalSourceImageBytes:
      canonicalSource.bytes,
    outputImageBytes,
    identityScopeReview,
    routeColorReview
  });

if (result.status !== "ready") {
  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
  process.exitCode = 1;
} else {
  const evidencePacketPath =
    path.join(
      privateDirectory,
      result.outputNames
        .evidencePacket
    );
  const calibrationCasePath =
    path.join(
      privateDirectory,
      result.outputNames
        .calibrationCase
    );

  await writeJsonAtomic(
    evidencePacketPath,
    result.evidencePacket
  );
  await writeJsonAtomic(
    calibrationCasePath,
    result.calibrationCase
  );

  console.log(
    JSON.stringify(
      {
        runnerVersion:
          result.runnerVersion,
        status:
          result.status,
        caseId:
          result.caseId,
        campaignId:
          result.campaignId,
        intentGroupId:
          result.intentGroupId,
        generationIndex:
          result.generationIndex,
        evidencePacketPath:
          `./${result.outputNames.evidencePacket}`,
        calibrationCasePath:
          `./${result.outputNames.calibrationCase}`
      },
      null,
      2
    )
  );
}
