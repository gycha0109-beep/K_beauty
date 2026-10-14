#!/usr/bin/env node
/**
 * B4 disposable npm-resolver feasibility probe using the *original vulnerable*
 * npm-ci packages only. It is NOT an install of reviewed B3 patches.
 *
 * Never write to source repo, publish archives, or treat npm audit HIGH0
 * (possible with file: packages) as security remediation. Everything is
 * built/installed under OS temp and removed on exit.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"bejewely-sca-b4-resolver-"));
const names=Object.freeze(["braces","node-forge"]);
const sha=b=>createHash("sha256").update(b).digest("hex");
const mandatory=(cmd,args,cwd,timeout=150000)=>{
  const s=spawnSync(cmd,args,{cwd,timeout,encoding:"utf8",maxBuffer:4*1024*1024,
    env:{...process.env,CI:"true",npm_config_update_notifier:"false",NODE_OPTIONS:""}});
  assert.equal(s.error,undefined,cmd+" timeout or spawn failure");
  assert.equal(s.status,0,"SC_SCA_B4_RESOLVER_COMMAND_FAILED:"+cmd+":status="+s.status);
  return s.stdout.trim();
};
function copyWorkspaces(lock,location) {
  for(const locationKey of Object.keys(lock.packages)){
    if(!/^(apps|packages|tools)\/[^/]+$/.test(locationKey))continue;
    const from=path.join(root,locationKey,"package.json");
    const to=path.join(location,locationKey,"package.json");
    assert.ok(fs.statSync(from).isFile(),"workspace manifest missing");
    fs.mkdirSync(path.dirname(to),{recursive:true});
    fs.copyFileSync(from,to);
  }
}
function runAudit(location,omitDev){
  const result=spawnSync("npm",["audit","--json",...(omitDev?["--omit=dev"]:[])],{
    cwd:location,encoding:"utf8",timeout:75000,maxBuffer:12*1024*1024,
    env:{...process.env,CI:"true",npm_config_update_notifier:"false",NODE_OPTIONS:""}
  });
  if(result.error||![0,1].includes(result.status))return {status:"AUDIT_UNAVAILABLE_HOLD"};
  try{
    const report=JSON.parse(result.stdout);
    const severity=report?.metadata?.vulnerabilities;
    if(!severity||typeof severity.high!=="number"||typeof severity.critical!=="number")
      return {status:"AUDIT_UNAVAILABLE_HOLD"};
    return {status:"RAW_AUDIT_OBSERVED_NOT_AN_APPROVAL",high:severity.high,
      critical:severity.critical,moderate:severity.moderate??null,
      advisoryNameMaskingPossible:true};
  }catch{return {status:"AUDIT_UNAVAILABLE_HOLD"};}
}
try{
  const sourceLockBytes=fs.readFileSync(path.join(root,"package-lock.json"));
  const sourceManifestBytes=fs.readFileSync(path.join(root,"package.json"));
  const sourceHashes=[sha(sourceLockBytes),sha(sourceManifestBytes)];
  const lock=JSON.parse(sourceLockBytes);
  assert.equal(lock.lockfileVersion,3);
  const shadow=path.join(temp,"shadow-app");
  const packdir=path.join(temp,"original-packages");
  fs.mkdirSync(shadow);fs.mkdirSync(packdir);
  const manifest=JSON.parse(sourceManifestBytes);
  assert.ok(!Object.hasOwn(manifest,"overrides")||
    !names.some(n=>Object.hasOwn(manifest.overrides??{},n)),
    "existing override might change test semantics");
  const archives=Object.create(null);
  const originalHashes=Object.create(null);
  for(const name of names){
    const folder=path.join(root,"node_modules",name);
    const orig=JSON.parse(fs.readFileSync(path.join(folder,"package.json"),"utf8"));
    assert.equal(orig.name,name);
    assert.equal(orig.version,lock.packages["node_modules/"+name].version);
    const inputFile=path.join(folder,name==="braces"?"lib/parse.js":"lib/rsa.js");
    originalHashes[name]=sha(fs.readFileSync(inputFile));
    const pack=JSON.parse(mandatory("npm",[
      "pack",folder,"--ignore-scripts","--offline","--json","--no-audit","--no-fund",
      "--pack-destination",packdir
    ],shadow,45000));
    assert.equal(pack.length,1);
    assert.equal(pack[0].name,name);
    assert.equal(pack[0].version,orig.version);
    const archive=path.join(packdir,pack[0].filename);
    assert.equal(fs.lstatSync(archive).isFile(),true);
    archives[name]={file:archive,sha256:sha(fs.readFileSync(archive))};
  }
  // B4 exploration only: exact copied manifests + root lock, never real root.
  copyWorkspaces(lock,shadow);
  fs.writeFileSync(path.join(shadow,"package.json"),JSON.stringify({
    ...manifest,private:true,overrides:{
      ...(manifest.overrides??{}),
      braces:"file:"+archives.braces.file,
      "node-forge":"file:"+archives["node-forge"].file
    }
  },null,2)+"\n");
  fs.copyFileSync(path.join(root,"package-lock.json"),
    path.join(shadow,"package-lock.json"));
  mandatory("npm",["install","--package-lock-only","--ignore-scripts",
    "--no-audit","--no-fund","--prefer-offline"],shadow,165000);
  // npm may preserve an old transitive registry resolution in the copied
  // lock when the package version does not change. Retry with npm's resolver
  // command, without hand-editing lock entries or changing repo manifests.
  mandatory("npm",["update","node-forge","--package-lock-only",
    "--ignore-scripts","--no-audit","--no-fund","--prefer-offline"],shadow,165000);
  const candidateLock=JSON.parse(fs.readFileSync(path.join(shadow,"package-lock.json"),"utf8"));
  assert.equal(candidateLock.lockfileVersion,3);
  const candidateEntries=Object.create(null);
  for(const name of names){
    const entries=Object.entries(candidateLock.packages)
      .filter(([p])=>p==="node_modules/"+name||p.endsWith("/node_modules/"+name));
    assert.ok(entries.length>0,"CANDIDATE_PACKAGE_MISSING:"+name);
    // Emit only fixed scheme kinds and counts: never temp file paths or URLs.
    const byScheme=Object.fromEntries(["FILE","REGISTRY","OTHER","NONE"].map(x=>[x,0]));
    for(const [,v] of entries){
      const u=v.resolved;
      const kind=typeof u!=="string"?"NONE":u.startsWith("file:")?"FILE":
        u.startsWith("https:")?"REGISTRY":"OTHER";
      byScheme[kind]++;
    }
    console.log("SEC_SCA_B4_RESOLVER_PACKAGE_SHAPE="+JSON.stringify({
      package:name,copyCount:entries.length,resolutionKindCounts:byScheme}));
    assert.ok(byScheme.FILE===entries.length,
      "CANDIDATE_RESOLVER_DID_NOT_USE_TARBALL:"+name);
    candidateEntries[name]=entries.length;
  }
  // Actually physically install a *known vulnerable* all-workspaces
  // application graph in the disposable shadow location.
  mandatory("npm",["ci","--ignore-scripts","--no-audit","--no-fund",
    "--prefer-offline"],shadow,180000);
  const physical=Object.create(null);
  for(const name of names){
    const folder=path.join(shadow,"node_modules",name);
    const pkg=JSON.parse(fs.readFileSync(path.join(folder,"package.json"),"utf8"));
    assert.equal(pkg.name,name);
    assert.equal(pkg.version,lock.packages["node_modules/"+name].version);
    const actual=sha(fs.readFileSync(path.join(folder,
      name==="braces"?"lib/parse.js":"lib/rsa.js")));
    assert.equal(actual,originalHashes[name],
      "candidate original bytes did not match intentionally vulnerable baseline");
    physical[name]={installed:true,byteIdenticalToOriginal:true,sourceSha256:actual};
  }
  // Independent audit observation, NOT a green security admission gate.
  const full=runAudit(shadow,false),production=runAudit(shadow,true);
  const rootAfter=[sha(fs.readFileSync(path.join(root,"package-lock.json"))),
    sha(fs.readFileSync(path.join(root,"package.json")))];
  assert.deepEqual(rootAfter,sourceHashes,"SOURCE_APP_FILES_MODIFIED");
  const receipt={
    status:"ISOLATED_NPM_OVERRIDE_RESOLVER_PHYSICAL_INSTALL_PASS_SECURITY_HOLD",
    candidatePackagesFrom:"UNMODIFIED_KNOWN_VULNERABLE_ORIGINALS",
    originalRepoManifestAndLockUnmodified:true,
    candidatePackageNameAndVersionUnchanged:true,
    resolvedFileArchivePaths: candidateEntries,
    physicallyInstalledOriginalSource:physical,
    rawAuditFull:full,rawAuditProduction:production,
    hasProvenPatchedSource:false,privateArtifactApproved:false,
    lockedVulnerableCodeRemoved:false,securityGatePassed:false,
    npmAuditPolicyChanged:false,rootLockMutation:false,
    productionDeploymentAuthorized:false,artifactsDeletedOnExit:true
  };
  console.log("SEC_SCA_B4_ORIGINAL_RESOLVER_FEASIBILITY="+JSON.stringify(receipt));
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}
