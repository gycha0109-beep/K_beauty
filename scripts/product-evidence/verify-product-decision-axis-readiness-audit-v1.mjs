import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { AXIS_CONTRACTS, build, buildAudit, canonicalJson } from "./product-decision-axis-readiness-audit-v1.mjs";

const SNAPSHOT = "evidence/product-decision-axis-readiness-v1/product-decision-axis-input-snapshot-v1.json";
const AUDIT = "evidence/product-decision-axis-readiness-v1/product-decision-axis-input-coverage-audit-v1.json";
const DOC = "docs/evidence/product-decision-axis-input-coverage-calibration-readiness-audit-v1.md";
const EXPECTED_MAIN = "e34e7e9f731de1018fc2fd70e5462d69f919869d";
const EXPECTED_REGISTRY = "product-fact-registry-cross-category-v1";
const EXPECTED_REGISTRY_CHECKSUM = "79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575";
const EXPECTED_SUBJECT_SERIALIZER = "product-fact-subject-identity-v1";
const EXPECTED_PROP_SERIALIZER = "product-fact-proposition-pilot-v1";
const EXPECTED_KEYS = [
  "active_concentration","barrier_support_claim","contains_active","deep_cleansing","eye_sting_observed","fragrance_declared",
  "hydration_change","low_ph","pad_surface_texture","primary_use_role","product_format","recommended_use_frequency",
  "spf_value","tewl_change","treatment_claim","uv_filter_type","uva_label","water_resistance_duration","white_cast_observed","wipe_off_use"
];
const EXPECTED_AXES = ["barrier_support","cleansing_burden","exfoliation_load","hydration_preservation","irritation_burden","photo_protection","sebum_pore_control"];
let assertions = 0;
function ok(condition, message){ assertions += 1; if(!condition) throw new Error(message); }
function eq(actual, expected, message){ ok(JSON.stringify(actual)===JSON.stringify(expected), `${message}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
function sha(file){ return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }

const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT,"utf8"));
ok(snapshot.version === "product-decision-axis-input-snapshot-v1", "snapshot version");
ok(snapshot.stage === "V2.1-8I", "snapshot stage");
ok(snapshot.authority.repository === "gycha0109-beep/K_beauty", "repository authority");
ok(snapshot.authority.execution_main_sha === EXPECTED_MAIN, "execution main authority");
ok(snapshot.authority.hosted_project === "bygrczggxfuisupcevaz", "hosted project");
ok(snapshot.authority.registry_version === EXPECTED_REGISTRY, "registry version");
ok(snapshot.authority.registry_checksum === EXPECTED_REGISTRY_CHECKSUM, "registry checksum");
ok(snapshot.authority.registry_definition_count === 20, "registry definition count authority");
ok(snapshot.authority.subject_serializer === EXPECTED_SUBJECT_SERIALIZER, "subject serializer");
ok(snapshot.authority.proposition_serializer_lineage === EXPECTED_PROP_SERIALIZER, "proposition serializer lineage");

const h = snapshot.hosted_snapshot;
for(const [key,value] of Object.entries({catalog_product_count:164,registry_versions:1,registry_definitions:20,subjects:16,sources:16,bindings:16,evidence_records:41,fact_instances:41,evidence_links:41,assignments:41,review_events:180,confirmations:41,current:41,adopted_distinct_products:16,distinct_current_fact_keys:12})) ok(h[key]===value, `hosted ${key}`);

eq(snapshot.registry_definitions.map(x=>x.fact_key).sort(), EXPECTED_KEYS, "registry key set");
ok(snapshot.registry_definitions.every(x=>x.deprecated===false), "registry keys non-deprecated");
ok(snapshot.adopted_products.length===16, "distinct adopted product snapshot rows");
ok(new Set(snapshot.adopted_products.map(x=>x.product_id)).size===16, "adopted products distinct");
const allFacts = snapshot.adopted_products.flatMap(p=>p.facts.map(f=>({product_id:p.product_id,category:p.category,...f})));
ok(allFacts.length===41, "Current proposition count");
ok(new Set(allFacts.map(f=>f.fact_key)).size===12, "distinct populated Current fact keys");
ok(allFacts.every(f=>f.semantic_status==="supported"), "all frozen Current semantic statuses supported");
ok(allFacts.every(f=>f.authority_ceiling==="product_specific_primary"), "all frozen Current authorities product-specific primary");
const contains = allFacts.filter(f=>f.fact_key==="contains_active");
ok(contains.length===17, "contains_active proposition count");
ok(new Set(contains.map(f=>f.product_id)).size===10, "contains_active distinct product count no fanout");

ok(snapshot.category_coverage.length===9, "category count");
ok(snapshot.category_coverage.reduce((a,x)=>a+x.total_distinct_products,0)===164, "category catalog sum");
ok(snapshot.category_coverage.reduce((a,x)=>a+x.adopted_distinct_products,0)===16, "category adopted sum");
ok(snapshot.category_coverage.every(x=>x.unadopted_distinct_products===x.total_distinct_products-x.adopted_distinct_products), "category unadopted math");

ok(AXIS_CONTRACTS.length===7, "seven actual axis contracts");
eq(AXIS_CONTRACTS.map(x=>x.axis_key).sort(), EXPECTED_AXES, "axis key set");
const irritation = AXIS_CONTRACTS.find(x=>x.axis_key==="irritation_burden");
ok(irritation.dependency_contract.CONTRACT_UNSPECIFIED.some(x=>x.includes("eye_sting_observed")), "irritation current Registry contract gap frozen");
const exfol = AXIS_CONTRACTS.find(x=>x.axis_key==="exfoliation_load");
ok(exfol.dependency_contract.REQUIRED.includes("contains_active{mandelic_acid|lactic_acid|salicylic_acid}"), "exfoliation relevant active identity required");
const photo = AXIS_CONTRACTS.find(x=>x.axis_key==="photo_protection");
ok(photo.dependency_contract.CONTRACT_UNSPECIFIED.length===1, "photo calibration input minimum unspecified");
ok(AXIS_CONTRACTS.every(x=>x.calibration_defined===false), "numeric calibration undefined for all axes");
ok(AXIS_CONTRACTS.every(x=>x.production_consumed===false), "production PDA consumption false for all axes");

const expectedAudit = buildAudit(snapshot);
const audit = JSON.parse(fs.readFileSync(AUDIT,"utf8"));
ok(fs.readFileSync(AUDIT,"utf8")===canonicalJson(expectedAudit), "canonical audit exactly reproduces from snapshot");
eq(audit.axis_readiness.map(x=>x.axis_key).sort(), EXPECTED_AXES, "readiness axis set");
ok(audit.axis_readiness.every(x=>x.verdict==="MAPPER_CONTRACT_GAP"), "all axes root verdict mapper contract gap");
ok(audit.axis_readiness.every(x=>x.primary_reason.includes("CALIBRATION_READINESS_GATE") || x.axis_key==="irritation_burden"), "readiness gate root reason preserved");
ok(audit.axis_readiness.every(x=>x.evidence.products_blocked_by_semantic_status===0), "no semantic status quality blocker");
ok(audit.axis_readiness.every(x=>x.evidence.products_blocked_by_authority===0), "no authority quality blocker");
ok(audit.invariants.readiness_threshold_invented===false, "no readiness threshold invented");
ok(audit.invariants.missing_is_false===false, "missing != false");
ok(audit.invariants.reviewed_not_established_is_false===false, "reviewed_not_established != false");
ok(audit.invariants.evidence_insufficient_is_false===false, "evidence_insufficient != false");
ok(audit.invariants.multi_value_arbitrary_selection===false, "multi-value arbitrary selection forbidden");
ok(audit.invariants.hosted_product_fact_writes_v21_8i===0, "Hosted writes zero");
ok(audit.invariants.external_product_evidence_research_v21_8i===0, "external evidence research zero");
ok(audit.invariants.migration_delta_v21_8i===0, "migration delta zero");
ok(audit.invariants.product_decision_axis_numeric_calibration_v21_8i===0, "numeric calibration zero");
ok(audit.invariants.decision_axis_production_consumption_v21_8i===0, "production PDA consumption zero");
ok(audit.invariants.recommendation_behavior_delta_v21_8i===0, "recommendation behavior delta zero");

const ledger = audit.product_axis_coverage;
ok(new Set(ledger.map(x=>`${x.product_id}:${x.axis_key}`)).size===ledger.length, "product-axis ledger no proposition fanout");
ok(ledger.filter(x=>x.axis_key==="exfoliation_load").length===7, "exfoliation adopted product ledger count");
const medicube = ledger.find(x=>x.product_id==="230f1c9c-cbf8-4458-aaac-ea1010a21e8c" && x.axis_key==="exfoliation_load");
ok(medicube.multi_valued_proposition_summary.contains_active.proposition_count===2, "Medicube multi-value active cardinality preserved");
eq(medicube.multi_valued_proposition_summary.contains_active.relevant_exfoliating_values,["lactic_acid","salicylic_acid"],"Medicube relevant active values preserved");
const drg = ledger.find(x=>x.product_id==="c4a5f510-8d9e-46bd-a31c-3c0a34fee331" && x.axis_key==="exfoliation_load");
ok(drg.multi_valued_proposition_summary.contains_active.proposition_count===3, "Dr.G multi-value active cardinality preserved");
eq(drg.multi_valued_proposition_summary.contains_active.relevant_exfoliating_values,["mandelic_acid"],"Dr.G only explicit exfoliating identity selected");

const readiness = Object.fromEntries(audit.axis_readiness.map(x=>[x.axis_key,x]));
for(const [axis,evaluable,partial,total] of [
  ["cleansing_burden",1,0,26],["hydration_preservation",1,0,26],["irritation_burden",0,0,26],["sebum_pore_control",1,0,26],
  ["photo_protection",3,1,11],["barrier_support",2,2,61],["exfoliation_load",3,4,66]
]){
  ok(readiness[axis].evaluable_product_count===evaluable, `${axis} evaluable count`);
  ok(readiness[axis].partial_product_count===partial, `${axis} partial count`);
  ok(readiness[axis].blocked_product_count===total-evaluable, `${axis} blocked count`);
}

ok(audit.next_stage_recommendation.stage==="Product Decision Axis Mapper Contract Completion", "exactly one next stage recommendation");
ok(!Array.isArray(audit.next_stage_recommendation.stage), "next stage is singular");

const temp = fs.mkdtempSync(path.join(os.tmpdir(),"v21-8i-verify-"));
const built = build(temp);
ok(fs.readFileSync(built.out,"utf8")===fs.readFileSync(AUDIT,"utf8"), "Build output audit equals committed canonical artifact");
ok(fs.readFileSync(built.doc,"utf8")===fs.readFileSync(DOC,"utf8"), "Build output docs equals committed canonical docs");

const builderSource = fs.readFileSync(new URL("./product-decision-axis-readiness-audit-v1.mjs", import.meta.url),"utf8");
ok(!/^import\s+.*from\s+["\'](?:node:net|node:http|node:https|@supabase|postgres|pg)[^"\']*["\'];?$/im.test(builderSource), "audit builder imports no network/database client");
ok(!/\bfetch\s*\(/.test(builderSource), "audit builder has no network fetch path");
const verifierSource = fs.readFileSync(new URL(import.meta.url),"utf8");
ok(!/^import\s+.*from\s+["\'](?:node:net|node:http|node:https|@supabase|postgres|pg)[^"\']*["\'];?$/im.test(verifierSource), "audit verifier imports no network/database client");

console.log(JSON.stringify({
  version:"verify-product-decision-axis-readiness-audit-v1",
  status:"PASS",
  assertions,
  axes:audit.axis_readiness.length,
  adopted_distinct_products:snapshot.hosted_snapshot.adopted_distinct_products,
  current_propositions:snapshot.hosted_snapshot.current,
  snapshot_sha256:sha(SNAPSHOT),
  audit_sha256:sha(AUDIT),
  docs_sha256:sha(DOC)
},null,2));
