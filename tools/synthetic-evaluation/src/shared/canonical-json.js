import { createHash } from "node:crypto";

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
}

export function stableStringify(value) {
  return JSON.stringify(sortKeys(value));
}

export function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
