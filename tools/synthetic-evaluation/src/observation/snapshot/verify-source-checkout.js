import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { OBSERVATION_SOURCE, OBSERVATION_VERSIONS } from "./canonical-v1.js";

function gitBlobSha(buffer) {
  return createHash("sha1").update(`blob ${buffer.length}\0`).update(buffer).digest("hex");
}

const REQUIRED_TOKENS = Object.freeze({
  "lib/face-lab-observation-contract.js": [
    OBSERVATION_VERSIONS.faceSchemaVersion,
    OBSERVATION_VERSIONS.facePromptVersion
  ],
  "lib/vision-observation-contract.js": [
    OBSERVATION_VERSIONS.visionSchemaVersion,
    OBSERVATION_VERSIONS.visionPromptVersion
  ]
});

export async function verifyObservationSourceCheckout(sourceRoot) {
  const errors = [];
  for (const file of OBSERVATION_SOURCE.files) {
    const absolutePath = path.join(sourceRoot, ...file.path.split("/"));
    let buffer;
    try {
      buffer = await readFile(absolutePath);
    } catch {
      errors.push({ code: "contract_source_file_missing", path: file.path });
      continue;
    }
    const actualBlobSha = gitBlobSha(buffer);
    if (actualBlobSha !== file.blobSha) {
      errors.push({ code: "contract_source_blob_mismatch", path: file.path, expected: file.blobSha, actual: actualBlobSha });
      continue;
    }
    const text = buffer.toString("utf8");
    for (const token of REQUIRED_TOKENS[file.path] || []) {
      if (!text.includes(token)) {
        errors.push({ code: "contract_source_version_mismatch", path: file.path, token });
      }
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors });
}
