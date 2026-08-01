import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(testDirectory, "../../..");

async function collectFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else if (/\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

test("production application does not import the synthetic evaluation toolkit", async () => {
  const productionRoots = ["app", "components", "lib"]
    .map((item) => path.join(workspaceRoot, item));
  const existingRoots = [];
  for (const root of productionRoots) {
    try {
      await fs.access(root);
      existingRoots.push(root);
    } catch {
      // Mini-workspace tests may not contain production roots.
    }
  }
  for (const root of existingRoots) {
    for (const file of await collectFiles(root)) {
      const source = await fs.readFile(file, "utf8");
      assert.doesNotMatch(source, /@bejewely\/synthetic-evaluation/);
    }
  }
});

test("generation source contains no network, browser automation, or image write adapter", async () => {
  const sourceRoot = path.resolve(testDirectory, "../src/generation");
  for (const file of await collectFiles(sourceRoot)) {
    const source = await fs.readFile(file, "utf8");
    assert.doesNotMatch(source, /\bfetch\s*\(/, file);
    assert.doesNotMatch(source, /playwright|puppeteer|webdriver/i, file);
    assert.doesNotMatch(source, /writeFile|createWriteStream|appendFile/, file);
  }
});
