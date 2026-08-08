#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {validateRegistry,validateFactSet,getFactDefinition,validateRelationshipScopeCompatibility,assessFactCoexistence} from "./product-evidence/product-fact-registry-core-v1.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const er=path.join(root,"evidence/product-evidence-decision-axis-v1");
const P={
 registry:path.join(er,"cross-category-registry-v1.json"),
 core:path.join(root,"scripts/product-evidence/product-fact-registry-core-v1.mjs"),
 p3v:path.join(root,"scripts/verify-product-fact-registry-cross-category-v1.mjs"),
 inventory:path.join(er,"current-catalog-inventory-audit-v1.json"),
 corpus:path.join(er,"cross-category-real-evidence-pilot-v1.json"),
 mapping:path.join(er,"cross-category-real-fact-mapping-pilot-v1.json"),
 gaps:path.join(er,"cross-category-real-pilot-gap-report-v1.json")
};
const BASE="e1c9af6ad69e54a6a8d2e614de545e48f4e749b1";
const F={registry:"32fdaa2d3a181c9d18888fc48c1343e083ad20f7",core:"4d514f7eff80d299d6893a7f3b1c97d40ce451ba",p3v:"5020853bc1948e9544d04dcdfe5dde44fe2aa22a",inventory:"8fb808ccdfb51eabd88e550d25e33bd42d293223"};
const P2={
 "scripts/product-evidence/cleanser-poc-core.mjs":"61ff2d517a963ec302a52781f2a98669c40d4af2",
 "scripts/build-product-evidence-cleanser-poc-v1.mjs":"48d933f6cc8c8a3437c12036342015840af03423",
 "scripts/verify-product-evidence-cleanser-poc-v1.mjs":"128b85d42406b49ac90cc655055fbb3f4918e117",
 "evidence/product-evidence-decision-axis-v1/cleanser-poc-output-v1.json":"be3724b513a11a6521585950e79e21296550ecdc"
};
const ALLOWED=new Set(["docs/evidence/cross-category-real-evidence-pilot-v1.md","evidence/product-evidence-decision-axis-v1/cross-category-real-evidence-pilot-v1.json","evidence/product-evidence-decision-axis-v1/cross-category-real-fact-mapping-pilot-v1.json","evidence/product-evidence-decision-axis-v1/cross-category-real-pilot-gap-report-v1.json","scripts/verify-cross-category-real-evidence-pilot-v1.mjs"]);
const TAX=new Set(["NONE","VOCABULARY_GAP","VALUE_OR_UNIT_GAP","EVIDENCE_CLASS_OR_AUTHORITY_GAP","IDENTITY_GAP","SOURCE_GAP","RELATIONSHIP_GAP","SCOPE_GAP","CARDINALITY_GAP","FUSION_GAP","OTHER_STRUCTURAL_GAP"]);
const SEV=new Set(["S0_MAPPED","S1_VOCABULARY_ONLY","S2_STRUCTURAL","S3_RESEARCH_OR_IDENTITY"]);
const OUT=new Set(["supported","reviewed_not_established","evidence_insufficient","evidence_conflict","registry_gap","identity_blocked","source_blocked"]);
const MATCH=new Set(["yes","partial","uncertain","no"]);
const FUSED_BAD=["evidence_class","evidence_authority","confidence","evidence_refs"];
let n=0;
const ok=(x,m)=>{assert.ok(x,m);n++}; const eq=(a,b,m)=>{assert.deepEqual(a,b,m);n++};
const J=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const sha=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const blob=p=>{const b=fs.readFileSync(p);return crypto.createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest("hex")};
const git=a=>execFileSync("git",a,{cwd:root,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
const has=o=>{try{execFileSync("git",["cat-file","-e",o],{cwd:root,stdio:"ignore"});return true}catch{return false}};

const registry=J(P.registry), corpus=J(P.corpus), mapping=J(P.mapping), gaps=J(P.gaps);
validateRegistry(registry); ok(true,"registry validates");
eq(blob(P.registry),F.registry,"registry blob"); eq(blob(P.core),F.core,"core blob"); eq(blob(P.inventory),F.inventory,"inventory blob");
if(fs.existsSync(P.p3v)) eq(blob(P.p3v),F.p3v,"Phase3A verifier blob");

eq(corpus.products.length,12,"12 products");
const fam=d=>d==="sunscreen"?"sunscreen":d==="treatment"?"treatment":d.startsWith("moisturizer")?"moisturizer":["toner_pad","toner_essence"].includes(d)?"toner_pad":d;
const dc={sunscreen:0,treatment:0,moisturizer:0,toner_pad:0}; for(const p of corpus.products)dc[fam(p.domain)]++;
for(const [d,c] of Object.entries(dc))ok(c>=3,`${d} >=3`);
eq(new Set(corpus.products.map(p=>p.catalog_product_id)).size,12,"unique catalog ids");
eq(corpus.reference_inventory.authority_boundary,"INVENTORY_ONLY_NOT_EVIDENCE_AUTHORITY","inventory not authority");
eq(corpus.reference_inventory.blob_sha,"e843d19a9784fd2a4b3904dc35a984012150ebe7","reference inventory blob");
eq(corpus.reference_inventory.canonical_sha256,"e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856","reference inventory digest");
const members=new Set(corpus.reference_inventory.pilot_member_ids); eq(members.size,12,"membership freeze");
for(const p of corpus.products){ok(members.has(p.catalog_product_id),"member");ok(["resolved","ambiguous","unresolved"].includes(p.identity_status),"identity state")}

const src=new Map(corpus.sources.map(s=>[s.source_id,s])); eq(src.size,corpus.sources.length,"source ids unique");
for(const s of corpus.sources){ok(/^https?:\/\//.test(s.source_url),"source url");ok(MATCH.has(s.exact_product_match),"source match");ok(Boolean(s.source_notes),"source notes")}
const ev=new Map(corpus.evidence_records.map(e=>[e.evidence_id,e])); eq(ev.size,corpus.evidence_records.length,"evidence ids unique");
const keys=new Set(registry.facts.map(f=>f.fact_key));
for(const e of corpus.evidence_records){ok(src.has(e.source_id),"evidence source");ok((e.fact_key&&keys.has(e.fact_key))||Boolean(e.registry_gap_candidate),"key or gap");if(e.fact_key)ok(keys.has(e.fact_key),"no forced key");ok(Boolean(e.evidence_summary),"summary");}
eq(mapping.forced_mapping_count,0,"no forced mapping");eq(gaps.forced_mapping_count,0,"no forced mapping gaps");

const cp=new Map(corpus.products.map(p=>[p.pilot_id,p]));
for(const mp of mapping.products){
 const id=cp.get(mp.pilot_id);ok(Boolean(id),"mapping identity");
 if(mp.mapped_facts.some(f=>f.status==="supported"))eq(id.identity_status,"resolved","supported requires resolved");
 const refs=new Set(mp.mapped_facts.flatMap(f=>[...(f.supporting_evidence_refs||[]),...(f.opposing_evidence_refs||[])]));
 const records=[...refs].map(r=>{ok(ev.has(r),"fact evidence retained");return ev.get(r)});
 validateFactSet(registry,{domain:mp.domain,evidence_records:records,facts:mp.mapped_facts});ok(true,"validateFactSet");
 const fi=new Map(mp.mapped_facts.map(f=>[f.fact_instance_id,f]));
 for(const f of mp.mapped_facts){for(const k of FUSED_BAD)ok(!(k in f),"fused field separation");const d=getFactDefinition(registry,f.fact_key);if(d.relationship_schema?.subject_ref_required){const s=fi.get(f.subject_ref);ok(Boolean(s),"subject ref");validateRelationshipScopeCompatibility(s,f);ok(true,"scope compatible")}}
 for(let i=0;i<mp.mapped_facts.length;i++)for(let j=i+1;j<mp.mapped_facts.length;j++){const a=mp.mapped_facts[i],b=mp.mapped_facts[j];if(a.fact_key===b.fact_key)ok(!["conflict_required","dedupe_or_corroborate"].includes(assessFactCoexistence(registry,a,b).disposition),"no silent proposition collision")}
 if(id.identity_status!=="resolved")eq(mp.mapped_facts.filter(f=>f.status==="supported").length,0,"identity blocked");
 for(const r of mp.review_coverage)ok(OUT.has(r.outcome),"review outcome");
}
for(const e of corpus.evidence_records){if(e.evidence_class==="measurement")ok(e.qualifier_context?.metric&&e.qualifier_context?.method_context&&e.qualifier_context?.timepoint,"measurement context");if(e.evidence_class==="usage_instruction")ok(!["hydration_change","tewl_change"].includes(e.fact_key),"usage != efficacy");if(e.evidence_class==="role_declaration")eq(e.fact_key,"primary_use_role","role != policy");ok(e.evidence_class!=="legacy_catalog_observation","no legacy authority")}
eq(corpus.evidence_records.filter(e=>e.evidence_class==="measurement").length,0,"measurement count 0");
ok(corpus.evidence_records.some(e=>e.pilot_id==="T3"&&e.evidence_class==="product_claim"&&e.fact_key==="hydration_change"&&!e.qualifier_context?.method_context),"claim not promoted to measurement");
const obs=corpus.evidence_records.filter(e=>e.evidence_class==="observation");ok(new Set(obs.map(e=>e.pilot_id)).size>=2,"two review products");for(const e of obs)if(e.qualifier_context?.analyzed_sample_size==null)eq(e.qualifier_context?.prevalence,"forbidden","no denominator prevalence");

const unm=mapping.products.flatMap(p=>p.unmapped_evidence_refs);for(const r of unm)ok(ev.has(r),"unmapped retained");eq(unm.length,mapping.summary.unmapped_evidence_count,"unmapped count");
for(const g of gaps.gaps){ok(TAX.has(g.taxonomy),"gap taxonomy");ok(SEV.has(g.severity),"gap severity")}
eq(gaps.severity_summary.S2_STRUCTURAL,0,"S2=0");eq(gaps.severity_summary.S1_VOCABULARY_ONLY,mapping.summary.gap_severity_counts.S1_VOCABULARY_ONLY,"S1 consistent");eq(gaps.severity_summary.S3_RESEARCH_OR_IDENTITY,mapping.summary.gap_severity_counts.S3_RESEARCH_OR_IDENTITY,"S3 consistent");
eq(mapping.architecture_outcome,"ARCHITECTURE_SURVIVES_REAL_EVIDENCE_PILOT","architecture");eq(gaps.architecture_outcome,mapping.architecture_outcome,"architecture consistent");

const t2=mapping.products.find(p=>p.pilot_id==="T2"), acts=t2.mapped_facts.filter(f=>f.fact_key==="contains_active"), conc=t2.mapped_facts.filter(f=>f.fact_key==="active_concentration");
eq(acts.length,2,"multi-active");eq(conc.length,1,"one concentration established");ok(acts.some(f=>f.fact_instance_id===conc[0].subject_ref),"per-active concentration");ok(t2.review_coverage.some(r=>r.outcome==="reviewed_not_established"&&/concentration/i.test(`${r.fact_key||""}${r.candidate_concept||""}`)),"missing concentration not zero");
const s1=mapping.products.find(p=>p.pilot_id==="S1");ok(s1.mapped_facts.filter(f=>f.fact_key==="spf_value").every(f=>f.scope?.market==="KR"),"market scope");ok(s1.unmapped_evidence_refs.some(r=>ev.get(r)?.registry_gap_candidate==="uva_broad_spectrum_label"),"US label retained");
const m2=mapping.products.find(p=>p.pilot_id==="M2");ok(m2.mapped_facts.some(f=>f.fact_key==="primary_use_role")&&m2.mapped_facts.some(f=>f.fact_key==="barrier_support_claim"),"role vs claim");
const p3=mapping.products.find(p=>p.pilot_id==="P3");for(const k of ["product_format","wipe_off_use","pad_surface_texture"])ok(p3.mapped_facts.some(f=>f.fact_key===k),"pad semantic");ok(!p3.mapped_facts.some(f=>/intensity|strength|score|weight/.test(f.fact_key)),"pad != magnitude");
for(const v of Object.values(mapping.mandatory_acceptance_questions))eq(v.status,"PASS","acceptance A-F");

eq(sha(P.corpus),mapping.corpus_sha256,"corpus digest mapping");eq(sha(P.corpus),gaps.corpus_sha256,"corpus digest gaps");eq(sha(P.mapping),gaps.mapping_sha256,"mapping digest gaps");

let gitScope="NOT_EVALUATED_NO_GIT_BASELINE";
if(has(`${BASE}^{commit}`)){
 const head=git(["rev-parse","HEAD"]),changed=git(["diff","--name-only",`${BASE}..${head}`]).split("\n").filter(Boolean);
 execFileSync("git",["diff","--check",`${BASE}..${head}`],{cwd:root,stdio:"ignore"});n++;
 for(const p of changed)ok(ALLOWED.has(p),`scope ${p}`);
 ok(!changed.some(p=>/^(app|components|lib|supabase\/migrations|\.github\/workflows)\//.test(p)||p==="package.json"),"runtime delta 0");
 ok(!changed.some(p=>p.includes("cleanser-catalog-field-review-v1")),"frozen cleanser corpus delta 0");
 for(const [p,s] of Object.entries(P2))eq(git(["rev-parse",`HEAD:${p}`]),s,`Phase2 blob ${p}`);
 for(const [p,s] of [[P.registry,F.registry],[P.core,F.core],[P.p3v,F.p3v],[P.inventory,F.inventory]])eq(git(["rev-parse",`HEAD:${path.relative(root,p).replaceAll("\\","/")}`]),s,"Phase3A blob");
 gitScope="PASS";
}
console.log("PASS verify-cross-category-real-evidence-pilot-v1");
console.log(`pilot_version=${corpus.pilot_version}`);
console.log(`products=${corpus.products.length}`);
console.log(`sources=${corpus.sources.length}`);
console.log(`evidence_records=${corpus.evidence_records.length}`);
console.log(`mapped_facts=${mapping.summary.fused_fact_count}`);
console.log(`assertions=${n}`);
console.log(`measurement_evidence_count=${corpus.evidence_records.filter(e=>e.evidence_class==="measurement").length}`);
console.log(`forced_mapping_count=${mapping.forced_mapping_count}`);
console.log(`S1=${gaps.severity_summary.S1_VOCABULARY_ONLY}`);
console.log(`S2=${gaps.severity_summary.S2_STRUCTURAL}`);
console.log(`S3=${gaps.severity_summary.S3_RESEARCH_OR_IDENTITY}`);
console.log(`architecture_outcome=${mapping.architecture_outcome}`);
console.log(`corpus_sha256=${sha(P.corpus)}`);
console.log(`mapping_sha256=${sha(P.mapping)}`);
console.log(`gap_report_sha256=${sha(P.gaps)}`);
console.log(`git_scope=${gitScope}`);
