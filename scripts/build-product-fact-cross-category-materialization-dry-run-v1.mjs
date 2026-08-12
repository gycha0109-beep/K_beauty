#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const INPUT_DIR=path.join(ROOT,"evidence/product-evidence-decision-axis-v1");
const OUTPUT_DIR=path.join(ROOT,"evidence/product-fact-materialization-v1");
const OUTPUT_JSON=path.join(OUTPUT_DIR,"cross-category-pilot-materialization-dry-run-v1.json");
const OUTPUT_MD=path.join(ROOT,"docs/evidence/cross-category-pilot-materialization-dry-run-v1.md");

export const C={
  main_sha:"22c20146192e9075c9d9cb36be7e5f49f83d3119",
  pilot_head:"596493154b74548187ed71f8d522bb41c7ad1900",
  dry_run_version:"cross-category-pilot-materialization-dry-run-v1",
  registry_blob:"32fdaa2d3a181c9d18888fc48c1343e083ad20f7",
  corpus_blob:"c68e26daf3d3295c9f669362851383dd9997c21c",
  mapping_blob:"20d211c70f6ba44ca4f9205942cb5e0387d74b7e",
  gap_blob:"60b53f49cbac2021a47e50f4e1a0a79760ab7874",
  frozen_verifier_blob:"9056eb4b95e46e6afc58158da50d5c6c27e579a9",
  corpus_sha256:"47457c0242451a35305fd8eceba0ebb7e210eb9ee2e73134ccf41696d18e517d",
  mapping_sha256:"c746c5d02f654ed7f0a8e8385611ac65ca30b9c4648fa4c6454ac863e7c9314f",
  gap_sha256:"5a4580d76cca62d90a3ac306744054c507a6d5e45b0b91a41dffb3b754980215",
  pf2_blob:"676afbc56bf90443a1198f93427382f067d19407",
  controlled_blob:"03523a01322170e6b0fca2ff4cc77b8be581f19e",
  subject_blob:"a08651d4ea5825e33f2dc94fe98c5b7643d32532",
  candidate_policy_manifest_blob:"37d60570f5a79cbc0baad114cfc1f7b4ca9e7440",
  subject_serializer:"product-fact-subject-identity-v1",
  proposition_serializer:"product-fact-proposition-pilot-v1",
  identity_resolution_version:"cross-category-real-evidence-pilot-v1",
  fusion_policy_version:"cross-category-real-fact-mapping-pilot-v1:no-recalibration"
};

const P={
  registry:path.join(INPUT_DIR,"cross-category-registry-v1.json"),
  corpus:path.join(INPUT_DIR,"cross-category-real-evidence-pilot-v1.json"),
  mapping:path.join(INPUT_DIR,"cross-category-real-fact-mapping-pilot-v1.json"),
  gaps:path.join(INPUT_DIR,"cross-category-real-pilot-gap-report-v1.json"),
  frozenVerifier:path.join(ROOT,"scripts/verify-cross-category-real-evidence-pilot-v1.mjs"),
  pf2:path.join(ROOT,"supabase/migrations/20260809115932_product_fact_storage_v1.sql"),
  controlled:path.join(ROOT,"supabase/migrations/20260810174400_product_fact_controlled_write_v1.sql"),
  subject:path.join(ROOT,"supabase/migrations/20260810174410_product_fact_subject_registration_v1.sql"),
  candidatePolicy:path.join(ROOT,"docs/architecture/candidate-policy-main-integration-blob-manifest-v1.json")
};

export const stable=v=>{
  if(Array.isArray(v)) return v.map(stable);
  if(v&&typeof v==="object") return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
  return v;
};
export const canonical=v=>JSON.stringify(stable(v));
export const digest=v=>crypto.createHash("sha256").update(typeof v==="string"?v:canonical(v)).digest("hex");
const fileSha=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const J=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const gitBlob=p=>execFileSync("git",["hash-object",p],{cwd:ROOT,encoding:"utf8"}).trim();
const sorted=a=>[...a].sort((x,y)=>String(x).localeCompare(String(y),"en"));
const uniq=a=>[...new Set(a)];
const by=(a,k)=>new Map(a.map(x=>[x[k],x]));
const safe=(o,k,d=null)=>Object.prototype.hasOwnProperty.call(o,k)?o[k]:d;

function verifyFreeze(){
  const pairs=[
    [P.registry,C.registry_blob],[P.corpus,C.corpus_blob],[P.mapping,C.mapping_blob],[P.gaps,C.gap_blob],
    [P.frozenVerifier,C.frozen_verifier_blob],[P.pf2,C.pf2_blob],[P.controlled,C.controlled_blob],[P.subject,C.subject_blob],
    [P.candidatePolicy,C.candidate_policy_manifest_blob]
  ];
  for(const [p,b] of pairs) assert.equal(gitBlob(p),b,`frozen/protected blob drift: ${path.relative(ROOT,p)}`);
  assert.equal(fileSha(P.corpus),C.corpus_sha256,"corpus SHA-256 drift");
  assert.equal(fileSha(P.mapping),C.mapping_sha256,"mapping SHA-256 drift");
  assert.equal(fileSha(P.gaps),C.gap_sha256,"gap SHA-256 drift");
}

function valueIdentity(f){
  if(f.status!=="supported") return null;
  const v=f.value;
  if(v&&typeof v==="object"&&!Array.isArray(v)) return stable(v);
  return v;
}

