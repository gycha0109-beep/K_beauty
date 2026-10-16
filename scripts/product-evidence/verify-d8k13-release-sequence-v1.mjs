#!/usr/bin/env node
// D8K-13 deployment-sequence diagnostic. LOCAL FILES ONLY; no network,
// no SQL, no secrets, no remote state, no mutation. This gate is intentionally
// a HOLD until the chronology conflict and operational approvals are resolved.
import assert from "node:assert/strict";
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
 rankingSnapshotHistoricalAclStepMissingInStoredStatements:true,
 liveAnonymousClaimExplicitNullGuardNotObserved:true,
 laterRankingSnapshotAclRepairAppliedAndObserved:true,
 rankingSnapshotPublicResidualReferencesTriggerMaintainUnresolved:true,
 rankingSnapshotPublicResidualAclRemediationNotAuthorized:true,
 anonymousClaimOnlyServiceRoleExecutable:true,
 anonymousServerTokenHmacAndCookieBindingStaticallyVerified:true,
 anonymousClaimNullGuardRemediationNotAuthorized:true,
 sameVersionSingleStatementTerminalDelimiterOnly:6,
 sameVersionSingleStatementTokenMatches:5,
 sameVersionSingleStatementEdgeNewlineBlobMatches:6,
 sameVersionCrawlerFunctionParserReviewPending:1,
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
