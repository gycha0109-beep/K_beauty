#!/usr/bin/env node
// D8K-13 deployment-sequence diagnostic. LOCAL FILES ONLY; no network,
// no SQL, no secrets, no remote state, no mutation. This gate is intentionally
// a HOLD until the chronology conflict and operational approvals are resolved.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,existsSync,readdirSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const D8DV2="supabase/migrations/20261014150000_taxonomy_ai_r16i_d8d_v2_owner_gated_dual_offer.sql";
const D8K13="supabase/migrations/20261015185000_taxonomy_ai_r16i_d8k12_owner_review_revocation_v1.sql";
function content(rel){
 const p=path.join(ROOT,rel);
 assert.ok(existsSync(p),"MISSING_MIGRATION: "+rel);
 return readFileSync(p,"utf8");
}
function basenameVersion(rel){return Number(path.basename(rel).slice(0,14))}
const args=process.argv.slice(2);
if(args.length>1||args.some(x=>x!=="--enforce-release"))
 throw Error("D8K13_UNKNOWN_RELEASE_DIAGNOSTIC_ARGUMENT");
const v2=content(D8DV2),migration=content(D8K13);
const v2First=basenameVersion(D8DV2)<basenameVersion(D8K13);
const createsV2=[
 "admin_r16i_d8d_v2_applications",
 "admin_r16i_d8d_v2_owner_authorizations",
 "admin_r16i_d8d_v2_application_offers"
].every(name=>new RegExp("CREATE\\s+TABLE\\s+public\\."+name+"\\b","i").test(v2));
const d8k13RefusesV2=[
 "admin_r16i_d8d_v2_applications",
 "admin_r16i_d8d_v2_owner_authorizations",
 "admin_r16i_d8d_v2_application_offers"
].every(name=>migration.includes("to_regclass('public."+name+"') IS NOT NULL"));
const defaultLegacyRefusal=migration.includes(
 "D8K12_EXISTING_VERDICTS_REQUIRE_EXPLICIT_RECONCILIATION");
const exactManifest=migration.includes(
 "observed_manifest IS DISTINCT FROM expected_manifest");
const inertV2CompatibilityCandidate=[
 "D8K13_UNEXPECTED_D8DV2_ACTIVITY",
 "D8K13_UNEXPECTED_D8DV2_SCHEMA",
 "D8K13_UNEXPECTED_D8DV2_SECURITY",
 "pg_catalog.pg_advisory_xact_lock(195721,16)",
 "LOCK TABLE public.admin_r16i_d8d_v2_gate",
 "pg_catalog.cardinality(actual_columns)",
 "SELECT x.val FROM unnest(actual_columns)",
 "SELECT y.val FROM unnest(expected_columns)",
 "enabled=false"
].every(s=>migration.includes(s));
const actualV2ChainTest=content(
 "scripts/product-evidence/run-d8k13-local-pg17.mjs");
const sec05SyntheticRunner=content(
 "scripts/product-evidence/run-d8k13-sec05-acl-synthetic-pg17.mjs");
const sec05SyntheticFixtures=[
 "tests/fixtures/r16i-d8k13/30_sec05_acl_synthetic_setup_pg17.sql",
 "tests/fixtures/r16i-d8k13/31_sec05_legacy_null_behavior_pg17.sql",
 "tests/fixtures/r16i-d8k13/32_sec05_hardened_null_contract_pg17.sql",
 "tests/fixtures/r16i-d8k13/33_sec05_ranking_acl_minimal_revoke_pg17.sql"
].map(content);
assert.ok(sec05SyntheticRunner.includes('"--network=none"'));
assert.ok(sec05SyntheticRunner.includes('"--pull=never"'));
assert.ok(sec05SyntheticRunner.includes("SEC05_REMOTE_DOCKER_HOST_FORBIDDEN"));
assert.ok(sec05SyntheticRunner.includes("legacyVariant(fn)"));
assert.ok(sec05SyntheticRunner.includes("D8K13_SEC05_ACL_LOCAL_DOCKER_PG17_PASS"));
assert.ok(sec05SyntheticFixtures[0].includes("D8K13_SYNTHETIC_ACL_BASELINE_PASS"));
assert.ok(sec05SyntheticFixtures[1].includes("D8K13_SEC05_LEGACY_NULL_COUNTEREXAMPLE_AND_ROLLBACK_PASS"));
assert.ok(sec05SyntheticFixtures[2].includes("D8K13_SEC05_HARDENED_NULL_MATRIX_ROLE_AND_RETRY_PASS"));
assert.ok(sec05SyntheticFixtures[3].includes("D8K13_SYNTHETIC_RANKING_ACL_REVOKE_ROLLBACK_IDEMPOTENCE_PASS"));
const realChainFixtureIncluded=[
 "supabase/migrations/20261014150000_taxonomy_ai_r16i_d8d_v2_owner_gated_dual_offer.sql",
 "D8K13_D8DV2_REAL_ORDER_CHAIN_ACCEPTANCE_PASS",
 "D8K13_D8DV2_DRIFT_REFUSAL_AND_ROLLBACK_PASS"
].every(s=>actualV2ChainTest.includes(s));
const unresolvedStaticConflict=v2First&&createsV2&&d8k13RefusesV2&&
 !inertV2CompatibilityCandidate;
