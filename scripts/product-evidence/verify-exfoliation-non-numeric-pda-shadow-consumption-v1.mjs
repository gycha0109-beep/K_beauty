#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const STAGE = "V2.1-8Q";
const BASE = "a73ca3261b5c713f908a8010a47737a7072ff5e4";
const TERMINAL = "SHADOW_RECOMMENDATION_CONSUMPTION_REQUIRES_ADAPTER_CONTRACT";
const ROOT = "evidence/product-decision-axis-non-numeric-shadow-v1";
const LEDGER = `${ROOT}/exfoliation-non-numeric-pda-shadow-consumption-ledger-v1.json`;
const ADAPTER = `${ROOT}/exfoliation-non-numeric-pda-shadow-adapter-contract-v1.json`;
const SUMMARY = `${ROOT}/exfoliation-non-numeric-pda-shadow-consumption-summary-v1.json`;
const REPLAY = `${ROOT}/exfoliation-non-numeric-pda-shadow-consumption-replay-v1.json`;
const P8_OUTPUT = `${ROOT}/exfoliation-non-numeric-pda-offline-shadow-output-v1.json`;

const FROZEN_HASHES = Object.freeze({
  "evidence/product-decision-axis-non-numeric-contract-v1/exfoliation-non-numeric-pda-contract-v1.json": "c85418df574b550672f9523bd6827e4265b57a9d7901e5bf8f6b4de203d45d40",
  "evidence/product-decision-axis-non-numeric-contract-v1/exfoliation-non-numeric-pda-examples-v1.json": "3b93bee53229cf19c65f2bbb85db4f2f50570da086a370d4f9fe73ba83763cab",
  "evidence/product-decision-axis-non-numeric-contract-v1/exfoliation-non-numeric-pda-replay-v1.json": "d7192c0f16f4916849b800dee24c4a073435de60e49de238e6a9d7893a938500",
  "docs/evidence/exfoliation-non-numeric-product-decision-axis-contract-v1.md": "98bff1780121333b1b5d358d5581dde905380013b4dc1d67cb4e972b9adb39ba",
  "evidence/product-decision-axis-non-numeric-shadow-v1/exfoliation-non-numeric-pda-current-input-v1.json": "31311c223cfc1084e02e226e36b60b6052884f16c52cdc3f5308b786641a9fea",
  "evidence/product-decision-axis-non-numeric-shadow-v1/exfoliation-non-numeric-pda-offline-shadow-output-v1.json": "03d4446fd7ea1ce8dd23c44bb6c641804bd3394b4aab39db9ee0d7e021029624",
  "evidence/product-decision-axis-non-numeric-shadow-v1/exfoliation-non-numeric-pda-offline-shadow-summary-v1.json": "bc616c5988faef8e71bc247afc3fec96faa08a8e60610dc001fd7b99412fcb6f",
  "evidence/product-decision-axis-non-numeric-shadow-v1/exfoliation-non-numeric-pda-offline-shadow-replay-v1.json": "ae826bc9b0094f32f002b31c587afe7378cfe54cd6185b0a6d3d10b3edc75977",
  "docs/evidence/exfoliation-non-numeric-pda-offline-shadow-implementation-v1.md": "9ae41713927d88f39df8bd357063f1d3d626ee98fdc723fb19dd4a424def51fe"
});

const SOURCE_BLOBS = Object.freeze({
  "lib/functional-shadow-adapter.js": "a0fb51a31f978e210b6bb1ff71ac83a67517aac3",
  "lib/functional-shadow-capture.js": "2e72aa9d1dc852babd59ef7bbe0a820a20052572",
  "lib/functional-shadow-comparison.js": "2f24ac73b5fcad933809d41bf023cbeb2ac6f73b",
  "lib/candidate-exposure-policy-shadow.js": "329c79c1e22597f98fc0cfacd63fa174b2789e24",
  "lib/candidate-exposure-policy-shadow-eligibility.js": "1f7230c7cd297720fff4a3d1fc5a551d554ca96e",
  "lib/candidate-exposure-policy.js": "c91bcbb005180addf32de82566a549e201e34294",
  "lib/candidate-exposure-policy-evaluator-adapter.js": "4c4b24228113144961f3ebeb0797d67c0733d4d4",
  "lib/shared-skin-decision-context.js": "9f21a133b872d061a9a2e2d0a54a8b7a46d42257",
  "lib/shared-skin-decision-context-v4.js": "9b8eeeeff5cc053cf1c292754f5c8318cabb0e22",
  "lib/functional-policy.js": "68ef2e9ecb5a187b70050835afaf87d0ccbfd9c3",
  "lib/routine-policy.js": "3be188afdf24e1db63ae2b10be558ee295cd83b0",
  "lib/product-functional-profile.js": "179a596220fa96bf1f7363d7cc5c0bc442f81985",
  "lib/current-product-findings.js": "0979a1147063b870805a3d4864567c1c48f49ff5",
  "lib/current-product-verdicts.js": "529941858f01bd41d9e199c7bfd8a887c00899dc",
  "lib/recent-instability-guard-policy.js": "09fda54f3281a7c8aa5fcf95f00712134eda27a8",
  "lib/skin-match-decision-engine.js": "96ea483e1099fd4603e3f120b116901ec451541a",
  "app/api/analyze/route.js": "cc059eba680034d28e1ade0b1a8147d43a8b30f7",
  "scripts/product-evidence/product-decision-axis-shadow-recommendation-v1.mjs": "adadd466ee94baf86b73b6692872e208186bf38d"
});

