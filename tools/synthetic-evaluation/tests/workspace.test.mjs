import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

function normalizedPathFromModuleUrl(moduleUrl) {
  return path.normalize(fileURLToPath(moduleUrl));
}

test("workspace packages resolve as ESM modules", async () => {
  const contractEntryUrl = import.meta.resolve("@bejewely/face-contracts");
  const contractEntryPath = normalizedPathFromModuleUrl(contractEntryUrl);

  assert.ok(
    contractEntryPath.endsWith(path.normalize("packages/face-contracts/src/index.js")),
    `unexpected contract entry: ${contractEntryPath}`
  );

  const contractModule = await import("@bejewely/face-contracts");
  const toolkitModule = await import("../src/index.js");

  assert.equal(typeof contractModule.validateDraftGenerationSpec, "function");
  assert.equal(typeof toolkitModule.compileGenerationPrompt, "function");
});
