#!/usr/bin/env node
/**
 * B3 ONLY: build and independently reproduce disposable npm tarballs from
 * source-pinned B1+B2 candidates. No publish, dependency override or audit
 * bypass. Forge is deliberately source-only: original browser dist is NOT
 * copied and resulting package is categorically NOT approved for release.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {materializePrivateBracesSource} from "./materialize-private-braces-source.mjs";
import {materializePrivateForgeSource} from "./materialize-private-forge-source.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"bejewely-sca-b3-pack-only-"));
const sha=(bytes,algorithm="sha256")=>createHash(algorithm).update(bytes).digest("hex");
const lockInputs=["package.json","package-lock.json","apps/mobile/package.json"];
const currentInputs=()=>lockInputs.map(file=>sha(fs.readFileSync(path.join(root,file))));
const priorInputs=currentInputs();

function run(program,args,cwd,timeout=35000,encoding="utf8"){
 const proc=spawnSync(program,args,{cwd,encoding,timeout,maxBuffer:16*1024*1024,
   env:{...process.env,NODE_OPTIONS:"",npm_config_update_notifier:"false",CI:"1"}});
 assert.equal(proc.error,undefined,program+" failed or timed out");
 assert.equal(proc.status,0,program+" failed: "+
   String(proc.stderr||"").slice(-900)+" "+String(proc.stdout||"").slice(-500));
 return proc.stdout;
}
function regular(filepath){
 const st=fs.lstatSync(filepath);
 assert.ok(st.isFile()&&!st.isSymbolicLink(),"non-regular package source file: "+filepath);
}
function createSource(name,seq){
 const pkgDir=path.join(tmp,name+"-"+seq,"package");
 fs.mkdirSync(pkgDir,{recursive:true});
 const result=name==="braces"
   ?materializePrivateBracesSource(pkgDir)
   :materializePrivateForgeSource(pkgDir);
 if(name==="node-forge"){
   // Source-only candidate must preserve the original legal notice byte-for-byte.
   const license=path.join(root,"node_modules/node-forge/LICENSE");
   regular(license);
   fs.copyFileSync(license,path.join(pkgDir,"LICENSE"));
   assert.equal(sha(fs.readFileSync(license)),
     sha(fs.readFileSync(path.join(pkgDir,"LICENSE"))),"forge license byte drift");
   assert.ok(!fs.existsSync(path.join(pkgDir,"dist")),
     "unreviewed browser dist accidentally included");
 }
 assert.equal(result.installedSourceUntouched??result.installedOriginalUnchanged,true,
   "original npm-ci source changed");
 return {pkgDir,result};
}
function pack(name,seq){
 const {pkgDir,result}=createSource(name,seq);
 const packDir=path.join(tmp,name+"-"+seq,"output");
 fs.mkdirSync(packDir);
 const raw=run("npm",["pack","--ignore-scripts","--json",
   "--pack-destination",packDir,"--no-audit","--no-fund"],
   pkgDir,60000);
 let parsed;
 try{parsed=JSON.parse(raw);}catch{throw new Error("npm pack JSON invalid");}
 assert.ok(Array.isArray(parsed)&&parsed.length===1,"unexpected npm pack output");
 const meta=parsed[0];
 const expectedVersion=name==="braces"?"3.0.3":"1.4.0";
 assert.equal(meta.name,name,"candidate npm identity changed unexpectedly");
 assert.equal(meta.version,expectedVersion,"candidate source version drift");
 assert.equal(meta.filename,name+"-"+expectedVersion+".tgz",
   "unexpected candidate output name");
 const archive=path.join(packDir,meta.filename);
 regular(archive);
 assert.ok(fs.statSync(archive).size>1000 &&
   fs.statSync(archive).size<20*1024*1024,"unsafe candidate archive size");
 const data=fs.readFileSync(archive);
 const files=run("tar",["-tzf",archive],packDir,10000).trim().split("\n");
 assert.ok(files.length>=7&&files.length<500,"invalid candidate file inventory");
 for(const file of files){
   assert.ok(file.startsWith("package/")&&!file.includes("..")&&!file.includes("\\"),
     "unreviewed/unsafe package path: "+file);
 }
 const changed=name==="braces"?result.modifiedFiles:["lib/rsa.js"];
 for(const file of changed){
   const archiveContents=run("tar",["-xOzf",archive,"package/"+file],packDir,10000,null);
   const digest=sha(archiveContents);
   const expected=name==="braces"
     ?result.modifiedFileSha256[file]:result.patchedRsaSha256;
   assert.equal(digest,expected,"packed patched source drift: "+file);
 }
 assert.ok(files.includes("package/LICENSE"),"original LICENSE missing from private package");
 const browserPaths=files.filter(file=>file.startsWith("package/dist/"));
 assert.equal(browserPaths.length,0,"unreviewed browser dist included");
 if(name==="node-forge"){
   // The original registry source contains dist bundles. Their deliberate
   // omission is NOT evidence that web/bundled consumers remain compatible.
   assert.equal(result.bundledDistUnchecked,true);
 }
 return {
   name,version:meta.version,
   tarballSha256:sha(data),tarballSha512:"sha512-"+createHash("sha512").update(data).digest("base64"),
   archiveFiles:files.length,matchedReviewedPatchedSources:changed,
   browserDistFilesIncluded:browserPaths.length,
   sourceOnly:name==="node-forge",
   releaseApproved:false,patchedLibraryEvidence:result
 };
}
try{
 const summaries=[];
 for(const name of ["braces","node-forge"]){
   const first=pack(name,1);
   const second=pack(name,2);
   assert.equal(first.tarballSha256,second.tarballSha256,
     name+" candidate tarball byte reproducibility failed");
   assert.equal(first.tarballSha512,second.tarballSha512,
     name+" second tarball sha512 differed");
   summaries.push({
     package:name,tarballSha256:first.tarballSha256,
     tarballSha512:first.tarballSha512,
     fileCount:first.archiveFiles,
     modifiedFiles:first.matchedReviewedPatchedSources,
     byteReproducedTwice:true,
     originalLicenseCopied:true,
     browserDistIncluded:first.browserDistFilesIncluded,
     sourceOnly:first.sourceOnly,
     releaseApproved:false,
   });
 }
 assert.deepEqual(currentInputs(),priorInputs,
   "committed package manifests or original lock changed");
 console.log("SCA_B3_TEMPORARY_PATCH_PACKAGE="+JSON.stringify({
   state:"PASS_REPRODUCIBLE_SOURCE_ONLY_TEST_PACKAGES",
   packages:summaries,
   originalRepoLockUnmodified:true,
   tempTarballsDeletedOnExit:true,
   registryPublished:false,
   installedIntoApp:false,
   browserDistCompatibility:"NOT_ATTESTED",
   licenseSecurityOwnerApproval:"NOT_ATTESTED",
   npmAuditHighZero:"NOT_ATTESTED",
   conclusion:"B3_ISOLATED_PACKAGING_EVIDENCE_ONLY_RELEASE_HOLD",
 }));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
