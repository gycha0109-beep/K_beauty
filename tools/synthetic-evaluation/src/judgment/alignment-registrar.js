import { readFile } from "node:fs/promises";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { verifyIntentAlignmentIntegrity } from "./alignment.js";
import { verifyDerivedGradeRecordIntegrity } from "./grades.js";
import { writeExclusiveJson, writeSemanticAddressedJson } from "./artifact-store.js";
import {
  derivedGradeRecordRelativePath,
  intentAlignmentManifestRelativePath,
  intentAlignmentObjectRelativePath,
  toNativePath
} from "./storage-layout.js";

const ALIGNMENT_MANIFEST_KEYS = Object.freeze([
  "schemaVersion",
  "alignmentId",
  "alignmentDigest",
  "candidateId",
  "consensusDigest",
  "objectRelativePath",
  "registeredAt",
  "manifestDigest"
]);

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function verifyAlignmentManifest(manifest, alignment) {
  if (!exactKeys(manifest, ALIGNMENT_MANIFEST_KEYS)) return false;
  const { registeredAt, manifestDigest, ...semantic } = manifest;
  const expectedObjectPath = intentAlignmentObjectRelativePath(alignment.alignmentDigest);
  return manifest.schemaVersion === "intent-alignment-manifest-v1" &&
    manifest.alignmentId === alignment.alignmentId &&
    manifest.alignmentDigest === alignment.alignmentDigest &&
    manifest.candidateId === alignment.candidate.candidateId &&
    manifest.consensusDigest === alignment.consensus.consensusDigest &&
    manifest.objectRelativePath === expectedObjectPath &&
    Number.isFinite(Date.parse(registeredAt)) &&
    manifestDigest === sha256Hex(stableStringify(semantic));
}

export async function registerIntentAlignment({ dataRoot, alignment, registeredAt = new Date().toISOString() }) {
  if (!verifyIntentAlignmentIntegrity(alignment) || !Number.isFinite(Date.parse(registeredAt))) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "alignment_artifact_conflict", path: "alignment", detail: null }]) });
  }
  const objectRelativePath = intentAlignmentObjectRelativePath(alignment.alignmentDigest);
  const objectResult = await writeSemanticAddressedJson(
    toNativePath(dataRoot, objectRelativePath),
    alignment,
    (existing, proposed) => verifyIntentAlignmentIntegrity(existing) && existing.alignmentDigest === proposed.alignmentDigest
  );
  const storedAlignment = objectResult.value;
  const semantic = {
    schemaVersion: "intent-alignment-manifest-v1",
    alignmentId: storedAlignment.alignmentId,
    alignmentDigest: storedAlignment.alignmentDigest,
    candidateId: storedAlignment.candidate.candidateId,
    consensusDigest: storedAlignment.consensus.consensusDigest,
    objectRelativePath
  };
  const manifest = deepFreeze({ ...semantic, registeredAt, manifestDigest: sha256Hex(stableStringify(semantic)) });
  const manifestPath = toNativePath(dataRoot, intentAlignmentManifestRelativePath(storedAlignment.candidate.candidateId, storedAlignment.alignmentId));
  try {
    await writeExclusiveJson(manifestPath, manifest);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let existing;
    try {
      existing = JSON.parse(await readFile(manifestPath, "utf8"));
    } catch {
      throw Object.assign(new Error("alignment_artifact_conflict"), { code: "alignment_artifact_conflict" });
    }
    if (!verifyAlignmentManifest(existing, storedAlignment)) throw Object.assign(new Error("alignment_artifact_conflict"), { code: "alignment_artifact_conflict" });
    return Object.freeze({ ok: true, state: "existing", alignment: storedAlignment, manifest: existing, writesPerformed: objectResult.created ? 1 : 0 });
  }
  return Object.freeze({ ok: true, state: "registered", alignment: storedAlignment, manifest, writesPerformed: (objectResult.created ? 1 : 0) + 1 });
}

export async function registerDerivedGradeRecord({ dataRoot, gradeRecord }) {
  if (!verifyDerivedGradeRecordIntegrity(gradeRecord)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "grade_record_invalid", path: "gradeRecord", detail: null }]) });
  }
  const relativePath = derivedGradeRecordRelativePath(gradeRecord.candidateId, gradeRecord.gradeRecordId);
  const result = await writeSemanticAddressedJson(
    toNativePath(dataRoot, relativePath),
    gradeRecord,
    (existing, proposed) => verifyDerivedGradeRecordIntegrity(existing) && existing.gradeRecordDigest === proposed.gradeRecordDigest
  );
  return Object.freeze({ ok: true, state: result.created ? "registered" : "existing", gradeRecord: result.value, objectRelativePath: relativePath, writesPerformed: result.created ? 1 : 0 });
}