const appliedSnapshot=JSON.parse(content(
 "scripts/product-evidence/baselines/d8k13-hosted-migrations-readonly-20261016.json"));
assert.equal(appliedSnapshot.schema,"D8K13_HOSTED_MIGRATION_HISTORY_READONLY_V1");
assert.equal(appliedSnapshot.migrations.length,appliedSnapshot.observed_count);
const provenance=JSON.parse(content(
 "scripts/product-evidence/baselines/d8k13-hosted-migration-provenance-readonly-20261016.json"));
assert.equal(provenance.schema,"D8K13_HOSTED_MIGRATION_SOURCE_PROVENANCE_V1");
assert.equal(provenance.status,"RELEASE_HOLD");
assert.equal(provenance.sourceSqlBodiesPublished,false);
assert.equal(provenance.summaries.applied,appliedSnapshot.observed_count);
assert.equal(provenance.summaries.sameNameDifferentVersion,41);
assert.equal(provenance.summaries.byteMatchRaw+
 provenance.summaries.byteMatchWithTrailingLF,34);
assert.equal(provenance.summaries.differentVersionPairs,7);
assert.equal(provenance.summaries.remoteOnlySqlStored,34);
const sameVersionTriage=JSON.parse(content(
 "scripts/product-evidence/baselines/d8k13-hosted-same-version-sql-triage-readonly-20261016.json"));
assert.equal(sameVersionTriage.schema,"D8K13_SAME_VERSION_SQL_TRIAGE_READONLY_V1");
assert.equal(sameVersionTriage.status,"RELEASE_HOLD");
assert.equal(sameVersionTriage.sourceSqlBodiesPublished,false);
assert.equal(sameVersionTriage.summary.sameVersionAndNameButBlobNotDirectMatch,
 provenance.summaries.sameVersionNameUnmatched);
assert.equal(sameVersionTriage.summary.joinReassemblyNotProven,28);
assert.equal(sameVersionTriage.summary.singleStatementDifferent,18);
assert.equal(sameVersionTriage.summary.requiresPG17ParserReview,1);
assert.equal(sameVersionTriage.multiStatementTokenFollowup.evaluated,28);
assert.equal(sameVersionTriage.multiStatementTokenFollowup.tokenExact+
 sameVersionTriage.multiStatementTokenFollowup.tokenSameExceptSingleFinalSemicolon,26);
