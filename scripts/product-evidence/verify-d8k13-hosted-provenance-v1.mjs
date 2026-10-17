#!/usr/bin/env node
// D8K-13 historic migration provenance audit: OFFLINE ONLY.
// Provenance was established from read-only hosted statement fingerprints
// and GitHub source blob IDs on 2026-10-16. This program does NOT query
// hosted DB, read credentials, export historic SQL, or authorize a release.
import {verifyD8k13ExtendedHomeEvidence} from "./verify-d8k13-sec05-extended-home-evidence-v1.mjs";
import {verifyD8k13P0AclTaxonomyProvenance} from "./verify-d8k13-p0-acl-taxonomy-provenance-v1.mjs";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,readdirSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const migrationsDir=join(ROOT,"supabase/migrations");
const taxP0Followup=verifyD8k13P0AclTaxonomyProvenance(ROOT);
assert.equal(taxP0Followup.releaseAuthorized,false);
const extendedSec05Home=verifyD8k13ExtendedHomeEvidence(ROOT);
const provenance=JSON.parse(readFileSync(join(ROOT,
 "scripts/product-evidence/baselines/d8k13-hosted-migration-provenance-readonly-20261016.json"),"utf8"));
const args=process.argv.slice(2);
if(args.length>1||args.some(x=>!["--full","--enforce-release","--help"].includes(x)))
 throw Error("D8K13_UNKNOWN_PROVENANCE_DIAGNOSTIC_ARG");
if(args.includes("--help")){
 console.log("node scripts/product-evidence/verify-d8k13-hosted-provenance-v1.mjs [--full|--enforce-release]");
 process.exit(0);
}
assert.equal(provenance.schema,"D8K13_HOSTED_MIGRATION_SOURCE_PROVENANCE_V1");
assert.equal(provenance.status,"RELEASE_HOLD");
assert.equal(provenance.sourceSqlBodiesPublished,false);
const sameVersionTriage=JSON.parse(readFileSync(join(ROOT,
 "scripts/product-evidence/baselines/d8k13-hosted-same-version-sql-triage-readonly-20261016.json"),"utf8"));
assert.equal(sameVersionTriage.schema,"D8K13_SAME_VERSION_SQL_TRIAGE_READONLY_V1");
assert.equal(sameVersionTriage.status,"RELEASE_HOLD");
assert.equal(sameVersionTriage.sourceSqlBodiesPublished,false);
assert.equal(sameVersionTriage.summary.sameVersionAndNameButBlobNotDirectMatch,
 provenance.summaries.sameVersionNameUnmatched);
assert.equal(sameVersionTriage.summary.joinReassemblyNotProven,28);
assert.equal(sameVersionTriage.summary.singleStatementDifferent,18);
assert.equal(sameVersionTriage.entries.length,46);
const multiFollowup=sameVersionTriage.multiStatementTokenFollowup;
assert.equal(multiFollowup.evaluated,28);
assert.equal(multiFollowup.tokenExact,1);
assert.equal(multiFollowup.tokenSameExceptSingleFinalSemicolon,25);
assert.equal(multiFollowup.tokenDifference,2);
assert.deepEqual([...multiFollowup.mismatchedFiles].sort(),[
 "20260621030000_phase1_ranking_snapshot_pipeline.sql",
 "20260711032649_sec_05_anonymous_write_grants.sql"
]);
const p0=sameVersionTriage.p0DeployedScopeFollowup;
assert.equal(p0.taxonomy8.historicalSqlBytes,64);
assert.equal(p0.taxonomy8.hostedCategoryNullable,true);
assert.equal(p0.c5b.historicalFunctionTokensMatchGit,1203);
assert.equal(p0.c5b.runtimeFunctionTokensMatchGit,1203);
assert.equal(p0.ranking.anonAndAuthenticatedDirectWrites,false);
assert.equal(p0.anonymousWriteGrant.exploitabilityProven,false);
const entries=readdirSync(migrationsDir).filter(x=>x.endsWith(".sql"));
const unique=new Set(entries);
assert.equal(unique.size,entries.length);
assert.equal(entries.length,provenance.summaries.local);
assert.equal(provenance.versionChanged.length,41);
assert.equal(provenance.remoteOnly.length,34);
function gitBlobSha(buffer){
 return createHash("sha1")
  .update(Buffer.from("blob "+buffer.length+"\0","utf8"))
  .update(buffer).digest("hex");
}
const focusedHistory=JSON.parse(readFileSync(join(ROOT,
 "scripts/product-evidence/baselines/d8k13-crawler-taxonomy8-ranking-source-lineage-readonly-20261017.json"),"utf8"));
