#!/usr/bin/env node
/**
 * B3 read-only consumer census. This is NOT browser compatibility proof:
 * static string references cannot detect runtime-computed imports or CDN use.
 * Uses unchanged npm ci graph and lockfile; never modifies source or audit.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {traceSupplyChainLockGraph} from "../../lib/supply-chain-lock-path-tracer.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const lock=JSON.parse(fs.readFileSync(path.join(root,"package-lock.json"),"utf8"));
const original=traceSupplyChainLockGraph(lock,{maxExamples:20});
assert.equal(original.status,"EVIDENCE_ONLY_NOT_A_SECURITY_PASS");
assert.equal(original.unresolvedDependencyEdges,0,"unknown lock dependency edges");
const target=original.targets.find(x=>x.package==="node-forge");
assert.ok(target,"missing forge graph target");
assert.deepEqual(target.installedVersions,["1.4.0"],"node-forge graph drift");
assert.equal(target.installedPathCount,1,"nested forge copy not inventoried");
assert.equal(target.reachablePathCount,1,"forge not reachable as expected");
const packagePaths=lock.packages;
const directConsumers=Object.entries(packagePaths).flatMap(([pkgPath,pkg])=>{
 const dependencyKinds=["dependencies","optionalDependencies","peerDependencies"];
 const kinds=dependencyKinds.filter(kind=>Object.hasOwn(pkg?.[kind]||{},"node-forge"));
 return kinds.length?[{path:pkgPath||".",name:pkg.name||pkgPath,
  version:pkg.version||null,kinds}]:[];
}).sort((a,b)=>a.path.localeCompare(b.path));
assert.ok(directConsumers.length>0,"no direct declared forge consumer: graph drift");
const appPaths=["app","apps/mobile","packages","components","lib"];
const scanners=new Set();
for(const p of appPaths)if(fs.existsSync(path.join(root,p)))scanners.add(p);
for(const c of directConsumers)if(c.path!==".")scanners.add(c.path);
const sourceFile=/\.(?:js|cjs|mjs|ts|tsx|jsx|json|html)$/i;
const moduleDist=/(?:node-forge[/\\]+dist[/\\]|node-forge[/\\]+dist\b|forge(?:\.all)?\.min\.js)/i;
const forgeName=/\bnode-forge\b/;
let filesRead=0,bytesRead=0,symlinksSkipped=0;
const seenFiles=new Set(),directDistLiterals=[],forgeRefs=[];
const maxFiles=40000,maxBytes=200*1024*1024;
function scan(folder,relative){
 const entries=fs.readdirSync(folder,{withFileTypes:true});
 for(const ent of entries){
  const rel=path.posix.join(relative,ent.name);
  const fp=path.join(folder,ent.name);
  if(ent.isSymbolicLink()){symlinksSkipped++;continue;}
  if(ent.isDirectory()){
   if(["node_modules",".git",".next",".expo",".turbo","coverage","android","ios"].includes(ent.name))continue;
   scan(fp,rel);
   continue;
  }
  if(!ent.isFile()||!sourceFile.test(ent.name)||seenFiles.has(fp))continue;
  seenFiles.add(fp);
  const st=fs.statSync(fp);
  assert.ok(st.size<=3*1024*1024,"unusually large consumer source: "+rel);
  filesRead++;bytesRead+=st.size;
  assert.ok(filesRead<=maxFiles&&bytesRead<=maxBytes,"consumer census resource cap");
  const src=fs.readFileSync(fp,"utf8");
  if(moduleDist.test(src))directDistLiterals.push(rel);
  if(forgeName.test(src))forgeRefs.push(rel);
 }
}
for(const dir of [...scanners].sort()){
 const location=path.join(root,dir);
 if(fs.lstatSync(location).isDirectory()&&!fs.lstatSync(location).isSymbolicLink())scan(location,dir);
}
const pkg=JSON.parse(fs.readFileSync(path.join(root,"node_modules/node-forge/package.json"),"utf8"));
const braces=JSON.parse(fs.readFileSync(path.join(root,"node_modules/braces/package.json"),"utf8"));
assert.equal(pkg.name,"node-forge");
assert.equal(pkg.version,"1.4.0");
assert.equal(pkg.main,"lib/index.js","forge main entrypoint changed");
assert.equal(pkg.license,"(BSD-3-Clause OR GPL-2.0)","forge license metadata drift");
assert.equal(braces.license,"MIT","braces license metadata drift");
const licenses=["braces","node-forge"].map(name=>{
 const loc=path.join(root,"node_modules",name,"LICENSE");
 const bytes=fs.readFileSync(loc);
 return {name,license:JSON.parse(fs.readFileSync(path.join(root,"node_modules",name,"package.json"),"utf8")).license,
  licenseFile:"LICENSE",licenseSha256:createHash("sha256").update(bytes).digest("hex")};
});
assert.ok(Array.isArray(pkg.files)&&pkg.files.some(x=>x.startsWith("dist/")),
 "existing browser distributable file manifest missing or changed");
const report={
 state:directDistLiterals.length?"HOLD_STATIC_DIST_REFERENCES_FOUND":
 "NO_LITERAL_DIST_REFERENCES_IN_COVERED_CONSUMERS_NOT_BROWSER_PROOF",
 source:"original npm ci graph, not B4 switched lock",
 nodeForgeInstalledPathCount:target.installedPathCount,
 directDependencyConsumers:directConsumers,
 scopesScanned:[...scanners].sort(),
 codeFilesRead:filesRead,codeBytesRead:bytesRead,symlinksSkipped,
 filesMentioningForge:forgeRefs.length,forgeReferenceSamples:forgeRefs.slice(0,15),
 distReferences:directDistLiterals.slice(0,30),
 unresolvedLockEdges:original.unresolvedDependencyEdges,
 forgeMain:pkg.main,originalPackagePublishesDistGlobs:true,
 originalPackageLicenseHashes:licenses,
 licenseReviewApproval:"HOLD",browserBundleCompatibility:"UNKNOWN",
 noRuntimeOrDynamicImportCompletenessClaim:true,
 publishedTarballOrDependencyReplacement:false,
 auditGateUnchanged:true
};
console.log("SCA_B3_FORGE_CONSUMER_BOUNDARY="+JSON.stringify(report));
assert.deepEqual(directDistLiterals,[],
 "literal forge dist imports in consumer graph: candidate without dist not safe to promote");