function valueColumns(def,f){
  const empty={value_type:null,value_boolean:null,value_enum:null,value_number:null,value_unit:null,value_range_min:null,value_range_max:null,value_entity_identifier:null};
  if(f.semantic_status!=="supported") return empty;
  const t=def.value_type,v=f.typed_value;
  if(t==="boolean") return {...empty,value_type:t,value_boolean:v};
  if(t==="enum") return {...empty,value_type:t,value_enum:v};
  if(t==="number") return {...empty,value_type:t,value_number:v};
  if(t==="number_unit") return {...empty,value_type:t,value_number:v.amount,value_unit:v.unit};
  if(t==="range_unit") return {...empty,value_type:t,value_range_min:v.min,value_range_max:v.max,value_unit:v.unit};
  if(t==="entity_identifier") return {...empty,value_type:t,value_entity_identifier:v};
  throw new Error(`unsupported value_type ${t}`);
}

function inferFactValue(registryFact,mapped){
  const t=registryFact.value_type,v=mapped.value;
  if(t==="number_unit"&&typeof v==="object"&&"amount" in v) return {amount:v.amount,unit:v.unit};
  if(t==="range_unit"&&typeof v==="object") return {min:v.min,max:v.max,unit:v.unit};
  return v;
}

function sourceMarketCompatibility(source,product){
  const sm=source.market_if_known,pm=product.selected_market;
  if(!sm||!pm) return "unknown";
  if(sm===pm) return "equivalent";
  if(sm==="GLOBAL") return "broader";
  if(sm.split(/[_+,/]/).includes(pm)) return "overlapping";
  return "disjoint_or_variant_specific";
}

function buildMarkdown(o){
  const s=o.summary,w=o.expected_writes;
  const lines=[
    "# Cross-category Pilot Product Fact Materialization Dry-run v1","",
    "> Offline deterministic proposal only. Hosted Product Fact business writes = 0.","",
    "## Authority","",
    `- execution authority main: \`${o.authority.current_main_sha}\``,
    `- frozen pilot head: \`${o.authority.frozen_pilot_head}\``,
    `- registry blob: \`${o.input_freeze.registry.git_blob}\``,
    `- corpus SHA-256: \`${o.input_freeze.corpus.sha256}\``,
    `- mapping SHA-256: \`${o.input_freeze.mapping.sha256}\``,
    `- gap SHA-256: \`${o.input_freeze.gap_report.sha256}\``,"",
    "## Summary","",
    `- products: ${s.input_products}`,
    `- sources: ${s.input_sources}`,
    `- evidence records: ${s.input_evidence_records}`,
    `- frozen fused facts: ${s.input_fused_facts}`,
    `- subjects: ${s.resolved_subjects} resolved / ${s.ambiguous_subjects} ambiguous`,
    `- evidence proposals: ${s.evidence_proposals} (${s.evidence_materializable} materializable / ${s.evidence_blocked} blocked)`,
    `- fact proposals: ${s.fact_proposals} (${s.confirmation_eligible_facts} confirmation-eligible / ${s.confirmation_blocked_facts} blocked)`,
    `- forced mappings: ${s.forced_mapping_count}`,
    `- Hosted writes: ${s.hosted_write_count}`,"",
    "## Materialization boundary","",
    "The dry-run preserves Product != Product Fact Subject, Evidence != Fact, and Fact Instance != Current. The single ambiguous NEEDLY subject remains provisional and confirmation/current-ineligible. Registry gaps, source gaps, and relationship-identity gaps are retained rather than force-mapped.","",
    "Source `content_digest` proposals hash the frozen source provenance record because the frozen pilot contains locators and extraction provenance but no external page-byte snapshot. The digest basis is explicitly tagged and must not be represented as a byte hash of the live webpage.","",
    "The proposal `fusion_input_digest` is deterministic over frozen semantic identities. PF runtime fusion digests that include Hosted UUID identities remain deferred until a future approved Hosted materialization allocates those UUIDs.","",
    "## Expected writes if the full deterministic eligible set were later materialized","",
    "| relation | inserts | updates | deletes | phase |",
    "|---|---:|---:|---:|---|",
    ...Object.entries(w).map(([r,x])=>`| ${r} | ${x.expected_insert_count} | ${x.expected_update_count} | ${x.expected_delete_count} | ${x.phase} |`),"",
    "These are a deterministic full-eligible-set planning envelope, not authorization for V2.1-3. V2.1-3 remains coordinator-selected and may confirm only a smaller subset.","",
    "## Lifecycle","",
    "- PRODUCT_FACT_CATALOG_ADOPTED = NO",
    "- CATALOG_ADOPTED = NO",
    "- DECISION_AXIS_CONSUMPTION = NO",
    "- RECOMMENDATION_ACTIVATED = NO",""
  ];
  return lines.join("\n");
}