assert.equal(focusedHistory.schema,"D8K13_CRAWLER_TAX8_RANKING_LINEAGE_READONLY_V1");
assert.equal(focusedHistory.status,"RELEASE_HOLD");
assert.equal(focusedHistory.rawHostedSqlIncluded,false);
assert.equal(focusedHistory.hostedDbWrites,0);
assert.equal(focusedHistory.productionReleaseAuthorized,false);
assert.equal(focusedHistory.whole178RowMigrationReplayAccepted,false);
const crawler=focusedHistory.crawler;
const crawlerSource=readFileSync(join(ROOT,crawler.currentRepoFile));
assert.equal(gitBlobSha(crawlerSource),crawler.currentRepoGitBlobSha,
 "D8K13_CRAWLER_SOURCE_CHANGED_SINCE_HOSTED_LEXER_AUDIT");
assert.equal(crawler.differencesAreOnlySixEndSemicolonInsertions,true);
assert.equal(crawler.historicalLexerTokens,5072);
assert.equal(crawler.repoLexerTokens,5078);
assert.equal(crawler.fullNativePg17ReplayAttested,false);
const crawlerEndLines=[...crawlerSource.toString("utf8").matchAll(/\bend;\s*\$\$/gi)]
 .map(m=>crawlerSource.toString("utf8").slice(0,m.index).split("\n").length);
assert.deepEqual(crawlerEndLines,crawler.expectedRepositorySourceLines,
 "D8K13_CRAWLER_EXPECTED_SIX_END_SEMICOLONS_CHANGED");
assert.equal(crawlerEndLines.length,6);
assert.equal(focusedHistory.sourceRankings.hostedHistoryRowCount,178);
assert.equal(focusedHistory.sourceRankings.sourceRankingsGrantExplicitHistoryRows,0);
assert.equal(focusedHistory.sourceRankings.sourceRankingsRevokeExplicitHistoryRows,0);
assert.equal(focusedHistory.sourceRankings.sourceRankingsCreateTableExplicitHistoryRows,0);
assert.equal(focusedHistory.sourceRankings.historicalExplicitAclProvenanceResolved,false);
assert.equal(focusedHistory.sourceRankings.currentAnonWrite,false);
assert.equal(focusedHistory.sourceRankings.currentRlsEnabled,true);
assert.equal(focusedHistory.taxonomy8.currentProductTotal,176);
assert.equal(focusedHistory.taxonomy8.currentNonExactProjectionCount,11);
assert.equal(focusedHistory.taxonomy8.currentNonExactShadowOnly,10);
assert.equal(focusedHistory.taxonomy8.currentNonExactNonNullCategory,1);
assert.equal(focusedHistory.taxonomy8.currentNonExactNonNullWithoutCanonicalAssignment,1);
assert.equal(focusedHistory.taxonomy8.currentNonExactNonNullLegacyCategory,"sunscreen");
assert.equal(focusedHistory.taxonomy8.currentNonExactNonNullOriginType,"official_product_page");
assert.equal(focusedHistory.taxonomy8.currentNonExactCreatedBefore20260914,0);
assert.equal(focusedHistory.taxonomy8.historicalPreflightExecutedAttested,false);
const focusedQuery=readFileSync(join(ROOT,focusedHistory.repeatableSelectOnlySql),"utf8");
assert.ok(focusedQuery.includes("D8K13_CRAWLER_TAX8_RANKING_HISTORY_READONLY_V1"));
assert.ok(focusedQuery.includes("release_authorized',false"));
const twoGaps=JSON.parse(readFileSync(join(ROOT,
 "scripts/product-evidence/baselines/d8k13-two-multistatement-source-drift-readonly-20261017.json"),"utf8"));
