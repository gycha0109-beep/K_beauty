import { readFile } from "node:fs/promises";
import path from "node:path";
import { stableStringify } from "../../shared/canonical-json.js";
import { resolveSafeContainedFile } from "../../import/resolve-safe-path.js";

export function parseArgs(argv) {
  const result = { flags: new Set(), values: new Map() };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) result.flags.add(token);
    else {
      result.values.set(token, next);
      index += 1;
    }
  }
  return result;
}

export function resolveDataRoot() {
  return path.resolve(process.env.BEJEWELY_SYNTHETIC_DATA_ROOT || path.join(process.cwd(), ".synthetic-local"));
}

export async function readRequestJson(dataRoot, relativePath, field) {
  const requestRoot = path.join(dataRoot, "requests");
  const resolved = await resolveSafeContainedFile(requestRoot, relativePath, field);
  if (!resolved.ok) throw Object.assign(new Error("request_file_invalid"), { code: "request_file_invalid" });
  try {
    return JSON.parse(await readFile(resolved.absolutePath, "utf8"));
  } catch {
    throw Object.assign(new Error("request_file_invalid"), { code: "request_file_invalid" });
  }
}

export function printResult(value) {
  process.stdout.write(`${stableStringify(value)}\n`);
}

export function fail(error) {
  printResult({ ok: false, errors: [{ code: error?.code || "cli_execution_failed", path: "$", detail: null }] });
  process.exitCode = 1;
}
