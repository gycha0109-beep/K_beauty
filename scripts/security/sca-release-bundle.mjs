/** Offline release admission. No audit exception, upload, package rename or version change. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, createPublicKey, verify} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const digest=(b,algorithm='sha256')=>createHash(algorithm).update(b).digest('hex');
export const reference=JSON.parse(fs.readFileSync(path.join(root,'security/release/sca-b6-validated-source.json')));
export const browserReference=JSON.parse(fs.readFileSync(path.join(root,'security/release/sca-b6-browser-provenance.json')));
const upstream=Object.fromEntries(['braces','node-forge'].map(n=>[n,JSON.parse(fs.readFileSync(path.join(root,'security/vendor',n,'source-manifest.json')))]));
export const requiredRoles=['security','license-redistribution','maintenance','distribution'];
const names=['braces','node-forge'];
const filenames={'braces':'braces-3.0.3.tgz','node-forge':'node-forge-1.4.0.tgz'};
const requireTrue=(v,message)=>assert.equal(v,true,message);
function read(file,max=24*1024*1024) {
  const st=fs.lstatSync(file); assert.ok(st.isFile()&&!st.isSymbolicLink(),'regular file required');
  assert.ok(st.size<=max,'file exceeds bounded size'); return fs.readFileSync(file);
}
function write(file,bytes){fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600});}
function safeName(s){assert.ok(typeof s==='string'&&/^[a-zA-Z0-9_.-]+$/.test(s)&&s!=='.'&&s!=='..','unsafe bundle filename');return s;}
function octal(b){const s=b.toString('ascii').replace(/\0/g,'').trim();assert.match(s,/^[0-7]*$/,'unsupported tar numeric field');return s?parseInt(s,8):0;}

// Do not extract untrusted tar archives to disk. Reject links, duplicate/escaping entries,
// special devices, extended headers and oversized gzip expansion before parsing metadata.
export function inspectArchive(bytes) {
  assert.ok(bytes.length<=24*1024*1024,'compressed archive too large');
  const tar=gunzipSync(bytes,{maxOutputLength:64*1024*1024}),files=Object.create(null);
  let offset=0,ended=false;
  while(offset+512<=tar.length){
    const h=tar.subarray(offset,offset+512);
    if(h.every(b=>b===0)){assert.ok(tar.subarray(offset).every(b=>b===0),'nonzero trailing tar bytes');ended=true;break;}
    const checksum=octal(h.subarray(148,156));
    let actual=0;for(let i=0;i<512;i++)actual+=i>=148&&i<156?32:h[i];
    assert.equal(actual,checksum,'tar checksum mismatch');
    const text=b=>b.toString('utf8').split('\0')[0];
    const prefix=text(h.subarray(345,500)),n=(prefix?prefix+'/':'')+text(h.subarray(0,100));
    assert.ok(n.startsWith('package/')&&!n.includes('\\')&&!n.includes('\ufffd'),'invalid archive path');
    const rel=n.slice(8);assert.ok(rel&&!rel.split('/').some(x=>x==='..'||x==='.'||x===''),'escaping archive path');
    assert.ok(h[156]===0||h[156]===48,'tar entry must be regular file');
    assert.ok(!Object.hasOwn(files,rel),'duplicate tar entry');
    const size=octal(h.subarray(124,136));assert.ok(size<=20*1024*1024&&offset+512+size<=tar.length,'invalid tar size');
    files[rel]=tar.subarray(offset+512,offset+512+size);
    offset+=512+Math.ceil(size/512)*512;
  }
  assert.ok(ended,'tar end marker missing');assert.ok(files['package.json'],'package metadata missing');
  return files;
}
export function verifyArchive(name,bytes) {
  const expected=reference.installed.find(p=>p.name===name);assert.ok(expected,'unknown package');
  const packed=name==='braces'?reference.artifacts.braces:reference.artifacts.forge;
  assert.equal(digest(bytes),packed.sha256,'archive differs from independently verified candidate');
  const files=inspectArchive(bytes),inventory=Object.fromEntries(Object.entries(files).map(([n,b])=>[n,digest(b)]).sort(([a],[b])=>a.localeCompare(b)));
  assert.deepEqual(inventory,expected.fileSha256,'source/dist/license byte mismatch');
  const meta=JSON.parse(files['package.json']);assert.equal(meta.name,name);assert.equal(meta.version,expected.version);
  assertNoLifecycleHooks(meta);
  assert.ok(!meta.bundleDependencies&&!meta.bundledDependencies,'bundled dependency not allowed');
  assert.ok(files.LICENSE,'original LICENSE missing');
  return {name,version:meta.version,filename:filenames[name],sha256:digest(bytes),sha512:'sha512-'+createHash('sha512').update(bytes).digest('base64'),
    license:meta.license,licenseSha256:digest(files.LICENSE),installedContentSha256:expected.contentSha256,fileCount:Object.keys(files).length};
}
export function assertNoLifecycleHooks(meta){
  assert.deepEqual(Object.keys(meta.scripts||{}).filter(n=>/^(?:preinstall|install|postinstall|prepublish|prepublishOnly|prepare|prepack|postpack|preuninstall|uninstall|postuninstall)$/.test(n)),[],
    'candidate lifecycle scripts not allowed');
}
function sbomFor(artifacts) {
  return {bomFormat:'CycloneDX',specVersion:'1.6',version:1,
    metadata:{component:{type:'application',name:'BEJEWELY-reviewed-patch-candidate',version:reference.head}},
    components:artifacts.map(a=>({type:'library',name:a.name,version:a.version,
      'bom-ref':a.name+'@'+a.version+'#'+a.sha256,
      hashes:[{alg:'SHA-256',content:a.sha256},{alg:'SHA-512',content:Buffer.from(a.sha512.slice(7),'base64').toString('hex')}],
      licenses:[{license:{name:typeof a.license==='string'?a.license:JSON.stringify(a.license)}}],
      properties:[{name:'bejewely:status',value:'CANDIDATE_NOT_RELEASED'},
        {name:'bejewely:original-license-sha256',value:a.licenseSha256},
        {name:'bejewely:installed-content-sha256',value:a.installedContentSha256}]}))};
}
function noticeFor(artifacts){return '# BEJEWELY security patch candidate\n\nOriginal names and versions retained; NOT an official upstream release.\n'
  +artifacts.map(a=>`\n${a.name}@${a.version}: original LICENSE preserved (SHA256 ${a.licenseSha256}); ${typeof a.license==='string'?a.license:JSON.stringify(a.license)}.\n`).join('')
  +'\nSource, patches, browser bundles, original package provenance and test limits are recorded in validated-source.json and the pinned vendor manifests. Redistribution approval is pending. No audit exception or product release approval is conferred by this bundle.\n';}

export function prepareBundle({braces,forge,output}) {
  assert.ok(!fs.existsSync(output),'output must be new isolated directory');
  const bytes=[read(braces),read(forge)];
  const artifacts=names.map((n,i)=>verifyArchive(n,bytes[i]));
  assert.equal(browserReference.browserCompleteTempPack.sha256,artifacts[1].sha256,'browser provenance tarball mismatch');
  requireTrue(browserReference.browserCompleteTempPackReproducibleWithinRunner,'browser reproducibility proof missing');
  assert.equal(browserReference.npmInstalledConsumer.originalAppGraphUnaffected,true);
  requireTrue(reference.fullGraphInstalled,'full graph proof missing');
  requireTrue(reference.checks.every(c=>c.status==='PASS'),'compatibility proof failed');
  assert.equal(reference.releaseApproved,false,'reference must not claim approval');
  fs.mkdirSync(output,{recursive:true,mode:0o700});
  const resources={};
  try{
    for(let i=0;i<names.length;i++)resources[filenames[names[i]]]=bytes[i];
    resources['validated-source.json']=Buffer.from(JSON.stringify(reference,null,2)+'\n');
    resources['upstream-provenance.json']=Buffer.from(JSON.stringify(upstream,null,2)+'\n');
    resources['browser-build-provenance.json']=Buffer.from(JSON.stringify(browserReference,null,2)+'\n');
    resources['sbom.json']=Buffer.from(JSON.stringify(sbomFor(artifacts),null,2)+'\n');
    resources['NOTICE.md']=Buffer.from(noticeFor(artifacts));
    const files=Object.fromEntries(Object.entries(resources).map(([n,b])=>[n,{sha256:digest(b),bytes:b.length}]));
    for(const [n,b]of Object.entries(resources))write(path.join(output,n),b);
    const manifest={schema:'bejewely.sca-release-candidate.v1',sourceEvidenceHead:reference.head,
      sourceEvidenceRun:38514455251,status:'CANDIDATE_ONLY_NOT_RELEASED',
      officialAuditPass:false,auditPolicyChanged:false,artifacts,files};
    write(path.join(output,'release-candidate.json'),JSON.stringify(manifest,null,2)+'\n');
    return verifyBundle(output);
  }catch(e){fs.rmSync(output,{recursive:true,force:true});throw e;}
}
export function verifyBundle(dir) {
  assert.ok(fs.lstatSync(dir).isDirectory()&&!fs.lstatSync(dir).isSymbolicLink(),'bundle directory must be physical');
  const manifestBytes=read(path.join(dir,'release-candidate.json'));
  const m=JSON.parse(manifestBytes);
  assert.equal(m.schema,'bejewely.sca-release-candidate.v1');assert.equal(m.status,'CANDIDATE_ONLY_NOT_RELEASED');
  assert.equal(m.sourceEvidenceHead,reference.head);assert.equal(m.sourceEvidenceRun,38514455251);
  assert.equal(m.officialAuditPass,false);assert.equal(m.auditPolicyChanged,false);
  assert.deepEqual(Object.keys(m.files).sort(),['NOTICE.md','braces-3.0.3.tgz','node-forge-1.4.0.tgz','sbom.json','validated-source.json','upstream-provenance.json','browser-build-provenance.json'].sort());
  assert.deepEqual(fs.readdirSync(dir).sort(),[...Object.keys(m.files),'release-candidate.json'].sort(),'unreviewed bundle file');
  for(const [n,h]of Object.entries(m.files)){const b=read(path.join(dir,safeName(n)));assert.equal(digest(b),h.sha256,'bundle checksum mismatch');assert.equal(b.length,h.bytes);}
  assert.deepEqual(JSON.parse(read(path.join(dir,'validated-source.json'))),reference,'substituted compatibility/audit evidence');
  assert.deepEqual(JSON.parse(read(path.join(dir,'upstream-provenance.json'))),upstream,'substituted upstream/patch provenance');
  assert.deepEqual(JSON.parse(read(path.join(dir,'browser-build-provenance.json'))),browserReference,'substituted browser build/RSA/toolchain provenance');
  const artifacts=names.map(n=>verifyArchive(n,read(path.join(dir,filenames[n]))));
  assert.deepEqual(m.artifacts,artifacts,'substituted artifact metadata');
  assert.deepEqual(JSON.parse(read(path.join(dir,'sbom.json'))),sbomFor(artifacts),'invalid SBOM provenance/license');
  assert.equal(read(path.join(dir,'NOTICE.md')).toString(),noticeFor(artifacts),'NOTICE mismatch');
  return {candidateSha256:digest(manifestBytes),artifacts,codePatchBytes:'PASS',provenance:'PINNED_B3_B4_EVIDENCE',
    officialAudit:'FAIL',fullHigh:reference.audits.candidateFull.counts.high,productionHigh:reference.audits.candidateProduction.counts.high,
    releaseApproval:'PENDING',productApplied:false};
}
export function registryUrl(value){
  const u=new URL(value);assert.equal(u.protocol,'https:','HTTPS registry required');
  assert.ok(!u.username&&!u.password&&!u.search&&!u.hash,'registry credentials/query forbidden');
  assert.notEqual(u.hostname,'npm.pkg.github.com','GitHub Packages requires scoped identities; this immutable unscoped B6 bundle cannot be directly published or staged there');
  assert.ok(!/(^|\.)(npmjs\.(org|com)|example\.(invalid|com|org)|localhost)$/.test(u.hostname)&&!u.hostname.endsWith('.invalid'),'public npm/placeholder registry forbidden');
  assert.ok(u.pathname.endsWith('/')&&!u.pathname.includes('%'),'registry URL must end with slash and use unambiguous path');return u;
}
export function verifyApproval({candidateSha256,approvalBytes,signatures,trust,now=Date.now()}) {
  const a=JSON.parse(approvalBytes);
  assert.equal(a.schema,'bejewely.sca-release-upload-approval.v1');assert.equal(a.candidateSha256,candidateSha256);
  assert.equal(a.purpose,'UPLOAD_AND_READBACK_ONLY');requireTrue(a.auditGateRemainsRequired,'audit gate must remain required');
  assert.equal(a.auditExceptionApproved,false,'this interface cannot approve security exceptions');
  assert.deepEqual(Object.keys(a.licenseElections||{}).sort(),names.slice().sort(),'explicit license elections required');
  assert.equal(a.licenseElections.braces,'MIT');
  assert.ok(['BSD-3-Clause','GPL-2.0'].includes(a.licenseElections['node-forge']),'forge dual-license election requires reviewer decision');
  for(const p of ['privateRepository','immutableVersions','noUpstreamShadowing'])requireTrue(a[p],p+' requires organization approval');
  const registry=registryUrl(a.registry);
  const expires=Date.parse(a.expiresAt);assert.ok(Number.isFinite(expires)&&expires>now&&expires-now<=7*24*3600000,'approval expired or exceeds seven-day window');
  assert.equal(trust.schema,'bejewely.sca-release-trust.v1');requireTrue(trust.organizationApproved,'organization trust policy missing');
  assert.ok(Array.isArray(trust.keys)&&Array.isArray(trust.revokedKeyIds));
  assert.equal(new Set(trust.keys.map(k=>k.id)).size,trust.keys.length,'duplicate trust key');
  assert.deepEqual(Object.keys(a.tarballUrls).sort(),names.slice().sort());
  for(const n of names){const u=new URL(a.tarballUrls[n]);assert.equal(u.origin,registry.origin,'tarball outside registry origin');
    assert.ok(!u.pathname.includes('%')&&u.pathname.startsWith(registry.pathname)&&u.pathname.endsWith('/'+filenames[n]),'tarball outside approved repository');
    assert.ok(!u.username&&!u.password&&!u.search&&!u.hash,'unsafe tarball URL');}
  assert.ok(Array.isArray(signatures));
  const roles=new Set(),signers=new Set();
  for(const s of signatures){
    assert.ok(requiredRoles.includes(s.role),'unknown approval role');assert.ok(!roles.has(s.role),'duplicate approval role');
    const k=trust.keys.find(k=>k.id===s.keyId);assert.ok(k&&!trust.revokedKeyIds.includes(k.id),'untrusted or revoked signing key');
    assert.ok(typeof k.owner==='string'&&k.owner.trim().length>0,'named responsible owner missing');
    assert.ok(Array.isArray(k.roles)&&k.roles.includes(s.role),'signer not authorized for role');
    assert.ok(Date.parse(k.notBefore)<=now&&Date.parse(k.notAfter)>=expires,'key invalid through approval window');
    const key=createPublicKey(k.publicKeyPem);assert.equal(key.asymmetricKeyType,'ed25519','Ed25519 approval key required');
    const sig=Buffer.from(s.signature,'base64');assert.equal(sig.length,64,'invalid approval signature');
    // Bind the role to the exact document bytes, including registry, digest and expiry.
    assert.ok(verify(null,Buffer.concat([Buffer.from('BEJEWELY-SCA-UPLOAD-v1:'+s.role+'\n'),approvalBytes]),key,sig),'approval signature mismatch');
    roles.add(s.role);signers.add(k.owner);
  }
  assert.deepEqual([...roles].sort(),requiredRoles.slice().sort(),'all four organizational approvals required');
  assert.ok(signers.size>=2,'security/redistribution approval requires at least two named owners');
  return {approval:a,scope:'UPLOAD_AND_READBACK_ONLY',officialAudit:'FAIL',mergeApproved:false,productionApproved:false};
}
export function loadApprovedBundle({bundle,approval,signatures,trust}) {
  const receipt=verifyBundle(bundle);
  return {...verifyApproval({candidateSha256:receipt.candidateSha256,approvalBytes:read(approval),signatures:JSON.parse(read(signatures)),trust:JSON.parse(read(trust))}),receipt};
}
export function requirePinnedTrust(file){
  assert.match(process.env.SCA_TRUST_POLICY_SHA256||'',/^[a-f0-9]{64}$/,'organization-pinned SCA_TRUST_POLICY_SHA256 required');
  assert.equal(digest(read(file)),process.env.SCA_TRUST_POLICY_SHA256,'organization trust-policy fingerprint mismatch');
}
export async function assertPrivateReadback(url,fetcher=fetch){
  const r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
  try{assert.ok([401,403,404].includes(r.status),'anonymous archive read must be denied; stop product promotion and contact distribution owner');}
  finally{await r.body?.cancel();}
}
export function args(argv,allowed){const a={};for(let i=0;i<argv.length;i+=2){assert.ok(allowed.includes(argv[i])&&argv[i+1]&&!argv[i+1].startsWith('--'),'invalid CLI option');assert.ok(!a[argv[i]],'duplicate CLI option');a[argv[i]]=argv[i+1];}return a;}
