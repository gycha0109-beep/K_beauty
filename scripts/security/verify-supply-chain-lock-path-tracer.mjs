#!/usr/bin/env node
import assert from "node:assert/strict";
import { traceSupplyChainLockGraph } from "../../lib/supply-chain-lock-path-tracer.mjs";

const demo = {
  lockfileVersion: 3,
  packages: {
    "": {name:"demo-root", dependencies:{"expo":"1.0.0"}},
    "apps/mobile": {name:"@demo/mobile", dependencies:{"@expo/cli":"1.0.0"}},
    "node_modules/expo": {version:"1.0.0", dependencies:{"micromatch":"4.0.0"}},
    "node_modules/@expo/cli": {version:"1.0.0", dependencies:{"@expo/code-signing-certificates":"1.0.0"}},
    "node_modules/@expo/code-signing-certificates": {version:"1.0.0", dependencies:{"node-forge":"1.4.0"}},
    "node_modules/micromatch": {version:"4.0.8", dependencies:{"braces":"3.0.3"}},
    "node_modules/braces": {version:"3.0.3"},
    "node_modules/node-forge": {version:"1.4.0"},
    "node_modules/unrelated": {version:"1.0.0",dependencies:{"braces":"3.0.2"}},
    "node_modules/unrelated/node_modules/braces": {version:"3.0.2"}
  }
};
const result = traceSupplyChainLockGraph(demo, {maxExamples:4});
assert.equal(result.status, "EVIDENCE_ONLY_NOT_A_SECURITY_PASS");
assert.equal(result.audit_gate_unchanged, true);
assert.equal(result.exception_dates_unchanged, true);
assert.equal(result.production_write_authorized, false);
assert.equal(result.unresolvedDependencyEdges, 0);
assert.ok(result.roots.some(x=>x.path === "apps/mobile"));
const braces = result.targets.find(t=>t.package==="braces");
assert.equal(braces.advisory,"GHSA-vfj7-8cjw-p6xm");
assert.equal(braces.installedPathCount,2);
assert.equal(braces.reachablePathCount,1);
assert.equal(braces.knownAffectedReachable,true);
assert.equal(braces.knownExceptionExpiresUtc,"2026-10-10T00:00:00.000Z");
assert.deepEqual(braces.exampleDependencyChains[0].chain.map(x=>x.package),[
  "demo-root", "expo", "micromatch", "braces"
]);
const forge = result.targets.find(t=>t.package==="node-forge");
assert.equal(forge.installedPathCount,1);
assert.equal(forge.reachablePathCount,1);
assert.equal(forge.knownAffectedReachable,true);
assert.deepEqual(forge.exampleDependencyChains[0].chain.map(x=>x.package), [
  "@demo/mobile","@expo/cli","@expo/code-signing-certificates","node-forge"
]);
assert.equal(forge.knownExceptionExpiresUtc,"2026-10-16T00:00:00.000Z");

const nested = structuredClone(demo);
nested.packages["node_modules/expo/node_modules/micromatch"] = {
  version:"4.0.9",dependencies:{"braces":"3.0.3"}
};
nested.packages["node_modules/expo/node_modules/micromatch/node_modules/braces"] = {version:"3.0.3"};
const nestedReport = traceSupplyChainLockGraph(nested);
assert.ok(nestedReport.targets.find(t=>t.package==="braces").reachablePathCount >= 1);
assert.equal(nestedReport.targets.find(t=>t.package==="braces").exampleDependencyChains[0].chain.at(-1).package,"braces");

const future = structuredClone(demo);
future.packages["node_modules/braces"].version="3.0.4";
future.packages["node_modules/node-forge"].version="1.4.1";
const futureResult=traceSupplyChainLockGraph(future);
assert.ok(futureResult.targets.every(t=>t.knownAffectedReachable===false));
assert.ok(futureResult.targets.every(t=>t.resolution_status==="NO_KNOWN_AFFECTED_VERSION_DETECTED_REQUIRES_AUDIT"));
assert.equal(futureResult.audit_gate_unchanged,true);

const empty = traceSupplyChainLockGraph({lockfileVersion:3, packages:{"":{dependencies:{}}}});
assert.equal(empty.targets[0].resolution_status,"NOT_INSTALLED_IN_LOCK_REQUIRES_AUDIT");
assert.equal(empty.audit_gate_unchanged,true);
const malformed = traceSupplyChainLockGraph({lockfileVersion:2, packages:{}});
assert.equal(malformed.status,"BLOCKED_INVALID_LOCKFILE");
assert.equal(malformed.audit_gate_unchanged,true);
assert.equal(traceSupplyChainLockGraph(null).status,"BLOCKED_INVALID_LOCKFILE");

const unknown = structuredClone(demo);
unknown.packages["node_modules/expo"].dependencies.optionalPlatformOnly="1.0.0";
const unknownResult=traceSupplyChainLockGraph(unknown);
assert.equal(unknownResult.unresolvedDependencyEdges,1);
assert.ok(unknownResult.unresolvedDependencyExamples.some(x=>x.dependency==="optionalPlatformOnly"));

console.log(JSON.stringify({status:"PASS",stage:"SEC_SCA_LOCK_PATH_TRIAGE",fixtures:6,
  analyzedAdvisories:2,knownAffectedReachable:2,expiryPolicyChanged:false,
  auditGateDisabled:false,productionWrites:0}));
