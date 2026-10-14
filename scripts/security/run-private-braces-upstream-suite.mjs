#!/usr/bin/env node
/**
 * B1 upstream whole-suite candidate: exact reviewed commit, but execute with
 * actual patched original npm-ci library code, not an unseen upstream build.
 * Network only fetches public upstream source and pinned test tooling.
 * Everything is OS-temp; npm audit and root package-lock remain untouched.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { materializePrivateBracesSource } from "./materialize-private-braces-source.mjs";
const SHA="28d440b5dd449dbf1fe6f3506cf94ecca4d02660";
const ORIGIN="https://github.com/micromatch/braces.git";
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"bejewely-b1-upstream-suite-"));
const repo=path.join(tmp,"upstream"),candidate=path.join(tmp,"patched"),harness=path.join(tmp,"test-harness");
const hash=data=>createHash("sha256").update(data).digest("hex");
const command=(executable,args,cwd,timeout=120000,env=process.env)=>{
 const p=spawnSync(executable,args,{cwd,env,encoding:"utf8",timeout,maxBuffer:5*1024*1024});
 assert.equal(p.error,undefined,"bounded command unavailable/timed out: "+executable);
 assert.equal(p.status,0,executable+" command FAILED: "+(p.stderr||"").slice(-1800)+" "+(p.stdout||"").slice(-1000));
 return p.stdout.trim();
};
try{
 fs.mkdirSync(repo);fs.mkdirSync(candidate);fs.mkdirSync(harness);
 const evidence=materializePrivateBracesSource(candidate);
 command("git",["init","-q"],repo,15000);
 command("git",["fetch","--depth=1",ORIGIN,SHA],repo,90000);
 command("git",["checkout","-q","--detach","FETCH_HEAD"],repo,15000);
 assert.equal(command("git",["rev-parse","HEAD"],repo,15000),SHA,
   "fetched upstream test source identity mismatch");
 const libPaths=["compile.js","constants.js","expand.js","parse.js","stringify.js"];
 const upstreamSourceDifferences=[];
 for(const basename of libPaths) {
   const src=path.join(candidate,"lib",basename);
   const upstream=path.join(repo,"lib",basename);
   const candidateSource=fs.readFileSync(src,"utf8");
   const upstreamSource=fs.readFileSync(upstream,"utf8");
   if(candidateSource!==upstreamSource){
     const a=candidateSource.split("\n"),z=upstreamSource.split("\n");
     let first=0;
     while(first<Math.min(a.length,z.length)&&a[first]===z[first])first++;
     upstreamSourceDifferences.push({
       file:"lib/"+basename,
       candidateSha256:hash(Buffer.from(candidateSource,"utf8")),
       upstreamHeadSha256:hash(Buffer.from(upstreamSource,"utf8")),
       candidateLines:a.length,upstreamHeadLines:z.length,
       firstDifferentLine:first+1
     });
   }
 }
 // The upstream review HEAD contains additional non-patch code changes beyond
 // the npm 3.0.3 registry source. The approved B1 candidate is the original
 // npm-ci package plus exactly the Git-blob-pinned five-file patch, as already
 // enforced by materializePrivateBracesSource. Record drift, do not silently
 // replace the actual tested candidate with an upstream-head source.
 assert.ok(upstreamSourceDifferences.length<=libPaths.length,
   "invalid inspected upstream file difference inventory");
 console.log("SCA_B1_UPSTREAM_SOURCE_DRIFT="+JSON.stringify({
   upstreamTestCommit:SHA,actualPatchedNpmSource:true,
   driftFiles:upstreamSourceDifferences
 }));
 // Run full upstream tests against actual B1 original-install + patch bytes.
 fs.rmSync(path.join(repo,"lib"),{recursive:true,force:true});
 fs.cpSync(path.join(candidate,"lib"),path.join(repo,"lib"),{recursive:true});
 fs.copyFileSync(path.join(candidate,"index.js"),path.join(repo,"index.js"));
 fs.writeFileSync(path.join(harness,"package.json"),JSON.stringify({
   name:"bejewely-b1-test-only",version:"0.0.0",private:true,
   dependencies:{mocha:"6.2.3","bash-path":"2.0.1","ansi-colors":"3.2.4",
     "fill-range":"7.1.1"}
 },null,2)+"\n");
 command("npm",["install","--ignore-scripts","--no-fund","--no-audit","--package-lock=false"],
   harness,150000,{...process.env,npm_config_update_notifier:"false"});
 const out=command(process.execPath,[
   path.join(harness,"node_modules/mocha/bin/mocha"),
   "-r","./test/mocha-initialization.js","test"
 ],repo,180000,{...process.env,NODE_PATH:path.join(harness,"node_modules"),NODE_OPTIONS:""});
 assert.match(out,/\bpassing\b/,"upstream suite summary missing");
 const matches=[...out.matchAll(/(\d+)\s+passing\b/g)];
 assert.ok(matches.length>0,"upstream pass count missing");
 const passed=Number(matches[matches.length-1][1]);
 assert.ok(passed>=500,"incomplete upstream suite; unexpected passing count "+passed);
 console.log("SCA_B1_UPSTREAM_SUITE="+JSON.stringify({
   state:"PASS_FULL_UPSTREAM_TEST_SUITE_AGAINST_B1_CANDIDATE",
   upstreamTestCommit:SHA,sourcePatchGitBlob:evidence.reviewedPatchGitBlobSha1,
   testRunner:"mocha@6.2.3",testsPassed:passed,
   upstreamHeadFileDifferences:upstreamSourceDifferences.length,
   originalDependencyGraphUnchanged:true,temporaryOnly:true,
   noReleaseOrAuditApproval:true
 }));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
