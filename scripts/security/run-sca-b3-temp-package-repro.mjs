#!/usr/bin/env node
/**
 * B3: two reproducible, quarantined npm tarballs; NEVER publish or install into
 * the application. Deliberately preserves original package names/versions so
 * no scanner-name masking can be mistaken for vulnerability remediation.
 * Artifacts live only in the OS temp directory and are removed on exit.
 */
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {materializePrivateBracesSource} from "./materialize-private-braces-source.mjs";
import {materializePrivateForgeSource} from "./materialize-private-forge-source.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"bejewely-sca-b3-"));
const sha=(bytes,type="sha256")=>createHash(type).update(bytes).digest("hex");
const sha512=(bytes)=>"sha512-"+createHash("sha512").update(bytes).digest("base64");
const run=(exe,args,cwd,limit=120000)=>{
 const result=spawnSync(exe,args,{cwd,encoding:"utf8",timeout:limit,maxBuffer:8*1024*1024,
   env:{...process.env,CI:"true",npm_config_update_notifier:"false",NODE_OPTIONS:""}});
 assert.equal(result.error,undefined,exe+" failed/timeout");
 assert.equal(result.status,0,exe+" failed: "+(result.stderr||"").slice(-1500));
 return result.stdout.trim();
};
const isSecretPath=(p)=>p.split("/").some(s=>
 /^(?:\.env(?:\.|$)|\.npmrc$|\.netrc$|id_rsa$|id_ed25519$|.*\.(?:pem|p12|pfx|key)$)/i.test(s));
