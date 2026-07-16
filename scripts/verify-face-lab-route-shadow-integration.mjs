import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function loadFunctions(path, names, dependencies = {}) {
  const source = readFileSync(path, "utf8")
    .replace(/^import .*?;\r?\n/gm, "")
    .replace(/export function /g, "function ");
  const dependencyNames = Object.keys(dependencies);
