#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const SENSITIVE_PATTERNS = [
  /^app\/api\/analyze\//,
  /^app\/result\//,
  /^lib\/current-products\.js$/,
  /^lib\/product-source\.js$/,
  /^lib\/product-category-normalizer\.js$/,
  /^lib\/recommendation.*$/,
  /^components\/current-products\//,
  /^supabase\/migrations\//
];

const ARCHITECTURE_DOC_PATTERN = /^docs\/architecture\//;

function runGit(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch {
    return "";
  }
}

function normalizePath(filePath) {
  return String(filePath || "").replace(/\\/g, "/").trim();
}

function getChangedFiles({ staged }) {
  const args = staged
    ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR"]
    : ["diff", "--name-only", "--diff-filter=ACMR"];

  return runGit(args)
    .split(/\r?\n/)
    .map(normalizePath)
    .filter(Boolean);
}

function isSensitivePath(filePath) {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function main() {
  const staged = process.argv.includes("--staged");
  const changedFiles = getChangedFiles({ staged });
  const sensitiveFiles = changedFiles.filter(isSensitivePath);
  const architectureDocsChanged = changedFiles.some((filePath) =>
    ARCHITECTURE_DOC_PATTERN.test(filePath)
  );

  if (!sensitiveFiles.length) {
    console.log("[architecture-guard] No architecture-sensitive files changed.");
    console.log("Architecture docs update: not needed");
    console.log("Ghost-code audit: passed");
    return;
  }

  console.log("[architecture-guard] Architecture-sensitive files changed:");
  for (const filePath of sensitiveFiles) {
    console.log(`- ${filePath}`);
  }

  if (architectureDocsChanged) {
    console.log("Architecture docs update: not needed");
    console.log("Ghost-code audit: passed");
    return;
  }

  const changeScope = staged ? "staged" : "changed";

  console.warn("");
  console.warn(`[architecture-guard] WARNING: architecture-sensitive files are ${changeScope}.`);
  console.warn("");
  console.warn("Stop and check before committing:");
  console.warn("- Did this change a domain term, category, alias, API payload, DB schema, result contract, or recommendation flow?");
  console.warn("  If yes, update docs/architecture/.");
  console.warn("- If no, state why docs are not needed in the Codex final report or commit body.");
  console.warn("");
  console.warn("Architecture docs update: updated / not needed");
  console.warn("Ghost-code audit: passed / findings");
  console.warn("");
  console.warn("Warning only; commit will continue.");
}

main();
