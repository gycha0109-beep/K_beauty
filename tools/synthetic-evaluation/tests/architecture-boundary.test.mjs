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
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    else if (/\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

test("production application does not import the synthetic evaluation toolkit", async () => {
  const productionRoots = ["app", "components", "lib"].map((item) => path.join(workspaceRoot, item));
  const existingRoots = [];
  for (const root of productionRoots) {
    try { await fs.access(root); existingRoots.push(root); } catch { /* mini workspace */ }
  }
  for (const root of existingRoots) {
    for (const file of await collectFiles(root)) {
      assert.doesNotMatch(await fs.readFile(file, "utf8"), /@bejewely\/synthetic-evaluation/);
    }
  }
});

test("generation source contains no network, browser automation, or image write adapter", async () => {
  for (const file of await collectFiles(path.resolve(testDirectory, "../src/generation"))) {
    const source = await fs.readFile(file, "utf8");
    assert.doesNotMatch(source, /\bfetch\s*\(/, file);
    assert.doesNotMatch(source, /playwright|puppeteer|webdriver/i, file);
    assert.doesNotMatch(source, /writeFile|createWriteStream|appendFile/, file);
  }
});

test("import source has no network, browser automation, shell, or Provider execution", async () => {
  for (const file of await collectFiles(path.resolve(testDirectory, "../src/import"))) {
    const source = await fs.readFile(file, "utf8");
    assert.doesNotMatch(source, /\bfetch\s*\(/, file);
    assert.doesNotMatch(source, /playwright|puppeteer|webdriver/i, file);
    assert.doesNotMatch(source, /child_process|execFile|spawn\s*\(/, file);
    assert.doesNotMatch(source, /gemini\.google|api\.openai|generativelanguage/i, file);
  }
});

test("observation source keeps production, browser, DB, and shell boundaries isolated", async () => {
  const observationRoot = path.resolve(testDirectory, "../src/observation");
  for (const file of await collectFiles(observationRoot)) {
    const source = await fs.readFile(file, "utf8");
    assert.doesNotMatch(source, /from\s+[#']@\/lib\//, file);
    assert.doesNotMatch(source, /server-only|@supabase|playwright|puppeteer|webdriver|child_process|execFile|spawn\s*\(/i, file);
    if (!file.endsWith(`${path.sep}openai-transport.js`)) {
      assert.doesNotMatch(source, /\bfetch\s*\(/, file);
      assert.doesNotMatch(source, /api\.openai\.com/i, file);
    }
  }
});

test("observation request and execution paths do not accept generation intent", async () => {
  const files = [
    path.resolve(testDirectory, "../src/observation/observe-candidate.js"),
    path.resolve(testDirectory, "../src/observation/preflight-observation.js"),
    path.resolve(testDirectory, "../../../packages/face-contracts/src/synthetic-observation/observation-contract.js")
  ];
  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    assert.doesNotMatch(source, /generationArtifact|compiledPrompt|specDigest|promptDigest|campaignId|conditionId|intendedLabels/, file);
  }
});

test("T3 and T4 expose no batch execution command", async () => {
  const packageJson = JSON.parse(await fs.readFile(path.resolve(testDirectory, "../package.json"), "utf8"));
  assert.equal(Object.keys(packageJson.scripts || {}).some((name) => /batch/i.test(name)), false);
});
