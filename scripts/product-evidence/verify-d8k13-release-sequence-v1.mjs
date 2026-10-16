#!/usr/bin/env node
// D8K-13 deployment-sequence diagnostic. LOCAL FILES ONLY; no network,
// no SQL, no secrets, no remote state, no mutation. This gate is intentionally
// a HOLD until the chronology conflict and operational approvals are resolved.
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
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
 actualPG17ChainAcceptanceVerifiedByThisScript:false,
 currentHostedLastAppliedVersion:"NOT_CHECKED_BY_THIS_SCRIPT",
 backupsAndRestoreVerified:false,
 securityIssue1208Resolved:false,
 independentReviewerValidated:false,
 productionReleaseAuthorized:false,
 next:"Run synthetic native PG17 actual D8D-v2-before-D8K13 acceptance; then verify hosted dry-run, recoverable backup, manifest, independent reviewer and security issue 1208 before separate operational approval"
};
console.log(JSON.stringify(result));
if(args[0]==="--enforce-release"){
 console.error("D8K13_RELEASE_HOLD: native PG17 ordered chain, independent backup/reviewer/security and deployment approval not attested here");
 process.exitCode=3;
}