function inventory(dir){
 const files={};let total=0;
 function visit(current,rel=""){
  for(const entry of fs.readdirSync(current,{withFileTypes:true})){
   const p=path.posix.join(rel,entry.name),absolute=path.join(current,entry.name);
   assert.ok(!entry.isSymbolicLink(),"symlink in candidate: "+p);
   assert.ok(!isSecretPath(p),"secret-like candidate path: "+p);
   if(entry.isDirectory()){assert.notEqual(entry.name,"node_modules");visit(absolute,p);}
   else{
    assert.ok(entry.isFile(),"unexpected filesystem type: "+p);
    const data=fs.readFileSync(absolute);
    assert.ok(data.length<=16*1024*1024,"oversize candidate file: "+p);
    assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\s\S]{80,}-----END /m.test(data.toString("utf8")),
      "embedded private key in "+p);
    files[p]=sha(data);total+=data.length;
    assert.ok(Object.keys(files).length<1000 && total<100*1024*1024,"candidate resource ceiling exceeded");
   }
  }
 }
 visit(dir);
 return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));
}
function licenseFiles(dir){
 return fs.readdirSync(dir).filter(x=>/^(licen[sc]e|copying|notice)(?:[.-].*)?$/i.test(x));
}
function assertLicense(source,candidate,name){
 const licenses=licenseFiles(source);
 assert.ok(licenses.length>0,name+" source license missing: manual review required");
 for(const l of licenses){
  assert.ok(fs.statSync(path.join(source,l)).isFile());
  assert.equal(sha(fs.readFileSync(path.join(source,l))),sha(fs.readFileSync(path.join(candidate,l))),
    name+" license changed");
 }
 return licenses;
}
function removeAllowedLifecycle(pkgDir,name){
 const fp=path.join(pkgDir,"package.json");
 const pkg=JSON.parse(fs.readFileSync(fp,"utf8"));
 const lifecycle=new Set(["preinstall","install","postinstall","prepublish","prepublishOnly",
 "prepare","prepack","postpack","preuninstall","postuninstall"]);
 const found=Object.keys(pkg.scripts||{}).filter(s=>lifecycle.has(s)).sort();
 // Metadata removal is explicitly reviewed; unexpected new hooks block packing.
 assert.deepEqual(found,name==="node-forge"?["prepublish"]:[],
   name+" lifecycle metadata drift; manual review required");
 for(const hook of found)delete pkg.scripts[hook];
 if(found.length)fs.writeFileSync(fp,JSON.stringify(pkg,null,2)+"\n");
 assert.deepEqual(Object.keys(pkg.scripts||{}).filter(s=>lifecycle.has(s)),[]);
 return found;
}
function makeSource(name,folder){
 const target=path.join(folder,"package");
 fs.mkdirSync(target);
 if(name==="braces"){
  const reviewed=materializePrivateBracesSource(target);
  assert.deepEqual(reviewed.modifiedFiles.slice().sort(),[
   "lib/compile.js","lib/constants.js","lib/expand.js","lib/parse.js","lib/stringify.js"]);
  assert.equal(reviewed.installedSourceUntouched,true);
 }else{
  assert.equal(name,"node-forge");
  const original=path.join(root,"node_modules/node-forge");
  const patch=path.join(folder,"isolated-rsa-source");
  fs.mkdirSync(patch);
  const reviewed=materializePrivateForgeSource(patch);
  assert.equal(reviewed.installedOriginalUnchanged,true);
  // Start from the complete official npm-ci installed package: preserve
  // its license/NOTICE/README/flash and every non-dist consumer entrypoint.
  fs.cpSync(original,target,{recursive:true,force:false,errorOnExist:true});
  const before=inventory(target);
  const dist=Object.keys(before).filter(p=>p.startsWith("dist/"));
  assert.equal(dist.length,6,"original node-forge browser dist count drift");
  assert.ok(dist.every(p=>/\.min\.js(?:\.map)?$/.test(p)),
   "unexpected original dist entry: "+dist.join(","));
  fs.copyFileSync(path.join(patch,"lib/rsa.js"),path.join(target,"lib/rsa.js"));
  fs.rmSync(path.join(target,"dist"),{recursive:true});
  assert.ok(!fs.existsSync(path.join(target,"dist")),"stale prebuilt browser distribution");
  const after=inventory(target);
  const changed=Object.keys(before).filter(p=>before[p]!==after[p]).sort();
  assert.deepEqual(changed,["lib/rsa.js",...dist].sort(),
   "node-forge candidate modified files outside pinned RSA and quarantined browser dist");
  assert.equal(sha(fs.readFileSync(path.join(target,"lib/rsa.js"))),reviewed.patchedRsaSha256);
 }
 const source=path.join(root,"node_modules",name);
 const licenses=assertLicense(source,target,name);
 const originalPkg=JSON.parse(fs.readFileSync(path.join(source,"package.json"),"utf8"));
 const candidatePkg=JSON.parse(fs.readFileSync(path.join(target,"package.json"),"utf8"));
 assert.equal(candidatePkg.name,name);
 assert.equal(candidatePkg.version,originalPkg.version);
 const removedHooks=removeAllowedLifecycle(target,name);
 return {directory:target,licenses,removedLifecycleHooks:removedHooks,
  sourcePin:JSON.parse(fs.readFileSync(path.join(root,"security/vendor",name,"source-manifest.json"),"utf8"))};
}
function verifyActualPackedForgeConsumer(unpackedPackage,work){
 const original=path.join(root,"node_modules/@expo/code-signing-certificates");
 const originalPkg=JSON.parse(fs.readFileSync(path.join(original,"package.json"),"utf8"));
 assert.equal(originalPkg.version,"0.0.6","Expo signing consumer drift");
 const fixture=path.join(work,"packed-forge-expo-consumer");
 const signing=path.join(fixture,"@expo/code-signing-certificates");
 const modules=path.join(fixture,"node_modules");
 fs.mkdirSync(signing,{recursive:true});
 fs.mkdirSync(modules,{recursive:true});
 fs.symlinkSync(unpackedPackage,path.join(fixture,"node-forge"),"dir");
 fs.symlinkSync(unpackedPackage,path.join(modules,"node-forge"),"dir");
 fs.copyFileSync(path.join(original,"package.json"),path.join(signing,"package.json"));
 fs.cpSync(path.join(original,"build"),path.join(signing,"build"),{recursive:true});
 // The original B2 child checks the vulnerable original, *then* verifies
 // normal/wrong-message/malformed DigestInfo + real Expo signing using the
 // candidate. Here it runs against bytes unpacked from the actual npm .tgz.
 const output=run(process.execPath,[
  path.join(root,"scripts/security/verify-private-forge-probe-child.mjs"),fixture
 ],root,70000);
 assert.match(output,/SCA_B2_PRIVATE_FORGE_BEHAVIOR=PASS/,
   "actual packed forge RSA and Expo consumer checks did not pass");
 const packed=fs.readFileSync(path.join(unpackedPackage,"lib/rsa.js"));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,
   "security/vendor/node-forge/source-manifest.json"),"utf8"));
 const b=createHash("sha1").update(Buffer.concat([Buffer.from("blob "+packed.length+"\\0"),packed])).digest("hex");
 assert.equal(b,manifest.upstreamPatch.patchedRsaJsGitBlobSha1,
   "tarball RSA bytes differ from upstream reviewed Git blob");
 return {result:"PASS_PACKED_RSA_AND_EXPO_CONSUMER",
   actualTarballBytes:true,expoConsumerVersion:originalPkg.version,
   rsaSourceGitBlobSha1:b,distBundleNotAttested:true};
}
function packOne(name,iteration){
 const work=path.join(tmp,name+"-"+iteration);
 fs.mkdirSync(work);
 const source=makeSource(name,work);
 const packedDir=path.join(work,"output");fs.mkdirSync(packedDir);
 const stdout=run("npm",["pack",source.directory,"--ignore-scripts","--json",
    "--offline","--no-audit","--no-fund","--pack-destination",packedDir],work);
 let parsed;
 try{parsed=JSON.parse(stdout);}catch{throw new Error("npm pack JSON invalid: "+stdout.slice(-300));}
 assert.ok(Array.isArray(parsed)&&parsed.length===1,"unexpected npm pack count");
 const p=parsed[0];
 assert.equal(p.name,name);assert.equal(p.version,source.sourcePin.originalVersion);
 assert.ok(typeof p.filename==="string"&&/^[a-z0-9.-]+\.tgz$/.test(p.filename));
 const archive=path.join(packedDir,p.filename);
 assert.ok(fs.lstatSync(archive).isFile()&&!fs.lstatSync(archive).isSymbolicLink());
 const archiveBytes=fs.readFileSync(archive);
 const paths=run("tar",["-tzf",archive],work,12000).split("\n").filter(Boolean);
 assert.ok(paths.length>=8&&paths.length<1000);
 for(const n of paths){
  assert.ok(n.startsWith("package/")&&!n.includes("\\")&&!path.posix.isAbsolute(n));
  assert.ok(!n.split("/").includes("..")&&!isSecretPath(n),"unsafe archive member "+n);
  if(name==="node-forge")assert.ok(!n.startsWith("package/dist/"),
    "unpatched browser bundle leaked to release");
 }
 assert.ok(paths.includes("package/package.json"));
 assert.ok(paths.includes("package/lib/rsa.js")||name==="braces");
 const unpack=path.join(work,"unpacked");fs.mkdirSync(unpack);
 run("tar",["-xzf",archive,"-C",unpack,"--no-same-owner","--no-same-permissions"],work,12000);
 const files=inventory(path.join(unpack,"package"));
 assert.ok(Object.keys(files).length>=8);
 for(const [p,h] of Object.entries(files)){
  assert.equal(h,sha(fs.readFileSync(path.join(source.directory,p))),"pack changed input "+p);
 }
 for(const l of source.licenses)assert.equal(files[l],
   sha(fs.readFileSync(path.join(source.directory,l))),"license absent from artifact");
 assert.equal(files["lib/rsa.js"]===undefined,name==="braces",
   "forge RSA file not present in packed artifact");
 const actualPackedForgeConsumer=name==="node-forge"&&iteration===1 ?
   verifyActualPackedForgeConsumer(path.join(unpack,"package"),work) : null;
 const pkg=JSON.parse(fs.readFileSync(path.join(unpack,"package/package.json"),"utf8"));
 assert.equal(pkg.name,name);assert.equal(pkg.version,source.sourcePin.originalVersion);
 assert.deepEqual(Object.keys(pkg.scripts||{}).filter(s=>
  /^(?:preinstall|install|postinstall|prepack|postpack|prepare|prepublish|prepublishOnly)$/.test(s)),[]);
 return {name,version:pkg.version,sourceSha:source.sourcePin.upstreamPatch.headSha,
   sourceOriginalIntegrity:source.sourcePin.originalLockIntegritySha512,
   sha256:sha(archiveBytes),sha512:sha512(archiveBytes),
   artifactBytes:archiveBytes.length,files,
   lifecycleHooksRemoved:source.removedLifecycleHooks,
   actualPackedForgeConsumer,
   licenses:source.licenses,distEntries:paths.filter(x=>x.startsWith("package/dist/")).length,
   provenance:"verified original npm-ci package + pinned minimal source patch",
   privateTempOnly:true,originalAuditStillFailing:true,distributionApproved:false};
}
try{
 const lock=JSON.parse(fs.readFileSync(path.join(root,"package-lock.json"),"utf8"));
 const outputs=[];
 for(const name of ["braces","node-forge"]){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,"security/vendor",name,"source-manifest.json"),"utf8"));
  assert.equal(manifest.distributionApproved,false);
  assert.equal(manifest.vulnerabilityRemediated,false);
  assert.equal(lock.packages["node_modules/"+name].integrity,manifest.originalLockIntegritySha512);
  const first=packOne(name,1),second=packOne(name,2);
  assert.equal(first.sha512,second.sha512,name+" non-reproducible npm tarball");
  assert.deepEqual(first.files,second.files,name+" file byte-level reproducibility failed");
  assert.deepEqual(first.lifecycleHooksRemoved,second.lifecycleHooksRemoved);
  outputs.push(first);
 }
 // B3-scope SBOM: exact archive contents; *not* an installed dependency SBOM.
 const sbom={bomFormat:"CycloneDX",specVersion:"1.6",version:1,
  metadata:{component:{type:"application",name:"BEJEWELY-SCA-B3-isolation",version:"2026-10-14"}},
  components:outputs.map(o=>({type:"library",name:o.name,version:o.version,
   hashes:[{alg:"SHA-256",content:o.sha256},{alg:"SHA-512",content:o.sha512.slice(7)}],
   properties:[{name:"bejewely:source-commit",value:o.sourceSha},
    {name:"bejewely:status",value:"TEMP_ARTIFACT_ONLY_NOT_RELEASED"},
    {name:"bejewely:license-files",value:o.licenses.join(",")},
    {name:"bejewely:content-file-count",value:String(Object.keys(o.files).length)}]}))};
 const receipt={schema:"bejewely.security.sca-b3-temp-pack.v1",
   result:"PASS_TEMP_PACK_REPRODUCIBILITY_ONLY",releaseApproved:false,
   fullAuditPassing:false,fullGraphInstalled:false,browserDistCompatibilityProven:false,
   ownerApproval:"HOLD",artifactsDeletedOnExit:true,sbom,outputs};
 const outByName=Object.fromEntries(outputs.map(p=>[p.name,p]));
 const bracesDigest=outByName.braces.sha256;
 const forgeDigest=outByName["node-forge"].sha256;
 if("SCA_B3_EXPECTED_BRACES_SHA256" in process.env){
  assert.match(process.env.SCA_B3_EXPECTED_BRACES_SHA256,/^[a-f0-9]{64}$/);
  assert.equal(bracesDigest,process.env.SCA_B3_EXPECTED_BRACES_SHA256,
   "independent clean-runner braces package hash drift");
 }
 if("SCA_B3_EXPECTED_FORGE_SHA256" in process.env){
  assert.match(process.env.SCA_B3_EXPECTED_FORGE_SHA256,/^[a-f0-9]{64}$/);
  assert.equal(forgeDigest,process.env.SCA_B3_EXPECTED_FORGE_SHA256,
   "independent clean-runner forge package hash drift");
 }
 if(process.env.GITHUB_OUTPUT){
  fs.appendFileSync(process.env.GITHUB_OUTPUT,
    "braces_sha256="+bracesDigest+"\n"+"node_forge_sha256="+forgeDigest+"\n");
 }
 console.log("SCA_B3_TEMP_PACKAGE_EVIDENCE="+JSON.stringify(receipt));
}finally{
 fs.rmSync(tmp,{recursive:true,force:true});
}
