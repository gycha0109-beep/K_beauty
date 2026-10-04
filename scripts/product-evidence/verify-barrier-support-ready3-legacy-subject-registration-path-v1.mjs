#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildTrustAdminIdentityAuthorityCandidate,
  buildTrustSubjectIdentityProposal
} from "../../lib/admin/trust-subject-identity.js";

const EVIDENCE="evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-ready3-legacy-backfill-controlled-subject-path-v1.json";
const IDENTITY="lib/admin/trust-subject-identity.js";
const REGISTRATION="lib/admin/trust-subject-registration.js";
const evidence=JSON.parse(fs.readFileSync(EVIDENCE,"utf8"));
const identitySource=fs.readFileSync(IDENTITY,"utf8");
const registrationSource=fs.readFileSync(REGISTRATION,"utf8");

let assertions=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);assertions+=1};
const ok=(v,m)=>{assert.ok(v,m);assertions+=1};
const throws=(fn,code)=>{assert.throws(fn,e=>e?.code===code);assertions+=1};

eq(evidence.stage,"V2.1-8H-R11A","stage");
eq(evidence.primary_terminal_outcome,"LEGACY_BACKFILL_CONTROLLED_SUBJECT_PATH_READY","terminal");
eq(evidence.implementation.new_database_writer,false,"no writer");
eq(evidence.implementation.governed_subject_writer,"admin_register_product_fact_subject_v1","existing writer");
eq(evidence.implementation.post_registration_reprocess,"process_catalog_trust_product_v3","pinned reprocess");
eq(evidence.production_state.ready3_subject_count,0,"no subject writes in R11A");
eq(evidence.production_state.product_fact_current,101,"PF current invariant");
eq(evidence.production_state.fact_instances,102,"fact instances invariant");
eq(evidence.production_state.confirmations,102,"confirmations invariant");

const ids={
  task:"11111111-1111-4111-8111-111111111111",
  intake:"22222222-2222-4222-8222-222222222222",
  product:"33333333-3333-4333-8333-333333333333"
};
function legacySnapshot(){
  const intake={
    id:ids.intake,
    product_id:ids.product,
    source_candidate_id:null,
    market:"KR",
    subject_id:null,
    identity_state:"SUBJECT_CREATION_REQUIRED",
    trust_state:"REVIEW_REQUIRED",
    identity_resolution_detail:{
      reason_code:"no_product_fact_subject_exists",
      identity_authority:{
        authority_kind:"admin_identity_authority",
        market:"KR",
        official_source_locator:"https://brand.example/products/fixture",
        source_content_digest:"a".repeat(64),
        authority_resolution_version:"v21-fixture-official-identity-v1",
        resolution_reason:"explicit reviewed first-party identity"
      }
    },
    updated_at:"2026-10-04T00:00:00.000Z"
  };
  const product={id:ids.product,brand:"Fixture",name:"Fixture Balm",category:"moisturizer_balm"};
  const candidate=buildTrustAdminIdentityAuthorityCandidate(intake,product);
  return {
    task:{
      id:ids.task,intake_id:ids.intake,product_id:ids.product,subject_id:null,
      state:"REVIEW_REQUIRED",blocker_code:"SUBJECT_CREATION_REQUIRED",updated_at:"2026-10-04T00:00:00.000Z"
    },
    intake,
    product,
    candidate,
    tasks:[
      {id:ids.task,fact_key:"barrier_support_claim",state:"REVIEW_REQUIRED",blocker_code:"SUBJECT_CREATION_REQUIRED",subject_id:null,updated_at:"2026-10-04T00:00:00.000Z"}
    ]
  };
}
const reviewed={
  variantKey:null,
  variantKeyReviewedAsNull:true,
  formulationRevisionKey:"v21-fixture-formulation-r1",
  formulationLabel:"Fixture KR official identity",
  marketApplicability:"KR",
  regionApplicability:null,
  validFrom:null,
  validTo:null
};

