/**
 * SEC-SCA B4 preflight: inspect the committed npm v3 graph and installed
 * package copies. This is a *blocker detector*, never an admission/approval.
 * No package source is accepted without independent reviewed source digests,
 * B3 private distribution approval and BOTH unmodified raw npm audits.
 */
import {traceSupplyChainLockGraph} from "./supply-chain-lock-path-tracer.mjs";

export const SCA_B4_PREFLIGHT_VERSION="sec-sca-b4-lock-and-install-preflight-v1";
const TARGETS=Object.freeze([
  Object.freeze({name:"braces",affectedVersion:"3.0.3"}),
  Object.freeze({name:"node-forge",affectedVersion:"1.4.0"}),
]);
const VERSION=/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
function isPath(path,target) {
  return path==="node_modules/"+target||path.endsWith("/node_modules/"+target);
}
function packageLeaf(path) {
  const start=path.lastIndexOf("/node_modules/");
  return start>=0?path.slice(start+14):path.slice("node_modules/".length);
}
function listedCopies(lock,target) {
  return Object.entries(lock.packages)
    .filter(([path,entry])=>(
      (isPath(path,target)||entry?.name===target)&&
      path.includes("node_modules/")&&entry&&typeof entry==="object"))
    .map(([path,entry])=>({path,version:entry.version??null,
      actualName:entry.name??packageLeaf(path)}))
    .sort((a,b)=>a.path.localeCompare(b.path));
}
function cap(n){return Math.min(999,Math.max(0,Number(n)||0));}
function classification(target,trace,lock,installed){
  const copies=listedCopies(lock,target.name);
  const traced=trace.targets.find(x=>x.package===target.name);
  const evidence=installed?.[target.name];
  const versionInCopies=copies.some(x=>x.version===target.affectedVersion);
  const ambiguous=copies.some(x=>packageLeaf(x.path)!==target.name||x.actualName!==target.name||
    typeof x.version!=="string"||!VERSION.test(x.version));
  const mismatched=evidence?copies.length!==evidence.length||
    !copies.every(x=>evidence.some(y=>y.path===x.path&&y.present===true)):true;
  const blockerCodes=[
    ...(versionInCopies?["KNOWN_AFFECTED_LOCK_VERSION"]:[]),
    ...(traced?.knownAffectedReachable?["KNOWN_AFFECTED_REACHABLE"]:[]),
    ...(trace.unresolvedDependencyEdges>0?["UNRESOLVED_LOCK_DEPENDENCY_EDGES"]:[]),
    ...(ambiguous?["RENAMED_OR_UNVERSIONED_PACKAGE_REQUIRES_SOURCE_ATTESTATION"]:[]),
    ...(mismatched?["LOCK_INSTALL_PATHS_NOT_ATTESTED"]:[]),
    "REVIEWED_PATCHED_SOURCE_HASHES_NOT_ATTESTED",
    "APPROVED_PRIVATE_ARTIFACT_NOT_ATTESTED",
    "BOTH_UNMODIFIED_RAW_NPM_AUDITS_NOT_ATTESTED",
    "SECURITY_OWNER_APPROVAL_NOT_ATTESTED",
  ];
  return {
    package:target.name,installedLockCopies:cap(copies.length),
    knownAffectedCopies:cap(copies.filter(x=>x.version===target.affectedVersion).length),
    reachableLockCopies:cap(traced?.reachablePathCount),
    detectedAliasesOrUnknownVersions:cap(copies.filter(x=>
      packageLeaf(x.path)!==target.name||x.actualName!==target.name||typeof x.version!=="string"||!VERSION.test(x.version)).length),
    declaredInstallPathsCovered:!mismatched,
    blockerCodes:[...new Set(blockerCodes)],
    patchedSourceAttested:false,advisoryRemediated:false,
  };
}
/** \`installed\` is a read-only census from the exact npm ci filesystem.
 * Caller data is NEVER treated as patched-source approval. */
export function assessScaB4Preflight({lock,installed}={}){
  if(lock?.lockfileVersion!==3||!lock.packages||typeof lock.packages!=="object"||
    Array.isArray(lock.packages)||!lock.packages[""]){
    return Object.freeze({contract:SCA_B4_PREFLIGHT_VERSION,status:"HOLD_INVALID_LOCKFILE",
      targets:[],securityGatePassed:false,rawAuditHighZeroAttested:false,
      patchedCodeAttested:false,privateDistributionApproved:false,
      deploymentAuthorized:false,rootLockMutation:false});
  }
  const trace=traceSupplyChainLockGraph(lock);
  const targets=TARGETS.map(t=>classification(t,trace,lock,installed));
  const reasons=[
    ...(targets.some(t=>t.knownAffectedCopies>0)?["AFFECTED_LOCK_COPIES_PRESENT"]:[]),
    ...(targets.some(t=>t.detectedAliasesOrUnknownVersions>0)?["RENAMED_PACKAGE_OR_UNKNOWN_VERSION"]:[]),
    ...(trace.unresolvedDependencyEdges>0?["DEPENDENCY_GRAPH_INCOMPLETE"]:[]),
    ...(targets.some(t=>!t.declaredInstallPathsCovered)?["INSTALL_CENSUS_INCOMPLETE"]:[]),
    "B3_DISTRIBUTION_AND_SECURITY_SIGNOFF_HOLD",
    "PATCHED_INSTALL_BYTES_NOT_PROVEN",
    "RAW_AUDIT_FULL_AND_PRODUCTION_NOT_PROVEN",
  ];
  return Object.freeze({
    contract:SCA_B4_PREFLIGHT_VERSION,status:"B4_PREFLIGHT_HOLD",
    npmLockfileVersion:3,lockRoots:cap(trace.roots.length),
    unresolvedDependencyEdges:cap(trace.unresolvedDependencyEdges),
    targets,blockerCodes:reasons,
    securityGatePassed:false,rawAuditHighZeroAttested:false,
    patchedCodeAttested:false,privateDistributionApproved:false,
    deploymentAuthorized:false,rootLockMutation:false,
    npmAuditPolicyChanged:false,exceptionExpiryChanged:false,
    localPackagedCopiesDoNotImplyRemediation:true,
  });
}
