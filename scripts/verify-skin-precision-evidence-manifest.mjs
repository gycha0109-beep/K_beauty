#!/usr/bin/env node
// Skin Precision P1: read-only evidence manifest preflight; does NOT read any image bytes.
// Usage: node scripts/verify-skin-precision-evidence-manifest.mjs --self-test
//        node scripts/verify-skin-precision-evidence-manifest.mjs path/to/manifest.json
import { readFileSync } from "node:fs";

const CONCERNS = new Set(["acne", "redness", "pores", "uneven_tone", "oiliness", "dehydration"]);
const SPLITS = new Set(["train", "validation", "holdout"]);
const STATUSES = new Set(["positive", "negative", "uncertain", "not_assessed"]);
const TYPES = new Set(["point", "bbox", "polygon", "mask", "zone_grade", "none"]);
const HEX_SHA = /^[a-f0-9]{64}$/i;
const NON_EMPTY = (value) => typeof value === "string" && value.length > 0 && value.trim() === value;
const NUMBER = (value) => typeof value === "number" && Number.isFinite(value);
const ID = (value) => NON_EMPTY(value) && /^[a-z0-9][a-z0-9._:-]{1,127}$/i.test(value);
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const b = (value) => value === true;

function validateRegistry(registry) {
  const errors = [];
  const byId = new Map();
  if (registry?.schemaVersion !== "skin-precision-asset-register-v1" || !Array.isArray(registry.assets)) {
    return { byId, errors: ["asset-register schemaVersion/assets invalid"] };
  }
  for (const [i, item] of registry.assets.entries()) {
    if (!ID(item?.id)) errors.push("assets[" + i + "]: invalid id");
    if (byId.has(item?.id)) errors.push("assets[" + i + "]: duplicate id");
    if (!["candidate", "hold", "restricted", "review", "approved"].includes(item?.status)) errors.push("assets[" + i + "]: invalid status");
    if (!NON_EMPTY(item?.sourceUrl)) errors.push("assets[" + i + "]: missing source URL");
    if (item?.commercialUseCleared === true && (item.status !== "approved" || !NON_EMPTY(item.rightsReviewEvidenceId))) {
      errors.push("assets[" + i + "]: cleared requires approved status and rightsReviewEvidenceId");
    }
    byId.set(item.id, item);
  }
  return { byId, errors };
}
function within01(x) { return NUMBER(x) && x >= 0 && x <= 1; }
function checkGeometry(ann, errors, pos) {
  const geom = ann.geometry;
  if (!geom || typeof geom !== "object" || Array.isArray(geom)) {
    errors.push(pos + ": positive must carry explicit geometry");
    return;
  }
  if (ann.type === "point" && !(within01(geom.x) && within01(geom.y))) {
    errors.push(pos + ": normalized point x/y outside [0,1]");
  } else if (ann.type === "bbox") {
    if (![geom.x,geom.y,geom.w,geom.h].every(within01) || geom.w <= 0 || geom.h <= 0 || geom.x + geom.w > 1.000001 || geom.y + geom.h > 1.000001) {
      errors.push(pos + ": invalid normalized bbox");
    }
  } else if (ann.type === "polygon") {
    if (!Array.isArray(geom.vertices) || geom.vertices.length < 3 || geom.vertices.some(p => !within01(p?.x) || !within01(p?.y))) {
      errors.push(pos + ": invalid normalized polygon");
    }
  } else if (ann.type === "mask") {
    if (!ID(geom.maskEvidenceId)) errors.push(pos + ": mask requires opaque maskEvidenceId");
  } else if (ann.type === "zone_grade") {
    if (!ID(geom.zoneId) || !Number.isInteger(geom.grade) || geom.grade < 0 || geom.grade > 4 || !ID(ann.rubricVersion)) {
      errors.push(pos + ": zone_grade needs zoneId, ordinal 0-4 and rubricVersion");
    }
  } else {
    errors.push(pos + ": unsupported positive geometry type");
  }
}
function validateEvidenceManifest(manifest, registry) {
  const { byId, errors: registryErrors } = validateRegistry(registry);
  const errors = [...registryErrors];
  const report = { total: 0, splits: { train: 0, validation: 0, holdout: 0 }, perConcern: {}, rightsBlocked: 0 };
  if (manifest?.schemaVersion !== "skin-precision-evidence-v1" || !Array.isArray(manifest.samples) || !ID(manifest.corpusId)) {
    return { ok: false, errors: [...errors, "manifest schemaVersion/corpusId/samples invalid"], report };
  }
  const seenIds = new Set();
  const groupOwners = { subjectGroupId: new Map(), originalGroupId: new Map(), sha256: new Map() };
  for (const [i, sample] of manifest.samples.entries()) {
    const at = "samples[" + i + "]";
    report.total++;
    if (!ID(sample?.sampleId) || seenIds.has(sample.sampleId)) errors.push(at + ": missing/duplicate sampleId");
    seenIds.add(sample?.sampleId);
    if (!SPLITS.has(sample?.split)) errors.push(at + ": invalid split");
    else report.splits[sample.split]++;
    for (const key of ["subjectGroupId", "originalGroupId"]) {
      if (!ID(sample?.[key])) {
        errors.push(at + ": invalid " + key);
        continue;
      }
      const first = groupOwners[key].get(sample[key]);
      if (first && first !== sample.split) errors.push(at + ": " + key + " leaks across splits");
      else groupOwners[key].set(sample[key], sample.split);
    }
    if (!HEX_SHA.test(sample?.sha256 || "")) errors.push(at + ": missing/invalid image sha256");
    else {
      const first = groupOwners.sha256.get(sample.sha256);
      if (first && first !== sample.split) errors.push(at + ": exact image sha256 leaks across splits");
      else groupOwners.sha256.set(sample.sha256, sample.split);
    }
    const asset = byId.get(sample?.assetId);
    const approved = Boolean(asset && asset.kind === "dataset" && asset.status === "approved" &&
      asset.commercialUseCleared === true && NON_EMPTY(asset.rightsReviewEvidenceId));
    if (!approved || sample?.rightsScope !== "commercial_train_eval" || !ID(sample?.rightsEvidenceId)) {
      errors.push(at + ": commercial training/eval rights not cleared");
      report.rightsBlocked++;
    }
    if (!["explicit_opt_in", "upstream_license_reviewed"].includes(sample?.consentBasis) || !ID(sample?.consentEvidenceId)) {
      errors.push(at + ": consent/personality-rights evidence missing");
    }
    if (!sample?.image || !Number.isInteger(sample.image.width) || sample.image.width < 1 ||
        !Number.isInteger(sample.image.height) || sample.image.height < 1 ||
        sample.image.orientationNormalized !== true) {
      errors.push(at + ": image dimensions/orientation not verified");
    }
    if (!Array.isArray(sample?.annotations) || sample.annotations.length === 0) {
      errors.push(at + ": empty annotations (explicit not_assessed required)");
      continue;
    }
    const tasks = new Set();
    for (const [j, annotation] of sample.annotations.entries()) {
      const pos = at + ".annotations[" + j + "]";
      if (!CONCERNS.has(annotation?.concern)) errors.push(pos + ": invalid concern");
      if (tasks.has(annotation?.concern)) errors.push(pos + ": duplicate concern annotation; aggregate instances under one annotation task");
      tasks.add(annotation?.concern);
      if (!STATUSES.has(annotation?.status)) errors.push(pos + ": invalid label status");
      if (!TYPES.has(annotation?.type)) errors.push(pos + ": invalid annotation type");
      if (!ID(annotation?.taxonomyVersion)) errors.push(pos + ": missing taxonomyVersion");
      const reviewerIds = annotation?.reviewerIds;
      if (!Array.isArray(reviewerIds) || new Set(reviewerIds).size !== reviewerIds.length || reviewerIds.some(r => !ID(r))) {
        errors.push(pos + ": invalid or duplicate pseudonymous reviewers");
      }
      if (sample.split === "holdout" && ["positive","negative"].includes(annotation.status) && (!Array.isArray(reviewerIds) || reviewerIds.length < 2 || annotation.adjudicated !== true)) {
        errors.push(pos + ": assessed holdout needs >=2 independent reviewers and adjudicated consensus");
      }
      if (annotation.status === "positive") checkGeometry(annotation, errors, pos);
      else if (annotation.type !== "none" || own(annotation, "geometry")) errors.push(pos + ": negative/uncertain/not_assessed must not contain spatial geometry; maintain distinct statuses");
      if (!own(report.perConcern, annotation.concern)) report.perConcern[annotation.concern] = { positive: 0, negative: 0, uncertain: 0, not_assessed: 0 };
      if (STATUSES.has(annotation.status) && report.perConcern[annotation.concern]) report.perConcern[annotation.concern][annotation.status]++;
    }
  }
  return { ok: errors.length === 0, errors, report };
}
function fakeSample(id, split, group, shaChar, status, rights = {}) {
  return {
    sampleId: id, subjectGroupId: "subject_" + group, originalGroupId: "origin_" + group, sha256: shaChar.repeat(64),
    split, assetId: "synthetic-cleared", rightsScope: "commercial_train_eval", rightsEvidenceId: "grant_test_only",
    consentBasis: "explicit_opt_in", consentEvidenceId: "consent_test_only",
    image: { width: 640, height: 640, orientationNormalized: true },
    annotations: [{ concern: "acne", status, type: status === "positive" ? "point" : "none",
      ...(status === "positive" ? { geometry: { x: 0.25, y: 0.5 } } : {}),
      taxonomyVersion: "acne_v1", reviewerIds: ["reviewer_a", "reviewer_b"], adjudicated: true }],
    ...rights
  };
}
function runSelfTest() {
  const registry = { schemaVersion: "skin-precision-asset-register-v1", assets: [{
    id: "synthetic-cleared", kind: "dataset", status: "approved", sourceUrl: "https://example.org/synthetic-fixture",
    commercialUseCleared: true, rightsReviewEvidenceId: "synthetic_test_only"
  }] };
  const manifest = { schemaVersion: "skin-precision-evidence-v1", corpusId: "synthetic_test", samples: [
    fakeSample("sample_aa","train","aa","a","positive"),
    fakeSample("sample_bb","holdout","bb","b","negative")
  ] };
  const checks = [];
  const ok = validateEvidenceManifest(manifest, registry);
  checks.push(["clean synthetic independent record", ok.ok && ok.report.splits.holdout === 1]);
  const leak = structuredClone(manifest); leak.samples[1].subjectGroupId = "subject_aa";
  checks.push(["cross split subject blocked", !validateEvidenceManifest(leak, registry).ok]);
  const rights = structuredClone(registry); rights.assets[0].status = "hold"; rights.assets[0].commercialUseCleared = false;
  checks.push(["unapproved rights blocked", !validateEvidenceManifest(manifest, rights).ok]);
  const geometry = structuredClone(manifest); delete geometry.samples[0].annotations[0].geometry;
  checks.push(["missing positive coordinates blocked", !validateEvidenceManifest(geometry, registry).ok]);
  const vague = structuredClone(manifest); vague.samples[1].annotations[0].status = "not_assessed";
  checks.push(["unassessed never counted as negative", validateEvidenceManifest(vague, registry).report.perConcern.acne.negative === 0]);
  for (const [name, passed] of checks) console.log((passed ? "PASS" : "FAIL") + ": " + name);
  if (checks.some(([,passed]) => !passed)) process.exitCode = 1;
}
function main(argv) {
  if (argv[0] === "--self-test") return runSelfTest();
  if (!argv[0] || argv[0] === "--help") {
    console.log("Usage: node scripts/verify-skin-precision-evidence-manifest.mjs --self-test");
    console.log("       node scripts/verify-skin-precision-evidence-manifest.mjs <manifest.json> [register.json]");
    return;
  }
  const manifest = JSON.parse(readFileSync(argv[0], "utf8"));
  const registry = JSON.parse(readFileSync(argv[1] || "data/skin-precision/asset-candidate-register-v1.json", "utf8"));
  const { ok, errors, report } = validateEvidenceManifest(manifest, registry);
  console.log(JSON.stringify({ ok, report, errors }, null, 2));
  if (!ok) process.exitCode = 1;
}
main(process.argv.slice(2));
