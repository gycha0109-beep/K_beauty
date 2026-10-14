import fs from "node:fs";
import path from "node:path";

const MAX_SOURCE_BYTES = 256 * 1024;
const MAX_FILES_PER_PACKAGE = 3000;
const MAX_REPORTED_MATCHES_PER_PACKAGE = 60;
const SOURCE_SUFFIXES = /\.(?:[cm]?js|tsx?|jsx)$/;
const MARKERS = Object.freeze([
  { id: "node-forge-import", re: /(?:from\s*["']node-forge["']|require\s*\(\s*["']node-forge["']|import\s*\(\s*["']node-forge["'])/ },
  { id: "node-forge-verify-method", re: /\b(?:publicKey|public_key|certificate|pub|cert)\s*\.\s*verify\s*\(/ },
  { id: "expo-signature-verify-function", re: /\bsignBufferRSASHA256AndVerify\s*\(/ },
  { id: "micromatch-import", re: /(?:from\s*["']micromatch["']|require\s*\(\s*["']micromatch["']|import\s*\(\s*["']micromatch["'])/ },
  { id: "braces-import", re: /(?:from\s*["']braces["']|require\s*\(\s*["']braces["']|import\s*\(\s*["']braces["'])/ },
  { id: "explicit-brace-ast-api", re: /\b(?:micromatch|braces)\s*\.\s*(?:braces|expand|parse|compile)\s*\(/ },
]);

function walk(root, result) {
  const stack = [root];
  while (stack.length > 0) {
    if (result.scanned >= MAX_FILES_PER_PACKAGE) {
      result.incomplete = true;
      return;
    }
    const directory = stack.pop();
    const names = fs.readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of names) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        result.skippedSymlinks++;
        continue;
      }
      if (entry.isDirectory()) {
        if (!["node_modules", "__tests__", "__mocks__", "test", "tests", "coverage"].includes(entry.name)) {
          stack.push(absolute);
        }
        continue;
      }
      if (!entry.isFile() || !SOURCE_SUFFIXES.test(entry.name) || entry.name.endsWith(".d.ts")) continue;
      if (result.scanned >= MAX_FILES_PER_PACKAGE) {
        result.incomplete = true;
        return;
      }
      const size = fs.statSync(absolute).size;
      if (size > MAX_SOURCE_BYTES) {
        result.skippedOversize++;
        result.incomplete = true;
        continue;
      }
      result.scanned++;
      const content = fs.readFileSync(absolute, "utf8");
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        for (const marker of MARKERS) {
          if (!marker.re.test(lines[i])) continue;
          result.markerCounts[marker.id] = (result.markerCounts[marker.id] || 0) + 1;
          if (result.matches.length < MAX_REPORTED_MATCHES_PER_PACKAGE) {
            result.matches.push({
              file: path.relative(root, absolute).replaceAll(path.sep, "/"),
              line: i + 1,
              marker: marker.id,
            });
          } else {
            result.truncatedMatches = true;
          }
        }
      }
    }
  }
}

export function scanPackageTree(root, packageName) {
  const result = {
    package: packageName,
    exists: fs.existsSync(root) && fs.statSync(root).isDirectory(),
    scanned: 0,
    skippedOversize: 0,
    skippedSymlinks: 0,
    incomplete: false,
    markerCounts: {},
    matches: [],
    truncatedMatches: false,
    assertion: "TEXTUAL_CALL_SITE_OBSERVATION_ONLY_NOT_EXPLOITABILITY_OR_REMEDIATION",
  };
  if (!result.exists) return result;
  walk(root, result);
  return result;
}

export const TARGET_PACKAGES = Object.freeze([
  "@expo/cli",
  "@expo/code-signing-certificates",
  "@expo/metro-file-map",
  "metro-file-map",
  "metro-config/node_modules/metro-file-map",
  "micromatch",
  "fast-glob",
  "chokidar",
  "braces",
]);
