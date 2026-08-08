import assert from "node:assert/strict";

export const REGISTRY_VERSION = "product-fact-registry-cross-category-v1";
export const SCOPE_RELATIONS = Object.freeze(["equivalent", "narrower", "broader", "disjoint", "overlapping"]);
const VALUE_TYPES = new Set(["boolean", "enum", "number", "number_unit", "range_unit", "entity_identifier"]);
const FORBIDDEN = new Set(["weight", "score", "penalty", "hero_boost", "user_concern_coefficient", "intensity", "strength"]);
const DIRECT_SCOPE = ["market", "region", "locale", "variant", "formulation_version"];
const INHERITED_SCOPE = ["market", "region", "variant", "formulation_version"];
const FUSED_FORBIDDEN = ["evidence_class", "evidence_authority", "confidence", "evidence_refs"];

function fail(code, message = code) { const error = new Error(message); error.code = code; throw error; }
function obj(v) { return Boolean(v) && typeof v === "object" && !Array.isArray(v); }
function scope(v) { return obj(v) ? v : {}; }
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (!obj(v)) return v;
  return Object.fromEntries(Object.entries(v).filter(([,x]) => x !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,x]) => [k, canonical(x)]));
}
function sameValue(a,b) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
function walk(v, fn) { if (Array.isArray(v)) return v.forEach(x => walk(x, fn)); if (!obj(v)) return; for (const [k,x] of Object.entries(v)) { fn(k,x); walk(x,fn); } }
function date(v, fallback) { if (v == null || v === "") return fallback; const n = Date.parse(v); if (!Number.isFinite(n)) fail("invalid_scope_validity_date"); return n; }
function interval(s) { const x=scope(s), from=date(x.valid_from,-Infinity), to=date(x.valid_to,Infinity); if (from>to) fail("invalid_scope_validity_range"); return [from,to]; }
function validityRelation(a,b) {
  const [af,at]=interval(a), [bf,bt]=interval(b); if (at<bf || bt<af) return "disjoint";
  const ain=af>=bf && at<=bt, bin=bf>=af && bt<=at;
  if (ain&&bin) return "equivalent"; if (ain) return "narrower"; if (bin) return "broader"; return "overlapping";
}

export function classifyScopeRelation(a={}, b={}) {
  a=scope(a); b=scope(b); let an=false,bn=false;
  for (const k of DIRECT_SCOPE) { const av=a[k], bv=b[k]; if (av!=null&&bv!=null&&av!==bv) return "disjoint"; if (av!=null&&bv==null) an=true; if (av==null&&bv!=null) bn=true; }
  const vr=validityRelation(a,b); if (vr==="disjoint") return vr; if (vr==="narrower") an=true; if (vr==="broader") bn=true; if (vr==="overlapping") {an=true;bn=true;}
  return an&&bn ? "overlapping" : an ? "narrower" : bn ? "broader" : "equivalent";
}
export const scopesOverlap = (a,b) => classifyScopeRelation(a,b) !== "disjoint";

export function validateRegistry(registry) {
  assert.equal(registry?.registry_version, REGISTRY_VERSION);
  assert.deepEqual(registry?.scope_relation_values, SCOPE_RELATIONS);
  assert(Array.isArray(registry?.facts) && registry.facts.length>0);
  const seen=new Set();
  for (const d of registry.facts) {
    if (!d?.fact_key || seen.has(d.fact_key)) fail(seen.has(d?.fact_key)?"duplicate_fact_key":"invalid_fact_key"); seen.add(d.fact_key);
    if (d.registry_version!==REGISTRY_VERSION) fail("registry_version_mismatch");
    if (!VALUE_TYPES.has(d.value_type)) fail("invalid_value_type_definition");
    if (!Array.isArray(d.domain_scope)||!d.domain_scope.length) fail("missing_domain_scope");
    if (!["one","many"].includes(d.cardinality)) fail("invalid_cardinality");
    if (!d.semantic_definition || !d.positive_evidence_requirement || !d.negative_evidence_requirement || !d.conflict_semantics) fail("incomplete_fact_definition");
    if (!Array.isArray(d.permitted_evidence_classes)||!d.permitted_evidence_classes.length) fail("missing_evidence_class_contract");
    if (d.value_type==="enum" && (!Array.isArray(d.allowed_values)||!d.allowed_values.length)) fail("enum_values_required");
    if (["number_unit","range_unit"].includes(d.value_type) && !d?.unit_schema?.allowed_units?.length) fail("unit_schema_required");
    const p=d.proposition_identity_schema;
    if (!obj(p)||p.include_fact_key!==true||typeof p.include_subject_ref!=="boolean"||typeof p.include_value_identity!=="boolean"||!Array.isArray(p.scope_dimensions)||!Array.isArray(p.qualifier_dimensions)) fail("missing_proposition_identity_schema");
    if (d.relationship_schema?.subject_ref_required && !p.include_subject_ref) fail("relationship_fact_requires_subject_in_proposition_identity");
  }
  walk(registry, (k)=>{if(FORBIDDEN.has(k)) fail("forbidden_registry_scoring_or_intensity_key",k);});
  assert.equal(registry.downstream_consumption_boundary?.recommendation_policy_separate,true);
  assert.equal(registry.downstream_consumption_boundary?.fact_registry_does_not_create_decision_axes,true);
  return true;
}
export function getFactDefinition(registry,key) { const d=registry.facts.find(x=>x.fact_key===key); if(!d) fail("unknown_fact_key",key); return d; }