assert.equal(sameVersionTriage.multiStatementTokenFollowup.tokenDifference,2);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.taxonomy8.historicalSqlBytes,64);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.c5b.runtimeFunctionTokensMatchGit,1203);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.anonymousWriteGrant.exploitabilityProven,false);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.rankingAclLaterAppliedRepair.historical_records_readonly_verified,true);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.rankingAclLaterAppliedRepair.source_rankings_explicit_acl_origin_not_yet_proven,true);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.rankingAclLaterAppliedRepair.ranking_snapshots_residual_references_anon_authenticated,true);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.rankingAclLaterAppliedRepair.ranking_snapshots_residual_trigger_anon_authenticated,true);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.rankingAclLaterAppliedRepair.ranking_snapshots_residual_maintain_anon_authenticated,true);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.rankingAclLaterAppliedRepair.public_schema_create_anon_authenticated,false);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.anonymousWriteGrant.runtime_function_execute_role,"service_role_only");
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.anonymousWriteGrant.public_execute_allowed,false);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.anonymousWriteGrant.postgres_null_comparison_returns_unknown,true);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.anonymousWriteGrant.legacy_sql_explicit_all_six_null_guards_present,false);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.anonymousWriteGrant.locally_derived_legacy_function_tokens,747);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.anonymousWriteGrant.locally_derived_legacy_function_token_equivalent_to_hosted,true);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.anonymousWriteGrant.synthetic_pg17_native_sql_execution_attested,true);
assert.equal(sameVersionTriage.p0DeployedScopeFollowup.rankingAclLaterAppliedRepair.synthetic_pg17_native_sql_execution_attested,true);
const sec05HomeAcceptance=sameVersionTriage.syntheticPg17HomeAcceptance;
assert.equal(sec05HomeAcceptance.status,"SCOPED_SEC05_AND_RANKING_ACL_SYNTHETIC_DOCKER_PG17_PASS");
assert.equal(sec05HomeAcceptance.pinnedGithubCommit,"0832a7f964cb68aa7fb057eba654343f46214cfa");
assert.equal(sec05HomeAcceptance.postgreSQL17RunnerFinalMarker,true);
assert.equal(sec05HomeAcceptance.rankingAclRevokeRollbackPass,true);
assert.equal(sec05HomeAcceptance.legacyNullCheckDirectMarkerPresentInTranscript,false);
assert.equal(sec05HomeAcceptance.entire178RowMigrationHistoryReplayed,false);
assert.equal(sec05HomeAcceptance.hostedReleaseAuthorized,false);
assert.ok(content(sec05HomeAcceptance.evidenceDocument).includes("D8K13_HOME_PG17_TEST_PASS"));
const crawlerTax8RankAudit=JSON.parse(content(
 "scripts/product-evidence/baselines/d8k13-crawler-taxonomy8-ranking-source-lineage-readonly-20261017.json"));
assert.equal(crawlerTax8RankAudit.schema,"D8K13_CRAWLER_TAX8_RANKING_LINEAGE_READONLY_V1");
assert.equal(crawlerTax8RankAudit.status,"RELEASE_HOLD");
assert.equal(crawlerTax8RankAudit.rawHostedSqlIncluded,false);
assert.equal(crawlerTax8RankAudit.hostedDbWrites,0);
assert.equal(crawlerTax8RankAudit.productionReleaseAuthorized,false);
assert.equal(crawlerTax8RankAudit.whole178RowMigrationReplayAccepted,false);
const crawlerHistory=crawlerTax8RankAudit.crawler;
const crawlerSqlSource=content(crawlerHistory.currentRepoFile);
const crawlerBytes=Buffer.from(crawlerSqlSource,"utf8");
const crawlerBlobSha=createHash("sha1").update(
 Buffer.from("blob "+crawlerBytes.length+"\0","utf8")).update(crawlerBytes).digest("hex");
assert.equal(crawlerBlobSha,crawlerHistory.currentRepoGitBlobSha,
 "D8K13_CRAWLER_SOURCE_BLOB_SHA_CHANGED");
assert.equal(crawlerHistory.differencesAreOnlySixEndSemicolonInsertions,true);
assert.equal(crawlerHistory.repoLexerTokens-crawlerHistory.historicalLexerTokens,6);
const crawlerEndLines=[...crawlerSqlSource.matchAll(/\bend;\s*\$\$/gi)]
 .map(m=>crawlerSqlSource.slice(0,m.index).split("\n").length);
