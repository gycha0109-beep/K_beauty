import path from "node:path";

export function readCliOption(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`missing_cli_option_value:${name}`);
  }
  return value;
}

export function resolveCliDirectory(name, fallback) {
  return path.resolve(readCliOption(name, fallback));
}

export function resolveGeneratedAt(fallback = () => new Date().toISOString()) {
  const value = readCliOption("--generated-at", null);
  if (value === null) return fallback();
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error("invalid_generated_at");
  }
  return value;
}
