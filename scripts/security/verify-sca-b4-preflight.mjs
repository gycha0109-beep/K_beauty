#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {assessScaB4Preflight as assess} from "../../lib/supply-chain-b4-preflight.mjs";
const current=JSON.parse(fs.readFileSync("package-lock.json","utf8"));
const r=assess({lock:current});
assert.equal(r.contract,"sec-sca-b4-lock-and-install-preflight-v1");
assert.equal(r.status,"B4_PREFLIGHT_HOLD");
assert.equal(r.securityGatePassed,false);
assert.equal(r.patchedCodeAttested,false);
assert.equal(r.rawAuditHighZeroAttested,false);
assert.equal(r.privateDistributionApproved,false);
assert.equal(r.rootLockMutation,false);
assert.equal(r.npmAuditPolicyChanged,false);
assert.equal(r.exceptionExpiryChanged,false);
for(const [name,version] of [["braces","3.0.3"],["node-forge","1.4.0"]]){
 const t=r.targets.find(t=>t.package===name);
 assert.ok(t);
 assert.ok(t.knownAffectedCopies>=1, name+" "+version+" must remain a B4 HOLD");
 assert.ok(t.reachableLockCopies>=1);
 assert.ok(t.blockerCodes.includes("KNOWN_AFFECTED_LOCK_VERSION"));
 assert.equal(t.advisoryRemediated,false);
 assert.equal(t.patchedSourceAttested,false);
}
assert.equal(r.unresolvedDependencyEdges,0);
const demo={
 lockfileVersion:3,
 packages:{
  "":{name:"root",dependencies:{"micromatch":"1.0.0","node-forge":"1.4.0"}},
  "node_modules/micromatch":{version:"1.0.0",dependencies:{"braces":"3.0.3"}},
  "node_modules/braces":{version:"3.0.3",resolved:"https://PRIVATE_TOKEN.invalid/braces"},
  "node_modules/node-forge":{version:"1.4.0"},
 },
};
const d=assess({lock:demo});
assert.equal(d.targets.length,2);
assert.equal(d.targets[0].knownAffectedCopies,1);
assert.equal(d.targets[1].knownAffectedCopies,1);
assert.ok(d.blockerCodes.includes("AFFECTED_LOCK_COPIES_PRESENT"));
assert.equal(d.targets[0].declaredInstallPathsCovered,false);
const census={braces:[{path:"node_modules/braces",present:true}],
 "node-forge":[{path:"node_modules/node-forge",present:true}]};
const installed=assess({lock:demo,installed:census});
assert.ok(installed.targets.every(t=>t.declaredInstallPathsCovered));
assert.ok(!installed.blockerCodes.includes("INSTALL_CENSUS_INCOMPLETE"));
assert.equal(installed.securityGatePassed,false);
const namedOnly=structuredClone(demo);
namedOnly.packages["node_modules/braces"].version="9.0.0";
namedOnly.packages["node_modules/node-forge"].version="9.0.0";
const fakeFix=assess({lock:namedOnly,installed:census});
assert.equal(fakeFix.securityGatePassed,false);
assert.equal(fakeFix.rawAuditHighZeroAttested,false);
assert.equal(fakeFix.patchedCodeAttested,false);
assert.ok(fakeFix.blockerCodes.includes("PATCHED_INSTALL_BYTES_NOT_PROVEN"));
assert.ok(fakeFix.blockerCodes.includes("RAW_AUDIT_FULL_AND_PRODUCTION_NOT_PROVEN"));
const renamed=structuredClone(demo);
renamed.packages["node_modules/private-fork"]=renamed.packages["node_modules/braces"];
renamed.packages["node_modules/private-fork"].name="braces";
delete renamed.packages["node_modules/braces"];
const renamedResult=assess({lock:renamed});
assert.equal(renamedResult.securityGatePassed,false);
assert.equal(renamedResult.targets[0].detectedAliasesOrUnknownVersions,1);
assert.ok(renamedResult.blockerCodes.includes("RENAMED_PACKAGE_OR_UNKNOWN_VERSION"));
const nested=structuredClone(demo);
nested.packages["node_modules/micromatch/node_modules/braces"]={version:"3.0.3"};
const nestedResult=assess({lock:nested,installed:census});
assert.equal(nestedResult.targets[0].knownAffectedCopies,2);
assert.equal(nestedResult.targets[0].declaredInstallPathsCovered,false);
const graphHole=structuredClone(demo);
graphHole.packages["node_modules/micromatch"].dependencies.unknownVendor="1.0.0";
const graphResult=assess({lock:graphHole});
assert.ok(graphResult.blockerCodes.includes("DEPENDENCY_GRAPH_INCOMPLETE"));
const opaque=structuredClone(demo);
opaque.packages["node_modules/opaque-fork"]={
  version:"99.0.0",resolved:"file:/tmp/hidden-vulnerable.tgz"
};
const opaqueResult=assess({lock:opaque});
assert.equal(opaqueResult.unidentifiedLocalArchiveEntries,1);
assert.ok(opaqueResult.blockerCodes.includes(
  "UNATTRIBUTED_LOCAL_OR_ALIAS_ARCHIVES_REQUIRE_SOURCE_CENSUS"));