assert.deepEqual(crawlerEndLines,crawlerHistory.expectedRepositorySourceLines);
assert.equal(crawlerEndLines.length,6);
assert.equal(crawlerHistory.fullNativePg17ReplayAttested,false);
assert.equal(crawlerTax8RankAudit.sourceRankings.sourceRankingsGrantExplicitHistoryRows,0);
assert.equal(crawlerTax8RankAudit.sourceRankings.sourceRankingsRevokeExplicitHistoryRows,0);
assert.equal(crawlerTax8RankAudit.sourceRankings.historicalExplicitAclProvenanceResolved,false);
assert.equal(crawlerTax8RankAudit.sourceRankings.currentAnonWrite,false);
assert.equal(crawlerTax8RankAudit.sourceRankings.currentRlsEnabled,true);
assert.equal(crawlerTax8RankAudit.taxonomy8.currentNonExactProjectionCount,11);
assert.equal(crawlerTax8RankAudit.taxonomy8.currentNonExactShadowOnly,10);
assert.equal(crawlerTax8RankAudit.taxonomy8.currentNonExactNonNullCategory,1);
assert.equal(crawlerTax8RankAudit.taxonomy8.currentNonExactNonNullWithoutCanonicalAssignment,1);
assert.equal(crawlerTax8RankAudit.taxonomy8.currentNonExactNonNullLegacyCategory,"sunscreen");
assert.equal(crawlerTax8RankAudit.taxonomy8.currentNonExactNonNullOriginType,"official_product_page");
assert.equal(crawlerTax8RankAudit.taxonomy8.currentNonExactCreatedBefore20260914,0);
assert.equal(crawlerTax8RankAudit.taxonomy8.historicalPreflightExecutedAttested,false);
assert.ok(content(crawlerTax8RankAudit.repeatableSelectOnlySql)
 .includes("D8K13_CRAWLER_TAX8_RANKING_HISTORY_READONLY_V1"));
const securityAdvisors=JSON.parse(content(
 "scripts/product-evidence/baselines/d8k13-hosted-security-advisors-readonly-20261017.json"));
assert.equal(securityAdvisors.schema,"D8K13_HOSTED_SECURITY_ADVISORS_READONLY_V1");
assert.equal(securityAdvisors.status,"SECURITY_REVIEW_HOLD");
assert.equal(securityAdvisors.productionSecuritySettingsChanged,false);
assert.equal(securityAdvisors.lintTypes,5);
assert.equal(securityAdvisors.totalFindings,82);
assert.equal(securityAdvisors.lints.filter(x=>x.level==="WARN")
 .reduce((sum,x)=>sum+x.count,0),5);
assert.equal(securityAdvisors.adminHelperBoundaries.length,2);
assert.ok(securityAdvisors.adminHelperBoundaries.every(x=>
 x.securityDefiner===true&&x.authenticatedExecute===true&&
 x.anonExecute===false&&x.publicExecute===false&&
 x.escalationDemonstrated===false));
assert.equal(securityAdvisors.securityOwnerReviewCompleted,false);
assert.equal(securityAdvisors.backupsAndPitrRestorabilityVerified,false);
assert.equal(securityAdvisors.productionReleaseAuthorized,false);
const multiSourceGap=JSON.parse(content(
 "scripts/product-evidence/baselines/d8k13-two-multistatement-source-drift-readonly-20261017.json"));
