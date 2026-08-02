import { readFile } from "node:fs/promises";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { verifyIntentAlignmentIntegrity } from "./alignment.js";
import { verifyDerivedGradeRecordIntegrity } from "./grades.js";
import { writeContentAddressedJson, writeExclusiveJson } from "./artifact-store.js";
import {
  derivedGradeRecordRelativePath,
  intentAlignmentManifestRelativePath,
  intentAlignmentObjectRelativePath,
  toNativePath
} from "./storage-layout.js";

export async function registerIntentAlignment({ dataRoot, alignment, registeredAt = new Date().toISOString() }) {
  if (!verifyIntentAlignmentIntegrity(alignment)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "alignment_artifact_conflict", path: "alignment", detail: null }]) });
  }
  const objectRelativePath = intentAlignmentObjectRelativePath(alignment.alignmentDigest);
  const objectResult = await writeContentAddressedJson(toNativePath(dataRoot, objectRelativePath), alignment);
  const semantic = {
    schemaVersion: "intent-alignment-manifest-v1",
    alignmentId: alignment.alignmentId,
    alignmentDigest: alignment.alignmentDigest,
    candidateId: alignment.candidate.candidateId,
    consensusDigest: alignment.consensus.consensusDigest,
    objectRelativePath
  };
  const manifest = deepFreeze({ ...semantic, registeredAt, manifestDigest: sha256Hex(stableStringify(semantic)) });
  const manifestPath = toNativePath(dataRoot, intentAlignmentManifestRelativePath(alignment.candidate.candidateId, alignment.alignmentId));
  try {
    await writeExclusiveJson(manifestPath, manifest);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = JSON.parse(await readFile(manifestPath, "utf8"));
    if (existing.manifestDigest !== manifest.manifestDigest) throw Object.assign(new Error("alignment_artifact_conflict"), { code: "alignment_artifact_conflict" });
    return Object.freeze({ ok: true, state: "existing", alignment, manifest: existing, writesPerformed: objectResult.created ? 1 : 0 });
  }
  return Object.freeze({ ok: true, state: "registered", alignment, manifest, writesPerformed: (objectResult.created ? 1 : 0) + 1 });
}

export async function registerDerivedGradeRecord({ dataRoot, gradeRecord }) {
  if (!verifyDerivedGradeRecordIntegrity(gradeRecord)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "grade_record_invalid", path: "gradeRecord", detail: null }]) });
  }
  const relativePath = derivedGradeRecordRelativePath(gradeRecord.candidateId, gradeRecord.gradeRecordId);
  const result = await writeContentAddressedJson(toNativePath(dataRoot, relativePath), gradeRecord);
  return Object.freeze({ ok: true, state: result.created ? "registered" : "existing", gradeRecord, objectRelativePath: relativePath, writesPerformed: result.created ? 1 : 0 });
}