assert.equal(twoGaps.schema,"D8K13_TWO_MULTISTATEMENT_SOURCE_GAP_READONLY_V1");
assert.equal(twoGaps.status,"RELEASE_HOLD");
assert.equal(twoGaps.hostedRawSqlPublished,false);
assert.equal(twoGaps.hostedDbWrites,0);
assert.equal(twoGaps.previouslyUnresolvedMultiStatementFiles,2);
assert.equal(twoGaps.files.length,2);
assert.equal(twoGaps.allNonDelimiterTokenEditsExplained,true);
assert.equal(twoGaps.nativePg17HistoricalSqlReplayAttested,false);
assert.equal(twoGaps.productionReleaseAuthorized,false);
const rankGap=twoGaps.files.find(x=>x.migrationVersion==="20260621030000");
const sec05Gap=twoGaps.files.find(x=>x.migrationVersion==="20260711032649");
assert.ok(rankGap&&sec05Gap,"D8K13_TWO_HISTORIC_DRIFT_FILES_MISSING");
for(const item of [rankGap,sec05Gap]){
 assert.equal(gitBlobSha(readFileSync(join(ROOT,item.sourceFile))),item.gitBlobSha,
  "D8K13_HISTORIC_SQL_DIFF_SOURCE_SHA_DRIFT_"+item.name);
 assert.equal(item.gitLexerTokens-item.hostedLexerTokens,item.tokenDeltaGitMinusHosted);
 assert.equal(item.gitOnlyChangeRegions,item.gitOnlyRegions.length);
 assert.equal(item.localOnlyTerminalSemicolonTokens,1);
}
assert.equal(rankGap.gitOnlyChangeRegions,4);
assert.deepEqual(rankGap.gitOnlyRegions.map(x=>x.line),[48,71,119,338]);
assert.equal(rankGap.appliedRepairStatusGuardObserved,true);
assert.equal(rankGap.liveIngestRankingSnapshotStatusGuardPresent,true);
assert.equal(rankGap.historicalSourceRankingsAclCreationAndRevocationProven,false);
assert.equal(rankGap.productCandidatesExplicitAclHistoryRows,0);
assert.equal(rankGap.productCandidatesCurrentRlsEnabled,true);
assert.equal(rankGap.productCandidatesCurrentPublicSelect,false);
assert.equal(rankGap.productCandidatesCurrentPublicInsert,false);
assert.equal(rankGap.productCandidatesCurrentServiceRoleInsertAndUpdate,true);
assert.equal(rankGap.productCandidatesExplicitAclCreationOriginProven,false);
assert.equal(sec05Gap.gitOnlyChangeRegions,5);
assert.deepEqual(sec05Gap.gitOnlyRegions.map(x=>x.line),[220,391,413,472,494]);
assert.equal(sec05Gap.liveRoutines.length,3);
assert.ok(sec05Gap.liveRoutines.every(x=>
 x.hasAllSixExplicitNullGuards===false&&x.usesIsDistinctFrom===false
 &&x.serviceRoleExecute===true&&x.anonExecute===false
 &&x.authenticatedExecute===false&&x.securityDefiner===false));
assert.equal(sec05Gap.homeDockerPg17SyntheticClaimNullRejectionAttested,true);
assert.equal(sec05Gap.homeDockerPg17CompleteAndFailInputContractNativeAttested,false);

assert.equal(sec05Gap.completeLegacyInstalledTokenCount,224);
assert.equal(sec05Gap.failLegacyInstalledTokenCount,207);
assert.equal(sec05Gap.completeLegacyDerivedTokensEqualLivePgFunctionBody,true);
assert.equal(sec05Gap.failLegacyDerivedTokensEqualLivePgFunctionBody,true);
assert.equal(sec05Gap.completeFailLegacyNullBypassPg17FixtureAuthored,true);
assert.equal(sec05Gap.completeFailHardenedNullMatrixPg17FixtureAuthored,true);
assert.equal(sec05Gap.completeFailNewNativePg17AcceptanceMarkerPresent,false);
assert.equal(sec05Gap.extendedFixtureFiles.length,2);
const extendedSec05Runner=readFileSync(join(ROOT,sec05Gap.extendedRunnerFile),"utf8");
assert.ok(extendedSec05Runner.includes("completionLegacyVariant"));
assert.ok(extendedSec05Runner.includes("sqlBodyTokenCount(oldComplete),224"));
assert.ok(extendedSec05Runner.includes("sqlBodyTokenCount(oldFail),207"));
assert.ok(extendedSec05Runner.includes("D8K13_SEC05_COMPLETE_FAIL_HARDENED_NULL_RETRY_ROLLBACK_PASS"));
const extendedLegacyFixture=readFileSync(join(ROOT,sec05Gap.extendedFixtureFiles[0]),"utf8");
const extendedHardenedFixture=readFileSync(join(ROOT,sec05Gap.extendedFixtureFiles[1]),"utf8");
assert.ok(extendedLegacyFixture.includes("D8K13_SEC05_COMPLETE_FAIL_LEGACY_NULL_BYPASS_ROLLBACK_PASS"));
assert.ok(extendedHardenedFixture.includes("D8K13_SEC05_COMPLETE_FAIL_HARDENED_NULL_MATRIX_RETRY_ROLLBACK_PASS"));

