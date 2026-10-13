// Offline evaluator for a manually supplied Face Lab pg_catalog report.
// A passing catalog shape is NEVER proof of migration execution or Production identity.
const EXPECTED_TABLES=["saved_reports","analysis_request_rate_windows","analysis_request_idempotency"];
const EXPECTED_COLUMNS=[
  ["saved_reports","face_lab_revision"],
  ["analysis_request_rate_windows","endpoint"],
  ["analysis_request_idempotency","endpoint"]
];
const EXPECTED_CONSTRAINTS=[
  ["saved_reports","saved_reports_face_lab_revision_nonnegative"],
  ["analysis_request_rate_windows","analysis_request_rate_windows_endpoint_check"],
  ["analysis_request_idempotency","analysis_request_idempotency_endpoint_check"]
];
const EXPECTED_ROUTINES=[
  ["consume_analysis_rate_limits","public.consume_analysis_rate_limits(jsonb)"],
  ["refund_analysis_rate_limits","public.refund_analysis_rate_limits(jsonb)"],
  ["claim_analysis_idempotency",
   "public.claim_analysis_idempotency(text,text,text,text,text,timestamptz,integer)"]
];
const ROLES=["anon","authenticated","service_role"];
const CRUD=["select","insert","update","delete"];
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const fail=c=>{throw new Error("face_lab_catalog_evidence_"+c);};
const unique=(rows,id)=>{
  const map=new Map();
  for(const row of rows) {
    if(!obj(row))fail("entry_invalid");
    const k=id(row);
    if(typeof k!=="string"||!k||map.has(k))fail("duplicate_or_invalid_entry");
    map.set(k,row);
  }
  return map;
};
const boolean=x=>x===true||x===false;
const present=x=>x===true;
const MAX_TEXT=6000;

