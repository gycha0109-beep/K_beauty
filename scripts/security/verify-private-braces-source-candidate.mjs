#!/usr/bin/env node
/**
 * B1 candidate: reproducibly patch only temp source with byte-pinned hunk,
 * then test its behavior in a bounded subprocess. No npm dependency mutation,
 * artifact publication, policy change or successful security audit assertion.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { materializePrivateBracesSource } from "./materialize-private-braces-source.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),"bejewely-b1-braces-"));
const dest=path.join(scratch,"braces");
fs.mkdirSync(dest);
const tracked=["package.json","package-lock.json","apps/mobile/package.json"];
const hashes=()=>tracked.map(rel=>createHash("sha256")
  .update(fs.readFileSync(path.join(root,rel))).digest("hex"));
const original=hashes();
try{
  const e=materializePrivateBracesSource(dest);
  assert.equal(e.installedSourceUntouched,true);
  // Only the disposable negative-test source links dependencies installed
  // from the unchanged npm-ci lock. Do not pack or publish this symlink.
  fs.symlinkSync(path.join(root,"node_modules"),path.join(dest,"node_modules"),"dir");
  const script=path.join(root,"scripts/security/verify-private-braces-probe-child.mjs");
  const proc=spawnSync(process.execPath,[script,dest],{
    cwd:root,encoding:"utf8",timeout:30000,maxBuffer:1024*1024,
    env:{...process.env,NODE_OPTIONS:""},
  });
  assert.equal(proc.error,undefined,"bounded braces probe failed or timed out");
  assert.equal(proc.status,0,
    "braces regression failed: "+(proc.stderr||"").slice(0,1300));
  assert.match(proc.stdout,/SCA_B1_BRACES_BEHAVIOR=PASS/);
  assert.deepEqual(hashes(),original,"npm manifests or original lock were modified");
  console.log("SCA_B1_PRIVATE_BRACES_CANDIDATE="+JSON.stringify({
    ...e,behavior:"PASS_BOUNDED_CHILD",
    originalManifestAndLockUnchanged:true,
    conclusion:"B1_SOURCE_CANDIDATE_BEHAVIOR_PASS_NOT_RELEASE_OR_REMEDIATION",
  }));
}finally{
  fs.rmSync(scratch,{recursive:true,force:true});
}
