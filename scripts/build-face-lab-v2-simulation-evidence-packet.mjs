#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  canonicalizeImageBytes
} from "../lib/image-upload-boundary-core.js";
import {
  buildFaceLabSimulationEvidencePacket
} from "../lib/face-lab-v2/evaluation/simulation-evidence-packet.js";

const inputPath =
  process.argv[2] ||
  process.env.FACE_LAB_SIMULATION_EVIDENCE_INPUT;

if (!inputPath) {
  throw new Error(
    "Provide an input JSON path as argv[2] or FACE_LAB_SIMULATION_EVIDENCE_INPUT"
  );
}

const resolvedInputPath =
  path.resolve(inputPath);
const inputDirectory =
  path.dirname(resolvedInputPath);

const input = JSON.parse(
  await fs.readFile(
    resolvedInputPath,
    "utf8"
  )
);

function resolveLocalPath(value, label) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `${label} must be a non-empty local path`
    );
  }

  return path.resolve(
    inputDirectory,
    value.trim()
  );
}

const sourceImagePath =
  resolveLocalPath(
    input.sourceImagePath,
    "sourceImagePath"
  );
const outputImagePath =
  resolveLocalPath(
    input.outputImagePath,
    "outputImagePath"
  );

const rawSourceBytes =
  await fs.readFile(sourceImagePath);
const outputImageBytes =
  await fs.readFile(outputImagePath);

const canonicalSource =
  await canonicalizeImageBytes({
    bytes: rawSourceBytes,
    declaredMimeType:
      input.sourceMimeType
  });

if (!canonicalSource.ok) {
  throw new Error(
    `source_image_canonicalization_${canonicalSource.code || "failed"}`
  );
}

const packet =
  buildFaceLabSimulationEvidencePacket({
    caseId: input.caseId,
    analysis: input.analysis,
    rawState: input.faceLabV2State,
    locale: input.locale,
    canonicalSourceImageBytes:
      canonicalSource.bytes,
    outputImageBytes,
    responseMeta:
      input.responseMeta,
    checks:
      input.checks || null
  });

console.log(
  JSON.stringify(packet, null, 2)
);

if (packet.status !== "ready") {
  process.exitCode = 1;
}
