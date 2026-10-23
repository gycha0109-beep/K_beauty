#!/usr/bin/env node
// D8K-13 historical anonymous-claim/ranking ACL audit.
// OFFLINE STATIC CONTRACT ONLY: no network, secrets, DB, SQL, or writes.
// Historical provenance and runtime behavior are NOT certified by this script.
import {verifyD8k13ExtendedHomeEvidence} from "./verify-d8k13-sec05-extended-home-evidence-v1.mjs";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const extendedSec05Home=verifyD8k13ExtendedHomeEvidence(ROOT);
const args=process.argv.slice(2);
assert.ok(args.length<=1&&args.every(x=>x==="--enforce-release"||x==="--help"),
 "D8K13_UNKNOWN_HISTORICAL_SECURITY_ARG");
if(args.includes("--help")){
 console.log("Offline security-lineage contract: --enforce-release always HOLD");
 process.exit(0);
}
function src(relative){return readFileSync(path.join(ROOT,relative),"utf8")}
function assertOrdered(source,left,right,label){
 const a=source.indexOf(left),b=source.indexOf(right);
 assert.ok(a>=0&&b>a,"D8K13_SECURITY_CALL_ORDER_DRIFT: "+label);
}
const manifest=JSON.parse(src(
 "scripts/product-evidence/baselines/d8k13-hosted-same-version-sql-triage-readonly-20261016.json"));
const p0=manifest.p0DeployedScopeFollowup;
const auth=p0.anonymousWriteGrant,repair=p0.rankingAclLaterAppliedRepair;
assert.equal(manifest.status,"RELEASE_HOLD");
assert.equal(manifest.sourceSqlBodiesPublished,false);
assert.equal(manifest.multiStatementTokenFollowup.tokenDifference,2);
assert.equal(manifest.multiStatementTokenFollowup.evaluated,28);

const secCore=src("lib/security/anonymous-write-grant-core.js");
const secHelper=src("lib/security/anonymous-write-grant.js");
const results=src("app/api/results/route.js");
const track=src("app/api/track/route.js");
const secMigration=src("supabase/migrations/20260711032649_sec_05_anonymous_write_grants.sql");
const aclRepair=src("supabase/migrations/20260621151304_repair_phase1_ranking_snapshot_ingest_rpc.sql");
const truncateRepair=src("supabase/migrations/20260621152040_repair_phase1_ranking_snapshots_truncate_privilege.sql");
const readonlyProbe=src("scripts/product-evidence/sql/d8k13-historical-drift-readonly-preflight-v1.sql");
const isolatedPg17=src("scripts/product-evidence/run-d8k13-sec05-acl-synthetic-pg17.mjs");
const isolatedSetup=src("tests/fixtures/r16i-d8k13/30_sec05_acl_synthetic_setup_pg17.sql");
const isolatedLegacy=src("tests/fixtures/r16i-d8k13/31_sec05_legacy_null_behavior_pg17.sql");
const isolatedHardened=src("tests/fixtures/r16i-d8k13/32_sec05_hardened_null_contract_pg17.sql");
const isolatedAcl=src("tests/fixtures/r16i-d8k13/33_sec05_ranking_acl_minimal_revoke_pg17.sql");

assert.ok(secHelper.startsWith('import "server-only";'));
assertOrdered(secCore,"const expectedSignature = createAnonymousWriteGrantTokenSignature",
 "if (!safeEqual(signature, expectedSignature))","token HMAC verification");
assertOrdered(secCore,"if (!safeEqual(signature, expectedSignature))",
 "if (!isValidTokenPayload(payload))","signature precedes claims");
assert.ok(secCore.includes('isAnonymousWriteGrantHash(payload.principalHash)'));
assert.ok(secCore.includes('OPAQUE_ID_PATTERN.test(payload.resourceId || "")'));
assert.ok(secCore.includes('payload.operation !== expectedOperation'));
assertOrdered(secHelper,"const verification = verifyAnonymousWriteGrantToken(",
 "const anonymous = resolveExistingAnonymousCookiePayload(request)","HMAC before cookie");
