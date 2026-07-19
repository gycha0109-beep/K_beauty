import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { loadHostedManifest } from "./premium-hosted-preview-core.mjs";

const root = await mkdtemp(resolve(tmpdir(), "bejewely-user-hash-contract-"));

function manifestFixture(accountAHash, accountBHash) {
  return {
    accountA: { expectedUserIdHash: accountAHash },
    accountB: { expectedUserIdHash: accountBHash },
    fixtures: { normalPhoto: "normal.png", fallbackPhoto: "fallback.png" },
    uiCases: { ko: "ko.json", en: "en.json" },
    currentProductCases: [{}, {}, {}, {}]
  };
}

async function writeManifest(name, document) {
  const path = resolve(root, name);
  await writeFile(path, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  return path;
}

try {
  const hashA = `sha256:${"a".repeat(64)}`;
  const hashB = `sha256:${"b".repeat(64)}`;
  const validPath = await writeManifest("valid.json", manifestFixture(hashA, hashB));
  const valid = await loadHostedManifest(validPath);
  assert.equal(valid.accountA.expectedUserIdHash, hashA);
  assert.equal(valid.accountB.expectedUserIdHash, hashB);

  const unprefixedAPath = await writeManifest(
    "unprefixed-a.json",
    manifestFixture("a".repeat(64), hashB)
  );
  await assert.rejects(
    loadHostedManifest(unprefixedAPath),
    (error) => error.code === "account_a_hash_missing_or_invalid"
  );

  const unprefixedBPath = await writeManifest(
    "unprefixed-b.json",
    manifestFixture(hashA, "b".repeat(64))
  );
  await assert.rejects(
    loadHostedManifest(unprefixedBPath),
    (error) => error.code === "account_b_hash_missing_or_invalid"
  );

  const wrongAlgorithmPath = await writeManifest(
    "wrong-algorithm.json",
    manifestFixture(`sha1:${"a".repeat(64)}`, hashB)
  );
  await assert.rejects(
    loadHostedManifest(wrongAlgorithmPath),
    (error) => error.code === "account_a_hash_missing_or_invalid"
  );

  console.log("premium hosted preview user hash contract verification passed");
} finally {
  await rm(root, { recursive: true, force: true });
}
