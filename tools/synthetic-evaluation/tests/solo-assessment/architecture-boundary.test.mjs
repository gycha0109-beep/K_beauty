import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const soloRoot = path.resolve(directory, "../../src/solo-assessment");

async function files(root) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...await files(absolute));
    else if (/\.js$/.test(entry.name)) result.push(absolute);
  }
  return result;
}

test("T11 has no Provider, browser, DB, shell, upload, or production execution path", async () => {
  for (const file of await files(soloRoot)) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /\bfetch\s*\(|api\.openai\.com|gemini\.google|generativelanguage|playwright|puppeteer|webdriver|@supabase|child_process|execFile|spawn\s*\(|FormData|upload/i, file);
    assert.doesNotMatch(source, /from\s+["'](?:@\/|\.\.\/\.\.\/\.\.\/)(?:app|components|lib)\//, file);
  }
});

test("T11 does not import T5 consensus, T6 promotion, T8 mutation, or T9 dataset operations", async () => {
  for (const file of await files(soloRoot)) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /\.\.\/judgment\/|\.\.\/promotion\/|\.\.\/reporting\/|\.\.\/dataset\//, file);
    assert.doesNotMatch(source, /registerJudgment|registerIntentAlignment|confirmPromotion|lockAndActivateDataset|confirmCampaignReport/, file);
  }
});

test("public T11 exports authority-checked orchestration and integrity verification only", async () => {
  const source = await readFile(path.resolve(directory, "../../src/index.js"), "utf8");
  assert.match(source, /prepareSoloWave/);
  assert.match(source, /submitSoloScreening/);
  assert.match(source, /submitSoloIntentAssessment/);
  assert.match(source, /confirmSoloWaveBrief/);
  assert.match(source, /deriveSoloAlignmentReport/);
  assert.doesNotMatch(source, /createSoloWaveAssessmentRow/);
  assert.doesNotMatch(source, /createSoloIntentRevealReceipt/);
  assert.doesNotMatch(source, /finalizeSoloTargetWithheldScreening/);
  assert.doesNotMatch(source, /createSoloCueAlignment/);
  assert.doesNotMatch(source, /createSoloWaveAlignmentReport/);
});
