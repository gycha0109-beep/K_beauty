import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const evidence = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/london-set-v5-front-upstream-inventory.json",
    "utf8"
  )
);

assert.equal(
  evidence.schemaVersion,
  "face-lab-london-set-v5-front-upstream-inventory-v0"
);
assert.equal(
  evidence.status,
  "upstream_inventory_frozen_execution_receipts_absent"
);
assert.equal(evidence.productionAuthority, false);
assert.equal(evidence.normalizationAuthority, false);
assert.equal(evidence.thresholdAuthority, false);
assert.equal(evidence.adequacyDecisionAuthority, false);
assert.equal(
  evidence.source.mirrorRepository,
  "debruine/webmorphR.stim"
);
assert.equal(
  evidence.source.mirrorCommit,
  "fa8b78fda2d659bb74ce62fcd99c4407551d2a77"
);
assert.equal(
  evidence.source.mirrorTree,
  "0fd6e0d81b2a5513aef9311b34ffb640bb27b4b5"
);

const neutral = evidence.inventory.neutralFront;
const smiling = evidence.inventory.smilingFront;
assert.equal(neutral.length, 102);
assert.equal(smiling.length, 102);

const neutralIds = neutral.map((item) => item.subjectId);
const smilingIds = smiling.map((item) => item.subjectId);
assert.deepEqual(neutralIds, smilingIds);
assert.equal(new Set(neutralIds).size, 102);

for (const item of neutral) {
  assert.match(item.subjectId, /^[0-9]{3}$/);
  assert.equal(
    item.path,
    "inst/neutral_front/" + item.subjectId + "_03.jpg"
  );
  assert.match(item.upstreamGitBlobSha1, /^[a-f0-9]{40}$/);
}
for (const item of smiling) {
  assert.match(item.subjectId, /^[0-9]{3}$/);
  assert.equal(
    item.path,
    "inst/smiling_front/" + item.subjectId + "_08.jpg"
  );
  assert.match(item.upstreamGitBlobSha1, /^[a-f0-9]{40}$/);
}

assert.equal(
  evidence.receiptSemantics.upstreamGitBlobSha1IsExecutionImageSha256,
  false
);
assert.equal(
  evidence.receiptSemantics.executionImageSha256ReceiptsPresent,
  false
);
assert.equal(evidence.receiptSemantics.rawImagesPersistedInEvidence, false);
assert.equal(
  evidence.receiptSemantics.rawLandmarksPersistedInEvidence,
  false
);
assert.equal(evidence.receiptSemantics.identityEmbeddingsPresent, false);
assert.equal(
  evidence.receiptSemantics.biometricIdentityMatchingPerformed,
  false
);
assert.equal(evidence.receiptSemantics.localImagePathsPresent, false);

assert.equal(evidence.scope.referenceCorpusFrontCandidate, true);
assert.equal(evidence.scope.expressionPairCandidate, true);
assert.equal(evidence.scope.yawCandidate, false);
assert.equal(evidence.scope.pitchCandidate, false);
assert.equal(evidence.scope.rollCandidate, false);

console.log(JSON.stringify({
  ok: true,
  neutralFrontCount: neutral.length,
  smilingFrontCount: smiling.length,
  subjectParity: true,
  upstreamInventoryFrozen: true,
  executionImageSha256ReceiptsPresent: false,
  rawImagesPersistedInEvidence: false,
  productionAuthority: false,
  normalizationAuthority: false
}, null, 2));
