#!/usr/bin/env node
/**
 * Reproducible isolated node-forge B2 preflight: exact patch source provenance,
 * disposable Expo code-signing consumer and bounded behavioral child process.
 * No release artifact, root lock, npm audit exception or production key.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {materializePrivateForgeSource} from "./materialize-private-forge-source.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),"bejewely-b2-forge-"));
const dest=path.join(scratch,"node-forge");
const consumer=path.join(scratch,"@expo/code-signing-certificates");
const tracked=["package.json","package-lock.json","apps/mobile/package.json"];
const hashes=()=>tracked.map(p=>createHash("sha256").update(fs.readFileSync(path.join(root,p))).digest("hex"));
const initial=hashes();
try{
 fs.mkdirSync(dest,{recursive:true});
 const e=materializePrivateForgeSource(dest);
 assert.ok(e.installedOriginalUnchanged,"original forge changed");
 fs.mkdirSync(consumer,{recursive:true});
 const originalConsumer=path.join(root,"node_modules/@expo/code-signing-certificates");
 const lock=JSON.parse(fs.readFileSync(path.join(root,"package-lock.json"),"utf8"));
 const signingEntry=lock.packages["node_modules/@expo/code-signing-certificates"];
 assert.equal(signingEntry.version,"0.0.6","Expo signing dependency version drift");
 assert.equal(JSON.parse(fs.readFileSync(path.join(originalConsumer,"package.json"),"utf8")).version,"0.0.6");
 for(const filename of ["package.json"]){
  fs.copyFileSync(path.join(originalConsumer,filename),path.join(consumer,filename));
 }
 fs.cpSync(path.join(originalConsumer,"build"),path.join(consumer,"build"),{recursive:true});
 const localModules=path.join(scratch,"node_modules");
 fs.mkdirSync(localModules);
 fs.symlinkSync(dest,path.join(localModules,"node-forge"),"dir");
 const consumerRequire=createRequire(path.join(consumer,"package.json"));
 assert.equal(fs.realpathSync(consumerRequire.resolve("node-forge")),
   fs.realpathSync(path.join(dest,"lib/index.js")),
   "Expo consumer did not resolve isolated patched node-forge");
 const child=path.join(root,"scripts/security/verify-private-forge-probe-child.mjs");
 const p=spawnSync(process.execPath,[child,scratch],{
   cwd:root,encoding:"utf8",timeout:45000,maxBuffer:1024*1024,
   env:{...process.env,NODE_OPTIONS:""},
 });
 assert.equal(p.error,undefined,"B2 child timeout/error");
 assert.equal(p.status,0,"B2 RSA/Expo test failed: "+(p.stderr||"").slice(0,1400));
 assert.match(p.stdout,/SCA_B2_PRIVATE_FORGE_BEHAVIOR=PASS/);
 assert.deepEqual(hashes(),initial,"original manifest or lock mutated");
 console.log("SCA_B2_PRIVATE_FORGE_CANDIDATE="+JSON.stringify({
   ...e,expoConsumer:"0.0.6",isolatedConsumerResolution:true,
   behavior:"PASS_BOUNDED_CHILD",originalManifestAndLockUnmodified:true,
   conclusion:"B2_SOURCE_PREFLIGHT_PASS_NOT_A_RELEASE_OR_VULNERABILITY_REMEDIATION",
 }));
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
