import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveSafeContainedFile, validateRelativePath } from "../../src/index.js";

test("relative path validation rejects traversal and absolute paths", () => {
  assert.equal(validateRelativePath("nested/file.png"), true);
  assert.equal(validateRelativePath("../file.png"), false);
  assert.equal(validateRelativePath("nested/../file.png"), false);
  assert.equal(validateRelativePath(path.resolve("file.png")), false);
  assert.equal(validateRelativePath("C:\\file.png"), false);
});

test("contained regular file resolves safely", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bejewely-safe-path-"));
  await mkdir(path.join(root, "nested"));
  await writeFile(path.join(root, "nested", "file.txt"), "ok");
  const result = await resolveSafeContainedFile(root, "nested/file.txt", "source");
  assert.equal(result.ok, true);
  assert.equal(path.basename(result.absolutePath), "file.txt");
});

test("symbolic links fail closed when the platform permits creating them", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bejewely-safe-link-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "bejewely-safe-outside-"));
  await writeFile(path.join(outside, "file.txt"), "outside");
  try {
    await symlink(path.join(outside, "file.txt"), path.join(root, "link.txt"));
  } catch (error) {
    if (error?.code === "EPERM") {
      t.skip("symlink creation is not permitted on this platform");
      return;
    }
    throw error;
  }
  const result = await resolveSafeContainedFile(root, "link.txt", "source");
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "symlink_forbidden");
});
