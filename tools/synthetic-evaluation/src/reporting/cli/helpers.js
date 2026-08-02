import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveSafeContainedFile } from "../../import/resolve-safe-path.js";
import { stableStringify } from "../../shared/canonical-json.js";

export function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) flags.add(token);
    else { values.set(token, next); index += 1; }
  }
  return { flags, values };
}

export function resolveDataRoot() {
  return path.resolve(process.env.BEJEWELY_SYNTHETIC_DATA_ROOT || path.join(process.cwd(), ".synthetic-local"));
}

export async function readRequest(dataRoot, relativePath) {
  const requestRoot = path.join(dataRoot, "requests");
  const resolved = await resolveSafeContainedFile(requestRoot, relativePath, "request");
  if (!resolved.ok) throw Object.assign(new Error("request_file_invalid"), { code: "request_file_invalid" });
  try { return JSON.parse(await readFile(resolved.absolutePath, "utf8")); }
  catch { throw Object.assign(new Error("request_file_invalid"), { code: "request_file_invalid" }); }
}

export function print(value) {
  process.stdout.write(`${stableStringify(value)}\n`);
}

export function fail(error) {
  print({ ok: false, errors: [{ code: error?.code || "cli_execution_failed", path: "$", detail: null }] });
  process.exitCode = 1;
}