export function buildMaterialization(){
  verifyFreeze();
  const registry=J(P.registry),corpus=J(P.corpus),mapping=J(P.mapping),gaps=J(P.gaps);
  assert.equal(corpus.products.length,12);
  assert.equal(corpus.sources.length,15);
  assert.equal(corpus.evidence_records.length,29);
  assert.equal(mapping.products.flatMap(p=>p.mapped_facts).length,23);
  assert.equal(mapping.forced_mapping_count,0);
  assert.deepEqual(gaps.severity_summary,{S1_VOCABULARY_ONLY:4,S2_STRUCTURAL:0,S3_RESEARCH_OR_IDENTITY:4});

  const products=by(corpus.products,"pilot_id"),productsByCatalog=by(corpus.products,"catalog_product_id");
  const sourceMap=by(corpus.sources,"source_id"),evidenceMap=by(corpus.evidence_records,"evidence_id"),mappingMap=by(mapping.products,"pilot_id");
  const registryMap=by(registry.facts,"fact_key");
  assert.equal(registry.facts.length,20,"governed registry key count");

  const mappedFactById=new Map();
  const evidenceToMappedFact=new Map();
  for(const mp of mapping.products){
    for(const f of mp.mapped_facts){
      mappedFactById.set(f.fact_instance_id,{...f,pilot_id:mp.pilot_id});
      for(const ref of [...(f.supporting_evidence_refs||[]),...(f.opposing_evidence_refs||[])]){
        assert.ok(!evidenceToMappedFact.has(ref),`evidence ${ref} maps to multiple frozen facts`);
        evidenceToMappedFact.set(ref,{fact:f,pilot_id:mp.pilot_id});
      }
    }
  }

  const subjects=corpus.products.map(product=>{
    const mp=mappingMap.get(product.pilot_id);
    const variants=uniq(mp.mapped_facts.map(f=>f.scope?.variant).filter(Boolean));
    const markets=uniq(mp.mapped_facts.map(f=>f.scope?.market).filter(Boolean));
    const marketApplicability=product.identity_status==="resolved"&&markets.length===1&&markets[0]!=="GLOBAL"&&markets[0]===product.selected_market?markets[0]:null;
    const identityToken={
      pilot_id:product.pilot_id,catalog_product_id:product.catalog_product_id,canonical_brand:product.canonical_brand,
      canonical_product_name:product.canonical_product_name,identity_evidence_refs:sorted(product.identity_evidence_refs),
      identity_status:product.identity_status,selected_market:product.selected_market
    };
    const formulationRevisionKey=`pilot-freeze-${digest(identityToken).slice(0,32)}`;
    const variantKey=variants.length===1?variants[0]:null;
    const semanticIdentity={product_id:product.catalog_product_id,variant_key:variantKey,formulation_revision_key:formulationRevisionKey,market_applicability:marketApplicability,region_applicability:null,valid_from:null,valid_to:null};
    return {
      subject_ref:`subject:${product.pilot_id}`,
      pilot_id:product.pilot_id,
      catalog_product_id:product.catalog_product_id,
      product_identity_input:identityToken,
      proposed_subject_identity:{
        product_id:product.catalog_product_id,
        subject_semantic_key:digest(semanticIdentity),
        subject_identity_serializer_version:C.subject_serializer,
        variant_key:variantKey,
        formulation_revision_key:formulationRevisionKey,
        formulation_label:product.canonical_product_name,
        identity_status:product.identity_status,
        identity_resolution_version:C.identity_resolution_version,
        current_state:product.identity_status==="resolved"?"current":"provisional",
        market_applicability:marketApplicability,
        region_applicability:null,valid_from:null,valid_to:null,predecessor_subject_id:null,supersession_kind:null
      },
      market_scope:{selected_market:product.selected_market,subject_market_applicability:marketApplicability,evidence_market_scopes:sorted(markets)},
      region_scope:null,locale_scope:null,
      identity_status:product.identity_status,
      identity_reasoning:product.identity_notes,
      identity_provenance_refs:sorted(product.identity_evidence_refs),
      materialization_eligibility:product.identity_status==="resolved"?"eligible":"identity_blocked",
      current_creation_eligibility:product.identity_status==="resolved",
      confirmation_eligibility:product.identity_status==="resolved",
      block_reason:product.identity_status==="resolved"?null:"frozen_identity_status_ambiguous"
    };
  }).sort((a,b)=>a.pilot_id.localeCompare(b.pilot_id,"en"));
  const subjectByPilot=by(subjects,"pilot_id");

  const sourceToPilots=new Map(corpus.sources.map(s=>[s.source_id,new Set()]));
  for(const p of corpus.products) for(const s of p.identity_evidence_refs||[]) sourceToPilots.get(s)?.add(p.pilot_id);
  for(const mp of mapping.products){
    const refs=[...mp.mapped_facts.flatMap(f=>[...(f.supporting_evidence_refs||[]),...(f.opposing_evidence_refs||[])]),...(mp.unmapped_evidence_refs||[])];
    for(const er of refs){const e=evidenceMap.get(er); if(e) sourceToPilots.get(e.source_id)?.add(mp.pilot_id);}
  }
  for(const g of gaps.gaps){const p=productsByCatalog.get(g.catalog_product_id);for(const er of g.evidence_refs||[]){const e=evidenceMap.get(er);if(e&&p)sourceToPilots.get(e.source_id)?.add(p.pilot_id);}}
  for(const e of corpus.evidence_records) if(e.pilot_id&&products.has(e.pilot_id)) sourceToPilots.get(e.source_id)?.add(e.pilot_id);
  for(const [sid,set] of sourceToPilots) assert.equal(set.size,1,`source ${sid} must resolve to exactly one pilot product in frozen pilot`);

  const sources=corpus.sources.map(source=>({
    source_ref:`source:${source.source_id}`,
    frozen_source_id:source.source_id,
    canonical_locator:source.source_url,
    publisher:source.publisher,
    source_kind:source.source_kind,
    content_digest:digest(source),
    content_digest_basis:"sha256(canonical frozen source provenance record); NOT live-page byte snapshot",
    external_snapshot_reference:null,
    source_metadata:{
      frozen_source_id:source.source_id,
      exact_product_match:source.exact_product_match,
      source_authority_candidate:source.source_authority_candidate,
      source_language:source.source_language,
      source_notes:source.source_notes,
      provenance_container:`${path.relative(ROOT,P.corpus)}#sources/${source.source_id}`
    },
    market:source.market_if_known||null,region:null,locale:null,published_at:null,accessed_at:source.accessed_at,observed_at:null,
    materialization_eligibility:"eligible",
    provenance_preserved:true
  })).sort((a,b)=>a.frozen_source_id.localeCompare(b.frozen_source_id,"en"));

  const bindings=[];
  const bindingBySourcePilot=new Map();
  for(const source of corpus.sources){
    for(const pilotId of sorted(sourceToPilots.get(source.source_id))){
      const product=products.get(pilotId),subject=subjectByPilot.get(pilotId);
      let state,scopeRelation;
      if(product.identity_status!=="resolved"||source.exact_product_match==="uncertain"){
        state="formulation_ambiguous";scopeRelation="overlapping";
      }else if(source.exact_product_match==="partial"){
        state="variant_ambiguous";scopeRelation="disjoint";
      }else if(source.exact_product_match==="no"){
        state="disjoint_subject";scopeRelation="disjoint";
      }else{
        state="exact_subject_match";scopeRelation="equivalent";
      }
      const eligible=["exact_subject_match","equivalent_presentation_match"].includes(state)&&subject.identity_status==="resolved"&&["equivalent","narrower"].includes(scopeRelation);
      const b={
        binding_ref:`binding:${source.source_id}:${pilotId}`,
        source_ref:`source:${source.source_id}`,frozen_source_id:source.source_id,pilot_id:pilotId,catalog_product_id:product.catalog_product_id,
        proposed_subject_ref:eligible?subject.subject_ref:null,
        binding_state:state,scope_relation:scopeRelation,
        market_compatibility:sourceMarketCompatibility(source,product),region_compatibility:"not_asserted",variant_compatibility:state,
        presentation_metadata:{frozen_exact_product_match:source.exact_product_match,source_market:source.market_if_known||null,selected_product_market:product.selected_market,source_notes:source.source_notes},
        identity_resolution_version:C.identity_resolution_version,reviewed_at:source.accessed_at,
        evidence_admissibility:eligible?"eligible":"blocked",
        block_reason:eligible?null:(product.identity_status!=="resolved"?"identity_ambiguous":state)
      };
      bindings.push(b);bindingBySourcePilot.set(`${source.source_id}|${pilotId}`,b);
    }
  }
  bindings.sort((a,b)=>a.binding_ref.localeCompare(b.binding_ref,"en"));

  const factDrafts=[];
  for(const mp of mapping.products){
    const subject=subjectByPilot.get(mp.pilot_id);
    for(const frozen of mp.mapped_facts){
      const def=registryMap.get(frozen.fact_key);assert.ok(def,`registry definition missing ${frozen.fact_key}`);
      const parentFrozen=frozen.subject_ref?mappedFactById.get(frozen.subject_ref)?.fact:null;
      factDrafts.push({
        proposal_ref:`fact:${frozen.fact_instance_id}`,frozen_fact_instance_id:frozen.fact_instance_id,pilot_id:mp.pilot_id,subject_ref:subject.subject_ref,
        registry_version:registry.registry_version,registry_definition_ref:`${registry.registry_version}:${frozen.fact_key}`,fact_key:frozen.fact_key,
        frozen_parent_fact_instance_id:frozen.subject_ref||null,parent_frozen_fact:parentFrozen||null,
        typed_value:inferFactValue(def,frozen),semantic_status:frozen.status,authority_ceiling:frozen.authority_ceiling,fused_confidence:frozen.fused_confidence,
        fusion_policy_version:C.fusion_policy_version,supporting_evidence_refs:sorted(frozen.supporting_evidence_refs||[]),opposing_evidence_refs:sorted(frozen.opposing_evidence_refs||[]),
        context_evidence_refs:[],scope:stable(frozen.scope||{}),qualifier_context:stable(frozen.qualifier_context||{}),
        source_kind:"mapped_fact",confirmation_eligibility:"eligible",block_reason:null
      });
    }
  }

  const blocked=[];
  const representedNonSupported=[];
  for(const mp of mapping.products){
    const product=products.get(mp.pilot_id),subject=subjectByPilot.get(mp.pilot_id);
    for(const r of mp.review_coverage){
      if(r.outcome==="supported") continue;
      if(["registry_gap","identity_blocked","source_blocked"].includes(r.outcome)){
        blocked.push({block_ref:`review-block:${mp.pilot_id}:${digest(r).slice(0,16)}`,kind:r.outcome,pilot_id:mp.pilot_id,fact_key:r.fact_key||null,candidate_concept:r.candidate_concept||null,semantic_status:null,reason:`frozen_review_outcome_${r.outcome}`,forced_mapping:false});
        continue;
      }
      if(!["reviewed_not_established","evidence_insufficient"].includes(r.outcome)) continue;
      if(!r.fact_key||!registryMap.has(r.fact_key)){
        blocked.push({block_ref:`review-nonfact:${mp.pilot_id}:${digest(r).slice(0,16)}`,kind:"semantic_outcome_not_materializable",pilot_id:mp.pilot_id,fact_key:r.fact_key||null,candidate_concept:r.candidate_concept||null,semantic_status:r.outcome,reason:"canonical_fact_key_missing",forced_mapping:false});
        continue;
      }
      const def=registryMap.get(r.fact_key);
      const relRequired=Boolean(def.relationship_schema?.subject_ref_required);
      if(relRequired){
        blocked.push({block_ref:`relationship-block:${mp.pilot_id}:${digest(r).slice(0,16)}`,kind:"relationship_identity_blocked",pilot_id:mp.pilot_id,fact_key:r.fact_key,candidate_concept:r.candidate_concept||null,semantic_status:r.outcome,reason:"parent_proposition_identity_not_explicit_in_frozen_review_coverage",forced_mapping:false});
        continue;
      }
      const matchingContext=corpus.evidence_records.filter(e=>e.pilot_id===mp.pilot_id&&e.fact_key===r.fact_key).map(e=>e.evidence_id);
      const scope=matchingContext.length===1?stable(evidenceMap.get(matchingContext[0]).scope||{}):{market:product.selected_market};
      representedNonSupported.push({
        proposal_ref:`fact:review:${mp.pilot_id}:${r.fact_key}:${r.outcome}`,frozen_fact_instance_id:null,pilot_id:mp.pilot_id,subject_ref:subject.subject_ref,
        registry_version:registry.registry_version,registry_definition_ref:`${registry.registry_version}:${r.fact_key}`,fact_key:r.fact_key,
        frozen_parent_fact_instance_id:null,parent_frozen_fact:null,typed_value:null,semantic_status:r.outcome,authority_ceiling:"none",fused_confidence:"unknown",
        fusion_policy_version:C.fusion_policy_version,supporting_evidence_refs:[],opposing_evidence_refs:[],context_evidence_refs:sorted(matchingContext),scope,qualifier_context:{review_status:r.review_status,source:"frozen_review_coverage"},
        source_kind:"review_coverage",confirmation_eligibility:"blocked",block_reason:matchingContext.length?"context_evidence_not_directly_admissible_for_confirmation":"requires_future_adjudication_before_confirmation"
      });
    }
  }
  factDrafts.push(...representedNonSupported);

  const propositionByFrozenFact=new Map();
  for(const f of factDrafts.filter(x=>x.frozen_fact_instance_id)){
    const parentKey=f.frozen_parent_fact_instance_id?propositionByFrozenFact.get(f.frozen_parent_fact_instance_id):null;
    if(f.frozen_parent_fact_instance_id) assert.ok(parentKey,`parent proposition must precede child: ${f.frozen_fact_instance_id}`);
    const propositionIdentity={serializer_version:C.proposition_serializer,subject_semantic_key:subjectByPilot.get(f.pilot_id).proposed_subject_identity.subject_semantic_key,registry_version:f.registry_version,fact_key:f.fact_key,value_identity:valueIdentity({status:f.semantic_status,value:f.typed_value}),scope:f.scope,qualifier:f.qualifier_context,parent_proposition_key:parentKey};
    f.proposition_key=digest(propositionIdentity);f.parent_proposition_key=parentKey;
    propositionByFrozenFact.set(f.frozen_fact_instance_id,f.proposition_key);
  }
  for(const f of factDrafts.filter(x=>!x.frozen_fact_instance_id)){
    const propositionIdentity={serializer_version:C.proposition_serializer,subject_semantic_key:subjectByPilot.get(f.pilot_id).proposed_subject_identity.subject_semantic_key,registry_version:f.registry_version,fact_key:f.fact_key,value_identity:null,scope:f.scope,qualifier:f.qualifier_context,parent_proposition_key:null,semantic_status:f.semantic_status};
    f.proposition_key=digest(propositionIdentity);f.parent_proposition_key=null;
  }

  const factByFrozen=new Map(factDrafts.filter(x=>x.frozen_fact_instance_id).map(x=>[x.frozen_fact_instance_id,x]));
  const evidenceRecords=corpus.evidence_records.map(e=>{
    const mapped=evidenceToMappedFact.get(e.evidence_id),pilotId=mapped?.pilot_id||e.pilot_id||[...sourceToPilots.get(e.source_id)][0];
    const binding=bindingBySourcePilot.get(`${e.source_id}|${pilotId}`),subject=subjectByPilot.get(pilotId);
    const fact=mapped?factByFrozen.get(mapped.fact.fact_instance_id):null;
    let eligible=true,blockReason=null;
    if(!fact){eligible=false;blockReason=e.registry_gap_candidate?"registry_gap":"not_linked_to_frozen_mapped_fact";}
    if(eligible&&binding.evidence_admissibility!=="eligible"){eligible=false;blockReason=binding.block_reason;}
    if(eligible&&e.support_direction==="context_only"&&!['ambiguous','context_only'].includes(e.negative_admissibility)){eligible=false;blockReason="negative_admissibility_contract_mismatch";}
    if(eligible&&e.support_direction==="opposes"&&!['explicit_negative','conflict_opposition'].includes(e.negative_admissibility)){eligible=false;blockReason="negative_admissibility_contract_mismatch";}
    const propositionKey=fact?.proposition_key||null;
    const parentKey=e.subject_ref?propositionByFrozenFact.get(e.subject_ref)||null:null;
    const canonicalEvidence={frozen_evidence_id:e.evidence_id,source_ref:`source:${e.source_id}`,binding_ref:binding.binding_ref,subject_ref:eligible?subject.subject_ref:null,registry_version:fact?.registry_version||null,fact_key:e.fact_key||null,proposition_key:propositionKey,proposition_value_identity:safe(e,"proposition_value_identity",null),parent_proposition_key:parentKey,evidence_class:e.evidence_class,evidence_authority:e.evidence_authority,confidence:e.confidence,support_direction:e.support_direction,negative_admissibility:e.negative_admissibility,scope:stable(e.scope||{}),qualifier:stable(e.qualifier_context||{}),source_provenance:e.source_provenance,evidence_summary:e.evidence_summary};
    const proposal={
      evidence_ref:`evidence:${e.evidence_id}`,frozen_evidence_id:e.evidence_id,pilot_id:pilotId,source_ref:`source:${e.source_id}`,binding_ref:binding.binding_ref,
      proposed_subject_ref:eligible?subject.subject_ref:null,registry_version:fact?.registry_version||null,registry_definition_ref:fact?fact.registry_definition_ref:null,
      fact_key:e.fact_key||null,proposition_key:propositionKey,proposition_serializer_version:propositionKey?C.proposition_serializer:null,
      proposition_value_identity:safe(e,"proposition_value_identity",null),parent_proposition_key:parentKey,
      evidence_class:e.evidence_class,evidence_authority:e.evidence_authority,confidence:e.confidence,support_direction:e.support_direction,negative_admissibility:e.negative_admissibility,
      scope:stable(e.scope||{}),qualifier_context:stable(e.qualifier_context||{}),source_provenance:e.source_provenance,evidence_summary:e.evidence_summary,
      canonical_evidence_digest:digest(canonicalEvidence),materialization_eligibility:eligible?"eligible":"blocked",block_reason:blockReason,provenance_preserved:true,forced_mapping:false
    };
    if(!eligible) blocked.push({block_ref:`evidence-block:${e.evidence_id}`,kind:"evidence_blocked",pilot_id:pilotId,evidence_ref:proposal.evidence_ref,fact_key:e.fact_key||null,candidate_concept:e.registry_gap_candidate||null,semantic_status:null,reason:blockReason,forced_mapping:false});
    return proposal;
  }).sort((a,b)=>a.frozen_evidence_id.localeCompare(b.frozen_evidence_id,"en"));
  const evidenceProposalById=by(evidenceRecords,"frozen_evidence_id");

  for(const f of factDrafts){
    const relevant=[...f.supporting_evidence_refs,...f.opposing_evidence_refs,...f.context_evidence_refs].map(r=>evidenceProposalById.get(r)).filter(Boolean);
    if(f.semantic_status==="supported"&&f.supporting_evidence_refs.length===0){f.confirmation_eligibility="blocked";f.block_reason="supported_requires_supporting_evidence";}
    if(relevant.some(e=>e.materialization_eligibility!=="eligible")){f.confirmation_eligibility="blocked";f.block_reason=f.block_reason||"related_evidence_materialization_blocked";}
    if(subjectByPilot.get(f.pilot_id).identity_status!=="resolved"){f.confirmation_eligibility="blocked";f.block_reason="identity_not_resolved";}
    const admissible=[...f.supporting_evidence_refs,...f.opposing_evidence_refs].map(r=>evidenceProposalById.get(r)).filter(e=>e?.materialization_eligibility==="eligible");
    const fusionInputs={
      digest_contract:"offline-frozen-semantic-identities-v1",
      subject_identity:subjectByPilot.get(f.pilot_id).proposed_subject_identity.subject_semantic_key,
      registry_definition_identity:f.registry_definition_ref,
      proposition_key:f.proposition_key,
      fact_key:f.fact_key,
      supporting_evidence:sorted(f.supporting_evidence_refs).map(r=>({evidence_ref:`evidence:${r}`,canonical_evidence_digest:evidenceProposalById.get(r)?.canonical_evidence_digest||null})),
      opposing_evidence:sorted(f.opposing_evidence_refs).map(r=>({evidence_ref:`evidence:${r}`,canonical_evidence_digest:evidenceProposalById.get(r)?.canonical_evidence_digest||null})),
      context_evidence:sorted(f.context_evidence_refs).map(r=>({evidence_ref:`evidence:${r}`,canonical_evidence_digest:evidenceProposalById.get(r)?.canonical_evidence_digest||null,materialization_eligibility:evidenceProposalById.get(r)?.materialization_eligibility||"missing"})),
      scope:stable(f.scope),semantic_status:f.semantic_status,authority_ceiling:f.authority_ceiling,fused_confidence:f.fused_confidence,fusion_policy_version:f.fusion_policy_version
    };
    f.fusion_digest_inputs=fusionInputs;
    f.fusion_input_digest=digest(fusionInputs);
    f.runtime_fusion_input_digest={status:"deferred_until_hosted_ids_are_allocated",reason:"PF runtime digest includes Hosted UUID evidence/subject identities; V2.1-2 performs zero Hosted writes"};
    f.admissible_evidence_authorities=sorted(admissible.map(e=>e.evidence_authority));
    f.confirmation_eligibility=f.confirmation_eligibility==="eligible"?"eligible":"blocked";
    const def=registryMap.get(f.fact_key);
    f.typed_columns=valueColumns(def,f);
    delete f.parent_frozen_fact;
  }
  const factProposals=factDrafts.sort((a,b)=>a.proposal_ref.localeCompare(b.proposal_ref,"en"));

  const gapById=by(gaps.gaps,"gap_id");
  for(const g of gaps.gaps) blocked.push({block_ref:`gap:${g.gap_id}`,kind:g.taxonomy==="IDENTITY_GAP"?"identity_gap":g.taxonomy==="SOURCE_GAP"?"source_gap":"registry_gap",pilot_id:productsByCatalog.get(g.catalog_product_id)?.pilot_id||null,gap_id:g.gap_id,evidence_refs:sorted(g.evidence_refs||[]).map(r=>`evidence:${r}`),semantic_status:null,reason:g.why,severity:g.severity,forced_mapping:false});
  blocked.sort((a,b)=>a.block_ref.localeCompare(b.block_ref,"en"));

  const reviewBlockedRepresentable=[];
  for(const mp of mapping.products){
    for(const r of mp.review_coverage){
      if(!["identity_blocked","source_blocked"].includes(r.outcome)||!r.fact_key||!registryMap.has(r.fact_key)) continue;
      const subject=subjectByPilot.get(mp.pilot_id);
      const key=digest({kind:"blocked-review-proposition-v1",pilot_id:mp.pilot_id,product_id:mp.catalog_product_id,subject_semantic_key:r.outcome==="identity_blocked"?null:subject.proposed_subject_identity.subject_semantic_key,fact_key:r.fact_key,outcome:r.outcome});
      reviewBlockedRepresentable.push({pilot_id:mp.pilot_id,fact_key:r.fact_key,proposition_key:key,operational_state:r.outcome,subject_ref:r.outcome==="identity_blocked"?null:subject.subject_ref});
    }
  }
  assert.equal(reviewBlockedRepresentable.length,8,"expected representable blocked review assignments");

  const eligibleFacts=factProposals.filter(f=>f.confirmation_eligibility==="eligible");
  assert.equal(eligibleFacts.length,23,"full eligible frozen mapped-fact set");
  const materializableEvidence=evidenceRecords.filter(e=>e.materialization_eligibility==="eligible");
  assert.equal(materializableEvidence.length,23,"23 admissible EvidenceRecord proposals");
  const sourcesWithEligibleEvidence=new Set(materializableEvidence.map(e=>e.source_ref));
  const bindingOnlyOperations=sources.filter(s=>!sourcesWithEligibleEvidence.has(s.source_ref)).length;
  assert.equal(bindingOnlyOperations,7,"7 source/binding-only bootstrap operations");
  const initialReviewAssignments=factProposals.length+reviewBlockedRepresentable.length;
  assert.equal(initialReviewAssignments,34,"34 representable review assignments");

  const expectedOperations=[
    {operation:"admin_publish_product_fact_registry_v1",expected_calls_full_plan:1,v21_2_executed_calls:0,purpose:"publish frozen governed Registry v1 + 20 definitions"},
    {operation:"admin_register_product_fact_subject_v1",expected_calls_full_plan:subjects.length,v21_2_executed_calls:0,purpose:"register 11 resolved/current + 1 ambiguous/provisional subjects"},
    {operation:"admin_ingest_product_fact_evidence_v1",expected_calls_full_plan:materializableEvidence.length+bindingOnlyOperations,v21_2_executed_calls:0,purpose:`${materializableEvidence.length} EvidenceRecord calls + ${bindingOnlyOperations} source/binding-only calls`},
    {operation:"admin_prepare_product_fact_review_v1",expected_calls_full_plan:initialReviewAssignments+eligibleFacts.length,v21_2_executed_calls:0,purpose:`${initialReviewAssignments} initial assignments + ${eligibleFacts.length} ready_for_confirm transitions`},
    {operation:"admin_preflight_product_fact_confirmation_v1",expected_calls_full_plan:eligibleFacts.length,v21_2_executed_calls:0,purpose:"read-only confirmation preflight for full deterministic eligible set; future approval still required"},
    {operation:"admin_confirm_product_fact_v1",expected_calls_full_plan:eligibleFacts.length,v21_2_executed_calls:0,purpose:"full-eligible-set planning envelope only; NOT AUTHORIZED/EXECUTED in V2.1-2"}
  ];

  const expectedWrites={
    product_fact_registry_versions:{expected_insert_count:1,expected_update_count:0,expected_delete_count:0,phase:"registry_publish",reason:"one frozen governed Registry version"},
    product_fact_definition_snapshots:{expected_insert_count:registry.facts.length,expected_update_count:0,expected_delete_count:0,phase:"registry_publish",reason:"one snapshot per 20 governed keys"},
    product_fact_subjects:{expected_insert_count:subjects.length,expected_update_count:0,expected_delete_count:0,phase:"subject_registration",reason:"11 resolved/current + 1 ambiguous/provisional"},
    product_evidence_sources:{expected_insert_count:sources.length,expected_update_count:0,expected_delete_count:0,phase:"evidence_ingest",reason:"15 frozen source identities"},
    product_evidence_source_subject_bindings:{expected_insert_count:bindings.length,expected_update_count:0,expected_delete_count:0,phase:"evidence_ingest",reason:"one deterministic source-product binding per frozen source"},
    product_evidence_records:{expected_insert_count:materializableEvidence.length,expected_update_count:0,expected_delete_count:0,phase:"evidence_ingest",reason:"29 proposals minus 6 fail-closed blocked evidence records"},
    product_fact_instances:{expected_insert_count:eligibleFacts.length,expected_update_count:0,expected_delete_count:0,phase:"future_full_eligible_confirmation_envelope",reason:"one Fact Instance per confirmation-eligible proposal; V2.1-3 will select a smaller approved subset"},
    product_fact_evidence_links:{expected_insert_count:eligibleFacts.reduce((n,f)=>n+f.supporting_evidence_refs.length+f.opposing_evidence_refs.length,0),expected_update_count:0,expected_delete_count:0,phase:"future_full_eligible_confirmation_envelope",reason:"support/opposition links for eligible confirmed Facts"},
    product_fact_review_assignments:{expected_insert_count:initialReviewAssignments,expected_update_count:eligibleFacts.length*2,expected_delete_count:0,phase:"review_then_future_confirmation",reason:"34 initial assignments; 23 eligible transition under_review→ready_for_confirm→confirmed"},
    product_fact_review_events:{expected_insert_count:subjects.length+materializableEvidence.length+initialReviewAssignments+eligibleFacts.length+eligibleFacts.length,expected_update_count:0,expected_delete_count:0,phase:"subject/evidence/review/future_confirmation",reason:"subject_registered + evidence_ingested + initial review + ready transition + fact_confirmed"},
    product_fact_confirmations:{expected_insert_count:eligibleFacts.length,expected_update_count:0,expected_delete_count:0,phase:"future_full_eligible_confirmation_envelope",reason:"not executed in V2.1-2; full eligible-set envelope only"},
    product_fact_current:{expected_insert_count:eligibleFacts.length,expected_update_count:0,expected_delete_count:0,phase:"future_full_eligible_confirmation_envelope",reason:"empty Hosted baseline means full eligible envelope would insert 23 Current pointers; V2.1-3 selection remains pending"}
  };
  for(const x of Object.values(expectedWrites)) x.v21_2_actual_write_count=0;

  const reviewCounts=mapping.summary.review_coverage_outcomes;
  const factStatusCounts=Object.fromEntries(["supported","reviewed_not_established","evidence_insufficient","evidence_conflict"].map(k=>[k,factProposals.filter(f=>f.semantic_status===k).length]));
  const bindingBlocked=bindings.filter(b=>b.evidence_admissibility==="blocked");
  const summary={
    input_products:corpus.products.length,input_sources:corpus.sources.length,input_evidence_records:corpus.evidence_records.length,input_fused_facts:mapping.summary.fused_fact_count,
    resolved_subjects:subjects.filter(s=>s.identity_status==="resolved").length,ambiguous_subjects:subjects.filter(s=>s.identity_status==="ambiguous").length,
    eligible_subjects:subjects.filter(s=>s.materialization_eligibility==="eligible").length,identity_blocked_subjects:subjects.filter(s=>s.materialization_eligibility==="identity_blocked").length,
    source_proposals:sources.length,binding_proposals:bindings.length,eligible_bindings:bindings.length-bindingBlocked.length,blocked_bindings:bindingBlocked.length,
    blocked_bindings_by_reason:Object.fromEntries(uniq(bindingBlocked.map(b=>b.block_reason)).sort().map(r=>[r,bindingBlocked.filter(b=>b.block_reason===r).length])),
    evidence_proposals:evidenceRecords.length,evidence_materializable:materializableEvidence.length,evidence_blocked:evidenceRecords.length-materializableEvidence.length,
    fact_proposals:factProposals.length,fact_proposal_status_counts:factStatusCounts,confirmation_eligible_facts:eligibleFacts.length,confirmation_blocked_facts:factProposals.length-eligibleFacts.length,
    frozen_review_coverage_outcomes:stable(reviewCounts),registry_gaps:reviewCounts.registry_gap,source_blocked:reviewCounts.source_blocked,identity_blocked:reviewCounts.identity_blocked,
    forced_mapping_count:mapping.forced_mapping_count,measurement_evidence_count:mapping.summary.measurement_evidence_count,
    frozen_gap_severity:stable(gaps.severity_summary),materialization_contract_gap_count:0,hosted_write_count:0
  };

  const output={
    dry_run_version:C.dry_run_version,
    authority:{current_main_sha:C.main_sha,frozen_pilot_head:C.pilot_head,architecture_source:"비주얼리_추천_엔진_v2.1(1).md#V2.1-2",product_fact_storage_contract:"PF-2 + PF-5B1 controlled write + subject registration",execution_mode:"offline_deterministic_dry_run"},
    input_freeze:{
      registry:{path:path.relative(ROOT,P.registry),git_blob:C.registry_blob,governed_key_count:registry.facts.length,registry_version:registry.registry_version},
      corpus:{path:path.relative(ROOT,P.corpus),git_blob:C.corpus_blob,sha256:C.corpus_sha256},
      mapping:{path:path.relative(ROOT,P.mapping),git_blob:C.mapping_blob,sha256:C.mapping_sha256},
      gap_report:{path:path.relative(ROOT,P.gaps),git_blob:C.gap_blob,sha256:C.gap_sha256},
      frozen_verifier:{path:path.relative(ROOT,P.frozenVerifier),git_blob:C.frozen_verifier_blob},
      protected_pf_blobs:{pf2:C.pf2_blob,controlled_write:C.controlled_blob,subject_registration:C.subject_blob},
      candidate_policy_manifest_blob:C.candidate_policy_manifest_blob
    },
    summary,
    registry_proposal:{registry_version:registry.registry_version,definition_count:registry.facts.length,source_registry_blob:C.registry_blob,registry_definition_keys:sorted(registry.facts.map(f=>f.fact_key)),expansion_attempted:false},
    subjects,sources,source_subject_bindings:bindings,evidence_records:evidenceRecords,fact_proposals:factProposals,blocked_materialization:blocked,
    review_assignment_proposals:{representable_blocked:reviewBlockedRepresentable.sort((a,b)=>a.proposition_key.localeCompare(b.proposition_key,"en")),initial_assignment_count:initialReviewAssignments,ready_for_confirm_transition_count:eligibleFacts.length},
    expected_operations:expectedOperations,expected_writes:expectedWrites,
    invariants:{
      product_not_subject:true,evidence_not_fact:true,fact_instance_not_current:true,missing_not_false:true,supported_false_distinct_from_reviewed_not_established:true,
      resolved_only_confirmation:true,ambiguous_subject_current_forbidden:true,authority_ceiling_not_above_admissible_evidence:true,source_quality_not_identity_compatibility:true,
      registry_expansion:false,fusion_recalibration:false,decision_axis_output:false,user_concern_output:false,recommendation_output:false,cleanser_corpus_adoption:false,catalog_wide_backfill:false,
      frozen_forced_mapping_count:0,frozen_gap_taxonomy:{S1_VOCABULARY_ONLY:4,S2_STRUCTURAL:0,S3_RESEARCH_OR_IDENTITY:4},
      lifecycle:{PRODUCT_FACT_CATALOG_ADOPTED:"NO",CATALOG_ADOPTED:"NO",EVIDENCE_FUSION_PRODUCTION_CALIBRATED:"NO",REVIEW_BAYESIAN_MODEL_CALIBRATED:"NO",DECISION_AXIS_PRODUCTION_READY:"NO",DECISION_AXIS_CONSUMPTION:"NO",CONSTRAINT_UTILITY_RECOMMENDER_ACTIVE:"NO",ADMIN_PRODUCT_FACT_OPERATIONAL:"NO",RECOMMENDATION_ACTIVATED:"NO"}
    },
    hosted_write_count:0
  };
  return output;
}

export function writeMaterialization(output=buildMaterialization()){
  fs.mkdirSync(OUTPUT_DIR,{recursive:true});fs.mkdirSync(path.dirname(OUTPUT_MD),{recursive:true});
  fs.writeFileSync(OUTPUT_JSON,JSON.stringify(output,null,2)+"\n");
  fs.writeFileSync(OUTPUT_MD,buildMarkdown(output));
  return {json:OUTPUT_JSON,markdown:OUTPUT_MD,sha256:fileSha(OUTPUT_JSON)};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const r=writeMaterialization();
  console.log(`PASS build-product-fact-cross-category-materialization-dry-run-v1 products=12 sources=15 evidence=29 materializable_evidence=23 fact_proposals=26 confirmation_eligible=23 hosted_writes=0 sha256=${r.sha256}`);
}