assertOrdered(secHelper,"const anonymous = resolveExistingAnonymousCookiePayload(request)",
 "if (principalHash !== verification.payload.principalHash)","signed cookie principal binding");
assert.ok(secHelper.includes("!grant?.jtiHash || !grant?.principalHash || !requestFingerprintHash"));
for(const [routeName,route] of [["results",results],["track",track]]){
 assertOrdered(route,"anonymousGrant = verifyAnonymousWriteGrantForRequest({",
 "if (body?.analysisRunId !== anonymousGrant.payload.resourceId)","resource constraint "+routeName);
 assertOrdered(route,"if (body?.analysisRunId !== anonymousGrant.payload.resourceId)",
 "const claimResult = await claimAnonymousWriteGrant({","verify before service RPC "+routeName);
}
assert.ok(secMigration.includes("if p_jti_hash is null"));
assert.ok(secMigration.includes("or p_principal_hash is null"));
assert.ok(secMigration.includes("or p_resource_id is null"));
assert.ok(secMigration.includes("or p_request_fingerprint_hash is null"));
assert.ok(aclRepair.includes("revoke insert, update, delete on table public.ranking_snapshots from anon, authenticated;"));
assert.ok(aclRepair.includes("grant select, insert, update on table public.ranking_snapshots to service_role;"));
assert.ok(truncateRepair.includes("revoke truncate on table public.ranking_snapshots from anon, authenticated;"));
assert.ok(readonlyProbe.includes("ranking_acl_later_migration_provenance"));
assert.ok(readonlyProbe.includes("pg_catalog.has_function_privilege('public',p.oid,'EXECUTE')"));
for(const privilege of ["REFERENCES","TRIGGER","MAINTAIN"])
 assert.ok(readonlyProbe.includes("'"+privilege+"'"),
  "D8K13_READONLY_ACL_PRIVILEGE_AUDIT_MISSING: "+privilege);
assert.ok(readonlyProbe.includes("public_schema_create_acl"));
assert.ok(isolatedPg17.includes('"--network=none"'));
assert.ok(isolatedPg17.includes('"--pull=never"'));
assert.ok(isolatedPg17.includes("SEC05_REMOTE_DOCKER_HOST_FORBIDDEN"));
assert.ok(isolatedPg17.includes("const IMAGE=\"postgres:17\""));
assert.ok(isolatedPg17.includes("legacyVariant(fn)"));
assert.ok(isolatedPg17.includes("if(args.length)return;"));
assert.ok(isolatedSetup.includes("D8K13_SYNTHETIC_ACL_BASELINE_PASS"));
assert.ok(isolatedLegacy.includes("D8K13_SEC05_LEGACY_NULL_COUNTEREXAMPLE_AND_ROLLBACK_PASS"));
assert.ok(isolatedHardened.includes("D8K13_SEC05_HARDENED_NULL_MATRIX_ROLE_AND_RETRY_PASS"));
assert.ok(isolatedAcl.includes("D8K13_SYNTHETIC_RANKING_ACL_REVOKE_ROLLBACK_IDEMPOTENCE_PASS"));
assert.ok(isolatedAcl.includes("REVOKE REFERENCES,TRIGGER,MAINTAIN ON TABLE public.ranking_snapshots"));

