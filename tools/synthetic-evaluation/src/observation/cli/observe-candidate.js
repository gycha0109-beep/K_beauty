#!/usr/bin/env node

import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { observeCandidate } from "../observe-candidate.js";

function parseArgs(argv) {
  const args = { request: null, action: null, apiKeyEnv: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--request") {
      args.request = argv[++index] || null;
    } else if (value === "--preflight") {
      args.action = args.action ? "invalid" : "preflight";
    } else if (value === "--execute") {
      args.action = args.action ? "invalid" : "execute";
    } else if (value === "--api-key-env") {
      args.apiKeyEnv = argv[++index] || null;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  if (!args.request || !new Set(["preflight", "execute"]).has(args.action)) {
    throw new Error("Usage: observe-candidate --request <path> (--preflight | --execute) [--api-key-env <NAME>]");
  }
  if (args.apiKeyEnv && !/^[A-Z][A-Z0-9_]{1,79}$/.test(args.apiKeyEnv)) throw new Error("Invalid --api-key-env name");
  return args;
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function resolveRequestFile(requestsRoot, requestedPath) {
  const rootReal = await realpath(requestsRoot);
  const absolute = path.resolve(requestedPath);
  if (!isInside(rootReal, absolute)) throw new Error("Request file must be inside the configured requests directory");
  const relative = path.relative(rootReal, absolute);
  let current = rootReal;
  for (const segment of relative.split(path.sep)) {
    if (!segment || segment === "." || segment === "..") throw new Error("Unsafe request path");
    current = path.join(current, segment);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error("Symlinked request file is forbidden");
  }
  const resolved = await realpath(current);
  if (!isInside(rootReal, resolved) || !(await lstat(resolved)).isFile()) throw new Error("Request file is invalid");
  return resolved;
}

export async function runObserveCli(argv, environment = process.env) {
  const args = parseArgs(argv);
  const dataRoot = path.resolve(environment.BEJEWELY_SYNTHETIC_DATA_ROOT || ".synthetic-local");
  const requestPath = await resolveRequestFile(path.join(dataRoot, "requests"), args.request);
  const request = JSON.parse(await readFile(requestPath, "utf8"));
  let apiKey = null;
  if (args.action === "execute" && request?.execution?.mode === "provider_bounded") {
    if (!args.apiKeyEnv) throw new Error("Provider execution requires explicit --api-key-env");
    apiKey = environment[args.apiKeyEnv] || null;
  }
  return observeCandidate({ request, action: args.action, dataRoot, apiKey });
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  runObserveCli(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (!result.ok) process.exitCode = 1;
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
