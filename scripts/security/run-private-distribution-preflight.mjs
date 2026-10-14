#!/usr/bin/env node
/**
 * SEC-SCA B3: REPRODUCIBLE DISPOSABLE PACKAGING CHECK, NOT A RELEASE.
 * Two exact source-pinned B1/B2 candidates are packed twice into OS-temp,
 * SHA-compared, installed by absolute local tarball paths in a fresh test
 * project, and checked byte-by-byte against verified modified source files.
 *
 * This never publishes or substitutes for the root dependency graph, npm
 * audit, release approval, browser bundle remediation or Android evidence.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {materializePrivateBracesSource} from "./materialize-private-braces-source.mjs";
import {materializePrivateForgeSource} from "./materialize-private-forge-source.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"bejewely-b3-private-pack-"));
const digest=(v,algo="sha256")=>createHash(algo).update(v).digest("hex");
const sha512sri=v=>"sha512-"+createHash("sha512").update(v).digest("base64");
const locked=JSON.parse(fs.readFileSync(path.join(root,"package-lock.json"),"utf8"));
const watched=["package.json","package-lock.json","apps/mobile/package.json"];
const originalHashes=watched.map(p=>digest(fs.readFileSync(path.join(root,p))));
function run(bin,args,cwd,timeout=90000){
 const result=spawnSync(bin,args,{
   cwd,encoding:"utf8",timeout,maxBuffer:2*1024*1024,
   env:{...process.env,CI:"true",npm_config_update_notifier:"false",NODE_OPTIONS:""},
 });
 assert.equal(result.error,undefined,bin+" unavailable or timed out");
 assert.equal(result.status,0,bin+" failed: "+(result.stderr||"").slice(0,1200));
 return result.stdout;
}
function listContents(tar,cwd){
 const out=run("tar",["-tzf",tar],cwd,10000);
 const names=out.split("\n").filter(Boolean);
 assert.ok(names.length>2&&names.length<500,"unexpected package contents count");
 assert.equal(new Set(names).size,names.length,"duplicate archive paths");
 for(const file of names){
   assert.ok(file.startsWith("package/")&&
      !file.split("/").includes("..")&&!file.includes("\\")&&
      !file.startsWith("/"),"archive path guard refused content");
 }
 return names;
}
function prepare(name,version,materialize,idx){
 const pkg=path.join(temp,name+"-source-"+idx);
 const output=path.join(temp,name+"-output-"+idx);
 fs.mkdirSync(pkg);fs.mkdirSync(output);
 const source=materialize(pkg);
 // The B2 source-only materializer preserves library provenance but has no
 // release assets. Include only the unmodified original npm-ci LICENSE in
 // this disposable packaging experiment; its contents are under lock integrity.
 if(name==="node-forge"){
   const from=path.join(root,"node_modules/node-forge/LICENSE");
   assert.ok(fs.lstatSync(from).isFile()&&!fs.lstatSync(from).isSymbolicLink(),
     "original npm-ci license file missing");
   const license=fs.readFileSync(from);
   assert.ok(license.includes(Buffer.from("BSD License")),
     "unexpected forge dual-license text; require legal review");
   fs.writeFileSync(path.join(pkg,"LICENSE"),license);
   assert.equal(digest(fs.readFileSync(path.join(pkg,"LICENSE"))),digest(license),
     "copied license bytes mismatch");
 }
 const manifest=JSON.parse(fs.readFileSync(path.join(pkg,"package.json"),"utf8"));
 assert.equal(manifest.name,name);
 assert.equal(manifest.version,version);
 const packed=JSON.parse(run("npm",["pack","--ignore-scripts","--json",
   "--no-audit","--no-fund","--pack-destination",output],pkg));
 assert.ok(Array.isArray(packed)&&packed.length===1,"npm pack result count");
 assert.equal(packed[0].name,name);
 assert.equal(packed[0].version,version);
 const tar=path.join(output,packed[0].filename);
 assert.equal(path.basename(tar),name+"-"+version+".tgz");
 assert.ok(fs.lstatSync(tar).isFile()&&!fs.lstatSync(tar).isSymbolicLink());
 assert.ok(fs.statSync(tar).size>1000&&fs.statSync(tar).size<20*1024*1024);
 const bytes=fs.readFileSync(tar);
 const names=listContents(tar,pkg);
 const required=name==="braces"?
  ["package/package.json","package/index.js",
   "package/lib/parse.js","package/lib/compile.js",
   "package/lib/expand.js","package/lib/stringify.js",
   "package/lib/constants.js"]:
  ["package/package.json","package/lib/index.js","package/lib/rsa.js"];
 for(const f of required)assert.ok(names.includes(f),name+" missing required "+f);
 assert.ok(names.includes("package/LICENSE"),
   name+" candidate does not preserve original LICENSE/NOTICE");
 const builtDist=names.filter(s=>s.startsWith("package/dist/"));
 if(name==="node-forge"){
  // Upstream npm package includes six separately generated browser dist files.
  // This source-only package intentionally includes no stale dist and must
  // never be described as approved replacement for the public node-forge.
  assert.deepEqual(builtDist,[],"unreviewed original browser bundles were packaged");
  assert.equal(source.bundledDistUnchecked,true);
 }
 return {name,version,source,tar,names,size:bytes.length,
   sha256:digest(bytes),sha512:sha512sri(bytes),distEntries:builtDist.length};
}
try{
 const a1=prepare("braces","3.0.3",materializePrivateBracesSource,1);
 const a2=prepare("braces","3.0.3",materializePrivateBracesSource,2);
 const f1=prepare("node-forge","1.4.0",materializePrivateForgeSource,1);
 const f2=prepare("node-forge","1.4.0",materializePrivateForgeSource,2);
 for(const [first,second] of [[a1,a2],[f1,f2]]){
   assert.equal(first.sha512,second.sha512,
     first.name+" tarball is not byte reproducible in independent clean copies");
   assert.deepEqual(first.names,second.names,
     first.name+" pack file listing drift");
 }
 // An isolated, local install exercises the actual tarballs without root
 // package.json/lock, registry publication or npm audit exceptions.
 const install=path.join(temp,"install");
 fs.mkdirSync(install);
 fs.writeFileSync(path.join(install,"package.json"),JSON.stringify({
   name:"bejewely-b3-private-pack-fixture",version:"0.0.0",private:true
 })+"\n");
 run("npm",["install",a1.tar,f1.tar,"--ignore-scripts",
   "--no-audit","--no-fund","--package-lock=false"],install,120000);
 const req=createRequire(path.join(install,"package.json"));
 const bp=req("braces");
 assert.deepEqual(bp.expand("src/{a,b}.js"),["src/a.js","src/b.js"]);
 assert.throws(()=>bp.parse("{".repeat(110)+"a,b"+"}".repeat(110)),
   /exceeds max depth/);
 const fp=req("node-forge");
 assert.equal(typeof fp.pki.publicKeyFromPem,"function");
 const patched={};
 for(const [entry,sourceDir] of [[a1,path.join(install,"node_modules/braces")],
    [f1,path.join(install,"node_modules/node-forge")]]){
   const files=entry.name==="braces"?entry.source.modifiedFiles:["lib/rsa.js"];
   patched[entry.name]={};
   for(const file of files){
     const actual=digest(fs.readFileSync(path.join(sourceDir,file)));
     const expected=entry.name==="braces"?
       entry.source.modifiedFileSha256[file]:entry.source.patchedRsaSha256;
     assert.equal(actual,expected,
       "installed local tarball source differs from reviewed patch: "+file);
     patched[entry.name][file]=actual;
   }
 }
 // Execute the existing independent B1/B2 negative fixtures against the
 // INSTALLED TAR FILES, not their pre-pack temporary source.
 const probe=(script,where,limit=45000)=>{
   const p=spawnSync(process.execPath,[path.join(root,"scripts/security",script),where],{
     cwd:root,encoding:"utf8",timeout:limit,maxBuffer:1024*1024,
     env:{...process.env,NODE_OPTIONS:""},
   });
   assert.equal(p.error,undefined,"installed archive behavior fixture timed out");
   assert.equal(p.status,0,"installed archive behavior failure: "+(p.stderr||"").slice(0,1200));
   return p.stdout;
 };
 assert.match(probe("verify-private-braces-probe-child.mjs",
   path.join(install,"node_modules/braces"),30000),
   /SCA_B1_BRACES_BEHAVIOR=PASS/);
 const probeDir=path.join(temp,"installed-forge-expo-probe");
 fs.mkdirSync(probeDir);
 const patchedForge=path.join(install,"node_modules/node-forge");
 fs.symlinkSync(patchedForge,path.join(probeDir,"node-forge"),"dir");
 fs.mkdirSync(path.join(probeDir,"node_modules"));
 fs.symlinkSync(patchedForge,path.join(probeDir,"node_modules/node-forge"),"dir");
 const expoOriginal=path.join(root,"node_modules/@expo/code-signing-certificates");
 const expoCopy=path.join(probeDir,"@expo/code-signing-certificates");
 fs.mkdirSync(expoCopy,{recursive:true});
 fs.copyFileSync(path.join(expoOriginal,"package.json"),path.join(expoCopy,"package.json"));
 fs.cpSync(path.join(expoOriginal,"build"),path.join(expoCopy,"build"),{recursive:true});
 assert.match(probe("verify-private-forge-probe-child.mjs",probeDir),
   /SCA_B2_PRIVATE_FORGE_BEHAVIOR=PASS/);
 const integrity=[a1,f1].map(entry=>{
   assert.equal(locked.packages["node_modules/"+entry.name].version,entry.version);
   return {name:entry.name,version:entry.version,
     tarballSha256:entry.sha256,tarballSha512:entry.sha512,
     unpackedFileCount:entry.names.length,
     installedPatchedFileSha256:patched[entry.name],
     byteIdenticalAcrossTwoPacks:true,
     patchedSourceVerifiedInIsolatedInstall:true,
     installedTarballSecurityFixturePass:true,
     missingBrowserDist:entry.name==="node-forge",
   };
 });
 assert.deepEqual(watched.map(p=>digest(fs.readFileSync(path.join(root,p)))),
   originalHashes,"canonical manifest/lock changed during B3");
 console.log("SCA_B3_PRIVATE_PACKAGE_PREFLIGHT="+JSON.stringify({
   state:"PASS_DISPOSABLE_PACK_AND_INSTALL_ONLY",
   packages:integrity,originalManifestAndLockUnchanged:true,
   npmAuditNotBypassed:true,publicRegistryPublication:false,
   nodeForgeBrowserDistRemainsUnrebuilt:true,
   auditedRelease:false,
   decision:"B3_DISTRIBUTION_HOLD_UNTIL_DIST_PROVENANCE_LICENSE_SECURITY_REVIEW",
 }));
}finally{
 fs.rmSync(temp,{recursive:true,force:true});
}