assert.equal(multiSourceGap.schema,"D8K13_TWO_MULTISTATEMENT_SOURCE_GAP_READONLY_V1");
assert.equal(multiSourceGap.status,"RELEASE_HOLD");
assert.equal(multiSourceGap.hostedRawSqlPublished,false);
assert.equal(multiSourceGap.hostedDbWrites,0);
assert.equal(multiSourceGap.previouslyUnresolvedMultiStatementFiles,2);
assert.equal(multiSourceGap.allNonDelimiterTokenEditsExplained,true);
assert.equal(multiSourceGap.nativePg17HistoricalSqlReplayAttested,false);
assert.equal(multiSourceGap.productionReleaseAuthorized,false);
const rankingMultiGap=multiSourceGap.files.find(x=>x.migrationVersion==="20260621030000");
const sec05MultiGap=multiSourceGap.files.find(x=>x.migrationVersion==="20260711032649");
assert.ok(rankingMultiGap&&sec05MultiGap);
for(const file of [rankingMultiGap,sec05MultiGap]){
 const raw=Buffer.from(content(file.sourceFile),"utf8");
 const sha=createHash("sha1").update(Buffer.from("blob "+raw.length+"\0","utf8"))
  .update(raw).digest("hex");
 assert.equal(sha,file.gitBlobSha,"D8K13_TWO_MULTISTATEMENT_CURRENT_GIT_SOURCE_CHANGED");
 assert.equal(file.gitLexerTokens-file.hostedLexerTokens,file.tokenDeltaGitMinusHosted);
 assert.equal(file.gitOnlyChangeRegions,file.gitOnlyRegions.length);
}
assert.deepEqual(rankingMultiGap.gitOnlyRegions.map(x=>x.line),[48,71,119,338]);
assert.equal(rankingMultiGap.appliedRepairStatusGuardObserved,true);
assert.equal(rankingMultiGap.historicalSourceRankingsAclCreationAndRevocationProven,false);
assert.deepEqual(sec05MultiGap.gitOnlyRegions.map(x=>x.line),[220,391,413,472,494]);
assert.equal(sec05MultiGap.liveRoutines.length,3);
assert.ok(sec05MultiGap.liveRoutines.every(x=>
 x.hasAllSixExplicitNullGuards===false&&x.usesIsDistinctFrom===false&&
 x.serviceRoleExecute===true&&x.anonExecute===false&&
 x.authenticatedExecute===false));
assert.equal(sec05MultiGap.homeDockerPg17CompleteAndFailInputContractNativeAttested,false);
assert.ok(content(multiSourceGap.docs).includes("두 SQL 이력의 실제 비구분자 차이"));
const historicalNames=new Set(appliedSnapshot.migrations.map(x=>x.name));
const historicalVersions=new Set(appliedSnapshot.migrations.map(x=>x.version));
const migrationFiles=readdirSync(path.join(ROOT,"supabase/migrations"))
 .filter(name=>name.endsWith(".sql"));
const localItems=migrationFiles.map(file=>{
 const parts=/^(\d{8}(?:\d{6})?)_(.+)\.sql$/.exec(file);
 if(!parts)throw Error("D8K13_UNKNOWN_MIGRATION_FILENAME: "+file);
 return {file,version:parts[1],name:parts[2]};
});
const unmatchedLocalVersions=localItems.filter(x=>!historicalVersions.has(x.version));
const unmatchedLocalNames=localItems.filter(x=>!historicalNames.has(x.name));
const historicalOnlyNames=appliedSnapshot.migrations
 .filter(x=>!localItems.some(y=>y.name===x.name));
const duplicateLocalVersions=localItems
 .filter((x,i)=>localItems.findIndex(y=>y.version===x.version)!==i);
const historyDrift=unmatchedLocalVersions.length>0||
 unmatchedLocalNames.length>0||
 historicalOnlyNames.length>0||duplicateLocalVersions.length>0;

assert.ok(defaultLegacyRefusal&&exactManifest,
 "D8K13_PRECONDITION_OR_MANIFEST_GUARD_MISSING");
