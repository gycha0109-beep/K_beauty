import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { candidateManifestRelativePath } from "../../src/import/storage-layout.js";
import { preparePromotionSourcePreflight } from "../../src/promotion/orchestrator.js";
import { verifyPromotionSourceSnapshotIntegrity } from "../../src/promotion/source-snapshot.js";
import { sha256Hex, stableStringify } from "../../src/shared/canonical-json.js";
import { setupStoredPromotionCase } from "./helpers.mjs";

function resealSnapshot(value) {
  const clone = JSON.parse(JSON.stringify(value));
  const { assembledAt, sourceSnapshotDigest, ...semantic } = clone;
  clone.sourceSnapshotDigest = sha256Hex(stableStringify(semantic));
  return clone;
}

async function overwriteManifest(stored, manifest) {
  const manifestPath = path.join(stored.dataRoot, ...candidateManifestRelativePath(manifest.candidateId).split("/"));
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, "utf8");
}

test("source preflight re-verifies stored T3/T4/T5 evidence and writes nothing", async () => {
  const stored = await setupStoredPromotionCase({ fixture: "D" });
  const result = await preparePromotionSourcePreflight({
    dataRoot: stored.dataRoot,
    candidateId: stored.candidateManifest.candidateId,
    alignmentDigest: stored.alignment.alignmentDigest,
    assembledAt: "2026-08-02T05:00:00.000Z"
  });
  assert.equal(result.ok, true);
  assert.equal(result.writesPerformed, 0);
  assert.deepEqual(result.snapshot.judgment.judgmentActorIds, ["judge_alpha", "judge_beta"]);
  assert.equal(result.snapshot.observation.g2RecordDigest, stored.g2.gradeRecordDigest);
  assert.equal(result.snapshot.judgment.g3RecordDigest, stored.g3.gradeRecordDigest);
  assert.equal(result.snapshot.claims.claimValues.find((item) => item.axis === "skin.blemishes.countBand").value, "three_to_five");
  assert.equal(verifyPromotionSourceSnapshotIntegrity(result.snapshot), true);
});

test("recomputed outer digest cannot hide a forged judgment actor set", async () => {
  const stored = await setupStoredPromotionCase();
  const result = await preparePromotionSourcePreflight({
    dataRoot: stored.dataRoot,
    candidateId: stored.candidateManifest.candidateId,
    alignmentDigest: stored.alignment.alignmentDigest
  });
  const tampered = JSON.parse(JSON.stringify(result.snapshot));
  tampered.judgment.judgmentActorIds = ["judge_alpha"];
  assert.equal(verifyPromotionSourceSnapshotIntegrity(resealSnapshot(tampered)), false);
});

test("candidate projection change invalidates reuse of the stored T5 alignment", async () => {
  const stored = await setupStoredPromotionCase({ markStatus: "absent" });
  const changed = JSON.parse(JSON.stringify(stored.candidateManifest));
  changed.operatorHints.visibleExternalMark.status = "unknown";
  await overwriteManifest(stored, changed);
  const result = await preparePromotionSourcePreflight({
    dataRoot: stored.dataRoot,
    candidateId: changed.candidateId,
    alignmentDigest: stored.alignment.alignmentDigest
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "candidate_alignment_mismatch");
});

test("T6 rejects weakened T3 synthetic and rights attestation even when candidate identity is unchanged", async () => {
  const stored = await setupStoredPromotionCase();
  const changed = JSON.parse(JSON.stringify(stored.candidateManifest));
  changed.operatorAttestation.termsAndRightsReviewed = false;
  await overwriteManifest(stored, changed);
  const result = await preparePromotionSourcePreflight({
    dataRoot: stored.dataRoot,
    candidateId: changed.candidateId,
    alignmentDigest: stored.alignment.alignmentDigest
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "artifact_integrity_invalid");
});
