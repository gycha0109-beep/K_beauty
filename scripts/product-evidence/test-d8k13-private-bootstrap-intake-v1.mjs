#!/usr/bin/env node
// No hosted credentials. All candidate files generated in OS temp and deleted.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {inspectD8k13PrivateBootstrapCandidate,verifyD8k13OriginalSourceInventory} from
 "./verify-d8k13-private-bootstrap-intake-v1.mjs";
const root=resolve(fileURLToPath(new URL("../..",import.meta.url)));
const gate=verifyD8k13OriginalSourceInventory(root);
assert.equal(gate.originalBootstrapFound,false);
assert.equal(gate.releaseAuthorized,false);
const temp=mkdtempSync(join(tmpdir(),"d8k13-intake-fixture-"));
try{
 const artifactPath=join(temp,"untrusted-candidate.sql");
 const manifestPath=join(temp,"untrusted-manifest.json");
 const ddl=[
  "create table public.products (id uuid primary key);",
  "create table public.product_candidates (id uuid primary key);",
  "create table public.source_rankings (id uuid primary key);"
 ].join("\n")+"\n";
 function writeFixture(raw=ddl,overrides={}){
  const bytes=Buffer.from(raw);
  writeFileSync(artifactPath,bytes);
  const m={schema:"D8K13_PRIVATE_BOOTSTRAP_CANDIDATE_V1",
   targetProjectRef:"bygrczggxfuisupcevaz",
   sourceKind:"ORIGINAL_BOOTSTRAP_SQL_CLAIMED",
   custodyLocation:"PRIVATE_EXTERNAL_NOT_REPOSITORY",
   firstAppliedMigrationVersion:"20260410",
   preFirstMigrationSchemaClaim:true,independentlyApprovedForReplay:false,
   releaseAuthorized:false,rawArtifactUploadedToGit:false,
   byteLength:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),
   ...overrides};
  writeFileSync(manifestPath,JSON.stringify(m));
 }
 function inspect(){return inspectD8k13PrivateBootstrapCandidate({root,artifactPath,manifestPath});}
 writeFixture();
 const candidate=inspect();
 assert.equal(candidate.status,"CANDIDATE_ONLY_NOT_ATTESTED");
 assert.equal(candidate.hashVerified,true);
 assert.equal(candidate.foundationalCreateTablePatterns,3);
 assert.equal(candidate.sourceAuthenticityVerified,false);
 assert.equal(candidate.approvedForSqlExecution,false);
 assert.equal(candidate.releaseAuthorized,false);
 writeFixture(ddl,{sha256:"0".repeat(64)});
 assert.throws(inspect,/D8K13_PRIVATE_INTAKE_ARTIFACT_SHA256_MISMATCH/);
 writeFixture(ddl,{byteLength:ddl.length+1});
 assert.throws(inspect,/D8K13_PRIVATE_INTAKE_ARTIFACT_SIZE_MISMATCH/);
 writeFixture(ddl,{independentlyApprovedForReplay:true});
 assert.throws(inspect,/D8K13_PRIVATE_INTAKE_REPLAY_APPROVAL_CANNOT_COME_FROM_MANIFEST/);
 writeFixture(ddl,{targetProjectRef:"different-project"});
 assert.throws(inspect,/D8K13_PRIVATE_INTAKE_TARGET_PROJECT_MISMATCH/);
 writeFixture("create table public.products (id uuid primary key);\n");
 assert.throws(inspect,/D8K13_PRIVATE_INTAKE_FOUNDATIONAL_TABLE_DDL_INCOMPLETE/);
 writeFixture("-- intentionally synthetic fixture\n"+ddl);
 assert.throws(inspect,/D8K13_PRIVATE_INTAKE_SYNTHETIC_FIXTURE_REJECTED/);
 writeFixture();
 assert.throws(()=>inspectD8k13PrivateBootstrapCandidate({
  root,artifactPath:join(root,"supabase/migrations/20260410_safe_review_and_promotion_layer.sql"),
  manifestPath}),/D8K13_PRIVATE_INTAKE_REPO_ARTIFACT_FORBIDDEN/);
 const cli=spawnSync(process.execPath,[
  join(root,"scripts/product-evidence/verify-d8k13-private-bootstrap-intake-v1.mjs"),
  "--enforce-release"
 ],{encoding:"utf8",timeout:10000});
 assert.equal(cli.status,3);
 assert.match(cli.stdout,/D8K13_PRIVATE_BOOTSTRAP_EVIDENCE_INTAKE_HOLD/);
 assert.match(cli.stderr,/D8K13_PRIVATE_BOOTSTRAP_RELEASE_REFUSED/);
 console.log(JSON.stringify({status:"PASS_HOLD",cases:9,
  externalCandidateMayBeHashedWithoutExecutingSql:true,
  candidateCannotBecomeAttestedFromSelfClaims:true,releaseRefusalExitCode:3,
  originalBootstrapRecovered:false,productionWrites:0}));
 console.log("D8K13_PRIVATE_BOOTSTRAP_INTAKE_SELFTEST_PASS_HOLD");
}finally{rmSync(temp,{recursive:true,force:true});}
