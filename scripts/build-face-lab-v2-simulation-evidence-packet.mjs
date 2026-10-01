#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  canonicalizeImageBytes,
  detectImageSignature
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

function isObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function isSha256(value) {
  return typeof value === "string" &&
    /^[a-f0-9]{64}$/i.test(
      value.trim()
    );
}

async function loadCheckEvidence() {
  const mergedChecks = {};
  const refs = [];
  const seenCheckIds = new Set();

  const mergeFragment = (
    fragment,
    sourceLabel
  ) => {
    if (!isObject(fragment)) {
      throw new Error(
        `check evidence must be an object: ${sourceLabel}`
      );
    }

    for (const [
      checkId,
      check
    ] of Object.entries(fragment)) {
      if (seenCheckIds.has(checkId)) {
        throw new Error(
          `duplicate check evidence: ${checkId}`
        );
      }

      seenCheckIds.add(checkId);
      mergedChecks[checkId] = check;
    }
  };

  if (input.checks != null) {
    mergeFragment(
      input.checks,
      "input.checks"
    );
  }

  if (
    input.checkEvidencePaths != null &&
    !Array.isArray(
      input.checkEvidencePaths
    )
  ) {
    throw new Error(
      "checkEvidencePaths must be an array"
    );
  }

  for (
    const rawPath of
    input.checkEvidencePaths || []
  ) {
    const evidencePath =
      resolveLocalPath(
        rawPath,
        "checkEvidencePaths[]"
      );
    const evidence =
      JSON.parse(
        await fs.readFile(
          evidencePath,
          "utf8"
        )
      );

    if (!isObject(evidence)) {
      throw new Error(
        "check evidence file must contain an object"
      );
    }

    if (
      evidence.caseId != null &&
      evidence.caseId !== input.caseId
    ) {
      throw new Error(
        "check evidence caseId mismatch"
      );
    }

    const fragment =
      isObject(evidence.checks)
        ? evidence.checks
        : evidence;

    mergeFragment(
      fragment,
      "checkEvidencePaths[]"
    );

    if (
      typeof evidence.reviewVersion ===
        "string" &&
      isSha256(
        evidence.responseDigest
      )
    ) {
      refs.push({
        evidenceVersion:
          evidence.reviewVersion.trim(),
        evidenceDigest:
          evidence.responseDigest
            .trim()
            .toLowerCase(),
        checkIds:
          Object.keys(fragment)
            .sort()
      });
    }
  }

  return {
    checks:
      seenCheckIds.size
        ? mergedChecks
        : null,
    refs
  };
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

if (!detectImageSignature(outputImageBytes)) {
  throw new Error(
    "output_image_signature_invalid"
  );
}

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

const checkEvidence =
  await loadCheckEvidence();

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
      checkEvidence.checks,
    checkEvidenceRefs:
      checkEvidence.refs
  });

console.log(
  JSON.stringify(packet, null, 2)
);

if (packet.status !== "ready") {
  process.exitCode = 1;
}