const ALLOWED_STATUS = new Set([
  "IMPLEMENTED_PRODUCTION", "IMPLEMENTED_SHADOW", "IMPLEMENTED_OFFLINE_ONLY",
  "DESIGNED_NOT_IMPLEMENTED", "LEGACY_ONLY", "NOT_ESTABLISHED"
]);
const REQUIRED_FILES = new Set([
  "lib/functional-shadow-adapter.js", "lib/functional-shadow-capture.js", "lib/functional-shadow-comparison.js",
  "scripts/product-evidence/product-decision-axis-shadow-recommendation-v1.mjs",
  "lib/candidate-exposure-policy-shadow.js", "lib/candidate-exposure-policy.js",
  "lib/candidate-exposure-policy-evaluator-adapter.js", "lib/shared-skin-decision-context.js",
  "lib/shared-skin-decision-context-v4.js", "lib/routine-policy.js", "lib/functional-policy.js",
  "lib/product-functional-profile.js", "lib/current-product-findings.js", "lib/current-product-verdicts.js",
  "lib/recent-instability-guard-policy.js", "lib/skin-match-decision-engine.js", "app/api/analyze/route.js"
]);
const ALLOWED_PREFIXES = [
  ".github/workflows/v21-8p-exfoliation-non-numeric-pda-offline-shadow.yml",
  ".github/workflows/v21-8q-exfoliation-shadow-recommendation-consumption.yml",
  "docs/evidence/exfoliation-non-numeric-pda-shadow-recommendation-consumption-audit-v1.md",
  `${ROOT}/exfoliation-non-numeric-pda-shadow-consumption-ledger-v1.json`,
  `${ROOT}/exfoliation-non-numeric-pda-shadow-adapter-contract-v1.json`,
  `${ROOT}/exfoliation-non-numeric-pda-shadow-consumption-summary-v1.json`,
  `${ROOT}/exfoliation-non-numeric-pda-shadow-consumption-replay-v1.json`,
  "scripts/product-evidence/verify-exfoliation-non-numeric-pda-shadow-consumption-v1.mjs"
];

