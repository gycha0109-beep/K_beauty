/** Authorized technical candidate only. Original audit and organizational release HOLD remain mandatory. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fork,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash,createPublicKey,verify} from 'node:crypto';
import {inspectArchive,verifyArchive,digest,requiredRoles,reference} from './sca-release-bundle.mjs';
import {licenseReviewResources,bootstrapLicenseReviewResources} from './sca-release-license-review.mjs';
import {approvalPolicyContext,checkPolicyOwner,checkPolicySigners,normalizeOwner} from './sca-release-owner-policy.mjs';

export const scope='gycha0109-beep';
export const scopedName=n=>'@'+scope+'/'+n;
export function githubScopedPackageMetadataUrl(originalName){
  assert.ok(['braces','node-forge'].includes(originalName),'unreviewed GitHub package identity');
  return 'https://api.github.com/user/packages/npm/'+encodeURIComponent(scopedName(originalName));
}
export const embeddedNoticePath='BEJEWELY-THIRD-PARTY-NOTICES.md';
export function scopedDeliveryNotices(){return fs.readFileSync(new URL('../../security/release/license-review/THIRD-PARTY-NOTICES.md',import.meta.url));}
export function verifyScopedContents(old,next,{noticeDelivery=false}={}){
  assert.deepEqual(Object.keys(next).sort(),[...Object.keys(old),...(noticeDelivery?[embeddedNoticePath]:[])].sort(),'scoped packaging added/removed files');
  for(const n of Object.keys(old))if(n!=='package.json')assert.equal(digest(next[n]),digest(old[n]),'scoped source/browser/license drift: '+n);
  if(noticeDelivery)assert.equal(digest(next[embeddedNoticePath]),digest(scopedDeliveryNotices()),'embedded distribution notice missing/tampered');
}
export function scopedMetadata(original,originalArchiveSha256,{linkage='PRELINKED',noticeDelivery=false}={}){
  assert.ok(['braces','node-forge'].includes(original.name),'unknown upstream identity');
  assert.match(originalArchiveSha256,/^[a-f0-9]{64}$/);
  assert.ok(['PRELINKED','UNLINKED_BOOTSTRAP'].includes(linkage),'unknown publication linkage');
  const metadata={...original,name:scopedName(original.name),repository:{type:'git',url:'https://github.com/gycha0109-beep/K_beauty.git'},
    publishConfig:{registry:'https://npm.pkg.github.com/',access:'restricted'},
    bejewelyPatch:{originalName:original.name,originalVersion:original.version,originalArchiveSha256,
      originalPackageJsonSha256:digest(Buffer.from(JSON.stringify(original)))}};
  if(linkage==='UNLINKED_BOOTSTRAP'){
    delete metadata.repository;
    metadata.bejewelyPatch.sourceRepository='https://github.com/gycha0109-beep/K_beauty';
    metadata.bejewelyPatch.publicationLinkage='UNLINKED_BOOTSTRAP';
  }
  if(noticeDelivery){assert.equal(linkage,'UNLINKED_BOOTSTRAP');
    if(original.files!==undefined){assert.ok(Array.isArray(original.files));metadata.files=[...original.files,embeddedNoticePath];}}
  return metadata;
}
export function verifyScopedArchive(originalName,originalBytes,scopedBytes,{linkage='PRELINKED',noticeDelivery=false}={}){
  const upstream=verifyArchive(originalName,originalBytes),old=inspectArchive(originalBytes),next=inspectArchive(scopedBytes);
  assert.ok(typeof noticeDelivery==='boolean');if(noticeDelivery)assert.equal(linkage,'UNLINKED_BOOTSTRAP');
  verifyScopedContents(old,next,{noticeDelivery});
  assert.deepEqual(JSON.parse(next['package.json']),scopedMetadata(JSON.parse(old['package.json']),upstream.sha256,{linkage,noticeDelivery}),'unreviewed metadata changes');
  for(const n of Object.keys(old))if(n!=='package.json')assert.equal(digest(next[n]),digest(old[n]),'scoped source/browser/license drift: '+n);
  const fileSha256=Object.fromEntries(Object.entries(next).map(([n,b])=>[n,digest(b)]).sort(([a],[b])=>a.localeCompare(b)));
  return {originalName,originalVersion:upstream.version,name:scopedName(originalName),version:upstream.version,
    originalArchiveSha256:upstream.sha256,originalInstalledSha256:upstream.installedContentSha256,
    sha256:digest(scopedBytes),sha512:'sha512-'+createHash('sha512').update(scopedBytes).digest('base64'),
    originalPackageJsonBytesSha256:digest(old['package.json']),scopedPackageJsonBytesSha256:digest(next['package.json']),
    metadataChangedFields:['name','repository','publishConfig','bejewelyPatch',...(noticeDelivery&&Object.hasOwn(JSON.parse(old['package.json']),'files')?['files']:[])],license:upstream.license,
    licenseSha256:upstream.licenseSha256,fileSha256,sourceAndBrowserBytesPreserved:true,releaseApproved:false,
    ...(linkage==='UNLINKED_BOOTSTRAP'?{publicationLinkage:linkage}:{}),
    ...(noticeDelivery?{noticeDelivery:'IN_TARBALL_V1',noticeSha256:digest(next[embeddedNoticePath])}:{})};
}
function npm(a,cwd){
  const win=process.platform==='win32',binary=win?process.execPath:'npm';
  const argv=win?[path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js'),...a]:a;
  const p=spawnSync(binary,argv,{cwd,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});assert.ok(!p.error&&p.status===0,'scoped npm packaging failed\n'+p.stdout+'\n'+p.stderr);return JSON.parse(p.stdout);
}
function scopedResources(artifacts,originals,linkage='PRELINKED'){
  const notice='# BEJEWELY scoped patch candidate\n\nNOT an official upstream release. Redistribution approval pending.\n'+
    artifacts.map(a=>a.name+'@'+a.version+' maps to '+a.originalName+'@'+a.originalVersion+'; original archive SHA256 '+a.originalArchiveSha256+'; original LICENSE SHA256 '+a.licenseSha256+'; '+JSON.stringify(a.license)+'.\n').join('')+
    (artifacts.some(a=>a.noticeDelivery)?'\nSource and all browser bundles remain byte-identical to the verified B6 patch. Linkage metadata and explicitly recorded supplemental notice delivery differ. Original advisory audit is mandatory and remains FAIL; scoped scanner silence is not a fix.\n':
    '\nOnly package.json metadata changed. Source and all browser bundles remain byte-identical to the verified B6 patch. Original advisory audit is mandatory and remains FAIL; scoped scanner silence is not a fix.\n');
  const sbom={bomFormat:'CycloneDX',specVersion:'1.6',version:1,components:artifacts.map(a=>({type:'library',name:a.name,version:a.version,
    'bom-ref':a.name+'@'+a.version+'#'+a.sha256,hashes:[{alg:'SHA-256',content:a.sha256}],licenses:[{license:{name:typeof a.license==='string'?a.license:JSON.stringify(a.license)}}],
    properties:[{name:'bejewely:original-name',value:a.originalName},{name:'bejewely:original-version',value:a.originalVersion},
      {name:'bejewely:original-archive-sha256',value:a.originalArchiveSha256},{name:'bejewely:original-license-sha256',value:a.licenseSha256},
      {name:'bejewely:status',value:'SCOPED_TECHNICAL_CANDIDATE_NOT_RELEASED'}]}))};
  return {'NOTICE.md':Buffer.from(notice+'\nDistribution must include THIRD-PARTY-NOTICES.md and license-review-sbom.json. Open rights questions are recorded in license-review.json; publication remains HOLD.\n'),
    'sbom.json':Buffer.from(JSON.stringify(sbom,null,2)+'\n'),
    ...(linkage==='UNLINKED_BOOTSTRAP'?bootstrapLicenseReviewResources:licenseReviewResources)(artifacts,Object.fromEntries(Object.entries(originals).map(([n,p])=>[n,inspectArchive(fs.readFileSync(p))])))};
}
function scopedManifest(artifacts,files,linkage='PRELINKED'){return {schema:'bejewely.scoped-candidate.v1',status:'TECHNICAL_CANDIDATE_NOT_RELEASED',
  sourceEvidenceHead:reference.head,sourceEvidenceRun:38514455251,
  upstreamManifestSha256:Object.fromEntries(['braces','node-forge'].map(n=>[n,digest(fs.readFileSync(new URL('../../security/vendor/'+n+'/source-manifest.json',import.meta.url)))])),
  originalAuditRequired:true,officialAuditPass:false,productApplied:false,uploadExecuted:false,artifacts,files,
  ...(linkage==='UNLINKED_BOOTSTRAP'?{publicationLinkage:linkage,finalSourceRepository:'gycha0109-beep/K_beauty',liveAclAndLinkage:'NOT_RUN',
    accessPathDecisionSha256:digest(fs.readFileSync(new URL('../../security/release/sca-b6-package-access-path-decision.json',import.meta.url)))}:{})};}
export function prepareScopedArchives({originals,output,linkage='PRELINKED',noticeDelivery=false}){
  assert.ok(typeof noticeDelivery==='boolean');if(noticeDelivery)assert.equal(linkage,'UNLINKED_BOOTSTRAP');
  assert.ok(!fs.existsSync(output),'new scoped output required');fs.mkdirSync(output,{mode:0o700});
  const artifacts=[];
  for(const name of ['braces','node-forge']){
    const bytes=fs.readFileSync(originals[name]);verifyArchive(name,bytes);const entries=inspectArchive(bytes);
    const source=path.join(output,name);fs.mkdirSync(source);
    for(const [n,b] of Object.entries(entries)){const dest=path.join(source,n);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b,{flag:'wx',mode:0o600});}
    fs.writeFileSync(path.join(source,'package.json'),JSON.stringify(scopedMetadata(JSON.parse(entries['package.json']),digest(bytes),{linkage,noticeDelivery}),null,2)+'\n');
    if(noticeDelivery){
      fs.writeFileSync(path.join(source,embeddedNoticePath),scopedDeliveryNotices(),{flag:'wx',mode:0o600});
      // Explicit npm files whitelists do not necessarily include the addendum.
      // Pack normally, then require the exact resulting inventory; never waive omission.
    }
    const packed=npm(['pack',source,'--ignore-scripts','--offline','--json','--pack-destination',output],output);assert.equal(packed.length,1);
    const archive=path.join(output,packed[0].filename),receipt=verifyScopedArchive(name,bytes,fs.readFileSync(archive),{linkage,noticeDelivery});
    artifacts.push({...receipt,filename:packed[0].filename,archive});
  }
  const resources=scopedResources(artifacts,originals,linkage),files={};
  for(const a of artifacts)resources[a.filename]=fs.readFileSync(a.archive);
  for(const [n,b] of Object.entries(resources)){files[n]={sha256:digest(b),bytes:b.length};if(!n.endsWith('.tgz'))fs.writeFileSync(path.join(output,n),b,{flag:'wx',mode:0o600});}
  const manifest=scopedManifest(artifacts.map(({archive,...a})=>a),files,linkage);
  const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(output,'scoped-candidate.json'),manifestBytes,{flag:'wx',mode:0o600});
  const verified=verifyScopedCandidate({originals,output,expectedLinkage:linkage});assert.equal(verified.candidateSha256,digest(manifestBytes));
  return {...verified,manifest,artifacts};
}

export function verifyScopedCandidate({originals,output,expectedLinkage}){
  const read=n=>{assert.match(n,/^[a-zA-Z0-9_.-]+$/,'unsafe candidate path');const file=path.join(output,n),stat=fs.lstatSync(file);
    assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=24*1024*1024,'bounded physical file required');return fs.readFileSync(file);};
  const manifestBytes=read('scoped-candidate.json'),manifest=JSON.parse(manifestBytes),artifacts=[];
  const linkage=manifest.publicationLinkage||'PRELINKED';
  assert.ok(['PRELINKED','UNLINKED_BOOTSTRAP'].includes(linkage),'unknown candidate linkage');
  if(expectedLinkage)assert.equal(linkage,expectedLinkage,'candidate linkage mismatch');
  for(const name of ['braces','node-forge']){
    const version=name==='braces'?'3.0.3':'1.4.0',filename=scope+'-'+name+'-'+version+'.tgz';
    const noticeDelivery=manifest.artifacts?.find(a=>a.originalName===name)?.noticeDelivery;
    assert.ok(noticeDelivery===undefined||noticeDelivery==='IN_TARBALL_V1','unknown notice delivery mode');
    artifacts.push({...verifyScopedArchive(name,fs.readFileSync(originals[name]),read(filename),{linkage,noticeDelivery:noticeDelivery==='IN_TARBALL_V1'}),filename});
  }
  const resources=scopedResources(artifacts,originals,linkage),files={};for(const a of artifacts)resources[a.filename]=read(a.filename);
  for(const [n,b] of Object.entries(resources)){assert.equal(digest(read(n)),digest(b),'scoped NOTICE/SBOM substitution');files[n]={sha256:digest(b),bytes:b.length};}
  assert.deepEqual(manifest,scopedManifest(artifacts,files,linkage),'scoped manifest/provenance substitution');
  return {candidateSha256:digest(manifestBytes),artifacts,originalAuditRequired:true,officialAudit:'FAIL',releaseApproval:'PENDING',productApplied:false,
    ...(linkage==='UNLINKED_BOOTSTRAP'?{publicationLinkage:linkage,candidateLicensePacketSha256:digest(Buffer.concat(['THIRD-PARTY-NOTICES.md','license-review.json','license-review-sbom.json'].map(n=>Buffer.concat([Buffer.from(n+'\0'),resources[n]]))))}:{})};
}

// A separate localhost-only read server allows synchronous npm children to use real npm: aliases.
// No external registry deployment, upload, authentication, proxy or advisory feed exists here.
export async function startScopedFixture(artifacts,temp){
  const config=path.join(temp,'scoped-fixture.json');fs.writeFileSync(config,JSON.stringify(artifacts),{flag:'wx',mode:0o600});
  const child=fork(fileURLToPath(import.meta.url),['--fixture',config],{stdio:['ignore','ignore','inherit','ipc']});
  const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('fixture readiness timeout'));},10000);
    child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',()=>{clearTimeout(timer);reject(Error('fixture exited before readiness'));});
    child.once('message',m=>{clearTimeout(timer);assert.match(m.base,/^http:\/\/127\.0\.0\.1:\d+\/$/);resolve(m.base);});});
  return {base,stop:()=>child.kill('SIGTERM')};
}
if(process.argv[2]==='--fixture'){
  const artifacts=JSON.parse(fs.readFileSync(process.argv[3])),bytes=new Map();
  for(const a of artifacts){const b=fs.readFileSync(a.archive);assert.equal(digest(b),a.sha256);bytes.set(a.name,b);}
  const server=http.createServer((req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    let requested;try{requested=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1);}catch{res.writeHead(400);res.end();return;}
    const artifact=artifacts.find(a=>a.name===requested||'tarballs/'+a.filename===requested);
    if(!artifact){res.writeHead(404);res.end();return;}
    const body=requested.startsWith('tarballs/')?bytes.get(artifact.name):Buffer.from(JSON.stringify({name:artifact.name,'dist-tags':{latest:artifact.version},versions:{[artifact.version]:{
      ...JSON.parse(inspectArchive(bytes.get(artifact.name))['package.json']),
      dist:{tarball:'http://127.0.0.1:'+server.address().port+'/tarballs/'+artifact.filename,integrity:artifact.sha512,shasum:digest(bytes.get(artifact.name),'sha1')}
    }}}));
    res.writeHead(200,{'content-type':requested.startsWith('tarballs/')?'application/octet-stream':'application/json','content-length':body.length});res.end(req.method==='HEAD'?undefined:body);
  });
  server.listen(0,'127.0.0.1',()=>process.send({base:'http://127.0.0.1:'+server.address().port+'/'}));
  process.on('disconnect',()=>server.close());
}

export function verifyScopedApproval({candidateSha256,approvalBytes,signatures,trust,now=Date.now()}){
  assert.match(candidateSha256,/^[a-f0-9]{64}$/,'verified manifest SHA256 required');
  const a=JSON.parse(approvalBytes),policy=approvalPolicyContext(a,trust,{scoped:true});assert.equal(a.candidateSha256,candidateSha256);
  assert.equal(a.purpose,'SCOPED_UPLOAD_READBACK_ONLY');assert.equal(a.originalAuditRequired,true);assert.equal(a.auditExceptionApproved,false);
  assert.equal(a.registry,'https://npm.pkg.github.com/');assert.equal(a.privateRepository,true);assert.equal(a.immutableVersions,true);
  assert.deepEqual(a.licenseElections&&Object.keys(a.licenseElections).sort(),['braces','node-forge']);assert.equal(a.licenseElections.braces,'MIT');
  assert.ok(['BSD-3-Clause','GPL-2.0'].includes(a.licenseElections['node-forge']));
  assert.deepEqual(Object.keys(a.tarballUrls).sort(),['braces','node-forge']);
  for(const n of Object.keys(a.tarballUrls)){const u=new URL(a.tarballUrls[n]);assert.equal(u.origin,'https://npm.pkg.github.com');
    assert.ok(!u.username&&!u.password&&!u.search&&!u.hash,'credential-bearing readback URL');
    const decoded=decodeURIComponent(u.pathname),version=n==='braces'?'3.0.3':'1.4.0';
    assert.ok(decoded.startsWith('/download/'+scopedName(n)+'/'+version+'/')&&!decoded.split('/').some(x=>x==='..'||x==='.'),'identity/readback mismatch');}
  const expiry=Date.parse(a.expiresAt);assert.ok(Number.isFinite(expiry)&&expiry>now&&expiry-now<=7*24*3600000,'approval validity');
  assert.equal(trust.organizationApproved,true);
  assert.ok(Array.isArray(trust.keys)&&Array.isArray(trust.revokedKeyIds));assert.equal(new Set(trust.keys.map(k=>k.id)).size,trust.keys.length);
  assert.ok(Array.isArray(signatures),'signature list required');
  const roles=new Set(),owners=new Set();
  for(const s of signatures){assert.ok(requiredRoles.includes(s.role)&&!roles.has(s.role),'missing/duplicate/unknown role');
    const k=trust.keys.find(k=>k.id===s.keyId);assert.ok(k&&!trust.revokedKeyIds.includes(k.id),'untrusted/revoked key');
    assert.ok(typeof k.owner==='string'&&k.owner.trim().length>0&&Array.isArray(k.roles)&&k.roles.includes(s.role),'owner/role authorization');
    checkPolicyOwner(policy,k.owner);
    assert.ok(Date.parse(k.notBefore)<=now&&Date.parse(k.notAfter)>=expiry,'key validity');const key=createPublicKey(k.publicKeyPem);assert.equal(key.asymmetricKeyType,'ed25519');
    const sig=Buffer.from(s.signature,'base64');assert.equal(sig.length,64);
    assert.ok(verify(null,Buffer.concat([Buffer.from(policy.prefix+s.role+'\n'),approvalBytes]),key,sig),'signature mismatch');roles.add(s.role);owners.add(normalizeOwner(k.owner));
  }
  assert.deepEqual([...roles].sort(),requiredRoles.slice().sort(),'four responsibility signatures required');checkPolicySigners(policy,owners);
  return {scope:'SCOPED_UPLOAD_READBACK_ONLY',officialAudit:'FAIL',mergeApproved:false,productionApproved:false};
}

// Reusable readback checks; no credential acquisition or network operation runs automatically.
export function assertGithubPrivateMetadata(metadata,name,{stage='FINAL_LINKED',aclEvidence}={}){
  assert.ok(['braces','node-forge'].includes(name),'unknown patch identity');
  assert.equal(metadata.package_type,'npm');assert.equal(metadata.visibility,'private','anonymous denial alone cannot establish GitHub npm privacy');
  assert.equal(metadata.owner?.login,scope,'GitHub package owner mismatch');
  assert.ok([name,scopedName(name)].includes(metadata.name),'GitHub package identity mismatch');
  assert.ok(['FINAL_LINKED','INITIAL_UNLINKED','FINAL_LINKED_NONINHERITED'].includes(stage),'unknown linkage proof stage');
  if(stage==='INITIAL_UNLINKED')assert.ok(!metadata.repository,'bootstrap unexpectedly linked to a repository');
  else assert.equal(metadata.repository?.full_name,'gycha0109-beep/K_beauty','unreviewed repository inheritance/linkage');
  if(stage==='FINAL_LINKED_NONINHERITED'){
    // Standard metadata cannot establish effective ACL inheritance or Actions grants.
    // Callers must supply separately reviewed owner/UI proof, never inferred defaults.
    assert.equal(aclEvidence?.packageName,scopedName(name));assert.equal(aclEvidence.visibility,'private');
    assert.equal(aclEvidence.sourceRepository,'gycha0109-beep/K_beauty');assert.equal(aclEvidence.inheritsPermissions,false);
    assert.ok(Array.isArray(aclEvidence.actionsAccess));
    for(const a of aclEvidence.actionsAccess){assert.equal(a.repository,'gycha0109-beep/K_beauty');assert.equal(a.role,'read');}
    assert.ok(aclEvidence.actionsAccess.length<=1,'unexpected additional Actions grants');
    assert.equal(aclEvidence.forkIsolationReviewed,true,'Actions Read is not proof of fork isolation');
    assert.match(aclEvidence.evidenceSha256||'',/^[a-f0-9]{64}$/,'separate effective ACL evidence required');
  }
}
export function verifyScopedReadbackBytes({metadata,originalName,originalBytes,artifact,bytes,stage='FINAL_LINKED',aclEvidence}){
  if(artifact.publicationLinkage==='UNLINKED_BOOTSTRAP')assert.ok(['INITIAL_UNLINKED','FINAL_LINKED_NONINHERITED'].includes(stage),'bootstrap requires explicit staged proof');
  assertGithubPrivateMetadata(metadata,originalName,{stage,aclEvidence});assert.equal(digest(bytes),artifact.sha256,'authenticated readback hash mismatch');
  const receipt=verifyScopedArchive(originalName,originalBytes,bytes,{linkage:artifact.publicationLinkage||'PRELINKED',noticeDelivery:artifact.noticeDelivery==='IN_TARBALL_V1'});assert.equal(receipt.sha512,artifact.sha512);return receipt;
}
export async function assertScopedAccessDenied(url,{unauthorizedToken,fetcher=fetch}={}){
  const u=new URL(url);assert.equal(u.origin,'https://npm.pkg.github.com');assert.ok(!u.username&&!u.password&&!u.search&&!u.hash);
  const r=await fetcher(u.href,{...(unauthorizedToken?{headers:{Authorization:'Bearer '+unauthorizedToken}}:{}),redirect:'error',signal:AbortSignal.timeout(10000)});
  try{assert.ok([401,403,404].includes(r.status),'GitHub anonymous/unprivileged access unexpectedly allowed or failed');}finally{await r.body?.cancel();}
}
