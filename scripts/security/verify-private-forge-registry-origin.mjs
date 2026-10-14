#!/usr/bin/env node
/**
 * B2: independently verify registry tarball bytes (sha512) against canonical
 * committed npm lock. Does not patch or install tarball, publish or waive audit.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"security/vendor/node-forge/source-manifest.json"),"utf8"));
const lock=JSON.parse(fs.readFileSync(path.join(root,"package-lock.json"),"utf8"));
const entry=lock.packages["node_modules/node-forge"];
assert.equal(entry.version,"1.4.0");
assert.equal(entry.integrity,manifest.originalLockIntegritySha512);
assert.equal(entry.resolved,manifest.originalRegistryTarball);
assert.equal(manifest.distributionApproved,false);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"bejewely-b1-node-forge-registry-"));
try {
  const p=spawnSync("npm",["pack","node-forge@1.4.0","--ignore-scripts","--json",
    "--pack-destination",tmp,"--no-audit","--no-fund"],{
    cwd:tmp,encoding:"utf8",timeout:100000,maxBuffer:1024*1024,
    env:{...process.env,CI:"1",npm_config_update_notifier:"false"},
  });
  assert.equal(p.error,undefined,"npm registry pack unavailable; fail closed");
  assert.equal(p.status,0,"npm pack did not succeed; fail closed");
  let out;
  try {out=JSON.parse(p.stdout);} catch{throw new Error("npm pack JSON unreadable");}
  assert.ok(Array.isArray(out)&&out.length===1,"unexpected npm package results");
  assert.equal(out[0].name,"node-forge");
  assert.equal(out[0].version,"1.4.0");
  const filename=out[0].filename;
  assert.equal(filename,"node-forge-1.4.0.tgz","unexpected downloaded tarball name");
  const tar=path.join(tmp,filename);
  const st=fs.lstatSync(tar);
  assert.ok(st.isFile()&&!st.isSymbolicLink(),"tarball must be regular file");
  assert.ok(st.size>1000 && st.size<20*1024*1024,"unexpected tarball size");
  const data=fs.readFileSync(tar);
  const digest="sha512-"+createHash("sha512").update(data).digest("base64");
  assert.equal(digest,entry.integrity,"registry tarball hash differs from locked bytes");

  // Verify path inventory without extracting untrusted compressed content.
  const t=spawnSync("tar",["-tzf",tar],{
    cwd:tmp,encoding:"utf8",timeout:10000,maxBuffer:1024*1024,
  });
  assert.equal(t.error,undefined,"tar listing failed");
  assert.equal(t.status,0,"invalid archive; fail closed");
  const names=t.stdout.split("\n").filter(Boolean);
  assert.ok(names.length>4&&names.length<3000,"unexpected file inventory");
  for(const n of names){
    assert.ok(n.startsWith("package/"),"unexpected archive root");
    assert.ok(!n.includes("..")&&!n.includes("\\")&&!n.startsWith("/"),
      "unacceptable archive member path");
  }
  for(const required of ["package/package.json","package/lib/rsa.js",
    "package/lib/index.js"]){
    assert.ok(names.includes(required),"missing original source file: "+required);
  }
  console.log("SCA_B2_FORGE_REGISTRY_ORIGIN="+JSON.stringify({
    stage:"B2_ORIGINAL_TARBALL_ONLY",name:"node-forge",version:"1.4.0",
    originalTarballSha512:digest,packageFiles:names.length,
    bundledDistEntries:names.filter(n=>n.startsWith("package/dist/")).length,
    archiveDirectoryEntrypointsVerified:true,independentLockTarballIntegrity:true,
    auditedPatchedArtifact:false,licenseReviewed:false,
    vulnerabilityRemediated:false,conclusion:"SOURCE_REGISTRY_INTEGRITY_PASS_NOT_A_PATCH_RELEASE",
  }));
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
