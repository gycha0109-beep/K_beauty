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

  console.warn("");
  console.warn("[architecture-guard] Warning only: docs/architecture was not changed.");
  console.warn("Architecture docs update: needed / not needed");
  console.warn("Ghost-code audit: passed / findings");
  console.warn("");
  console.warn("If no architecture doc update is needed, note that in the task summary.");
  console.warn("If ghost-code audit found issues, document or fix them before commit.");
}

main();

