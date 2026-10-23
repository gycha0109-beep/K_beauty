#!/usr/bin/env node
// D8K13 pinned offline-only P0 metadata check. No network, SQL, private data, or writes.
// A current-role ACL result does not prove original table/GRANT creation provenance.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const MANIFEST="scripts/product-evidence/baselines/d8k13-p0-acl-taxonomy-provenance-followup-20261017.json";
function blobSha(bytes){
 return createHash("sha1").update(Buffer.from("blob "+bytes.length+String.fromCharCode(0),"utf8")).update(bytes).digest("hex");
}
export function verifyD8k13P0AclTaxonomyProvenance(root){
 const m=JSON.parse(readFileSync(join(root,MANIFEST),"utf8"));
 assert.equal(m.schema,"D8K13_P0_ACL_TAXONOMY_PROVENANCE_FOLLOWUP_V1");
 assert.equal(m.status,"RELEASE_HOLD");
 assert.equal(m.hostedWrites,0);
 assert.equal(m.rawMigrationSqlPublished,false);
 assert.equal(m.productIdentifiersPublished,false);
 assert.equal(m.productNamesPublished,false);
 assert.equal(m.history.appliedRows,178);
 assert.equal(m.history.earliestAppliedVersion,"20260410");
 assert.equal(m.history.earliestStoredSqlAltersProductCandidates,true);
 assert.equal(m.history.earliestStoredSqlCreatesViewJoiningSourceRankings,true);
 assert.equal(m.history.earliestStoredSqlDefinesProductCandidates,false);
 assert.equal(m.history.earliestStoredSqlDefinesSourceRankings,false);
 for(const key of [
  "sourceRankingsExactDirectCreateCount","productCandidatesExactDirectCreateCount",
  "sourceRankingsExactDirectGrantRevokeCount","productCandidatesExactDirectGrantRevokeCount"
 ])assert.equal(m.history[key],0,"D8K13_P0_HISTORY_PATTERN_CHANGED: "+key);
 assert.equal(m.history.initialAclGrantRevokeProvenance,"UNATTESTED");
 for(const key of ["rlsEnabled","serviceRoleInsert"])assert.equal(m.currentAccess[key],true);
 for(const key of ["anonSelect","anonInsert","authenticatedSelect","authenticatedInsert","historicalSafetyCertified"])
  assert.equal(m.currentAccess[key],false);
 assert.equal(m.taxonomy8.targetCount,1);
 assert.equal(m.taxonomy8.legacyCategory,"sunscreen");
 assert.equal(m.taxonomy8.createdDate,"2026-10-01");
 assert.equal(m.taxonomy8.promotionVersion,"crawler-canonical-product-structural-adoption-v1");
 assert.equal(m.taxonomy8.promotionAction,"inserted");
 assert.equal(m.taxonomy8.candidateClassificationMethod,"manual_legacy_projection_v1");
 assert.equal(m.taxonomy8.candidateClassificationState,"active_shadow");
 assert.equal(m.taxonomy8.candidateLegacyProjectionKeyPresent,true);
 assert.equal(m.taxonomy8.productCanonicalTaxonomyAssignments,0);
 assert.equal(m.taxonomy8.productTaxonomyInsertSyncTriggerPresent,false);
 assert.equal(m.taxonomy8.candidateTaxonomyShadowSyncTriggerPresent,true);
 assert.equal(m.taxonomy8.policyIntentApproved,false);
 assert.equal(m.taxonomy8.directLiveDataCorrectionApproved,false);
 assert.equal(m.sourceBlobs.length,3);
 const source=m.sourceBlobs.map(item=>{
  const raw=readFileSync(join(root,item.file));
  assert.equal(blobSha(raw),item.sha,"D8K13_P0_PINNED_BLOB_DRIFT: "+item.file);
  return raw.toString("utf8");
 });
 assert.ok(source[0].includes("alter table public.product_candidates"));
 assert.ok(source[0].includes("left join public.source_rankings sr"));
 const start=source[1].indexOf("create or replace function public.promote_product_candidate_structural_v1(");
 const end=source[1].indexOf("revoke all on function public.promote_product_candidate_structural_v1(",start);
 assert.ok(start>=0&&end>start,"D8K13_P0_STRUCTURAL_FUNCTION_DRIFT");
 const body=source[1].slice(start,end);
 assert.ok(body.includes("v_candidate.service_category, v_candidate.product_form"));
 assert.ok(body.includes("promotion_version = 'crawler-canonical-product-structural-adoption-v1'"));
 assert.ok(!body.includes("product_catalog_taxonomy_assignments"),"D8K13_P0_STRUCTURAL_ASSIGNMENT_CONTRACT_CHANGED");
 assert.ok(source[2].includes("insert into public.product_catalog_taxonomy_assignments("));
 const sql=readFileSync(join(root,m.queryFile),"utf8");
 assert.ok(sql.includes("D8K13_P0_ACL_TAXONOMY_PROVENANCE_FOLLOWUP_V1"));
 assert.ok(sql.includes("SELECT jsonb_build_object("));
 assert.ok(!sql.split(String.fromCharCode(10)).some(line=>["insert","update","delete","create","alter","drop","grant","revoke","truncate"].includes(line.trim().split(" ")[0].toLowerCase())),"D8K13_P0_SQL_NOT_SELECT_ONLY");
 assert.equal(m.wholeMigrationHistoryReplayed,false);
 assert.equal(m.backupPitrRestored,false);
 assert.equal(m.securityIssue1208Resolved,false);
 assert.equal(m.releaseAuthorized,false);
 return Object.freeze({
  status:"HOLD",metadataMatchesPinnedSources:true,
  earliestKnownLedgerPreexistingTables:true,
  historicalAclOriginAttested:false,
  taxonomyStructuralWriterGapObserved:true,
  taxonomyPolicyApproved:false,releaseAuthorized:false
 });
}
