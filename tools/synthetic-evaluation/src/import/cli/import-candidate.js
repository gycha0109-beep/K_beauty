#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importCandidate } from "../import-candidate.js";

function parseArgs(argv) {
  const args = { request: null, mode: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--request") {
      args.request = argv[index + 1] || null;
      index += 1;
    } else if (value === "--dry-run") {
      args.mode = args.mode ? "invalid" : "dry_run";
    } else if (value === "--confirm") {
      args.mode = args.mode ? "invalid" : "confirm";
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  if (!args.request || !new Set(["dry_run", "confirm"]).has(args.mode)) {
    throw new Error("Usage: import-candidate --request <path> (--dry-run | --confirm)");
  }
  return args;
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function runImportCli(argv, environment = process.env) {
  const args = parseArgs(argv);
  const dataRoot = path.resolve(environment.BEJEWELY_SYNTHETIC_DATA_ROOT || ".synthetic-local");
  const requestRoot = path.join(dataRoot, "requests");
  const requestAbsolutePath = path.resolve(args.request);
  if (!isInside(requestRoot, requestAbsolutePath)) {
    throw new Error("Request file must be inside the configured requests directory");
  }
  const request = JSON.parse(await readFile(requestAbsolutePath, "utf8"));
  return importCandidate({
    request,
    mode: args.mode,
    dataRoot,
    inboxRoot: path.join(dataRoot, "inbox"),
    generationArtifactRoot: requestRoot
  });
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  runImportCli(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (!result.ok) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