function num(v) { if(typeof v!=="number"||!Number.isFinite(v)) fail("invalid_number"); }
function validateValue(d,v) {
  if (d.value_type==="boolean") { if(typeof v!=="boolean") fail("invalid_boolean"); return; }
  if (d.value_type==="enum") { if(!d.allowed_values.includes(v)) fail("invalid_enum"); return; }
  if (d.value_type==="number") return num(v);
  if (d.value_type==="entity_identifier") { if(typeof v!=="string"||!v.trim()) fail("invalid_entity_identifier"); return; }
  if (!obj(v)||!d.unit_schema.allowed_units.includes(v.unit)) fail(obj(v)?"invalid_unit":"invalid_unit_value");
  if (d.value_type==="number_unit") return num(v.amount);
  num(v.min); num(v.max); if(v.min>v.max) fail("invalid_range");
}
function validateScope(d,s) { s=scope(s); const allowed=new Set(d.scope_schema?.allowed_fields||[]); for(const k of Object.keys(s)) if(!allowed.has(k)) fail("invalid_scope_field"); for(const k of d.scope_schema?.required_fields||[]) if(s[k]==null||s[k]==="") fail("missing_required_scope"); interval(s); }
function propositionValue(d,x) { return d.proposition_identity_schema.include_value_identity ? (Object.prototype.hasOwnProperty.call(x,"proposition_value_identity") ? x.proposition_value_identity : x.value) : undefined; }
function qualifierIdentity(d,x) { const q=x.qualifier_context||{}; return Object.fromEntries(d.proposition_identity_schema.qualifier_dimensions.map(k=>[k,q[k]??null])); }
export function buildPropositionIdentity(registry,x) {
  const d=getFactDefinition(registry,x.fact_key), p=d.proposition_identity_schema;
  return { fact_key:x.fact_key, subject_ref:p.include_subject_ref?(x.subject_ref??null):undefined, value_identity:propositionValue(d,x), scope:Object.fromEntries(p.scope_dimensions.filter(k=>x.scope?.[k]!=null).map(k=>[k,x.scope[k]])), qualifiers:qualifierIdentity(d,x) };
}
export function comparePropositions(registry,a,b) {
  if(a.fact_key!==b.fact_key) return {relation:"independent",scope_relation:"disjoint"};
  const d=getFactDefinition(registry,a.fact_key), p=d.proposition_identity_schema;
  if(p.include_subject_ref && (a.subject_ref??null)!==(b.subject_ref??null)) return {relation:"independent",scope_relation:"disjoint"};
  if(p.include_value_identity && !sameValue(propositionValue(d,a),propositionValue(d,b))) return {relation:"independent",scope_relation:"disjoint"};
  if(!sameValue(qualifierIdentity(d,a),qualifierIdentity(d,b))) return {relation:"independent",scope_relation:"disjoint"};
  const sr=classifyScopeRelation(a.scope,b.scope); return {relation:sr==="disjoint"?"independent":"same_or_overlapping",scope_relation:sr};
}

