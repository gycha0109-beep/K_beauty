import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const datasetRoot = path.resolve(directory, "../../src/dataset");

async function files(root) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...await files(absolute));
    else if (/\.js$/.test(entry.name)) result.push(absolute);
  }
  return result;
}

test("T9 dataset runtime has no Provider, network, browser, DB, shell, or model execution path", async () => {
  for (const file of await files(datasetRoot)) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /\bfetch\s*\(|api\.openai\.com|gemini\.google|generativelanguage|playwright|puppeteer|webdriver|@supabase|child_process|execFile|spawn\s*\(|onnx|tensorflow|torch|predict\s*\(|model\.run/i, file);
  }
});

test("T9 does not import production application modules", async () => {
  for (const file of await files(datasetRoot)) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /from\s+["'](?:@\/|\.\.\/\.\.\/\.\.\/)(?:app|components|lib)\//, file);
  }
});

test("T9 public package root exposes checked orchestration, not raw artifact constructors", async () => {
  const source = await readFile(path.resolve(directory, "../../src/index.js"), "utf8");
  assert.match(source, /lockAndActivateDataset/);
  assert.match(source, /verifyCurrentDataset/);
  assert.doesNotMatch(source, /prepareDatasetLockArtifacts/);
  assert.doesNotMatch(source, /createExposureClaim/);
  assert.doesNotMatch(source, /createDatasetSplitPlan/);
  assert.doesNotMatch(source, /assignLeakageComponents/);
});
