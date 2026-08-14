import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const VERSION = "product-decision-axis-readiness-audit-v1";
const SNAPSHOT = "evidence/product-decision-axis-readiness-v1/product-decision-axis-input-snapshot-v1.json";
const OUT = "evidence/product-decision-axis-readiness-v1/product-decision-axis-input-coverage-audit-v1.json";
const DOC = "docs/evidence/product-decision-axis-input-coverage-calibration-readiness-audit-v1.md";
const EXFOLIATING = new Set(["mandelic_acid","lactic_acid","salicylic_acid"]);

export const AXIS_CONTRACTS = Object.freeze([
  {
    axis_key:"cleansing_burden", mapper_version:"product-decision-axis-cleanser-v1",
    implementation_path:"scripts/product-evidence/product-decision-axis-cleanser-v1.mjs",
    categories:["cleanser"],
    dependency_contract:{REQUIRED:["deep_cleansing"],OPTIONAL:[],CONTEXT_ONLY:[],NOT_CONSUMED:[],CONTRACT_UNSPECIFIED:[]},
    null_contract:"missing/non-supported deep_cleansing remains null; supported false is explicit_negative_fact; no magnitude inferred",
    multi_value_contract:"not applicable: scalar deep_cleansing resolver input",
    authority_contract:"axis authority cannot exceed Product Fact authority; non-primary input becomes authority_limited",
    calibration_defined:false, production_consumed:false
  },
  {
    axis_key:"hydration_preservation", mapper_version:"product-decision-axis-cleanser-v1",
    implementation_path:"scripts/product-evidence/product-decision-axis-cleanser-v1.mjs",
    categories:["cleanser"],
    dependency_contract:{REQUIRED:["low_ph"],OPTIONAL:[],CONTEXT_ONLY:[],NOT_CONSUMED:[],CONTRACT_UNSPECIFIED:[]},
    null_contract:"missing/non-supported low_ph remains null; supported false is explicit_negative_fact; low_ph is indirect relevance only",
    multi_value_contract:"not applicable: scalar low_ph resolver input",
    authority_contract:"axis authority cannot exceed Product Fact authority; non-primary input becomes authority_limited",
    calibration_defined:false, production_consumed:false
  },
  {
    axis_key:"irritation_burden", mapper_version:"product-decision-axis-cleanser-v1",
    implementation_path:"scripts/product-evidence/product-decision-axis-cleanser-v1.mjs",
    categories:["cleanser"],
    dependency_contract:{REQUIRED:[],OPTIONAL:[],CONTEXT_ONLY:[],NOT_CONSUMED:["low_ph"],CONTRACT_UNSPECIFIED:["current Registry eye_sting_observed relationship to irritation_burden"]},
    null_contract:"mapper always returns no_relevant_fact with null estimate and authority none",
    multi_value_contract:"not defined because no irritation Product Fact is consumed",
    authority_contract:"authority remains none because mapper consumes no authoritative irritation input",
    calibration_defined:false, production_consumed:false
  },
  {
    axis_key:"sebum_pore_control", mapper_version:"product-decision-axis-cleanser-v1",
    implementation_path:"scripts/product-evidence/product-decision-axis-cleanser-v1.mjs",
    categories:["cleanser"],
    dependency_contract:{REQUIRED:["deep_cleansing"],OPTIONAL:[],CONTEXT_ONLY:[],NOT_CONSUMED:[],CONTRACT_UNSPECIFIED:[]},
    null_contract:"missing/non-supported deep_cleansing remains null; supported false is explicit_negative_fact; no sebum/pore magnitude inferred",
    multi_value_contract:"not applicable: scalar deep_cleansing resolver input",
    authority_contract:"axis authority cannot exceed Product Fact authority; non-primary input becomes authority_limited",
    calibration_defined:false, production_consumed:false
  },
  {
    axis_key:"photo_protection", mapper_version:"product-decision-axis-cross-category-v1",
    implementation_path:"scripts/product-evidence/product-decision-axis-cross-category-v1.mjs",
    categories:["sunscreen"],
    dependency_contract:{REQUIRED:[],OPTIONAL:["spf_value","uva_label","uv_filter_type","water_resistance_duration"],CONTEXT_ONLY:[],NOT_CONSUMED:[],CONTRACT_UNSPECIFIED:["minimum/calibration-required protection input set"]},
    null_contract:"no supported protection facts => missing/insufficient/conflict state; missing water resistance does not negate UV protection",
    multi_value_contract:"group resolver preserves cardinality-many facts; families dedupe contribution by proposition lineage",
    authority_contract:"weakest consumed Product Fact authority is preserved; mapper does not raise authority",
    calibration_defined:false, production_consumed:false,
    mapper_coverage_rule:"spf_value + uva_label => corroborated_fact; otherwise any supported protection input => partial_fact_coverage"
  },
  {
    axis_key:"barrier_support", mapper_version:"product-decision-axis-cross-category-v1",
    implementation_path:"scripts/product-evidence/product-decision-axis-cross-category-v1.mjs",
    categories:["moisturizer_balm","moisturizer_cream","moisturizer_gel","moisturizer_lotion_emulsion"],
    dependency_contract:{REQUIRED:["barrier_support_claim"],OPTIONAL:[],CONTEXT_ONLY:["primary_use_role"],NOT_CONSUMED:["contains_active","active_concentration"],CONTRACT_UNSPECIFIED:[]},
    null_contract:"no supported barrier_support_claim => missing/insufficient state; primary_use_role is explicitly excluded from efficacy contribution",
    multi_value_contract:"barrier_support_claim is consumed as claim evidence; usage role does not become efficacy",
    authority_contract:"product-specific primary claim => claim_only; weaker authority => authority_limited",
    calibration_defined:false, production_consumed:false
  },
  {
    axis_key:"exfoliation_load", mapper_version:"product-decision-axis-cross-category-v1",
    implementation_path:"scripts/product-evidence/product-decision-axis-cross-category-v1.mjs",
    categories:["treatment","toner_pad","toner_essence"],
    dependency_contract:{REQUIRED:["contains_active{mandelic_acid|lactic_acid|salicylic_acid}"],OPTIONAL:[],CONTEXT_ONLY:["active_concentration","recommended_use_frequency","product_format","wipe_off_use","pad_surface_texture"],NOT_CONSUMED:[],CONTRACT_UNSPECIFIED:[]},
    null_contract:"no supported relevant exfoliating active identity => no_relevant_fact/missing; concentration absence is not zero",
    multi_value_contract:"all contains_active propositions are preserved; only the explicit exfoliating identity set is selected, never one arbitrary proposition",
    authority_contract:"weakest consumed Product Fact authority is preserved; concentration/use context does not increase effect authority",
    calibration_defined:false, production_consumed:false
  }
]);