export function validateEvidenceRecord(registry,r,{domain}={}) {
  if(!r?.evidence_id) fail("missing_evidence_id"); const d=getFactDefinition(registry,r.fact_key);
  if(domain&&!d.domain_scope.includes(domain)) fail("fact_outside_domain_scope");
  if(!registry.evidence_classes.includes(r.evidence_class)) fail("invalid_evidence_class");
  if(r.evidence_class!=="legacy_catalog_observation"&&!d.permitted_evidence_classes.includes(r.evidence_class)) fail("evidence_class_not_permitted_for_fact");
  if(!registry.evidence_authority_values.includes(r.evidence_authority)) fail("invalid_evidence_authority");
  if(!registry.confidence_values.includes(r.confidence)) fail("invalid_confidence");
  if(!registry.support_directions.includes(r.support_direction)) fail("invalid_support_direction");
  if(!registry.negative_admissibility_values.includes(r.negative_admissibility??"not_applicable")) fail("invalid_negative_admissibility");
  if(!r.source_provenance) fail("missing_source_provenance"); validateScope(d,r.scope);
  if(d.proposition_identity_schema.include_subject_ref&&!r.subject_ref) fail("subject_ref_required");
  if(d.proposition_identity_schema.include_value_identity && r.proposition_value_identity==null) fail("proposition_value_identity_required");
  if(r.evidence_class==="measurement") { const q=r.qualifier_context; if(!obj(q)||!q.metric||!q.method_context||!q.timepoint) fail("missing_measurement_context"); }
  return d;
}
function validateEvidenceRefMatchesFact(registry,f,r) { if(comparePropositions(registry,f,r).relation==="independent") fail("evidence_proposition_mismatch"); }
function validateFused(registry,f,{domain,evidenceById}={}) {
  if(!f?.fact_instance_id) fail("missing_fact_instance_id"); const d=getFactDefinition(registry,f.fact_key);
  if(domain&&!d.domain_scope.includes(domain)) fail("fact_outside_domain_scope"); for(const k of FUSED_FORBIDDEN) if(Object.prototype.hasOwnProperty.call(f,k)) fail("fused_fact_must_not_copy_evidence_field");
  if(!registry.status_values.includes(f.status)) fail("invalid_fact_status"); if(!Array.isArray(f.supporting_evidence_refs)||!Array.isArray(f.opposing_evidence_refs)) fail("fused_evidence_refs_required");
  if(!registry.evidence_authority_values.includes(f.authority_ceiling)) fail("invalid_evidence_authority"); if(!registry.confidence_values.includes(f.fused_confidence)) fail("invalid_confidence"); validateScope(d,f.scope);
  if(d.relationship_schema?.subject_ref_required&&!f.subject_ref) fail("subject_ref_required");
  if(f.status==="supported") { if(f.value==null) fail("supported_value_required"); validateValue(d,f.value); if(f.value===false){if(d.negative_evidence_requirement!=="explicit_negative_only"||!f.opposing_evidence_refs.length) fail("explicit_negative_evidence_required");} else if(!f.supporting_evidence_refs.length) fail("supported_evidence_required"); }
  else if(f.status==="evidence_conflict") { if(f.value!==null) fail("conflict_value_must_be_null"); if(!f.supporting_evidence_refs.length) fail("conflict_supporting_evidence_required"); if(!f.opposing_evidence_refs.length) fail("conflict_opposing_evidence_required"); }
  else if(f.value!==null) fail("non_supported_authoritative_value_must_be_null");
  if(evidenceById){
    for(const ref of [...f.supporting_evidence_refs,...f.opposing_evidence_refs]) { const r=evidenceById.get(ref); if(!r) fail("missing_evidence_reference"); validateEvidenceRefMatchesFact(registry,f,r); }
    for(const ref of f.supporting_evidence_refs){const r=evidenceById.get(ref);if(r.support_direction!=="supports")fail("supporting_ref_direction_mismatch");if(r.evidence_class==="legacy_catalog_observation"||r.evidence_authority==="legacy_unreviewed")fail("legacy_cannot_establish_supported_fact");}
    for(const ref of f.oposing_evidence_refs||[]) if(evidenceById.get(ref).support_direction!=="opposes") fail("opposing_ref_direction_mismatch");
    for(const ref of f.opposing_evidence_refs) if(evidenceById.get(ref).support_direction!=="opposes") fail("opposing_ref_direction_mismatch");
    if(f.status==="supported"&&f.value===false&&f.opposing_evidence_refs.some(ref=>evidenceById.get(ref).negative_admissibility!=="explicit_negative")) fail("explicit_negative_evidence_required");
    if(f.status==="evidence_conflict"&&f.opposing_evidence_refs.some(ref=>!["explicit_negative","conflict_opposition"].includes(evidenceById.get(ref).negative_admissibility))) fail("conflict_opposition_not_admissible");
  }
  return d;
}
export const validateFactInstance=(registry,f,options={})=>validateFused(registry,f,options);
export function validateRelationshipScopeCompatibility(subject,child) { const s=scope(subject.scope),c=scope(child.scope); for(const k of INHERITED_SCOPE) if(s[k]!=null&&(c[k]==null||c[k]!==s[k])) fail("relationship_scope_mismatch"); if(validityRelation(s,c)==="disjoint") fail("relationship_scope_mismatch"); return true; }
export function assessFactCoexistence(registry,a,b) { const cmp=comparePropositions(registry,a,b); if(cmp.relation==="independent")return{disposition:"independent",...cmp}; if(a.status==="supported"&&b.status==="supported")return{disposition:sameValue(a.value,b.value)?"dedupe_or_corroborate":"conflict_required",...cmp}; return{disposition:"same_proposition_review_required",...cmp}; }
export function validateFactSet(registry,product) {
  const records=product?.evidence_records||[], facts=product?.facts||[]; if(!Array.isArray(records)||!Array.isArray(facts)) fail("invalid_product_fact_set"); const ev=new Map(), ids=new Map();
  for(const r of records){if(ev.has(r.evidence_id))fail("duplicate_evidence_id");validateEvidenceRecord(registry,r,{domain:product.domain});ev.set(r.evidence_id,r);}
  for(const f of facts){if(ids.has(f.fact_instance_id))fail("duplicate_fact_instance_id");validateFused(registry,f,{domain:product.domain,evidenceById:ev});ids.set(f.fact_instance_id,f);}
  for(const f of facts){const rel=getFactDefinition(registry,f.fact_key).relationship_schema||{};if(rel.subject_ref_required){const s=ids.get(f.subject_ref);if(!s)fail("orphan_subject_ref");if(s.fact_key!==rel.subject_ref_fact_key)fail("subject_ref_wrong_fact_key");validateRelationshipScopeCompatibility(s,f);}}
  for(let i=0;i<facts.length;i++)for(let j=i+1;j<facts.length;j++)if(facts[i].fact_key===facts[j].fact_key){const a=assessFactCoexistence(registry,facts[i],facts[j]);if(a.disposition==="conflict_required")fail("same_proposition_conflict_required");if(a.disposition==="dedupe_or_corroborate")fail("same_proposition_dedupe_required");}
  return true;
}

