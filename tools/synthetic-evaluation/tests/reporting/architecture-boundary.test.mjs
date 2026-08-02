import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(directory, "../../src/reporting");

async function collectFiles(root) {
  const files = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute));
    else if (/\.(?:js|mjs|ts)$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

test("T8 reporting runtime has no Provider, browser, database, shell, or upload execution", async () => {
  for (const file of await collectFiles(sourceRoot)) {
    const source = await fs.readFile(file, "utf8");
    assert.doesNotMatch(source, /\bfetch\s*\(|api\.openai\.com|gemini\.google|generativelanguage|playwright|puppeteer|webdriver|@supabase|child_process|execFile|spawn\s*\(|upload|publishPublic/i, file);
  }
});

test("T8 exposes no split, holdout, G5, training, or automatic judgment operation", async () => {
  const files = await collectFiles(sourceRoot);
  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    assert.doesNotMatch(source, /assignSplit|createG5|lockHoldout|trainDataset|autoReview|autoPromote|autoJudge/i, file);
  }
  const packageJson = JSON.parse(await fs.readFile(path.resolve(directory, "../../package.json"), "utf8"));
  assert.equal(Object.keys(packageJson.scripts).some((name) => /g5|holdout|split|train|public/i.test(name)), false);
  assert.equal(packageJson.scripts.report.includes("reporting/cli/report.js"), true);
  assert.equal(packageJson.scripts.export.includes("reporting/cli/export.js"), true);
});

test("public T8 API exposes authority-checked orchestration and integrity verification only", async () => {
  const source = await fs.readFile(path.resolve(directory, "../../src/index.js"), "utf8");
  assert.match(source, /preflightCampaignReport/);
  assert.match(source, /buildAndStoreCampaignReviewPackage/);
  assert.match(source, /confirmCampaignReport/);
  assert.match(source, /exportCampaignReport/);
  assert.doesNotMatch(source, /export \{ buildCampaignEvidenceSnapshot/);
  assert.doesNotMatch(source, /export \{ deriveCampaignMetricSet/);
  assert.doesNotMatch(source, /export \{ deriveInterpretationClaims/);
  assert.doesNotMatch(source, /export \{ buildExportFiles/);
});

test("T8 thumbnail code is resize-only and does not crop, retouch, composite, or recolor", async () => {
  const source = await fs.readFile(path.resolve(sourceRoot, "review-package.js"), "utf8");
  assert.match(source, /withoutEnlargement/);
  assert.match(source, /fit: THUMBNAIL_POLICY\.fit/);
  assert.doesNotMatch(source, /\.extract\s*\(|\.composite\s*\(|\.tint\s*\(|\.modulate\s*\(|\.sharpen\s*\(|\.blur\s*\(/);
});

test("T8 CLI requires internal review export and exposes no public publish command", async () => {
  const exportCli = await fs.readFile(path.resolve(sourceRoot, "cli/export.js"), "utf8");
  const reportCli = await fs.readFile(path.resolve(sourceRoot, "cli/report.js"), "utf8");
  assert.match(exportCli, /--internal-review/);
  assert.doesNotMatch(exportCli, /--public|--upload|--publish/);
  assert.match(reportCli, /--source-preflight/);
  assert.match(reportCli, /--build-review-package/);
  assert.match(reportCli, /--confirm/);
  assert.doesNotMatch(reportCli, /--winner|--rank|--significance|--causal/);
});