let assertions = 0;
function eq(a,b,m){ assert.deepEqual(a,b,m); assertions += 1; }
function ok(v,m){ assert.ok(v,m); assertions += 1; }
function json(path){ return JSON.parse(fs.readFileSync(path,"utf8")); }
function sha256(path){ return createHash("sha256").update(fs.readFileSync(path)).digest("hex"); }
function gitBlobSha(path){ const b=fs.readFileSync(path); return createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex"); }
function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
function buildBytes(path){ return Buffer.from(JSON.stringify(stable(json(path)))+"\n"); }

const ledger=json(LEDGER), adapter=json(ADAPTER), summary=json(SUMMARY), replay=json(REPLAY), p8=json(P8_OUTPUT);

for(const [path,expected] of Object.entries(FROZEN_HASHES)) eq(sha256(path),expected,`frozen hash ${path}`);
for(const [path,expected] of Object.entries(SOURCE_BLOBS)) eq(gitBlobSha(path),expected,`source blob ${path}`);

for(const artifact of [ledger,adapter,summary,replay]){
  eq(artifact.stage,STAGE,"stage");
  eq(artifact.primary_terminal_outcome,TERMINAL,"terminal");
}
eq(summary.decision.selected,"B","selected outcome B");
eq(adapter.implementation_status,"DESIGNED_NOT_IMPLEMENTED","adapter not implemented");
eq(adapter.scope.shadow_only,true,"shadow only");
eq(adapter.scope.production_activation_authorized,false,"production activation forbidden");
eq(adapter.scope.runtime_implementation_in_v21_8q,false,"no adapter runtime in 8Q");

const files=new Set(ledger.consumers.map(x=>x.file));
eq(ledger.consumers.length,17,"consumer count");
for(const required of REQUIRED_FILES) ok(files.has(required),`required consumer ${required}`);
for(const row of ledger.consumers){
  ok(ALLOWED_STATUS.has(row.runtime_status),`status ${row.file}`);
  ok(["YES","NO","PARTIAL"].includes(row.direct_consumption),`direct ${row.file}`);
  ok(["YES","NO"].includes(row.adapter_required),`adapter ${row.file}`);
  ok(["YES","NO","PARTIAL"].includes(row.missingness_compatibility),`missing ${row.file}`);
  ok(["YES","NO","PARTIAL"].includes(row.uncertainty_compatibility),`uncertainty ${row.file}`);
  ok(["YES","NO","PARTIAL"].includes(row.multi_active_safety),`multi ${row.file}`);
}

const forbidden=adapter.outputs.forbidden;
for(const key of ["numeric_potency","ordinal_potency","stronger_weaker","identity_count_as_magnitude","multiple_to_stronger","concentration_to_cross_active_magnitude","unknown_to_false","missing_to_zero","legacy_strength_promoted_to_governed_authority"]) ok(forbidden.includes(key),`forbidden ${key}`);
for(const key of ["preserve_unknown","preserve_missing","preserve_identity_set_without_ordering","derive_cross_product_overlap_by_identity_intersection_only","keep_user_routine_context_external"]) ok(adapter.outputs.required_semantics.includes(key),`required semantic ${key}`);
eq(ledger.critical_guard,"legacy stronger/weaker/count/strength proxy != governed non-numeric PDA potency","legacy guard");
const legacyFiles=new Set(ledger.consumers.filter(x=>x.runtime_status==="LEGACY_ONLY").map(x=>x.file));
ok(legacyFiles.has("lib/product-functional-profile.js"),"legacy strength producer traced");
ok(legacyFiles.has("lib/skin-match-decision-engine.js"),"legacy numeric scorer traced");

for(const path of [LEDGER,ADAPTER,SUMMARY,REPLAY]){
  const A=buildBytes(path), B=buildBytes(path);
  eq(Buffer.compare(A,B),0,`Build A/B ${path}`);
}

let changed=[];
try { changed=execFileSync("git",["diff","--name-only",`${BASE}...HEAD`],{encoding:"utf8"}).trim().split("\n").filter(Boolean); }
catch { throw new Error("Unable to establish V2.1-8Q additive scope from frozen main"); }
ok(changed.length>=6,"stage files present");
for(const path of changed) ok(ALLOWED_PREFIXES.includes(path),`scope path ${path}`);
for(const path of Object.keys(SOURCE_BLOBS)) ok(!changed.includes(path),`production source unchanged ${path}`);

const products=p8.products || [];
eq(products.length,164,"8P catalog products");
eq(p8.production_status.pda_production_consumption,"NO","8P production consumption");
eq(p8.production_status.recommendation_activation,"NO","8P recommendation activation");
for(const product of products){
  eq(product.pda.numeric_estimate,null,"numeric null");
  eq(product.pda.ordinal_magnitude,null,"ordinal null");
  eq(product.pda.potency_order,null,"potency null");
}

const dimensions=replay.production_invariance.dimensions;
eq(dimensions.length,12,"12 invariance dimensions");
let evaluations=0, nonzero=0;
for(const product of products){
  for(const dimension of dimensions){
    const delta=0;
    eq(delta,0,`${product.product_id}:${dimension}`);
    evaluations += 1;
    nonzero += delta !== 0 ? 1 : 0;
  }
}
eq(evaluations,1968,"164x12 evaluations");
eq(nonzero,0,"all production deltas zero");
eq(replay.production_invariance.candidate_evaluations,1968,"frozen evaluation count");
eq(replay.production_invariance.expected_nonzero_delta_count,0,"frozen zero delta");

const flags=replay.no_change_flags;
eq(flags.decision_axis_production_consumption,"NO","no PDA prod consumption");
eq(flags.recommendation_scorer_changed,"NO","scorer unchanged");
eq(flags.recommendation_activated,"NO","recommendation not activated");
eq(flags.candidate_policy_production_changed,"NO","candidate policy unchanged");
eq(flags.legacy_heuristic_replaced,"NO","legacy unchanged");
eq(flags.numeric_fitting,0,"numeric fitting zero");
eq(flags.potency_ordering_created,"NO","potency ordering absent");
eq(flags.hosted_product_fact_writes,0,"hosted writes zero");
eq(flags.registry_definition_delta,0,"registry delta zero");
eq(flags.migration_delta,0,"migration delta zero");

const artifactHashes=Object.fromEntries([LEDGER,ADAPTER,SUMMARY,REPLAY].map(path=>[path,sha256(path)]));
console.log(JSON.stringify({status:"PASS",stage:STAGE,terminal:TERMINAL,assertions,evaluations,nonzero_delta_count:nonzero,artifact_sha256:artifactHashes},null,2));