assert.equal(opaqueResult.securityGatePassed,false);
const renamedBoth=structuredClone(demo);
delete renamedBoth.packages["node_modules/braces"];
delete renamedBoth.packages["node_modules/node-forge"];
renamedBoth.packages["node_modules/opaque-fork"]=opaque.packages["node_modules/opaque-fork"];
const renamedBothResult=assess({lock:renamedBoth});
assert.equal(renamedBothResult.targets.every(t=>t.knownAffectedCopies===0),true);
assert.equal(renamedBothResult.unidentifiedLocalArchiveEntries,1);
assert.equal(renamedBothResult.securityGatePassed,false);
assert.ok(renamedBothResult.blockerCodes.includes(
  "UNATTRIBUTED_LOCAL_OR_ALIAS_ARCHIVES_REQUIRE_SOURCE_CENSUS"));
const malformed=assess({lock:{lockfileVersion:2,packages:{}}});
assert.equal(malformed.status,"HOLD_INVALID_LOCKFILE");
assert.equal(malformed.securityGatePassed,false);
assert.equal(assess({lock:null}).status,"HOLD_INVALID_LOCKFILE");
const spoofed=assess({lock:demo,installed:{...census,
 securityGatePassed:true,rawAuditHighZeroAttested:true,
 privateDistributionApproved:true}});
assert.equal(spoofed.securityGatePassed,false);
assert.equal(spoofed.privateDistributionApproved,false);
assert.equal(spoofed.rawAuditHighZeroAttested,false);
const encoded=JSON.stringify([r,d,installed,fakeFix,renamedResult,nestedResult,graphResult,spoofed]);
assert.ok(!encoded.includes("PRIVATE_TOKEN"));
assert.ok(!encoded.includes("https://PRIVATE_TOKEN.invalid"));
assert.ok(!encoded.includes("node_modules/private-fork/../../../"));
const src=fs.readFileSync("lib/supply-chain-b4-preflight.mjs","utf8").toLowerCase();
for(const forbidden of [".writefile", ".rename(", ".unlink(", ".rm(", ".exec(", ".spawn(",
 "supabase","openai","gemini","continue-on-error"]){
 assert.ok(!src.includes(forbidden),"forbidden active operation "+forbidden);
}
console.log(JSON.stringify({status:"PASS",stage:"SEC_SCA_B4_PREFLIGHT",
  currentAffectedPackageFamilies:r.targets.filter(t=>t.knownAffectedCopies>0).length,
  tests:11,rootLockMutation:false,rawAuditBypassed:false,
  securityApprovalGranted:false}));
