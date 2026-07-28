import assert from "node:assert/strict";
import {
  diffPremiumSnapshots,
  PREMIUM_SNAPSHOT_DIFF_LIMITS
} from "../lib/premium-snapshot-diff.js";

const existing = {
  decisionBundle: {
    contextRevision: 1,
    contextHash: "ctx-a"
  },
  currentProducts: null,
  nested: [{ stable: true }]
};
const next = structuredClone(existing);
next.decisionBundle.contextRevision = 2;

const diff = diffPremiumSnapshots(existing, next);
assert.equal(diff.equal, false);
assert.equal(diff.diffPaths[0].path, "decisionBundle.contextRevision");
assert.equal(diff.diffPaths[0].existingType, "number");
assert.equal(diff.diffPaths[0].nextType, "number");
assert.match(diff.diffPaths[0].existingHash, /^sha256:[0-9a-f]{64}$/);
assert.match(diff.diffPaths[0].nextHash, /^sha256:[0-9a-f]{64}$/);
assert.equal(JSON.stringify(diff).includes("ctx-a"), false);

const presence = diffPremiumSnapshots(
  { currentProducts: null },
  { currentProducts: { selections: [] } }
);
assert.equal(presence.diffPaths[0].path, "currentProducts");
assert.equal(presence.diffPaths[0].existingType, "null");
assert.equal(presence.diffPaths[0].nextType, "object");

const dangerousExisting = JSON.parse('{"safe":1,"__proto__":{"token":"secret"}}');
const dangerousNext = JSON.parse('{"safe":1,"__proto__":{"token":"changed"}}');
assert.equal(diffPremiumSnapshots(dangerousExisting, dangerousNext).equal, true);

const cyclic = { stable: true };
cyclic.self = cyclic;
const cyclicNext = { stable: true };
cyclicNext.self = cyclicNext;
assert.equal(diffPremiumSnapshots(cyclic, cyclicNext).truncated, true);

const bounded = diffPremiumSnapshots(
  Array.from({ length: 100 }, (_, index) => index),
  Array.from({ length: 100 }, (_, index) => index + 1),
  { maxVisitedEntries: 10, maxDiffPaths: 3 }
);
assert.equal(bounded.truncated, true);
assert.ok(bounded.diffPaths.length <= 3);
assert.equal(PREMIUM_SNAPSHOT_DIFF_LIMITS.maxDiffPaths, 12);

console.log("premium snapshot diff verification passed");