export function fuseBooleanProposition(registry,template,records) {
  const d=getFactDefinition(registry,template.fact_key); if(d.value_type!=="boolean")fail("boolean_fusion_requires_boolean_fact");
  const relevant=records.filter(r=>comparePropositions(registry,template,r).relation!=="independent"), support=relevant.filter(r=>r.support_direction==="supports"), opp=relevant.filter(r=>r.support_direction==="opposes"&&["explicit_negative","conflict_opposition"].includes(r.negative_admissibility));
  if(support.length&&opp.length)return{...template,status:"evidence_conflict",value:null,supporting_evidence_refs:support.map(r=>r.evidence_id),opposing_evidence_refs:opp.map(r=>r.evidence_id)};
  if(support.length)return{...template,status:"supported",value:true,supporting_evidence_refs:support.map(r=>r.evidence_id),opposing_evidence_refs:[]};
  const explicit=opp.filter(r=>r.negative_admissibility==="explicit_negative"); if(explicit.length&&d.negative_evidence_requirement==="explicit_negative_only")return{...template,status:"supported",value:false,supporting_evidence_refs:[],opposing_evidence_refs:explicit.map(r=>r.evidence_id)};
  return{...template,status:"not_reviewed",value:null,supporting_evidence_refs:[],opposing_evidence_refs:[]};
}
export function deriveAuthorityCeilingWithoutCountUpgrade(records=[]) { const a=new Set(records.map(r=>r.evidence_authority)); for(const k of ["product_specific_primary","limited_non_product_specific","ingredient_basis","review_observation","legacy_unreviewed"])if(a.has(k))return k; return "none"; }
export function observationPrevalence({positive_count,raw_source_sample_size,analyzed_sample_size}) { if(analyzed_sample_size==null)return{status:"forbidden",prevalence:null}; if(!Number.isInteger(analyzed_sample_size)||analyzed_sample_size<=0)fail("invalid_analyzed_sample_size");if(raw_source_sample_size!=null&&analyzed_sample_size>raw_source_sample_size)fail("analyzed_exceeds_raw");if(!Number.isInteger(positive_count)||positive_count<0||positive_count>analyzed_sample_size)fail("invalid_positive_count");return{status:"available",prevalence:positive_count/analyzed_sample_size}; }
export const missingFactState=()=>({status:"not_reviewed",value:null});
export function assertNoAutomaticDecisionAxisCreation(registry){walk(registry,k=>{if(["decision_axis","decision_axis_key","axis_weight","axis_score"].includes(k))fail("automatic_decision_axis_contract_forbidden");});return true;}
export function assertAuthorityConfidenceSeparated(f){assert(Object.prototype.hasOwnProperty.call(f,"authority_ceiling"));assert(Object.prototype.hasOwnProperty.call(f,"fused_confidence"));assert(!Object.prototype.hasOwnProperty.call(f,"evidence_authority"));assert(!Object.prototype.hasOwnProperty.call(f,"confidence"));return true;}
export function expectErrorCode(fn,code){try{fn();}catch(e){assert.equal(e.code,code,`expected ${code}, received ${e.code||e.message}`);return true;}assert.fail(`expected error ${code}`);}
export function materializeFixtureProduct(fixtures,p){const ed=fixtures?.fixture_defaults?.evidence_record||{},fd=fixtures?.fixture_defaults?.fused_fact||{};return{...p,evidence_records:(p?.evidence_records||[]).map(r=>({...ed,negative_admissibility:"not_applicable",scope:{},...r})),facts:(p?.facts||[]).map(f=>({...fd,scope:{},...f}))};}
