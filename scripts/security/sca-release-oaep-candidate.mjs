/** Separate OAEP replacement profile. Never rewrites or admits the frozen B6 profile. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {inspectArchive,verifyArchive,digest,browserReference,assertNoLifecycleHooks} from './sca-release-bundle.mjs';
import {scopedMetadata} from './sca-release-scoped.mjs';
import {leadingNotices} from './sca-release-license-review.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const vendor='security/vendor/node-forge-oaep-replacement/';
const profiles={
  'lib/pkcs1.js':vendor+'pkcs1.js',
  'lib/bejewely-node-rsa-oaep.js':vendor+'bejewely-node-rsa-oaep.js',
  'LICENSE.node-rsa.txt':vendor+'LICENSE.node-rsa.txt'
};
const noticeName='BEJEWELY-THIRD-PARTY-NOTICES.md',sbomName='BEJEWELY-OAEP-SBOM.json';
const json=b=>Buffer.from(JSON.stringify(b,null,2)+'\n');
const inventory=files=>Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([n,b])=>[n,digest(b)]));
const read=file=>{const s=fs.lstatSync(file);assert.ok(s.isFile()&&!s.isSymbolicLink()&&s.size<=24*1024*1024,'bounded physical file required');return fs.readFileSync(file);};
function asset(n){assert.ok(n.startsWith(vendor)&&!n.includes('..')&&!n.includes('\\'),'pinned vendor resource required');return read(path.join(root,n));}
function validateBuild(old,next,build){
  assert.equal(build.originalForgeSha256,verifyArchive('node-forge',old).sha256);
  assert.deepEqual(build.pinnedFiles,profiles,'replacement resource identity mismatch');
  assert.equal(build.replacementSourcePath,profiles['lib/pkcs1.js']);assert.equal(build.nodeRsaLicensePath,profiles['LICENSE.node-rsa.txt']);
  assert.equal(build.sourceRecipeSha256,digest(asset(vendor+'source-manifest.json')),'recipe resource mismatch');
  const before=inspectArchive(old),after=inspectArchive(next),bundles=browserReference.browserBundles.map(x=>x.path);
  assert.deepEqual(build.allowedChangedFiles.slice().sort(),['lib/pkcs1.js',...bundles].sort(),'unreviewed change profile');
  assert.deepEqual(build.addedFiles.slice().sort(),['lib/bejewely-node-rsa-oaep.js','LICENSE.node-rsa.txt'].sort(),'unreviewed added source');
  assert.deepEqual(Object.keys(after).sort(),[...Object.keys(before),...build.addedFiles].sort(),'replacement archive inventory');
  assert.deepEqual(inventory(after),build.fileSha256,'replacement file byte mismatch');
  for(const [n,b] of Object.entries(before))if(!build.allowedChangedFiles.includes(n))assert.equal(digest(after[n]),digest(b),'unreviewed original change: '+n);
  for(const [n,p] of Object.entries(profiles))assert.equal(digest(after[n]),digest(asset(p)),'pinned replacement mismatch: '+n);
  for(const n of bundles){const expected=Array.isArray(build.browserBundleSha256)?build.browserBundleSha256.find(x=>x.path===n)?.sha256:build.browserBundleSha256[n];assert.equal(digest(after[n]),expected,'browser rebuild mismatch: '+n);}
  for(const n of ['lib/pkcs1.js','lib/bejewely-node-rsa-oaep.js',...bundles])assert.ok(!/Ellis Pritchard|webrsa\.cvs|RSAES-OAEP\.js,v/.test(after[n].toString()),'historical OAEP copy remains: '+n);
  assertNoLifecycleHooks(JSON.parse(after['package.json']));
  assert.match(after['LICENSE.node-rsa.txt'].toString(),/Permission is hereby granted/,'full replacement MIT required');
  return {before,after};
}
function reviewResources(originals,build){
  const baseline=JSON.parse(read(path.join(root,'security/release/license-review/license-review.json')));
  const old=Object.fromEntries(Object.entries(originals).map(([n,p])=>{const b=read(p);verifyArchive(n,b);return [n,inspectArchive(b)];}));
  const retained=baseline.sourceNotices.filter(n=>!(n.package==='node-forge'&&n.path==='lib/pkcs1.js'));
  const sections=retained.map(n=>{const b=old[n.package][n.path],text=leadingNotices(b);assert.equal(digest(b),n.fileSha256);assert.equal(digest(Buffer.from(text)),n.noticeSha256);return '## '+n.package+'/'+n.path+'\n\nSource SHA256: '+n.fileSha256+'\n\n```text\n'+text+'\n```\n';});
  const frozen=read(path.join(root,'security/release/license-review/THIRD-PARTY-NOTICES.md')).toString();
  const start=frozen.indexOf('## Recovered public license evidence'),end=frozen.indexOf('## Unresolved rights review');assert.ok(start>=0&&end>start,'frozen public notice section missing');
  const mit=asset(profiles['LICENSE.node-rsa.txt']);
  const notice=Buffer.from('# BEJEWELY OAEP replacement distribution notices\n\nThis new candidate replaces the complete historical lib/pkcs1.js implementation. It does not clear or relicense the historical WebRSA copy. Original upstream LICENSE and all other source notices remain intact. Final legal and release approval are separate.\n\n'+
    ['braces','node-forge'].map(n=>'## '+n+' original LICENSE\n\n```text\n'+old[n].LICENSE.toString()+'\n```\n').join('\n')+sections.join('\n')+'\n## node-rsa replacement — MIT\n\n```text\n'+mit.toString()+'\n```\n\n'+frozen.slice(start,end)+'\n## Internal provenance assurance gaps\n\n'+baseline.internalAssuranceGaps.map(s=>'- '+s).join('\n')+'\n');
  const recipeBytes=asset(vendor+'source-manifest.json'),recipe=JSON.parse(recipeBytes);
  const report={schema:'bejewely.oaep-replacement-license-review.v1',legalApproval:false,redistributionApproved:false,
    historicalOaepTerms:'UNRESOLVED_FOR_HISTORICAL_IMPLEMENTATION',historicalImplementationDistributed:false,
    removedSource:'lib/pkcs1.js',replacementLicense:'MIT',replacementSourceRecipeSha256:build.sourceRecipeSha256,replacementSourceProvenance:recipe,
    originalFrozenPacketStatus:'UNCHANGED_HISTORICAL_BASELINE_NOT_CLEARED',originalFrozenReviewSha256:digest(read(path.join(root,'security/release/license-review/license-review.json'))),
    retainedSourceNotices:retained,internalAssuranceGaps:baseline.internalAssuranceGaps,upstreamReplyRequired:false};
  const sbom={bomFormat:'CycloneDX',specVersion:'1.6',version:1,components:[{type:'library',name:'braces',version:'3.0.3',licenses:[{license:{id:'MIT'}}]},
    {type:'library',name:'node-forge',version:'1.4.0',licenses:[{expression:'BSD-3-Clause AND MIT'}],properties:[{name:'bejewely:oaep-implementation',value:'node-rsa MIT replacement; original dual LICENSE preserved'}]},
    {type:'library',name:'node-rsa OAEP implementation',licenses:[{license:{id:'MIT'}}],hashes:[{alg:'SHA-256',content:digest(asset(profiles['lib/bejewely-node-rsa-oaep.js']))}]}]};
  return {'THIRD-PARTY-NOTICES.md':notice,'license-review.json':json(report),'license-review-sbom.json':json(sbom),'LICENSE.node-rsa.txt':mit};
}
function expectedContents(name,base,oldSha,resources,build){
  const out={...base};const metadata=scopedMetadata(JSON.parse(base['package.json']),oldSha,{linkage:'UNLINKED_BOOTSTRAP'});
  if(name==='node-forge')metadata.license='('+metadata.license+' AND MIT)';
  metadata.bejewelyPatch.oaepReplacement='NODE_RSA_MIT_V1';metadata.bejewelyPatch.sourceRecipeSha256=build.sourceRecipeSha256;
  if(metadata.files!==undefined){assert.ok(Array.isArray(metadata.files));metadata.files=[...new Set([...metadata.files,noticeName,sbomName,...(name==='node-forge'?['LICENSE.node-rsa.txt','lib/bejewely-node-rsa-oaep.js']:[])])];}
  out['package.json']=json(metadata);out[noticeName]=resources['THIRD-PARTY-NOTICES.md'];out[sbomName]=resources['license-review-sbom.json'];return out;
}
function pack(files,dir,destination){
  fs.mkdirSync(dir);for(const [n,b] of Object.entries(files)){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b,{flag:'wx',mode:0o600});}
  const win=process.platform==='win32',cmd=win?process.execPath:'npm',args=['pack',dir,'--ignore-scripts','--offline','--json','--pack-destination',destination];
  if(win)args.unshift(path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'));
  const p=spawnSync(cmd,args,{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});assert.ok(!p.error&&p.status===0,'OAEP candidate npm pack failed\n'+p.stdout+'\n'+p.stderr);const result=JSON.parse(p.stdout);assert.equal(result.length,1);return result[0].filename;
}
function contexts({originals,replacementForgeTarball,build}){
  const originalFiles={};for(const n of ['braces','node-forge']){const b=read(originals[n]);verifyArchive(n,b);originalFiles[n]=inspectArchive(b);}
  const replacement=read(replacementForgeTarball);validateBuild(read(originals['node-forge']),replacement,build);
  const resources=reviewResources(originals,build),expected={};
  for(const n of ['braces','node-forge'])expected[n]=expectedContents(n,n==='node-forge'?inspectArchive(replacement):originalFiles[n],digest(read(originals[n])),resources,build);
  return {resources,expected,replacementSha256:digest(replacement)};
}
function artifactFor(n,bytes,expected,originals){
  const entries=inspectArchive(bytes);assert.deepEqual(inventory(entries),inventory(expected),'candidate archive source/notice/SBOM substitution');const meta=JSON.parse(entries['package.json']),original=verifyArchive(n,read(originals[n]));
  return {originalName:n,originalVersion:original.version,name:meta.name,version:meta.version,filename:'gycha0109-beep-'+n+'-'+meta.version+'.tgz',sha256:digest(bytes),sha512:'sha512-'+createHash('sha512').update(bytes).digest('base64'),
    originalArchiveSha256:original.sha256,originalLicense:original.license,license:meta.license,licenseSha256:original.licenseSha256,fileSha256:inventory(entries),noticeDelivery:'IN_TARBALL_V1',noticeSha256:digest(entries[noticeName]),publicationLinkage:'UNLINKED_BOOTSTRAP',oaepReplacement:'NODE_RSA_MIT_V1',originalRsaSourcePreserved:true,releaseApproved:false};
}
function manifestFor(artifacts,resources,build,replacementSha256){return {schema:'bejewely.oaep-replacement-scoped-candidate.v1',publicationLinkage:'UNLINKED_BOOTSTRAP',oaepReplacement:'NODE_RSA_MIT_V1',build,replacementForgeSha256:replacementSha256,
  legalApproved:false,productApplied:false,uploadExecuted:false,originalAuditRequired:true,officialAuditPass:false,liveAclAndLinkage:'NOT_RUN',artifacts,
  files:Object.fromEntries(Object.entries(resources).sort(([a],[b])=>a.localeCompare(b)).map(([n,b])=>[n,{sha256:digest(b),bytes:b.length}]))};}
export function prepareOaepReplacementCandidate(options){
  const {output,originals,build}=options,c=contexts(options);assert.ok(!fs.existsSync(output),'new isolated output required');fs.mkdirSync(output,{mode:0o700});const artifacts=[];
  for(const n of ['braces','node-forge']){const filename=pack(c.expected[n],path.join(output,n),output),bytes=read(path.join(output,filename));const a=artifactFor(n,bytes,c.expected[n],originals);assert.equal(a.filename,filename);artifacts.push(a);}
  const replacement=read(options.replacementForgeTarball);fs.writeFileSync(path.join(output,'replacement-node-forge.tgz'),replacement,{flag:'wx',mode:0o600});
  const resources={...c.resources,'replacement-node-forge.tgz':replacement};for(const a of artifacts)resources[a.filename]=read(path.join(output,a.filename));
  const manifest=manifestFor(artifacts,resources,build,c.replacementSha256);
  for(const [n,b] of Object.entries(c.resources))fs.writeFileSync(path.join(output,n),b,{flag:'wx',mode:0o600});fs.writeFileSync(path.join(output,'scoped-candidate.json'),json(manifest),{flag:'wx',mode:0o600});
  return verifyOaepReplacementCandidate(options);
}
export function verifyOaepReplacementCandidate(options){
  const {output,originals}=options,manifestBytes=read(path.join(output,'scoped-candidate.json')),manifest=JSON.parse(manifestBytes),build=options.build||manifest.build;
  const replacementForgeTarball=options.replacementForgeTarball||path.join(output,'replacement-node-forge.tgz');
  const c=contexts({...options,build,replacementForgeTarball}),artifacts=[],resources={...c.resources,'replacement-node-forge.tgz':read(path.join(output,'replacement-node-forge.tgz'))};
  assert.equal(digest(resources['replacement-node-forge.tgz']),c.replacementSha256,'retained replacement archive substitution');
  for(const n of ['braces','node-forge']){const filename='gycha0109-beep-'+n+'-'+(n==='braces'?'3.0.3':'1.4.0')+'.tgz',bytes=read(path.join(output,filename));artifacts.push(artifactFor(n,bytes,c.expected[n],originals));resources[filename]=bytes;}
  for(const [n,b] of Object.entries(c.resources))assert.equal(digest(read(path.join(output,n))),digest(b),'replacement review packet substitution');
  assert.deepEqual(manifest,manifestFor(artifacts,resources,build,c.replacementSha256),'OAEP candidate provenance substitution');
  return {candidateSha256:digest(manifestBytes),candidateLicensePacketSha256:digest(Buffer.concat(Object.keys(c.resources).sort().map(n=>Buffer.concat([Buffer.from(n+'\0'),c.resources[n]])))),manifest,
    artifacts:artifacts.map(a=>({...a,archive:path.join(output,a.filename)})),resources:c.resources,output,publicationLinkage:'UNLINKED_BOOTSTRAP',originalAuditRequired:true,officialAudit:'FAIL',productApplied:false,legalApproved:false,uploadExecuted:false};
}
export const verifyFromCandidate=verifyOaepReplacementCandidate;
export function verifyOaepReplacementArchive(originalBytes,scopedBytes,artifact,build){
  const name=artifact.originalName;assert.ok(['braces','node-forge'].includes(name));verifyArchive(name,originalBytes);assert.equal(digest(scopedBytes),artifact.sha256,'readback archive mismatch');const entries=inspectArchive(scopedBytes);assert.deepEqual(inventory(entries),artifact.fileSha256);assert.equal(digest(entries[noticeName]),artifact.noticeSha256,'readback notice substitution');
  const old=inspectArchive(originalBytes);
  if(name==='node-forge'){for(const [n,p] of Object.entries(profiles))assert.equal(digest(entries[n]),digest(asset(p)));assert.equal(digest(entries['lib/rsa.js']),digest(old['lib/rsa.js']),'RSA security patch substitution');}
  else for(const [n,b] of Object.entries(old))if(n!=='package.json')assert.equal(digest(entries[n]),digest(b),'braces patch substitution');
  assert.equal(build.sourceRecipeSha256,digest(asset(vendor+'source-manifest.json')));return {sha256:digest(scopedBytes),noticeDelivery:'IN_TARBALL_V1'};
}
function kitExpected(candidate){
  assert.equal(digest(json(candidate.manifest)),candidate.candidateSha256,'browser candidate manifest binding');
  for(const [n,b] of Object.entries(candidate.resources)){assert.equal(digest(b),candidate.manifest.files[n]?.sha256,'browser packet source substitution');assert.equal(b.length,candidate.manifest.files[n]?.bytes);}
  const a=candidate.artifacts.find(a=>a.originalName==='node-forge'),{archive,...record}=a;assert.deepEqual(record,candidate.manifest.artifacts.find(x=>x.originalName==='node-forge'),'browser artifact binding');
  const bytes=read(archive);assert.equal(digest(bytes),a.sha256);const entries=inspectArchive(bytes);assert.deepEqual(inventory(entries),a.fileSha256);
  const files={};for(const {path:p} of browserReference.browserBundles)files[path.basename(p)]=entries[p];
  files['LICENSE.node-forge.txt']=entries.LICENSE;files['LICENSE.node-rsa.txt']=entries['LICENSE.node-rsa.txt'];files['THIRD-PARTY-NOTICES.md']=entries[noticeName];files['license-review-sbom.json']=entries[sbomName];files['license-review.json']=candidate.resources['license-review.json'];
  const manifest={schema:'bejewely.oaep-replacement-browser-notice-kit.v1',candidateSha256:candidate.candidateSha256,legalApproved:false,actualDistribution:'NOT_RUN',files:Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([n,b])=>[n,{sha256:digest(b),bytes:b.length}]))};return {files,manifest};
}
export function prepareOaepBrowserNoticeKit({candidate,output}){const {files,manifest}=kitExpected(candidate);assert.ok(!fs.existsSync(output));fs.mkdirSync(output,{mode:0o700});for(const [n,b] of Object.entries({...files,'browser-notice-kit.json':json(manifest)}))fs.writeFileSync(path.join(output,n),b,{flag:'wx',mode:0o600});return verifyOaepBrowserNoticeKit({candidate,output});}
export function verifyOaepBrowserNoticeKit({candidate,output}){const {files,manifest}=kitExpected(candidate),all={...files,'browser-notice-kit.json':json(manifest)};assert.deepEqual(fs.readdirSync(output).sort(),Object.keys(all).sort(),'browser kit inventory mismatch');for(const [n,b] of Object.entries(all))assert.equal(digest(read(path.join(output,n))),digest(b),'browser notice omission/tamper');return {manifestSha256:digest(json(manifest)),files:manifest.files,actualDistribution:'NOT_RUN',legalApproved:false};}