const result={
 stage:"D8K13_RELEASE_SEQUENCE_DIAGNOSTIC",
 status:"HOLD",
 localStaticOnly:true,
 hostedDatabaseQueried:false,
 hostedDatabaseWrites:0,
 v2BeforeD8K13:v2First,
 v2CreatesGuardedTables:createsV2,
 d8k13RecognizesV2Objects:d8k13RefusesV2,
 conditionalInertV2CompatibilityCandidate:inertV2CompatibilityCandidate,
 actualV2MigrationChainTestPresent:realChainFixtureIncluded,
 unresolvedStaticSequenceConflict:unresolvedStaticConflict,
 pinnedReadOnlyMigrationSnapshotDate:appliedSnapshot.observed_date_kst,
 pinnedLastAppliedMigrationVersion:appliedSnapshot.last_applied_version,
 localMigrationFileCount:localItems.length,
 pinnedAppliedMigrationCount:appliedSnapshot.migrations.length,
 localVersionsMissingFromPinnedAppliedHistory:unmatchedLocalVersions.length,
 localNamesMissingFromPinnedAppliedHistory:unmatchedLocalNames.length,
 pinnedAppliedNamesMissingLocally:historicalOnlyNames.length,
 duplicateLocalMigrationVersionOccurrences:duplicateLocalVersions.length,
 fullHistoricalMigrationChainDriftDetected:historyDrift,
 verifiedDifferentVersionSqlBodyMatches:34,
 differentVersionPairsWithCurrentSqlDrift:7,
 hostedOnlyAppliedSqlBodiesRecoverableFromRestrictedHistory:34,
 sameVersionSameNameUnverifiedSqlBodies:provenance.summaries.sameVersionNameUnmatched,
 sameVersionSqlDriftTriageStored:true,
 sameVersionMultiStatementParserReassemblyPending:28,
 sameVersionMultiStatementLexerTokenMatch:26,
 sameVersionMultiStatementLexerDrift:2,
 sameVersionMultiStatementDriftRegionsAccountedFor:9,
 rankingOriginalRevokeGrantAndStatusGuardsMissingFromFirstAppliedHistory:true,
 rankingStatusGuardLaterAppliedAndCurrentlyPresent:true,
 sec05LegacyRpcFunctionsNotHardenedInHosted:3,
 sec05CompleteFailNativeNegativeContractRunPending:true,
 rankingSnapshotHistoricalAclStepMissingInStoredStatements:true,
 liveAnonymousClaimExplicitNullGuardNotObserved:true,
 laterRankingSnapshotAclRepairAppliedAndObserved:true,
 rankingSnapshotPublicResidualReferencesTriggerMaintainUnresolved:true,
 rankingSnapshotPublicResidualAclRemediationNotAuthorized:true,
 sec05AndRankingSecuritySyntheticPg17FixtureReady:true,
 sec05AndRankingSecurityNativePg17RunAttested:true,
 sec05AndRankingSecurityFullHistoryAccepted:false,
 sec05AndRankingSecurityHostedMigrationAuthorized:false,
 anonymousClaimOnlyServiceRoleExecutable:true,
 anonymousServerTokenHmacAndCookieBindingStaticallyVerified:true,
 anonymousClaimNullGuardRemediationNotAuthorized:true,
 sameVersionSingleStatementTerminalDelimiterOnly:6,
 sameVersionSingleStatementTokenMatches:5,
 sameVersionSingleStatementEdgeNewlineBlobMatches:6,
 sameVersionCrawlerFunctionParserReviewPending:1,
 pinnedCrawlerSixTerminalSemicolonsLexicallyIsolated:true,
 crawlerFullNativeHistoricalReplayAccepted:false,
 sourceRankingsCurrentPublicWriteDenied:true,
 sourceRankingsHistoricalAclOriginStillUnverified:true,
 pinnedTaxonomy8NonExactPostMigrationProducts:11,
 pinnedTaxonomy8NonExactPreMigrationProducts:0,
 pinnedTaxonomy8NonNullProjectionFollowupCount:1,
 pinnedNonNullSunscreenWithoutCanonicalAssignmentCount:1,
 pinnedSecurityAdvisorWarnFindings:5,
 authenticatedSecurityDefinerAdminHelpersReviewPending:2,
 leakedPasswordProtectionSettingReviewPending:true,
 securityAdvisorFindingIsNotAutomaticExploitProof:true,
 taxonomy8HistoricalPreflightAttested:false,
 c5bHistoricalMigrationPreAndPostGuardsAttested:false,
 historicalProvenanceAllowsDeployment:false,
 fullHistoricalMigrationChainReleaseApproved:false,
 actualPG17ChainAcceptanceVerifiedByThisScript:false,
 currentHostedLastAppliedVersion:"NOT_CHECKED_BY_THIS_SCRIPT",
 backupsAndRestoreVerified:false,
 securityIssue1208Resolved:false,
 independentReviewerValidated:false,
 productionReleaseAuthorized:false,
 next:"Reconcile 153 local / 178 pinned applied history, 49 unmatched versions and 34 applied-only names, then separately review hosted dry-run, backup/restore, reviewer, supply-chain #1208 and full-chain PG17 before any release"
};
console.log(JSON.stringify(result));
if(args[0]==="--enforce-release"){
 console.error("D8K13_RELEASE_HOLD: native PG17 ordered chain, independent backup/reviewer/security and deployment approval not attested here");
 process.exitCode=3;
}
