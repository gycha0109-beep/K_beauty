import assert from "node:assert/strict";
import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runImportCli } from "../../src/import/cli/import-candidate.js";
import { createTestImportEnvironment } from "./helpers.mjs";

test("CLI accepts a regular request file inside the configured request root", async () => {
  const environment = await createTestImportEnvironment();
  const requestPath = path.join(environment.requestRoot, "import.json");
  await writeFile(requestPath, `${JSON.stringify(environment.request)}\n`, "utf8");

  const result = await runImportCli(
    ["--request", requestPath, "--dry-run"],
    { BEJEWELY_SYNTHETIC_DATA_ROOT: environment.dataRoot }
  );
  assert.equal(result.ok, true);
  assert.equal(result.mode, "dry_run");
  assert.equal(result.writesPerformed, 0);
});

test("CLI rejects a symlinked request file when the platform permits creating it", async (t) => {
  const environment = await createTestImportEnvironment();
  const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "bejewely-t3-cli-outside-"));
  const outsideRequest = path.join(outsideRoot, "import.json");
  const linkPath = path.join(environment.requestRoot, "linked-import.json");
  await writeFile(outsideRequest, `${JSON.stringify(environment.request)}\n`, "utf8");
  try {
    await symlink(outsideRequest, linkPath);
  } catch (error) {
    if (error?.code === "EPERM") {
      t.skip("symlink creation is not permitted on this platform");
      return;
    }
    throw error;
  }

  await assert.rejects(
    runImportCli(
      ["--request", linkPath, "--dry-run"],
      { BEJEWELY_SYNTHETIC_DATA_ROOT: environment.dataRoot }
    ),
    /Unsafe request file: symlink_forbidden/
  );
});