assert.equal(twoGaps.independentSecurityOwnerApproved,false);
const rankOriginal=readFileSync(join(ROOT,rankGap.sourceFile),"utf8");
const sec05Original=readFileSync(join(ROOT,sec05Gap.sourceFile),"utf8");
for(const name of ["ranking_snapshots","source_rankings","product_candidates"]){
 assert.ok(new RegExp("revoke\\s+insert,\\s*update,\\s*delete\\s+on\\s+table\\s+public\\."+name,"i")
  .test(rankOriginal),"D8K13_RANKING_GIT_ONLY_PUBLIC_REVOKE_MISSING_"+name);
}
assert.ok(rankOriginal.includes("ranking_ingest_existing_snapshot_not_ingested"));
for(const name of ["complete_anonymous_write_grant","fail_anonymous_write_grant"])
 assert.ok(sec05Original.includes("function public."+name+"("));
assert.equal((sec05Original.match(/p_jti_hash is null/g)||[]).length,3);
assert.ok((sec05Original.match(/is distinct from p_principal_hash/g)||[]).length>=2);
const triageCategories=new Map();
const triageFiles=new Set();
for(const entry of sameVersionTriage.entries){
 assert.ok(unique.has(entry.local_file),
  "D8K13_TRIAGE_SOURCE_FILE_MISSING: "+entry.local_file);
 assert.ok(!triageFiles.has(entry.local_file),
  "D8K13_TRIAGE_DUPLICATE_SOURCE_FILE: "+entry.local_file);
 triageFiles.add(entry.local_file);
 assert.ok(entry.local_file.startsWith(entry.version+"_"));
 assert.equal(gitBlobSha(readFileSync(join(migrationsDir,entry.local_file))),
  entry.git_blob_sha,
  "D8K13_TRIAGE_SOURCE_CHANGED: "+entry.local_file);
 triageCategories.set(entry.classification,
  (triageCategories.get(entry.classification)??0)+1);
}
for(const [classification,count] of [
 ["MULTI_STATEMENT_SPLIT_REASSEMBLY_NOT_PROVEN",28],
 ["TERMINAL_SQL_DELIMITER_DIFFERENCE_ONLY",6],
 ["SQL_TOKEN_EQUIVALENT_IGNORE_COMMENTS_WHITESPACE",5],
 ["GIT_BLOB_IDENTICAL_AFTER_TRIMMING_EDGE_NEWLINES",6],
 ["DELIMITER_OR_FUNCTION_BODY_DRIFT_REQUIRES_NATIVE_PG17_REVIEW",1]
])assert.equal(triageCategories.get(classification),count,
 "D8K13_TRIAGE_CLASSIFICATION_COUNT_CHANGED: "+classification);
