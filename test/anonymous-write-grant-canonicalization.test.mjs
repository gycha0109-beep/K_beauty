import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeAnonymousResultForPersistence,
  createAnonymousWriteGrantTokens
} from "../lib/security/anonymous-write-grant-core.js";

const input = {
  summary: " summary ",
  topPick: { id: "top-1", name: "Top" },
  altPicks: [
    { id: "alt-1", name: "Alternative 1" },
    { id: "alt-2", name: "Alternative 2" }
  ],
  categoryPicks: [
    { id: "category-1", name: "Category 1" },
    { id: "category-2", name: "Category 2" }
  ]
};

test("anonymous result canonicalization remains idempotent for persisted recommendation groups", () => {
  const canonical = canonicalizeAnonymousResultForPersistence(input);

  assert.ok(canonical);
  assert.deepEqual(canonical.altPicks.map(({ id }) => id), ["alt-1", "alt-2"]);
  assert.deepEqual(canonical.categoryPicks.map(({ id }) => id), ["category-1", "category-2"]);
  assert.deepEqual(canonicalizeAnonymousResultForPersistence(canonical), canonical);

  const bundle = createAnonymousWriteGrantTokens({
    secret: "anonymous-write-grant-canonicalization-test-secret",
    anonymousPayload: "anonymous-write-grant-canonicalization-test-principal",
    result: canonical,
    form: { skinType: "combination", mainConcern: "redness" },
    locale: "en",
    nowMs: Date.UTC(2026, 6, 13)
  });

  assert.equal(bundle.grants.length, 2);
  assert.equal(
    canonicalizeAnonymousResultForPersistence({ ...input, unexpectedField: true }),
    null
  );
});
