#!/usr/bin/env node
/**
 * B2 upstream full Node unit suite: run SHA-pinned reviewed PR #1152 tests
 * with a disposable copy of npm-ci node-forge 1.4.0 whose only changed source
 * is the reviewed RSA patch. No changes to package.json / lock / audit.
 *
 * Browser dist rebuild and package-publish provenance are NOT proven here.
 */
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {materializePrivateForgeSource} from "./materialize-private-forge-source.mjs";
const SHA="ceba34402e329f0365134f23fe19898756527d65";
const GIT="https://github.com/digitalbazaar/forge.git";
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"bejewely-b2-upstream-suite-"));
const checkout=path.join(tmp,"upstream");
const candidate=path.join(tmp,"patched");
const harness=path.join(tmp,"test-runner");
const sha256=data=>createHash("sha256").update(data).digest("hex");
const run=(exe,args,cwd,timeout=90000,env=process.env)=>{
 const res=spawnSync(exe,args,{cwd,env,encoding:"utf8",timeout,maxBuffer:8*1024*1024});
 assert.equal(res.error,undefined,"command error/timeout: "+exe);
 assert.equal(res.status,0,"command failed: "+exe+" "+(res.stderr||"").slice(-1800)+
   "\n"+(res.stdout||"").slice(-1600));
 return res.stdout.trim();
};
try{
 fs.mkdirSync(checkout);fs.mkdirSync(candidate);fs.mkdirSync(harness);
 const source=materializePrivateForgeSource(candidate);
 run("git",["init","-q"],checkout,15000);
 run("git",["fetch","--depth=1",GIT,SHA],checkout,90000);
 run("git",["checkout","-q","--detach","FETCH_HEAD"],checkout,15000);
 assert.equal(run("git",["rev-parse","HEAD"],checkout,15000),SHA,
   "unreviewed test source commit");
 const expected=sha256(fs.readFileSync(path.join(checkout,"lib/rsa.js")));
 assert.equal(sha256(fs.readFileSync(path.join(candidate,"lib/rsa.js"))),expected,
   "materialized B2 source differs from actual upstream review branch");
 // Replace upstream lib with our actual original-install 1.4.0 patched copy,
 // preventing upstream master prerelease changes in other sources from being
 // mistaken for the tested candidate.
 fs.rmSync(path.join(checkout,"lib"),{recursive:true,force:true});
 fs.cpSync(path.join(candidate,"lib"),path.join(checkout,"lib"),{recursive:true});
 fs.writeFileSync(path.join(harness,"package.json"),JSON.stringify({
  name:"bejewely-b2-test-only",private:true,version:"0.0.0",
  dependencies:{mocha:"5.2.0","opts":"1.2.7"}
 },null,2)+"\n");
 run("npm",["install","--ignore-scripts","--no-fund","--no-audit","--package-lock=false"],
  harness,160000,{...process.env,npm_config_update_notifier:"false"});
 const output=run(process.execPath,[path.join(harness,"node_modules/mocha/bin/mocha"),
   "--timeout","30000","--reporter","dot","tests/unit/index.js"
 ],checkout,240000,{...process.env,NODE_PATH:path.join(harness,"node_modules"),NODE_OPTIONS:""});
 const found=[...output.matchAll(/(\d+)\s+passing\b/g)];
 assert.ok(found.length>0,"no passing-count summary from forge upstream unit suite");
 const passed=Number(found[found.length-1][1]);
 console.log("SCA_B2_UPSTREAM_SUITE_COUNT="+JSON.stringify({
   testsPassed:passed,outputTail:output.slice(-800),
   expectedTestEntrypoint:"tests/unit/index.js"
 }));
 assert.ok(passed>=100,"incomplete node-forge full Node unit suite");
 console.log("SCA_B2_UPSTREAM_SUITE="+JSON.stringify({
  state:"PASS_FULL_UPSTREAM_NODE_UNIT_SUITE_AGAINST_B2_CANDIDATE",
  upstreamTestCommit:SHA,patchedRsaBlobSha1:source.patchedRsaBlobSha1,
  mochaVersion:"5.2.0",testsPassed:passed,
  patchedLibOnly:true,originalLockUnmodified:true,
  browserDistNotAttested:true,packageReleaseNotApproved:true
 }));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
