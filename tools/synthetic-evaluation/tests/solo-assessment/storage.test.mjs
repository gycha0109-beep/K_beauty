import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  createSoloScreeningClaim,
  finalizeSoloTargetWithheldScreening,
  prepareSoloWaveArtifacts
} from "../../src/solo-assessment/artifacts.js";
import {
  readSoloArtifact,
  readSoloSessionBundle,
  saveSoloClaim,
  saveSoloPreparation,
  saveSoloScreening
} from "../../src/solo-assessment/storage.js";

const hex = (character) => character.repeat(64);

function sourceRows() {
  return ["A","B","C","D"].map((conditionId, index) => ({
    slotId: `slot_${String(index + 1).repeat(24)}`,
    conditionId,
    readiness: "assessable_observed",
    candidateId: `cand_${String(index + 5).repeat(24)}`,
    canonicalAsset: { sha256: hex(String(index + 5)), objectRelativePath: `objects/${index}.png` },
    observationDigest: hex(String(index + 1)),
    authoritativeT5Status: "not_started",
    fixtureId: `${conditionId}_fixture`,
    finalizedSpecDigest: hex(String(index + 5)),
    compiledPromptDigest: hex(String(index + 6)),
    intendedSkinCue: {
      redness: ["B","D"].includes(conditionId) ? "mild" : "none",
      blemishes: ["C","D"].includes(conditionId) ? "mild" : "none",
      blemishCountBand: ["C","D"].includes(conditionId) ? "three_to_five" : "none"
    }
  }));
}

function draft() {
  return {
    reviewability: { face: "reviewable", skin: "reviewable" },
    capture: {
      singleAdultSyntheticPerson: "confirmed",
      directFrontalLevelPose: "confirmed",
      cameraGazeNeutralExpression: "confirmed",
      headShouldersFraming: "confirmed",
      plainBackground: "confirmed",
      softEvenLighting: "confirmed",
      sharpFace: "confirmed",
      hairMakeupAccessoriesControlled: "confirmed"
    },
    skinObservation: {
      redness: { presence: "none", regions: [] },
      blemishes: { presence: "none", countBand: "none", regions: [] }
    },
    artifactFlags: {
      distortedAnatomy: "absent",
      duplicatedOrMissingFeature: "absent",
      visibleTextOrExternalMark: "absent",
      filterOrRetouchPossible: "absent"
    },
    reasonCodes: ["solo_screening_reviewable"],
    priorTargetKnowledgeAcknowledged: true
  };
}

test("T11 storage is append-only and idempotent for identical artifacts", async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "bejewely-solo-storage-"));
  try {
    const prepared = prepareSoloWaveArtifacts({
      campaignRunId: `crun_${"1".repeat(24)}`,
      campaignPlanDigest: hex("a"),
      sourceProjectionDigest: hex("b"),
      waveOrdinal: 1,
      operatorId: "solo_operator",
      sourceRows: sourceRows(),
      createdAt: "2026-08-03T00:00:00.000Z"
    });
    const first = await saveSoloPreparation({ dataRoot, ...prepared });
    const second = await saveSoloPreparation({ dataRoot, ...prepared });
    assert.equal(first.createdCount, 7);
    assert.equal(second.createdCount, 0);
    const loaded = await readSoloSessionBundle({ dataRoot, runId: prepared.session.campaignRunId, waveOrdinal: 1, sessionDigest: prepared.session.sessionDigest });
    assert.equal(loaded.reviewItems.length, 4);

    const entry = loaded.privateMap.entries[0];
    const item = loaded.reviewItems.find((value) => value.reviewItemId === entry.reviewItemId);
    const claim = createSoloScreeningClaim({ session: loaded.session, item, claimedAt: "2026-08-03T00:01:00.000Z" });
    const claimWrite = await saveSoloClaim({ dataRoot, session: loaded.session, claim: claim.claim });
    assert.equal(claimWrite.created, true);
    const screening = finalizeSoloTargetWithheldScreening({ session: loaded.session, item, claim: claim.claim, draft: draft(), submittedAt: "2026-08-03T00:02:00.000Z" });
    const screeningWrite = await saveSoloScreening({ dataRoot, session: loaded.session, screening: screening.screening });
    assert.equal(screeningWrite.created, true);
    const reloaded = await readSoloArtifact({ dataRoot, session: loaded.session, kind: "screening", reviewItemId: item.reviewItemId, digest: screening.screening.screeningDigest });
    assert.equal(reloaded.screeningDigest, screening.screening.screeningDigest);
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});
