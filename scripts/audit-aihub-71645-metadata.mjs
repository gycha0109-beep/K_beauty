#!/usr/bin/env node
/**
 * AI-Hub 71645 metadata reconnaissance (read only).
 * No image file reads, exports, faces, raw identifiers, filenames, birth dates or row-level outputs.
 *
 * node scripts/audit-aihub-71645-metadata.mjs --self-test
 * node scripts/audit-aihub-71645-metadata.mjs /private/aihub/label_json [--max-files=200]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const EXPECTED = Object.freeze({
  imagesPublished: 13936,
  measurementsPublished: 84688,
  labelsPublished: 125424
});
const FIELDS = ["filename", "id", "date", "format", "imgsize", "width", "height",
  "device", "angle", "facepart", "face_box", "moisture", "elasticity", "pigmentation",
  "pore", "expert"];
const SENSITIVE = ["birth", "gender"];
const MEASURES = ["moisture", "elasticity", "pigmentation", "pore", "expert"];
const isObject = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const present = (x) => x !== undefined && x !== null && x !== "";
const count = (obj, key) => { obj[key] = (obj[key] || 0) + 1; };
function numberOrNull(x) {
  if (!present(x)) return null;
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN;
  return Number.isFinite(n) ? n : null;
}
function metadataRows(root) {
  const output = [];
  const seen = new Set();
  function walk(node, depth) {
    if (depth > 10 || !node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach((value) => walk(value, depth + 1));
      return;
    }
    if (("filename" in node || "face_box" in node) &&
      FIELDS.some((key) => key !== "filename" && key !== "face_box" && key in node)) {
      output.push(node);
      return;
    }
    // Only these known wrapper keys, never walk arbitrary unknown personal metadata.
    for (const key of ["data", "annotations", "annotation", "labels", "images",
      "items", "records", "result", "metadata", "json"]) {
      if (key in node) walk(node[key], depth + 1);
    }
  }
  walk(root, 0);
  return output;
}
function examineBox(value, width, height) {
  if (!present(value)) return "missing";
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return "invalid"; }
  }
  if (!isObject(value)) return "invalid";
  const x = numberOrNull(value.x);
  const y = numberOrNull(value.y);
  const w = numberOrNull(value.w);
  const h = numberOrNull(value.h);
  if ([x, y, w, h].some(n => n === null) || w <= 0 || h <= 0 || x < 0 || y < 0) return "invalid";
  if (width !== null && height !== null && (x + w > width + 1 || y + h > height + 1)) return "out_of_bounds";
  return "present_valid";
}
function aggregate(rows, summary) {
  for (const row of rows) {
    if (!isObject(row)) { summary.skippedNonObject++; continue; }
    summary.records++;
    for (const key of FIELDS) {
      if (present(row[key])) summary.fieldCoverage[key]++;
    }
    for (const key of SENSITIVE) {
      if (present(row[key])) summary.sensitivePresent[key]++;
    }
    if (typeof row.filename === "string" && row.filename.trim()) {
      const filename = row.filename.trim().replaceAll("\\", "/").split("/").at(-1);
      summary.imageNames.add(filename.toLowerCase());
      count(summary.imageRecordCounts, filename.toLowerCase());
    } else summary.recordsMissingImage++;
    if (present(row.id)) summary.candidateIds.add(String(row.id));
    else summary.recordsMissingId++;
    const width = numberOrNull(row.width), height = numberOrNull(row.height);
    const box = examineBox(row.face_box, width, height);
    count(summary.faceBoxes, box);
    const part = numberOrNull(row.facepart);
    if (part !== null && Number.isInteger(part) && part >= 1 && part <= 8) {
      count(summary.facePartCounts, String(part));
    } else count(summary.facePartCounts, "missing_or_unknown");
    for (const key of MEASURES) {
      if (!present(row[key])) { summary.measureCoverage[key].missing++; continue; }
      summary.measureCoverage[key].present++;
      if (key !== "expert" && numberOrNull(row[key]) === null) summary.measureCoverage[key].nonNumeric++;
    }
  }
}
function emptySummary() {
  return {
    filesScanned: 0, filesSkippedByLimit: 0, fileErrors: 0, jsonParseErrors: 0,
    unrecognizedStructureFiles: 0, skippedNonObject: 0, records: 0,
    recordsMissingImage: 0, recordsMissingId: 0,
    imageNames: new Set(), candidateIds: new Set(), imageRecordCounts: {},
    fieldCoverage: Object.fromEntries(FIELDS.map(key => [key, 0])),
    sensitivePresent: Object.fromEntries(SENSITIVE.map(key => [key, 0])),
    measureCoverage: Object.fromEntries(MEASURES.map(key => [key, { present: 0, missing: 0, nonNumeric: 0 }])),
    faceBoxes: {}, facePartCounts: {}
  };
}
function report(summary) {
  // Never include file paths, filenames, original IDs or individual human metadata in output.
  const unique = summary.imageNames.size;
  const duplicatedImageRowGroups = Object.values(summary.imageRecordCounts).filter(n => n > 1).length;
  return {
    schemaVersion: "aihub-71645-metadata-audit-v1",
    groundTruthAvailable: false,
    publishedReferenceCounts: EXPECTED,
    filesScanned: summary.filesScanned,
    filesSkippedByLimit: summary.filesSkippedByLimit,
    fileErrors: summary.fileErrors,
    jsonParseErrors: summary.jsonParseErrors,
    unrecognizedStructureFiles: summary.unrecognizedStructureFiles,
    inspectedAnnotationRows: summary.records,
    uniqueImageFilenameCandidates: unique,
    candidateIdsNotVerifiedSubjectIds: summary.candidateIds.size,
    repeatedImageFilenameGroups: duplicatedImageRowGroups,
    missingImageFilenameRows: summary.recordsMissingImage,
    missingIdRows: summary.recordsMissingId,
    faceBoxAudit: summary.faceBoxes,
    facePartCounts: summary.facePartCounts,
    fieldCoverage: summary.fieldCoverage,
    measures: summary.measureCoverage,
    notes: [
      "Image count, label row count, measurements and unique human subjects are different grains.",
      "Metadata id may be a row id rather than a person; verify linkage in actual guide and raw tables.",
      "face_box is a face rectangle, NOT an acne/pore/redness lesion location.",
      "Dataset does not publish acne lesion boxes, erythema masks or per-pore coordinates.",
      "This command only describes received metadata structure and does not approve rights, consent or scientific accuracy."
    ]
  };
}
function collectJsonFiles(path, maxFiles) {
  const out = [];
  let excess = 0;
  function walk(at, depth) {
    if (depth > 12) throw new Error("Directory nesting exceeds allowed depth");
    const stat = statSync(at, { throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink()) throw new Error("Invalid or symlink input path");
    if (stat.isFile()) {
      if (extname(at).toLowerCase() !== ".json") return;
      if (out.length < maxFiles) out.push(at);
      else excess++;
      return;
    }
    if (!stat.isDirectory()) return;
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isFile() && extname(entry.name).toLowerCase() !== ".json") continue;
      if (entry.isDirectory() || entry.isFile()) walk(join(at, entry.name), depth + 1);
    }
  }
  walk(path, 0);
  return { files: out, excess };
}
function auditDirectory(path, maxFiles = 200) {
  const summary = emptySummary();
  const { files, excess } = collectJsonFiles(resolve(path), maxFiles);
  summary.filesSkippedByLimit = excess;
  for (const file of files) {
    try {
      if (statSync(file).size > 25 * 1024 * 1024) { summary.fileErrors++; continue; }
      let data;
      try { data = JSON.parse(readFileSync(file, "utf8")); }
      catch { summary.jsonParseErrors++; continue; }
      const rows = metadataRows(data);
      if (!rows.length) summary.unrecognizedStructureFiles++;
      aggregate(rows, summary);
      summary.filesScanned++;
    } catch { summary.fileErrors++; }
  }
  return report(summary);
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function selfTest() {
  const synthetic = [
    { filename: "person1_F.jpg", id: 1, birth: 960129, width: 800, height: 600,
      facepart: 5, face_box: { x: 20, y: 30, w: 300, h: 250 }, pore: 3.1, pigmentation: 0 },
    { filename: "person1_F.jpg", id: 1, birth: 960129, width: 800, height: 600,
      facepart: 6, face_box: { x: 20, y: 30, w: 300, h: 250 }, moisture: 12 },
    { filename: "person2_F.jpg", id: 2, width: 100, height: 100, facepart: 5,
      face_box: { x: 90, y: 10, w: 50, h: 30 }, pore: null }
  ];
  const summary = emptySummary();
  const records = metadataRows({ annotations: synthetic });
  aggregate(records, summary);
  const result = report(summary);
  assert(records.length === 3, "expected all nested annotation rows");
  assert(result.uniqueImageFilenameCandidates === 2, "image records must be deduplicated");
  assert(result.repeatedImageFilenameGroups === 1, "same image can have multiple face parts");
  assert(result.measures.pore.present === 2 && result.measures.pore.missing === 1,
    "zero is a valid measured value, null is missing");
  assert(result.faceBoxAudit.out_of_bounds === 1, "invalid face box must be reported");
  assert(!JSON.stringify(result).includes("960129") &&
    !JSON.stringify(result).includes("person1"), "PII and filenames must not be emitted");
  assert(result.groundTruthAvailable === false, "never claim lesion gold from metadata");
  return result;
}
const args = process.argv.slice(2);
if (args.includes("--self-test")) {
  const tested = selfTest();
  console.log("PASS: schema, duplicates, missingness, face box bounds, no-PII output");
  console.log(JSON.stringify({ rows: tested.inspectedAnnotationRows, candidateImages: tested.uniqueImageFilenameCandidates,
    sourceType: tested.schemaVersion }, null, 2));
} else {
  const dir = args.find(x => !x.startsWith("--"));
  const opt = args.find(x => x.startsWith("--max-files="));
  const maxFiles = opt ? Number(opt.slice("--max-files=".length)) : 200;
  if (!dir || !Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 10000) {
    console.error("Usage: node scripts/audit-aihub-71645-metadata.mjs <local-json-directory> [--max-files=200]");
    process.exitCode = 2;
  } else {
    try {
      const outcome = auditDirectory(dir, maxFiles);
      console.log(JSON.stringify(outcome, null, 2));
      if (outcome.filesScanned === 0 || outcome.inspectedAnnotationRows === 0 ||
          outcome.jsonParseErrors || outcome.fileErrors || outcome.unrecognizedStructureFiles) process.exitCode = 1;
    } catch (error) {
      console.error("Read-only metadata audit failed (input path or structure invalid).");
      process.exitCode = 1;
    }
  }
}
