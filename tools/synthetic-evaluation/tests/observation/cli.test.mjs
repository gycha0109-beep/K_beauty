import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CANONICAL_OBSERVATION_PROFILE } from "@bejewely/face-contracts";
import { runObserveCli } from "../../src/observation/cli/observe-candidate.js";
import { CANONICAL_OBSERVATION_SNAPSHOT } from "../../src/observation/snapshot/canonical-v1.js";

async function fixture() {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "bejewely-t4-cli-"));
  const bytes = Buffer.from("synthetic-cli-image");
  const relative = "objects/canonical/by-sha/bb/image.png";
  const image = path.join(dataRoot, ...relative.split("/"));
  await mkdir(path.dirname(image), { recursive: true });
  await writeFile(image, bytes);
  const request = {
    schemaVersion: "observation-run-request-v1",
    candidate: {
      candidateId: "cand_abcdefabcdefabcdefabcdef",
      canonicalAsset: {
        sha256: createHash("sha256").update(bytes).digest("hex"),
        objectRelativePath: relative,
        transformPolicyVersion: "canonical-image-v1"
      }
    },
    adapterProfile: { id: CANONICAL_OBSERVATION_PROFILE.id, version: CANONICAL_OBSERVATION_PROFILE.version },
    contractSnapshotId: CANONICAL_OBSERVATION_SNAPSHOT.snapshotId,
    execution: { mode: "fixture_replay", requestedModel: CANONICAL_OBSERVATION_PROFILE.fixtureModel, replicateOrdinal: 1 }
  };
  const requestPath = path.join(dataRoot, "requests", "observe.json");
  await mkdir(path.dirname(requestPath), { recursive: true });
  await writeFile(requestPath, JSON.stringify(request));
  return { dataRoot, requestPath, cleanup: () => rm(dataRoot, { recursive: true, force: true }) };
}

test("CLI preflight and fixture execute require a contained regular request file", async () => {
  const item = await fixture();
  try {
    const env = { BEJEWELY_SYNTHETIC_DATA_ROOT: item.dataRoot };
    const preflight = await runObserveCli(["--request", item.requestPath, "--preflight"], env);
    assert.equal(preflight.ok, true);
    assert.equal(preflight.state, "ready");
    const execute = await runObserveCli(["--request", item.requestPath, "--execute"], env);
    assert.equal(execute.ok, true);
  } finally {
    await item.cleanup();
  }
});

test("CLI rejects a symlinked request when the platform permits it", async (t) => {
  const item = await fixture();
  try {
    const link = path.join(item.dataRoot, "requests", "linked.json");
    try {
      await symlink(item.requestPath, link);
    } catch {
      t.skip("symlink unavailable");
      return;
    }
    await assert.rejects(
      () => runObserveCli(["--request", link, "--preflight"], { BEJEWELY_SYNTHETIC_DATA_ROOT: item.dataRoot }),
      /Symlinked request file is forbidden/
    );
  } finally {
    await item.cleanup();
  }
});
