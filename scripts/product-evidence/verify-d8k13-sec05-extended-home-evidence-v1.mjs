#!/usr/bin/env node
// Metadata-only attestation of the 2026-10-17 user-reported Windows PG17 run.
// Validates pinned repository blobs and runner source contract; does not open the
// private Windows transcript, run SQL, connect to hosted services, or approve a release.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const MANIFEST="scripts/product-evidence/baselines/d8k13-sec05-extended-home-pg17-acceptance-20261017.json";
const EXPECTED_PATHS=[
  "supabase/migrations/20260711032649_sec_05_anonymous_write_grants.sql",
  "scripts/product-evidence/run-d8k13-sec05-acl-synthetic-pg17.mjs",
  "tests/fixtures/r16i-d8k13/30_sec05_acl_synthetic_setup_pg17.sql",
  "tests/fixtures/r16i-d8k13/31_sec05_legacy_null_behavior_pg17.sql",
  "tests/fixtures/r16i-d8k13/32_sec05_hardened_null_contract_pg17.sql",
  "tests/fixtures/r16i-d8k13/33_sec05_ranking_acl_minimal_revoke_pg17.sql",
  "tests/fixtures/r16i-d8k13/34_sec05_legacy_completion_failure_null_pg17.sql",
  "tests/fixtures/r16i-d8k13/35_sec05_hardened_completion_failure_pg17.sql"
];
const EXPECTED_MARKERS=[
  "D8K13_HOME_SOURCE_EIGHT_GIT_BLOB_CHECKSUMS_PASS",
  "D8K13_HOME_POSTGRES17_IMAGE_READY",
  "D8K13_SEC05_ACL_SYNTHETIC_CHECK_FILES_PASS",
  "D8K13_SEC05_ACL_LOCAL_DOCKER_PG17_PASS",
  "D8K13_HOME_PG17_TEST_PASS",
  "D8K13_SEC05_EXTENDED_HOME_PG17_TEST_PASS"
];
function gitBlobSha(bytes){
 return createHash("sha1").update(Buffer.from("blob "+bytes.length+String.fromCharCode(0),"utf8")).update(bytes).digest("hex");
}
export function verifyD8k13ExtendedHomeEvidence(root){
 const m=JSON.parse(readFileSync(join(root,MANIFEST),"utf8"));
 assert.equal(m.schema,"D8K13_SEC05_EXTENDED_HOME_PG17_ACCEPTANCE_V1");
 assert.equal(m.status,"SCOPED_SYNTHETIC_PG17_RUNNER_USER_REPORTED_PASS");
 assert.equal(m.pinnedGithubCommit,"303a94af096f6b4b8fa0784e8920bc39843a4edd");
 assert.equal(m.userReportedLogSha256,"1dadd3a9ba3fcde39e03dbf0c94b3b824a8014ccee445f2334c54db7dce52006");
 assert.equal(m.rawLogBytesAvailableToThisAudit,false);
 assert.equal(m.rawLogHashRecomputedByThisAudit,false);
 assert.equal(m.pinnedSourceCount,8);
 assert.deepEqual(m.pinnedSources.map(x=>x.path),EXPECTED_PATHS);
 assert.deepEqual(m.reportedTranscriptMarkers,EXPECTED_MARKERS);
 assert.equal(m.innerExtendedMarkersDirectlyVisibleInUserSummary,false);
 assert.equal(m.syntheticPg17CompleteFailAcceptanceAttestedFromUserReport,true);
 assert.equal(m.syntheticPg17ClaimRankingAcceptanceAttestedFromUserReport,true);
 for(const f of m.pinnedSources){
  assert.match(f.gitBlobSha,/^[0-9a-f]{40}$/);
  const source=readFileSync(join(root,f.path));
  assert.equal(gitBlobSha(source),f.gitBlobSha,"D8K13_EXTENDED_HOME_PINNED_BLOB_DRIFT: "+f.path);
 }
 const runner=readFileSync(join(root,EXPECTED_PATHS[1]),"utf8");
 const check=(x)=>assert.ok(runner.includes(x),"D8K13_EXTENDED_HOME_RUNNER_CONTRACT_DRIFT: "+x);
 for(const x of [
  "sqlBodyTokenCount(oldComplete),224",
  "sqlBodyTokenCount(oldFail),207",
  'assert.match(legacyExtended,/D8K13_SEC05_COMPLETE_FAIL_LEGACY_NULL_BYPASS_ROLLBACK_PASS/)',
  "D8K13_SEC05_COMPLETE_FAIL_HARDENED_NULL_MATRIX_RETRY_ROLLBACK_PASS",
  "D8K13_SEC05_COMPLETE_FAIL_PUBLIC_RPC_DENIED_PASS",
  "D8K13_SEC05_ACL_LOCAL_DOCKER_PG17_PASS",
  '"--network=none"','"--pull=never"',"SEC05_REMOTE_DOCKER_HOST_FORBIDDEN"
 ])check(x);
 const finalLog=runner.lastIndexOf('console.log("D8K13_SEC05_ACL_LOCAL_DOCKER_PG17_PASS")');
 const extendedAssert=runner.lastIndexOf("D8K13_SEC05_COMPLETE_FAIL_HARDENED_NULL_MATRIX_RETRY_ROLLBACK_PASS");
 const roles=runner.lastIndexOf('console.log("D8K13_SEC05_COMPLETE_FAIL_PUBLIC_RPC_DENIED_PASS")');
 assert.ok(extendedAssert>=0&&roles>extendedAssert&&finalLog>roles,
  "D8K13_EXTENDED_HOME_RUNNER_FINAL_MARKER_NOT_GATED");
 assert.equal(m.full178HistoricalMigrationReplayCertified,false);
 assert.equal(m.hostedSec05FunctionsHardenedByThisTest,false);
 assert.equal(m.productionAclModifiedByThisTest,false);
 assert.equal(m.productionDatabaseWrites,0);
 assert.equal(m.independentSecurityOwnerApproved,false);
 assert.equal(m.backupPitrRestoreVerified,false);
 assert.equal(m.issue1208Resolved,false);
 assert.equal(m.productionReleaseAuthorized,false);
 assert.equal(m.releaseStatus,"HOLD");
 return Object.freeze({
  pinnedGithubCommit:m.pinnedGithubCommit,
  sourceCount:8,
  scopedSec05CompleteFailNativePg17UserReportedPass:true,
  rawTranscriptAndStatementOutputIndependentlyVerified:false,
  releaseAuthorized:false
 });
}