export function assessFaceLabCatalogEvidence(input){
  if(!obj(input)||input.kind!=="face_lab_v2_catalog_metadata_readonly_v1"||
    input.production_readiness!=="HOLD"||
    input.production_project_identity_verified!==false||
    input.sql_application_verified!==false||
    !obj(input.schema_public_usage))fail("header_invalid");
  for(const k of ["table_metadata","column_metadata",
    "constraint_metadata","routine_metadata"]){
    if(!Array.isArray(input[k])||input[k].length>32)fail("collection_invalid");
  }
  const tables=unique(input.table_metadata,x=>x.name);
  const columns=unique(input.column_metadata,x=>x.table+"."+x.name);
  const constraints=unique(input.constraint_metadata,x=>x.table+"."+x.name);
  const routines=unique(input.routine_metadata,x=>x.signature);
  const findings=[];
  const emit=(severity,code,subject)=>{
    findings.push({severity,code,subject});
  };
  for(const role of ROLES){
    if(!boolean(input.schema_public_usage[role]))
      emit("evidence_gap","schema_usage_unverified",role);
    else if(role==="service_role"&&!input.schema_public_usage[role])
      emit("priority","service_schema_usage_missing",role);
  }
  for(const name of EXPECTED_TABLES){
    const t=tables.get(name);
    if(!t){emit("evidence_gap","table_metadata_missing",name);continue;}
    if(!present(t.exists)){
      emit("priority","table_not_found",name);continue;
    }
    if(t.relkind!=="r"&&t.relkind!=="p")
      emit("priority","unexpected_relation_type",name);
    if(t.rls_enabled!==true)
      emit("priority","rls_not_enabled",name);
    if(!boolean(t.rls_forced))
      emit("evidence_gap","rls_force_state_unknown",name);
    if(!Number.isInteger(t.policy_count)||t.policy_count<0)
      emit("evidence_gap","rls_policy_count_unknown",name);
    if(!obj(t.table_privileges)){
      emit("evidence_gap","table_privileges_missing",name);continue;
    }
    for(const role of ROLES){
      const perms=t.table_privileges[role];
      if(!obj(perms)||CRUD.some(k=>!boolean(perms[k]))){
        emit("evidence_gap","table_privileges_incomplete",name+":"+role);
        continue;
      }
      if(name!=="saved_reports"&&role!=="service_role"&&
        CRUD.some(k=>perms[k])){
        emit("priority","request_guard_table_access_exposed",name+":"+role);
      }
    }
  }
  for(const [table,name] of EXPECTED_COLUMNS){
    const subject=table+"."+name,c=columns.get(subject);
    if(!c){emit("evidence_gap","column_metadata_missing",subject);continue;}
    if(!present(c.exists)){
      emit("priority","column_not_found",subject);continue;
    }
    if(typeof c.data_type!=="string"||c.data_type.length>MAX_TEXT)
      emit("evidence_gap","column_type_unknown",subject);
    else if(subject==="saved_reports.face_lab_revision"&&c.data_type!=="bigint")
      emit("priority","revision_type_unexpected",subject);
    if(subject==="saved_reports.face_lab_revision"&&c.not_null!==true)
      emit("priority","revision_nullable",subject);
    if(subject==="saved_reports.face_lab_revision"&&
       (typeof c.default_expression!=="string"||
        !/^0(?:\s*::\s*\w+)?$/.test(c.default_expression.trim())))
      emit("review","revision_default_requires_review",subject);
  }
  for(const [table,name] of EXPECTED_CONSTRAINTS){
    const subject=table+"."+name,c=constraints.get(subject);
    if(!c){emit("evidence_gap","constraint_metadata_missing",subject);continue;}
    if(!present(c.exists)){
      emit("priority","constraint_not_found",subject);continue;
    }
    if(c.constraint_type!=="c"||c.validated!==true)
      emit("priority","constraint_not_validated_check",subject);
    if(typeof c.definition!=="string"||c.definition.length>MAX_TEXT)
      emit("evidence_gap","constraint_definition_missing",subject);
    else {
      const expected=name==="saved_reports_face_lab_revision_nonnegative"?
        ["face_lab_revision"]:name==="analysis_request_idempotency_endpoint_check"?
        ["face-lab-simulation-test"]:["face-reading-test","face-lab-simulation-test"];
      for(const token of expected)
        if(!c.definition.includes(token))
          emit("priority","expected_constraint_token_missing",subject+":"+token);
    }
  }
  for(const [name,signature] of EXPECTED_ROUTINES){
    const r=routines.get(signature);
    if(!r){emit("evidence_gap","routine_metadata_missing",name);continue;}
    if(r.routine_name!==name)emit("priority","routine_name_drift",name);
    if(!present(r.exists)){
      emit("priority","routine_not_found",name);continue;
    }
    if(r.security_definer!==false)
      emit("priority","routine_security_invoker_unconfirmed",name);
    if(typeof r.definition_sha256!=="string"||
      !/^[a-f0-9]{64}$/.test(r.definition_sha256))
      emit("evidence_gap","routine_hash_missing",name);
    if(!obj(r.function_execute_privileges)){
      emit("evidence_gap","routine_privileges_missing",name);continue;
    }
    const permissions=r.function_execute_privileges;
    for(const role of ROLES){
      const k=role+"_execute";
      if(!boolean(permissions[k]))
        emit("evidence_gap","routine_execute_state_unknown",name+":"+role);
      else if(role!=="service_role"&&permissions[k])
        emit("priority","routine_executable_by_untrusted_role",name+":"+role);
      else if(role==="service_role"&&!permissions[k])
        emit("priority","routine_service_role_execute_missing",name);
    }
  }
  findings.sort((a,b)=>a.severity.localeCompare(b.severity)||
    a.code.localeCompare(b.code)||a.subject.localeCompare(b.subject));
  const counts={
    expectedTables:EXPECTED_TABLES.length,
    expectedColumns:EXPECTED_COLUMNS.length,
    expectedConstraints:EXPECTED_CONSTRAINTS.length,
    expectedRoutines:EXPECTED_ROUTINES.length,
    priority:findings.filter(f=>f.severity==="priority").length,
    evidenceGaps:findings.filter(f=>f.severity==="evidence_gap").length,
    manualReview:findings.filter(f=>f.severity==="review").length,
    totalFindings:findings.length
  };
  return {
    status:"HOLD",
    evidenceAssessment:"offline_catalog_metadata_only",
    catalogMetadataReviewed:true,
    productionIdentityConfirmed:false,
    appliedSqlVerified:false,
    authorizationVerified:false,
    productionReconciliationComplete:false,
    networkCalls:0,databaseCalls:0,databaseWrites:0,
    approval:"manual_review_required",
    counts,findings
  };
}

export function faceLabCatalogEvidenceMarkdown(result){
  if(!obj(result)||result.status!=="HOLD"||
    !Array.isArray(result.findings)||!obj(result.counts))fail("report_invalid");
  return [
    "# Face Lab catalog and ACL readback — offline triage",
    "",
    "**Operational decision: HOLD.** No Production identity, SQL-execution,",
    "data access or runtime-authorization assertion can be inferred.",
    "",
    "| Measure | Count |","| --- | ---: |",
    "| Priority findings | "+result.counts.priority+" |",
    "| Evidence gaps | "+result.counts.evidenceGaps+" |",
    "| Manual review findings | "+result.counts.manualReview+" |",
    "| Total findings | "+result.counts.totalFindings+" |",
    "",
    "## Evidence flags (not changes to apply)",
    ...result.findings.map(f=>"- "+f.severity+" / "+f.code+" / "+f.subject),
    ...(result.findings.length?[]:["- No flagged metadata checks; still HOLD"]),
    "",
    "No DB connectivity, migrations, authorization probing, or writes occurred.",
    "A role privilege readback does not cover all authorization paths.",
    ""
  ].join("\n");
}