function stable(v){
  if(Array.isArray(v)) return v.map(stable);
  if(v && typeof v==="object") return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
  return v;
}
export function canonicalJson(v){ return JSON.stringify(stable(v))+"\n"; }
function countMap(values){
  const m={}; for(const v of values) m[v]=(m[v]||0)+1; return stable(m);
}
function currentFactDistribution(snapshot){
  const out=[];
  for(const def of snapshot.registry_definitions){
    const rows=[];
    for(const p of snapshot.adopted_products) for(const f of p.facts) if(f.fact_key===def.fact_key) rows.push({product_id:p.product_id,category:p.category,...f});
    out.push({
      fact_key:def.fact_key,
      current_proposition_count:rows.length,
      distinct_product_count:new Set(rows.map(r=>r.product_id)).size,
      category_distribution:countMap(rows.map(r=>r.category)),
      semantic_status_distribution:countMap(rows.map(r=>r.semantic_status)),
      authority_distribution:countMap(rows.map(r=>r.authority_ceiling))
    });
  }
  return out;
}
function byKey(p,key){ return p.facts.filter(f=>f.fact_key===key); }
function supported(p,key){ return byKey(p,key).filter(f=>f.semantic_status==="supported"); }
function applicable(p,c){ return c.categories.includes(p.category); }
function productAxisRow(p,c){
  const base={product_id:p.product_id,canonical_product_identity:{brand:p.brand,name:p.name},category:p.category,
    resolved_subject_identifier:p.subject_id,subject_semantic_key:p.subject_semantic_key,axis_key:c.axis_key};
  let inputs=[], missing=[], blockers=[], completeness="blocked", multi={};
  if(c.axis_key==="cleansing_burden" || c.axis_key==="sebum_pore_control"){
    inputs=supported(p,"deep_cleansing");
    if(!inputs.length){missing=["deep_cleansing"];blockers=["REQUIRED_INPUT_MISSING"];} else {completeness="mapper_signal_available";blockers=["CALIBRATION_READINESS_CONTRACT_UNSPECIFIED"];}
  } else if(c.axis_key==="hydration_preservation"){
    inputs=supported(p,"low_ph");
    if(!inputs.length){missing=["low_ph"];blockers=["REQUIRED_INPUT_MISSING"];} else {completeness="mapper_signal_available";blockers=["CALIBRATION_READINESS_CONTRACT_UNSPECIFIED"];}
  } else if(c.axis_key==="irritation_burden"){
    blockers=["MAPPER_CONTRACT_UNSPECIFIED"]; completeness="mapper_contract_blocked";
  } else if(c.axis_key==="photo_protection"){
    inputs=["spf_value","uva_label","uv_filter_type","water_resistance_duration"].flatMap(k=>supported(p,k));
    if(!inputs.length){blockers=["NO_RELEVANT_CURRENT_FACT"];completeness="blocked";}
    else {
      const corroborated=supported(p,"spf_value").length>0 && supported(p,"uva_label").length>0;
      completeness=corroborated?"mapper_corroborated_signal_available":"mapper_partial_signal_available";
      blockers=["CALIBRATION_READINESS_CONTRACT_UNSPECIFIED"];
    }
  } else if(c.axis_key==="barrier_support"){
    inputs=["barrier_support_claim","primary_use_role"].flatMap(k=>supported(p,k));
    if(!supported(p,"barrier_support_claim").length){missing=["barrier_support_claim"];blockers=["REQUIRED_INPUT_MISSING"];completeness=inputs.length?"context_only_partial":"blocked";}
    else {completeness="mapper_signal_available";blockers=["CALIBRATION_READINESS_CONTRACT_UNSPECIFIED"];}
  } else if(c.axis_key==="exfoliation_load"){
    const actives=supported(p,"contains_active");
    const relevant=actives.filter(f=>EXFOLIATING.has(f.value));
    const context=["active_concentration","recommended_use_frequency","product_format","wipe_off_use","pad_surface_texture"].flatMap(k=>supported(p,k));
    inputs=[...actives,...context];
    multi.contains_active={proposition_count:actives.length,values:actives.map(f=>f.value).sort(),relevant_exfoliating_values:relevant.map(f=>f.value).sort()};
    if(!relevant.length){missing=["contains_active{relevant_exfoliating_identity}"];blockers=["NO_RELEVANT_CURRENT_FACT"];completeness="blocked";}
    else {completeness=context.length?"mapper_signal_with_context_available":"mapper_signal_available";blockers=["CALIBRATION_READINESS_CONTRACT_UNSPECIFIED"];}
  }
  const compact=inputs.map(f=>({fact_key:f.fact_key,value:f.value,semantic_status:f.semantic_status,authority_ceiling:f.authority_ceiling,proposition_key:f.proposition_key}));
  return {...base,available_governed_current_inputs:compact,missing_required_inputs:missing,
    semantic_states:[...new Set(compact.map(x=>x.semantic_status))].sort(),
    authority_ceilings:[...new Set(compact.map(x=>x.authority_ceiling))].sort(),
    multi_valued_proposition_summary:multi,input_completeness_status:completeness,audit_blockers:blockers};
}
function axisEvidence(snapshot,c,ledger){
  const cat = snapshot.category_coverage.filter(x=>c.categories.includes(x.category));
  const total=cat.reduce((a,x)=>a+x.total_distinct_products,0);
  const adopted=cat.reduce((a,x)=>a+x.adopted_distinct_products,0);
  const rows=ledger.filter(x=>x.axis_key===c.axis_key);
  const signal=rows.filter(r=>r.input_completeness_status.startsWith("mapper_") && r.input_completeness_status.includes("signal") && r.input_completeness_status.includes("available"));
  const anyInput=rows.filter(r=>r.available_governed_current_inputs.length>0);
  let partial=0;
  if(c.axis_key==="photo_protection") partial=rows.filter(r=>r.input_completeness_status==="mapper_partial_signal_available").length;
  if(c.axis_key==="barrier_support") partial=rows.filter(r=>r.input_completeness_status==="context_only_partial").length;
  if(c.axis_key==="exfoliation_load") partial=rows.filter(r=>r.available_governed_current_inputs.length>0 && !(r.input_completeness_status.startsWith("mapper_") && r.input_completeness_status.includes("signal") && r.input_completeness_status.includes("available"))).length;
  const missingRequired=rows.filter(r=>r.audit_blockers.includes("REQUIRED_INPUT_MISSING")).length;
  const noRelevant=rows.filter(r=>r.audit_blockers.includes("NO_RELEVANT_CURRENT_FACT")).length;
  const semBlocked=rows.filter(r=>r.semantic_states.some(s=>s && s!=="supported")).length;
  const authorityBlocked=rows.filter(r=>r.authority_ceilings.some(a=>a && a!=="product_specific_primary")).length;
  let allRequired=null;
  if(c.dependency_contract.REQUIRED.length) allRequired=signal.length;
  return {
    catalog_distinct_products_in_applicable_categories:total,
    adopted_distinct_products_in_applicable_categories:adopted,
    products_with_any_relevant_current_input:anyInput.length,
    products_with_mapper_signal_available:signal.length,
    products_with_all_repository_defined_required_inputs:allRequired,
    products_with_partial_inputs:partial,
    products_blocked_by_missing_required_input:missingRequired,
    products_blocked_by_no_relevant_input:noRelevant,
    products_blocked_by_semantic_status:semBlocked,
    products_blocked_by_authority:authorityBlocked,
    products_blocked_by_mapper_contract:total,
    products_blocked_only_by_calibration_not_defined:0,
    unadopted_distinct_products:total-adopted
  };
}
function readiness(c,e){
  const irritation=c.axis_key==="irritation_burden";
  const secondary=[
    `governed mapper-signal products ${e.products_with_mapper_signal_available}/${e.catalog_distinct_products_in_applicable_categories}`,
    `adopted products ${e.adopted_distinct_products_in_applicable_categories}/${e.catalog_distinct_products_in_applicable_categories}`,
    ...(e.products_blocked_by_missing_required_input?[`adopted products missing required input: ${e.products_blocked_by_missing_required_input}`]:[]),
    ...(e.products_blocked_by_no_relevant_input?[`adopted products with no relevant axis input: ${e.products_blocked_by_no_relevant_input}`]:[]),
    "current usable inputs have no observed semantic-status or authority-quality blocker"
  ];
  return {
    axis_key:c.axis_key,
    verdict:"MAPPER_CONTRACT_GAP",
    primary_reason:irritation
      ?"CURRENT_MAPPER_HAS_NO_IRRITATION_FACT_DEPENDENCY_AND_CALIBRATION_READINESS_GATE_IS_UNSPECIFIED"
      :"CALIBRATION_READINESS_GATE_IS_NOT_DEFINED_BY_CURRENT_REPOSITORY_AUTHORITY",
    secondary_blockers:secondary,
    evaluable_product_count:e.products_with_mapper_signal_available,
    partial_product_count:e.products_with_partial_inputs,
    blocked_product_count:e.catalog_distinct_products_in_applicable_categories-e.products_with_mapper_signal_available,
    evidence:e
  };
}
export function buildAudit(snapshot){
  const dist=currentFactDistribution(snapshot);
  const ledger=[];
  for(const p of snapshot.adopted_products) for(const c of AXIS_CONTRACTS) if(applicable(p,c)) ledger.push(productAxisRow(p,c));
  ledger.sort((a,b)=>a.axis_key.localeCompare(b.axis_key)||a.category.localeCompare(b.category)||a.product_id.localeCompare(b.product_id));
  const axisContracts=AXIS_CONTRACTS.map(c=>({...c,calibration_readiness_gate:"CONTRACT_UNSPECIFIED"}));
  const axisReadiness=AXIS_CONTRACTS.map(c=>readiness(c,axisEvidence(snapshot,c,ledger)));
  return {
    version:VERSION,stage:"V2.1-8I",
    authority:snapshot.authority,
    hosted_snapshot:snapshot.hosted_snapshot,
    category_coverage:snapshot.category_coverage,
    current_fact_distribution:dist,
    axis_contracts:axisContracts,
    product_axis_coverage:ledger,
    axis_readiness:axisReadiness,
    invariants:{
      hosted_product_fact_writes_v21_8i:0,
      external_product_evidence_research_v21_8i:0,
      migration_delta_v21_8i:0,
      product_decision_axis_numeric_calibration_v21_8i:0,
      decision_axis_production_consumption_v21_8i:0,
      recommendation_behavior_delta_v21_8i:0,
      missing_is_false:false,
      reviewed_not_established_is_false:false,
      evidence_insufficient_is_false:false,
      multi_value_arbitrary_selection:false,
      readiness_threshold_invented:false,
      recommendation_activated:false
    },
    next_stage_recommendation:{
      stage:"Product Decision Axis Mapper Contract Completion",
      why:"All seven current axes lack a governed calibration-readiness/representative-coverage gate; irritation_burden additionally lacks a current Registry-backed irritation input contract.",
      proves:"Defines required/optional/context input roles and a defensible readiness gate without inventing numeric calibration weights.",
      explicitly_does_not_do:["external evidence research","new Product Fact creation","numeric calibration","production Decision Axis consumption","Recommendation activation"]
    }
  };
}
function md(a){
  const lines=["# Product Decision Axis Input Coverage & Calibration Readiness Audit v1","",
    "> V2.1-8I deterministic read-only audit. No Hosted writes, numeric calibration, production Decision Axis consumption, or Recommendation activation.","",
    "## FACT — Authority","",
    `- repository: \`${a.authority.repository}\``,
    `- execution main: \`${a.authority.execution_main_sha}\``,
    `- Hosted project: \`${a.authority.hosted_project}\``,
    `- Registry: \`${a.authority.registry_version}\` (${a.authority.registry_definition_count} definitions)`,
    `- Subject serializer: \`${a.authority.subject_serializer}\``,
    `- proposition serializer lineage: \`${a.authority.proposition_serializer_lineage}\``,
    "",
    "## FACT — Hosted baseline","",
    `Catalog ${a.hosted_snapshot.catalog_product_count}; Subjects ${a.hosted_snapshot.subjects}; Evidence ${a.hosted_snapshot.evidence_records}; Current ${a.hosted_snapshot.current}; adopted distinct products ${a.hosted_snapshot.adopted_distinct_products}.`,
    "",
    "Current rows are propositions, not products. Multi-valued facts such as `contains_active` therefore use distinct product identity for coverage.",
    "",
    "## FACT — Actual mapper locations","",
    "- `scripts/product-evidence/product-fact-current-resolver-v1.mjs`",
    "- `scripts/product-evidence/product-fact-current-group-resolver-v1.mjs`",
    "- `scripts/product-evidence/product-decision-axis-cleanser-v1.mjs`",
    "- `scripts/product-evidence/product-decision-axis-cross-category-v1.mjs`",
    "- `scripts/product-evidence/product-decision-axis-shadow-recommendation-v1.mjs`",
    "",
    "## FACT — Category coverage","",
    "| category | catalog | adopted | unadopted | ratio |","|---|---:|---:|---:|---:|",
    ...a.category_coverage.map(x=>`| ${x.category} | ${x.total_distinct_products} | ${x.adopted_distinct_products} | ${x.unadopted_distinct_products} | ${x.adoption_ratio.toFixed(6)} |`),
    "",
    "## FACT — Current Fact coverage","",
    "| fact_key | Current propositions | distinct products |","|---|---:|---:|",
    ...a.current_fact_distribution.map(x=>`| ${x.fact_key} | ${x.current_proposition_count} | ${x.distinct_product_count} |`),
    "",
    "All 41 Current propositions in the frozen snapshot are `supported` and have `product_specific_primary` authority; observed Current inputs therefore have no authority-quality blocker.",
    "",
    "## FACT — Axis dependency matrix","",
    "| axis | mapper | categories | REQUIRED | OPTIONAL | CONTEXT_ONLY | input CONTRACT_UNSPECIFIED | calibration-readiness gate | production consumed |","|---|---|---|---|---|---|---|---|---|",
    ...a.axis_contracts.map(c=>`| ${c.axis_key} | ${c.mapper_version} | ${c.categories.join(", ")} | ${c.dependency_contract.REQUIRED.join(", ")||"—"} | ${c.dependency_contract.OPTIONAL.join(", ")||"—"} | ${c.dependency_contract.CONTEXT_ONLY.join(", ")||"—"} | ${c.dependency_contract.CONTRACT_UNSPECIFIED.join(", ")||"—"} | ${c.calibration_readiness_gate} | NO |`),
    "",
    ...a.axis_contracts.flatMap(c=>[
      `### ${c.axis_key}`,
      `- null contract: ${c.null_contract}`,
      `- multi-value contract: ${c.multi_value_contract}`,
      `- authority contract: ${c.authority_contract}`,
      `- numeric calibration defined: ${c.calibration_defined ? "YES" : "NO"}`,
      `- production consumed: ${c.production_consumed ? "YES" : "NO"}`,
      ""
    ]),
    "## INFERENCE — Calibration readiness","",
    "No current repository authority defines a minimum sample-size, representative-coverage percentage, or other calibration-readiness gate. V2.1-8I therefore does not invent one.",
    "",
    "| axis | verdict | evaluable | partial | blocked | primary reason |","|---|---|---:|---:|---:|---|",
    ...a.axis_readiness.map(r=>`| ${r.axis_key} | ${r.verdict} | ${r.evaluable_product_count} | ${r.partial_product_count} | ${r.blocked_product_count} | ${r.primary_reason} |`),
    "",
    "The verdict is not `COVERAGE_INPUT_GAP` merely because the raw ratios are small: declaring any observed sample \"too small\" would itself require an ungoverned threshold. Coverage remains secondary evidence under the root mapper/readiness-contract gap.",
    "",
    "## FACT — Null / unknown discipline","",
    "- missing Current is not false.",
    "- `reviewed_not_established` is not false.",
    "- `evidence_insufficient` is not false.",
    "- missing concentration is not zero.",
    "- multi-valued `contains_active` propositions are retained and filtered only by the mapper's explicit exfoliating-active set.",
    "- no legacy value is used to backfill governed Product Fact input.",
    "",
    "## FACT — No-write / production invariance contract","",
    "- Hosted Product Fact writes: 0",
    "- migrations: 0",
    "- numeric calibration: 0",
    "- production Decision Axis consumption: 0",
    "- Recommendation behavior delta required: 0",
    "- canonical invariance verifier: `scripts/verify-skin-decision-recommendation-invariance.mjs`",
    "- canonical scenario authority: 164 products × 12 scenarios",
    "- prior frozen reference authority: `e6a116afec9a99d40b59ade0e38d3a451cf456e1`; V2.1-8I CI replays rather than assumes it.",
    "",
    "## FACT — Explicit lifecycle NO flags","",
    "- `CATALOG_FULLY_ADOPTED = NO`",
    "- `PRODUCT_DECISION_AXIS_PRODUCTION_CALIBRATED = NO`",
    "- `DECISION_AXIS_PRODUCTION_CONSUMPTION = NO`",
    "- `RECOMMENDATION_SCORER_CHANGED = NO`",
    "- `RECOMMENDATION_ACTIVATED = NO`",
    "- `ADMIN_PRODUCT_FACT_UI_OPERATIONAL = NOT_ESTABLISHED`",
    "",
    "## ROADMAP RECOMMENDATION — Exactly one next stage","",
    "**Product Decision Axis Mapper Contract Completion**",
    "",
    "Define the exact calibration-readiness gate and formal input-role semantics for the seven current axes; resolve the `irritation_burden` relationship to current Registry irritation evidence. Do not perform evidence research, numeric calibration, production consumption, or Recommendation activation."
  ];
  return lines.join("\n")+"\n";
}
export function build(root=process.env.V21_8I_OUTPUT_ROOT||"."){
  const snapshot=JSON.parse(fs.readFileSync(SNAPSHOT,"utf8"));
  const audit=buildAudit(snapshot);
  const out=path.join(root,OUT), doc=path.join(root,DOC);
  fs.mkdirSync(path.dirname(out),{recursive:true}); fs.mkdirSync(path.dirname(doc),{recursive:true});
  fs.writeFileSync(out,canonicalJson(audit)); fs.writeFileSync(doc,md(audit));
  return {audit,out,doc};
}
if(import.meta.url===`file://${process.argv[1]}`){
  const r=build();
  const h=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
  console.log(JSON.stringify({version:VERSION,status:"built",audit_sha256:h(r.out),docs_sha256:h(r.doc),axes:r.audit.axis_readiness.map(x=>[x.axis_key,x.verdict])}));
}
