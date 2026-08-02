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

test("blind T5 judgment and consensus modules cannot load generation intent", async () => {
  const files = [
    path.resolve(testDirectory, "../src/judgment/assignment.js"),
    path.resolve(testDirectory, "../src/judgment/submission.js"),
    path.resolve(testDirectory, "../src/judgment/consensus.js"),
    path.resolve(testDirectory, "../src/judgment/blind-registrar.js")
  ];
  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    assert.doesNotMatch(source, /(?:\.\.\/)?generation\/|intent-resolver|read-intent-artifacts|alignment(?:-registrar)?|grades\.js|candidate-manifest/i, file);
    assert.doesNotMatch(source, /compiledPrompt|specDigest|promptDigest|campaignId|conditionId|intendedLabels|generationArtifact|\bpurpose\b/, file);
  }
});

test("T5 assignment CLI derives input from authoritative T4 artifacts", async () => {
  const source = await fs.readFile(path.resolve(testDirectory, "../src/judgment/cli/judge.js"), "utf8");
  assert.match(source, /prepareBlindJudgmentAssignment/);
  assert.doesNotMatch(source, /createBlindJudgmentAssignment/);
  assert.doesNotMatch(source, /--blind-input/);
});

test("public T5 API exposes authority-checked orchestration rather than raw alignment derivation", async () => {
  const source = await fs.readFile(path.resolve(testDirectory, "../src/index.js"), "utf8");
  assert.match(source, /prepareBlindJudgmentAssignment/);
  assert.match(source, /prepareStoredJudgmentAlignment/);
  assert.doesNotMatch(source, /export \{ createBlindJudgmentAssignment/);
  assert.doesNotMatch(source, /export \{ buildJudgmentConsensus/);
  assert.doesNotMatch(source, /export \{ resolveCandidateIntent/);
  assert.doesNotMatch(source, /export \{ alignJudgmentToIntent/);
  assert.doesNotMatch(source, /export \{ deriveG2ObservedRecord/);
});

test("T5 runtime has no Provider, browser, DB, or shell execution", async () => {
  for (const file of await collectFiles(path.resolve(testDirectory, "../src/judgment"))) {
    const source = await fs.readFile(file, "utf8");
    assert.doesNotMatch(source, /\bfetch\s*\(|api\.openai\.com|gemini\.google|generativelanguage|playwright|puppeteer|webdriver|@supabase|child_process|execFile|spawn\s*\(/i, file);
  }
});

test("T6 runtime has no Provider, browser, DB, shell, or image transformation execution", async () => {
  for (const file of await collectFiles(path.resolve(testDirectory, "../src/promotion"))) {
    const source = await fs.readFile(file, "utf8");
    assert.doesNotMatch(source, /\bfetch\s*\(|api\.openai\.com|gemini\.google|generativelanguage|playwright|puppeteer|webdriver|@supabase|child_process|execFile|spawn\s*\(/i, file);
    assert.doesNotMatch(source, /sharp\s*\(|resize\s*\(|extract\s*\(|composite\s*\(/i, file);
  }
});

test("public T6 API exposes authority-checked orchestration rather than raw promotion constructors", async () => {
  const source = await fs.readFile(path.resolve(testDirectory, "../src/index.js"), "utf8");
  assert.match(source, /preparePromotionSourcePreflight/);
  assert.match(source, /preparePromotionPolicyReviewPreflight/);
  assert.match(source, /confirmPromotion/);
  assert.doesNotMatch(source, /export \{ assemblePromotionEvidenceBundle/);
  assert.doesNotMatch(source, /export \{ deriveG4GradeRecord/);
  assert.doesNotMatch(source, /export \{ derivePromotionDecision/);
  assert.doesNotMatch(source, /export \{ finalizePromotionReviewSubmission/);
});

test("T7 runtime performs no generation Provider, browser, DB, shell, image transformation, or automatic human decision execution", async () => {
  for (const file of await collectFiles(path.resolve(testDirectory, "../src/campaign"))) {
    const source = await fs.readFile(file, "utf8");
    assert.doesNotMatch(source, /\bfetch\s*\(|api\.openai\.com|gemini\.google|generativelanguage|playwright|puppeteer|webdriver|@supabase|child_process|execFile|spawn\s*\(/i, file);
    assert.doesNotMatch(source, /sharp\s*\(|resize\s*\(|extract\s*\(|composite\s*\(/i, file);
    assert.doesNotMatch(source, /autoReview|autoPromote|autoGenerate|assignSplit|lockHoldout/i, file);
  }
});

test("T7 CLI exposes single-boundary orchestration and no prohibited automation command", async () => {
  const source = await fs.readFile(path.resolve(testDirectory, "../src/campaign/cli/campaign.js"), "utf8");
  assert.match(source, /--compile/);
  assert.match(source, /--issue-wave/);
  assert.match(source, /--generation-handoff/);
  assert.match(source, /--checkpoint/);
  assert.match(source, /--advance/);
  assert.doesNotMatch(source, /--auto-all|--generate-provider|--auto-review|--auto-promote|--assign-split|--lock-holdout/);
});

test("T3 through T7 expose no batch, G5, holdout, or split execution command", async () => {
  const packageJson = JSON.parse(await fs.readFile(path.resolve(testDirectory, "../package.json"), "utf8"));
  const scripts = Object.keys(packageJson.scripts || {});
  assert.equal(scripts.some((name) => /batch/i.test(name)), false);
  assert.equal(scripts.some((name) => /g5|holdout|split|lock/i.test(name)), false);
  assert.equal(scripts.includes("promote"), true);
  assert.equal(scripts.includes("campaign"), true);
});