assert.equal(repair.historical_records_readonly_verified,true);
assert.equal(repair.current_hosted_ranking_rls_and_write_acl_verified,true);
assert.equal(repair.source_rankings_explicit_acl_origin_not_yet_proven,true);
assert.equal(repair.ranking_snapshots_residual_references_anon_authenticated,true);
assert.equal(repair.ranking_snapshots_residual_trigger_anon_authenticated,true);
assert.equal(repair.ranking_snapshots_residual_maintain_anon_authenticated,true);
assert.equal(repair.source_rankings_public_residual_permissions_absent,true);
assert.equal(repair.public_schema_create_anon_authenticated,false);
assert.equal(repair.ranking_snapshots_residual_acl_impact_exploitable_proven,false);
assert.equal(auth.runtime_function_execute_role,"service_role_only");
assert.equal(auth.anonymous_execute_allowed,false);
assert.equal(auth.authenticated_execute_allowed,false);
assert.equal(auth.public_execute_allowed,false);
assert.equal(auth.service_role_execute_allowed,true);
assert.equal(auth.caller_server_only_module,true);
assert.equal(auth.caller_requires_jti_principal_and_fingerprint,true);
assert.equal(auth.validated_token_requires_hmac_signature,true);
assert.equal(auth.caller_requires_signed_cookie_principal_match,true);
assert.equal(auth.postgres_null_comparison_returns_unknown,true);
assert.equal(auth.legacy_sql_explicit_all_six_null_guards_present,false);
assert.equal(auth.operator_live_rpc_invocation_performed,false);
assert.equal(auth.exploitabilityProven,false);
assert.equal(auth.hosted_legacy_function_tokens,747);
assert.equal(auth.locally_derived_legacy_function_tokens,747);
assert.equal(auth.locally_derived_legacy_function_token_equivalent_to_hosted,true);
assert.equal(auth.derived_legacy_only_strips_six_null_guards,true);
assert.equal(auth.legacy_derivation_js_special_dollar_replacement_fixed,true);
assert.equal(auth.synthetic_pg17_check_files_pass,true);
assert.equal(auth.synthetic_pg17_native_sql_execution_attested,true);
assert.equal(repair.synthetic_pg17_native_sql_execution_attested,true);
const acceptance=manifest.syntheticPg17HomeAcceptance;
assert.equal(acceptance.status,"SCOPED_SEC05_AND_RANKING_ACL_SYNTHETIC_DOCKER_PG17_PASS");
assert.equal(acceptance.pinnedGithubCommit,"0832a7f964cb68aa7fb057eba654343f46214cfa");
assert.equal(acceptance.userSuppliedTranscriptSha256.length,64);
assert.equal(acceptance.sixPinnedGitBlobsChecksumPass,true);
assert.equal(acceptance.postgreSQL17RunnerFinalMarker,true);
assert.equal(acceptance.sixNullInputAndRetryPass,true);
assert.equal(acceptance.publicRpcPermissionDenialPass,true);
assert.equal(acceptance.rankingAclRevokeRollbackPass,true);
assert.equal(acceptance.legacyNullCheckDirectMarkerPresentInTranscript,false);
assert.equal(acceptance.legacySqlTestIndirectlySupportedByGatedRunnerFinalPass,true);
assert.equal(acceptance.entire178RowMigrationHistoryReplayed,false);
assert.equal(acceptance.hostedReleaseAuthorized,false);
assert.ok(src(acceptance.evidenceDocument).includes("D8K13_HOME_PG17_TEST_PASS"));

console.log(JSON.stringify({
 stage:"D8K13_HISTORICAL_SECURITY_LINEAGE_OFFLINE_V1",
 status:"HOLD",
 contractsPassed:true,
 noLiveRpcExecution:true,
 observedServiceRoleOnly:true,
 authenticatedPublicDirectInvocation:false,
 signedCookieAndHmacGuardsPresent:true,
 originalRankAclRepairRecorded:true,
 residualRankingReferencesTriggerMaintainDetected:true,
 publicSchemaCreateDenied:true,
 sourceRankingsOriginAttested:false,
 liveAnonymousFunctionExplicitNullChecksAttested:false,
 exploitabilityProven:false,
 syntheticPg17SecuritySuiteSourcePresent:true,
 syntheticPg17SecuritySuiteExecutedOnDocker:true,
  syntheticPg17CompleteFailExtendedUserReportedPass:extendedSec05Home.scopedSec05CompleteFailNativePg17UserReportedPass,
  syntheticPg17EightPinnedSourceFilesVerified:extendedSec05Home.sourceCount===8,
  transcriptIndependentlyRehashedHere:false,
 syntheticPg17FullMigrationHistoryAccepted:false,
 fullMigrationChainReleaseApproved:false
}));
console.log("D8K13_HISTORICAL_SECURITY_LINEAGE_OFFLINE_PASS_HOLD");
if(args.includes("--enforce-release")){
 console.error("D8K13_HISTORICAL_SECURITY_LINEAGE_RELEASE_REFUSED");
 process.exitCode=3;
}
