/**
 * Isolated B2 source-only candidate: patch npm-ci installed node-forge@1.4.0
 * using the reviewed digitalbazaar/forge PR #1152 RSA ASN.1 validation hunk.
 *
 * Deliberately does NOT rebuild vulnerable browser dist bundles, publish an
 * artifact, change npm dependency resolution or claim audit remediation.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const hex=(data,algorithm="sha256")=>createHash(algorithm).update(data).digest("hex");
const blob=(data)=>hex(Buffer.concat([
 Buffer.from("blob "+Buffer.byteLength(data)+"\0"),Buffer.from(data)
]),"sha1");
const inventory=(dir)=>{
 const hashes={};
 const visit=(dirPart,relative="")=>{
  for(const d of fs.readdirSync(dirPart,{withFileTypes:true})){
   const name=path.posix.join(relative,d.name);
   const abs=path.join(dirPart,d.name);
   assert.ok(!d.isSymbolicLink()&&!d.isBlockDevice()&&!d.isCharacterDevice(),
     "forbidden source entry: "+name);
   if(d.isDirectory())visit(abs,name);
   else{
    assert.ok(d.isFile(),"unsupported source type: "+name);
    assert.ok(fs.statSync(abs).size<10*1024*1024,"oversize source file: "+name);
    hashes[name]=hex(fs.readFileSync(abs));
    assert.ok(Object.keys(hashes).length<=500,"too many source files");
   }
  }
 };
 visit(dir);
 return Object.fromEntries(Object.entries(hashes).sort(([a],[b])=>a.localeCompare(b)));
};

export function materializePrivateForgeSource(destination){
 assert.ok(fs.existsSync(destination),"existing temp directory required");
 assert.ok(fs.lstatSync(destination).isDirectory()&&!fs.lstatSync(destination).isSymbolicLink(),
   "destination must be a normal directory");
 assert.deepEqual(fs.readdirSync(destination),[],"destination must be empty");
 const manifest=JSON.parse(fs.readFileSync(path.join(root,"security/vendor/node-forge/source-manifest.json"),"utf8"));
 assert.equal(manifest.stage,"B2_ISOLATED_SOURCE_CANDIDATE_ONLY");
 assert.equal(manifest.distributionApproved,false);
 assert.equal(manifest.vulnerabilityRemediated,false);
 assert.equal(manifest.bundledDistributionRebuilt,false);
 assert.equal(manifest.upstreamPatch.headSha,"ceba34402e329f0365134f23fe19898756527d65");
 const pkg=JSON.parse(fs.readFileSync(path.join(root,"package-lock.json"),"utf8"))
   .packages["node_modules/node-forge"];
 assert.equal(pkg.version,manifest.originalVersion);
 assert.equal(pkg.integrity,manifest.originalLockIntegritySha512);
 assert.equal(pkg.resolved,manifest.originalRegistryTarball);
 const source=path.join(root,"node_modules/node-forge");
 assert.equal(fs.realpathSync(source),source,"symlinked original package refused");
 const rawPkg=fs.readFileSync(path.join(source,"package.json"));
 assert.equal(JSON.parse(rawPkg).version,"1.4.0");
 const src=path.join(source,"lib");
 const before=inventory(src);
 fs.copyFileSync(path.join(source,"package.json"),path.join(destination,"package.json"));
 fs.cpSync(src,path.join(destination,"lib"),{recursive:true,force:false,errorOnExist:true});
 assert.deepEqual(inventory(path.join(destination,"lib")),before,"candidate copy changed source");
 const rsa=path.join(destination,"lib/rsa.js");
 const original=[
 "if(!asn1.validate(obj, digestInfoValidator, capture, errors) ||",
 "            obj.value.length !== 2) {"
 ].join("\n");
 const replacement=[
 "if(!asn1.validate(obj, digestInfoValidator, capture, errors) ||",
 "            obj.value.length !== 2 ||",
 "            obj.value[0].value.length !==",
 "              (('parameters' in capture) ? 2 : 1)) {"
 ].join("\n");
 const prior=fs.readFileSync(rsa,"utf8");
 assert.equal(prior.split(original).length-1,1,"RSA patch anchor not unique");
 const oldComment="          // validate DigestInfo structure and element count";
 const updatedComment=[
   "          // validate DigestInfo structure and element counts (outer DigestInfo",
   "          // and nested DigestAlgorithm). asn1.validate ignores extra children,",
   "          // so length must be checked explicitly at each nesting level to",
   "          // prevent low-exponent PKCS#1 v1.5 signature forgery (CVE-2026-85393)."
 ].join("\n");
 assert.equal(prior.split(oldComment).length-1,1,
   "upstream review comment anchor not unique");
 const after=prior.replace(oldComment,updatedComment).replace(original,replacement);
 fs.writeFileSync(rsa,after);
 const post=inventory(path.join(destination,"lib"));
 const modified=Object.keys(before).filter(p=>before[p]!==post[p]);
 assert.deepEqual(modified,["rsa.js"],"unapproved source changes");
 assert.deepEqual(Object.keys(post),Object.keys(before),"source paths changed");
 // The full resulting upstream blob is an additional byte-for-byte source
 // identity check, not a generic search-and-replace security claim.
 const patchedBlob=blob(Buffer.from(after,"utf8"));
 assert.equal(patchedBlob,manifest.upstreamPatch.patchedRsaJsGitBlobSha1,
   "locally patched lib/rsa.js differs from reviewed upstream commit");
 assert.equal(hex(fs.readFileSync(path.join(source,"lib/rsa.js"))),before["rsa.js"],
   "original npm-ci source was mutated");
 assert.equal(hex(fs.readFileSync(path.join(source,"package.json"))),hex(rawPkg),
   "original package metadata was mutated");
 return {
  stage:"B2_ISOLATED_RSA_SOURCE_ONLY",name:"node-forge",version:"1.4.0",
  advisory:manifest.advisory,upstreamHead:manifest.upstreamPatch.headSha,
  patchedRsaBlobSha1:patchedBlob,patchedRsaSha256:post["rsa.js"],
  originalRsaSha256:before["rsa.js"],onlyChangedFile:"lib/rsa.js",
  installedOriginalUnchanged:true,bundledDistUnchecked:true,
  approvedForDistribution:false,canonicalAuditUnchanged:true,
  conclusion:"B2_SOURCE_PATCH_ONLY_NOT_PACKAGE_OR_SECURITY_REMEDIATION"
 };
}