assert.equal(triageCategories.size,5);
const categories={BYTE_IDENTICAL:0,IDENTICAL_PLUS_FINAL_LF:0,DIFFERENT:0};
const historicalRecovery=[];
for(const entry of provenance.versionChanged){
 assert.ok(unique.has(entry.local_file),"D8K13_PINNED_FILE_MISSING: "+entry.local_file);
 const sha=gitBlobSha(readFileSync(join(migrationsDir,entry.local_file)));
 assert.equal(sha,entry.local_git_blob_sha,
  "D8K13_SOURCE_CHANGED_SINCE_PROVENANCE_ATTESTATION: "+entry.local_file);
 assert.ok(Object.hasOwn(categories,entry.comparison));
 categories[entry.comparison]++;
 if(entry.followup==="EXACT_OLDER_GIT_REVISION")
  historicalRecovery.push(entry.name);
}
assert.equal(categories.BYTE_IDENTICAL+categories.IDENTICAL_PLUS_FINAL_LF,34);
assert.equal(categories.DIFFERENT,7);
assert.equal(historicalRecovery.length,1);
const localNames=new Set(entries.map(x=>x.replace(/^\d+_/,"").replace(/\.sql$/,"")));
for(const entry of provenance.remoteOnly){
 assert.ok(!localNames.has(entry.name),
  "D8K13_PREVIOUSLY_MISSING_APPLIED_SQL_NOW_LOCAL: "+entry.name);
 assert.ok(entry.statement_count>=1 && entry.stored_sql_bytes>0);
 // Never print SQL text, passwords, ids, or privately held SQL digests.
}
const result={
 stage:"D8K13_HOSTED_MIGRATION_SOURCE_PROVENANCE_AUDIT",
 status:"HOLD",offlineOnly:true,hostedDbQueried:false,
 productionDbWrites:0,publicSqlBodyExports:0,
 localFilesChecked:entries.length,versionShiftPairs:41,
 currentExactBytes:categories.BYTE_IDENTICAL,
 currentExactExceptFinalLf:categories.IDENTICAL_PLUS_FINAL_LF,
 currentFileDifferent:categories.DIFFERENT,
 exactHistoricalGitRevisionRecovered:historicalRecovery.length,
 appliedOnlyHistoryRows:provenance.remoteOnly.length,
 appliedOnlyHistoryRowsWithStoredSql:provenance.remoteOnly.filter(x=>x.statement_count>0).length,
 nameAndVersionSameButCurrentSqlBodyNotProven:provenance.summaries.sameVersionNameUnmatched,
 sameVersionTriage:{
  splitMultiStatementsNeedsParser:28,
  oneStatementTrailingDelimiterOnly:6,
  oneStatementSqlTokenEquivalent:5,
  oneStatementEdgeNewlinesOnly:6,
  requiresNativePg17ParserReview:1,
  crawlerStoredSourceOnlySixTerminalSemicolonsDifferent:true,
  crawlerNonDelimiterTokensMatched:5072,
  crawlerHistoricalNativeFullReplayAccepted:false,
  multiStatementLexerExact:multiFollowup.tokenExact,
  multiStatementLexerTerminalDelimiterOnly:multiFollowup.tokenSameExceptSingleFinalSemicolon,
  multiStatementLexerDifferent:multiFollowup.tokenDifference,
  storedGitMultiStatementDriftRegionsReconciled:9,
  twoRemainingMultiSqlDiffsNotMerelyDelimiters:true,
  rankingOriginalSecurityPatchMissingFromOriginalHostedHistory:true,
  rankingIngestStatusGuardRecoveredInLaterAppliedMigration:true,
  sec05ClaimCompleteFailCurrentExplicitNullGuardsMissing:3,
  sec05CompleteFailNativeNegativeTestsStillPending:false,
  sec05CompleteFailScopedNativePg17UserReportedPass:extendedSec05Home.scopedSec05CompleteFailNativePg17UserReportedPass,
  sec05PinnedEightBlobCheckPass:extendedSec05Home.sourceCount===8,
  sec05PrivateTranscriptIndependentlyRehashed:false,
  liveAnonymousGrantNullGuardsNotAttested:true
 },
 sourceSqlBodyEquivalentForEntireHistory:false,
 sourceRankingsEffectivePublicWritesDenied:true,
 sourceRankingsHistoricalAclOriginUnproven:true,
 taxonomy8NonExactAllCreatedAfterOriginalMigrationCutoff:11,
 taxonomy8CurrentLegacyProjectionDataQualityReviewCount:1,
 preLedgerCoreTableCreationProvenanceStillUnattested:true,
 sourceAndCandidateCurrentPublicReadWriteDenied:true,
 taxonomy8StructuralPromotionMissingProductCanonicalAssignment:taxP0Followup.taxonomyStructuralWriterGapObserved,
 taxonomy8PolicyOrDirectRepairAuthorized:false,
 pinnedNonNullSunscreenWithoutCanonicalAssignmentCount:1,
 releaseAuthorized:false,
 next:"Crawler historical comparison narrowed to exactly six ending semicolons (native replay not attested); audit source_rankings unrecorded historical ACL origin and one post-migration non-NULL product without exact taxonomy projection. Full 178-row replay/backup/security/reviewer approval remains blocked."
};
if(args[0]==="--full")
 result.currentFileDrifts=provenance.versionChanged.filter(x=>x.comparison==="DIFFERENT")
  .map(x=>({file:x.local_file,status:x.followup}));
console.log(JSON.stringify(result,null,2));
console.log("D8K13_HOSTED_PROVENANCE_READONLY_HOLD");
if(args.includes("--enforce-release")){
 console.error("D8K13_PROVENANCE_RELEASE_REFUSED");
 process.exitCode=3;
}