const snapshot=legacySnapshot();
ok(snapshot.candidate,"legacy authority candidate created");
eq(snapshot.candidate.identity_source_kind,"admin_identity_authority","legacy source kind");
eq(snapshot.candidate.review_status,"promoted","reviewed authority normalization");
eq(snapshot.candidate.identity_resolution_state,"resolved","resolved normalization");
eq(snapshot.candidate.identity_resolution_evidence.authority_boundary.product_fact_write_allowed,false,"no PF authority");
eq(snapshot.candidate.id,null,"no fabricated candidate id");

const proposal=buildTrustSubjectIdentityProposal(snapshot,reviewed);
eq(proposal.sourceCandidateId,null,"no source candidate lineage");
eq(proposal.identitySourceKind,"admin_identity_authority","proposal source kind");
eq(proposal.payload.product_id,ids.product,"product lineage");
eq(proposal.payload.variant_key,null,"reviewed product scope");
eq(proposal.payload.market_applicability,"KR","KR market");
eq(proposal.catalogIdentityIsProductFactAuthority,false,"identity only");
eq(proposal.requiresExplicitConfirmation,true,"explicit confirmation");
eq(proposal.automaticRegistration,false,"no automatic registration");

const badMarket=legacySnapshot();
badMarket.intake.identity_resolution_detail.identity_authority.market="US";
eq(buildTrustAdminIdentityAuthorityCandidate(badMarket.intake,badMarket.product),null,"authority market mismatch rejected");

const badDigest=legacySnapshot();
badDigest.intake.identity_resolution_detail.identity_authority.source_content_digest="bad";
eq(buildTrustAdminIdentityAuthorityCandidate(badDigest.intake,badDigest.product),null,"invalid digest rejected");

const badKind=legacySnapshot();
badKind.intake.identity_resolution_detail.identity_authority.authority_kind="catalog_evidence";
eq(buildTrustAdminIdentityAuthorityCandidate(badKind.intake,badKind.product),null,"wrong authority kind rejected");

const noAuthority=legacySnapshot();
delete noAuthority.intake.identity_resolution_detail.identity_authority;
eq(buildTrustAdminIdentityAuthorityCandidate(noAuthority.intake,noAuthority.product),null,"missing authority rejected");

const lineageTamper=legacySnapshot();
lineageTamper.candidate.matched_product_id="44444444-4444-4444-8444-444444444444";
throws(()=>buildTrustSubjectIdentityProposal(lineageTamper,reviewed),"trust_subject_registration_lineage_mismatch");

const escalation=legacySnapshot();
escalation.candidate.identity_resolution_evidence.authority_boundary.product_fact_write_allowed=true;
throws(()=>buildTrustSubjectIdentityProposal(escalation,reviewed),"trust_subject_identity_catalog_authority_boundary_invalid");

for(const token of [
  "buildTrustAdminIdentityAuthorityCandidate",
  "candidate ?? buildTrustAdminIdentityAuthorityCandidate(intake, product)"
]) ok(registrationSource.includes(token),`registration token ${token}`);
ok(identitySource.includes("admin_identity_authority"),"identity module carries admin authority marker");

ok(registrationSource.includes('"admin_register_product_fact_subject_v1"'),"existing governed writer retained");
ok(registrationSource.includes("runTrustSubjectRegistryPinnedReprocess"),"registry-pinned reprocess retained");
ok(!registrationSource.includes(".insert("),"no direct insert");
ok(!registrationSource.includes(".update("),"no direct update");
ok(!registrationSource.includes(".delete("),"no direct delete");
ok(identitySource.includes("product_fact_write_allowed: false"),"legacy identity authority cannot become PF authority");
ok(!identitySource.includes("automaticRegistration: true"),"no automatic registration");

eq(evidence.next_gate.stage,"V2.1-8H-R11B_READY3_CONTROLLED_SUBJECT_REGISTRATION","next gate");
eq(evidence.next_gate.status,"NOT_EXECUTED","R11B not executed");

console.log(JSON.stringify({
  status:"PASS",
  stage:evidence.stage,
  terminal:evidence.primary_terminal_outcome,
  assertions,
  identity_source_kind:proposal.identitySourceKind,
  subject_writer:evidence.implementation.governed_subject_writer
}));
