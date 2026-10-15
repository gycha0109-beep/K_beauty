import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {carrierMetadata} from './sca-release-github-carrier.mjs';
import {scopedMetadata,verifyScopedApproval,verifyScopedArchive,assertGithubPrivateMetadata,assertScopedAccessDenied} from './sca-release-scoped.mjs';
import {spawnSync} from 'node:child_process';
import {inspectArchive,verifyArchive,verifyApproval,registryUrl,requiredRoles,reference,browserReference,assertNoLifecycleHooks,assertPrivateReadback} from './sca-release-bundle.mjs';

function fixture(){
  const now=Date.parse('2026-10-14T06:00:00Z'),keys=[],privateKeys=[];
  for(let i=0;i<4;i++){const k=generateKeyPairSync('ed25519');privateKeys.push(k.privateKey);keys.push({id:'test-only-'+i,owner:i%2?'Test Bob':'Test Alice',roles:[requiredRoles[i]],notBefore:'2026-10-14T00:00:00Z',notAfter:'2026-11-14T00:00:00Z',publicKeyPem:k.publicKey.export({type:'spki',format:'pem'})});}
  const approval={schema:'bejewely.sca-release-upload-approval.v1',candidateSha256:'a'.repeat(64),registry:'https://registry.test.internal/reviewed/',
    privateRepository:true,immutableVersions:true,noUpstreamShadowing:true,purpose:'UPLOAD_AND_READBACK_ONLY',auditGateRemainsRequired:true,auditExceptionApproved:false,
    expiresAt:'2026-10-15T00:00:00Z',tarballUrls:{braces:'https://registry.test.internal/reviewed/braces/-/braces-3.0.3.tgz','node-forge':'https://registry.test.internal/reviewed/node-forge/-/node-forge-1.4.0.tgz'}};
  approval.licenseElections={braces:'MIT','node-forge':'BSD-3-Clause'};
  const trust={schema:'bejewely.sca-release-trust.v1',organizationApproved:true,keys,revokedKeyIds:[]};
  const build=()=>{const approvalBytes=Buffer.from(JSON.stringify(approval));return {candidateSha256:approval.candidateSha256,approvalBytes,
    signatures:requiredRoles.map((role,i)=>({role,keyId:keys[i].id,signature:sign(null,Buffer.concat([Buffer.from('BEJEWELY-SCA-UPLOAD-v1:'+role+'\n'),approvalBytes]),privateKeys[i]).toString('base64')})),trust,now};};
  return {approval,trust,build};
}
function tar(name='package/package.json',type='0',body=Buffer.from('{}')){
  const h=Buffer.alloc(512);h.write(name);h.write('0000644\0',100);h.write('0000000\0',108);h.write('0000000\0',116);
  h.write(body.length.toString(8).padStart(11,'0')+'\0',124);h.write('00000000000\0',136);h.fill(32,148,156);h.write(type,156);h.write('ustar\0',257);
  const sum=h.reduce((a,b)=>a+b,0);h.write(sum.toString(8).padStart(6,'0')+'\0 ',148);
  return Buffer.concat([h,body,Buffer.alloc((512-body.length%512)%512)]);
}
const archive=(...entries)=>gzipSync(Buffer.concat([...entries,Buffer.alloc(1024)]));
test('GitHub npm cannot admit the existing unscoped bundle, including namespace paths',()=>{
  for(const url of ['https://npm.pkg.github.com/','https://npm.pkg.github.com/gycha0109-beep/'])assert.throws(()=>registryUrl(url),/requires scoped identities/);
});
test('GitHub carrier is a non-installable review envelope; identities and audit stay explicit',()=>{
  const m=carrierMetadata('gycha0109-beep','a'.repeat(64));
  assert.equal(m.name,'@gycha0109-beep/bejewely-sca-artifacts');assert.equal(m.private,true);
  assert.equal(m.bejewely.productInstallable,false);assert.equal(m.bejewely.officialAudit,'FAIL');
  assert.deepEqual(m.bejewely.originalIdentities,['braces@3.0.3','node-forge@1.4.0']);
  assert.equal(m.dependencies,undefined);assert.equal(m.scripts,undefined);
  for(const scope of ['UpperCase','../escape','bad/scope','@owner',''])assert.throws(()=>carrierMetadata(scope,'a'.repeat(64)));
  assert.throws(()=>carrierMetadata('owner','not-a-digest'));
});
test('tar parser accepts a bounded regular metadata entry without filesystem extraction',()=>assert.equal(inspectArchive(archive(tar()))['package.json'].toString(),'{}'));
test('tar traversal, hard/symbolic links, devices and extended headers are rejected',()=>{
  for(const n of ['package/../package.json','package//package.json','/package/package.json','package/./package.json','package\\package.json'])assert.throws(()=>inspectArchive(archive(tar(n))));
  for(const type of ['1','2','3','4','5','6','x','g','L'])assert.throws(()=>inspectArchive(archive(tar(undefined,type))));
});
test('duplicate entries, truncation and corrupt checksum are rejected',()=>{
  assert.throws(()=>inspectArchive(archive(tar(),tar())),/duplicate/);
  assert.throws(()=>inspectArchive(gzipSync(tar())),/end marker/);
  const t=tar();t[110]^=1;assert.throws(()=>inspectArchive(archive(t)),/checksum/);
});
test('synthetic archives cannot replace real reviewed packages',()=>assert.throws(()=>verifyArchive('braces',archive(tar())),/independently verified/));
test('upstream non-lifecycle test/benchmark metadata is preserved, install/publish hooks rejected',()=>{
  assertNoLifecycleHooks({scripts:{test:'mocha',benchmark:'node benchmark'}});
  for(const name of ['preinstall','install','postinstall','prepublish','prepublishOnly','prepare','prepack','postpack','uninstall'])assert.throws(()=>assertNoLifecycleHooks({scripts:{[name]:'unreviewed hook'}}));
});
test('B4 reference retains failing original audit and unreleased provenance',()=>{
  assert.equal(reference.audits.candidateFull.exit,1);assert.equal(reference.audits.candidateProduction.exit,1);
  assert.equal(reference.audits.candidateFull.counts.high,22);assert.equal(reference.audits.candidateProduction.counts.high,19);
  assert.equal(reference.releaseApproved,false);assert.equal(reference.appSourceGraphChanged,false);
  assert.equal(browserReference.browserCompleteTempPack.sha256,reference.artifacts.forge.sha256);
  assert.deepEqual(browserReference.toolchain,{webpack:'4.44.1','webpack-cli':'3.3.12'});
  assert.equal(browserReference.distributionApproved,false);
});
test('four signed organization roles admit upload/readback only; no merge/production/audit pass',()=>{
  const r=verifyApproval(fixture().build());assert.equal(r.scope,'UPLOAD_AND_READBACK_ONLY');assert.equal(r.officialAudit,'FAIL');assert.equal(r.mergeApproved,false);assert.equal(r.productionApproved,false);
});
test('unsigned/template approvals are rejected',()=>{
  const f=fixture(),v=f.build();v.signatures=[];assert.throws(()=>verifyApproval(v),/all four/);
  f.trust.organizationApproved=false;assert.throws(()=>verifyApproval(f.build()),/trust policy/);
});
test('scoped metadata changes only four explicit fields; all upstream behavior/license fields stay',()=>{
  const original={name:'braces',version:'3.0.3',license:'MIT',main:'index.js',scripts:{test:'mocha'},dependencies:{'fill-range':'^7.1.1'}};
  const next=scopedMetadata(original,'b'.repeat(64));assert.equal(next.name,'@gycha0109-beep/braces');assert.equal(next.version,original.version);
  const restored={...next,name:original.name};for(const n of ['repository','publishConfig','bejewelyPatch'])delete restored[n];
  assert.deepEqual(restored,original);assert.equal(next.bejewelyPatch.originalArchiveSha256,'b'.repeat(64));
  assert.throws(()=>verifyScopedArchive('braces',archive(tar()),archive(tar())),/independently verified/);
});
function scopedFixture(){
  const f=fixture();f.approval.schema='bejewely.scoped-upload-approval.v1';f.approval.purpose='SCOPED_UPLOAD_READBACK_ONLY';
  f.approval.registry='https://npm.pkg.github.com/';f.approval.originalAuditRequired=true;
  f.approval.tarballUrls={braces:'https://npm.pkg.github.com/download/@gycha0109-beep/braces/3.0.3/abc',
    'node-forge':'https://npm.pkg.github.com/download/@gycha0109-beep/node-forge/1.4.0/def'};
  // fixture builds signatures in the original domain; regenerate ephemeral keys ONLY for scoped tests.
  const privateKeys=[];for(const k of f.trust.keys){const pair=generateKeyPairSync('ed25519');privateKeys.push(pair.privateKey);k.publicKeyPem=pair.publicKey.export({type:'spki',format:'pem'});}
  const build=()=>{const v=f.build();v.signatures=requiredRoles.map((role,i)=>({role,keyId:f.trust.keys[i].id,
    signature:sign(null,Buffer.concat([Buffer.from('BEJEWELY-SCA-SCOPED-v1:'+role+'\n'),v.approvalBytes]),privateKeys[i]).toString('base64')}));return v;};
  return {...f,build};
}
test('scoped four-role admission preserves original audit and forbids cross-schema approvals',()=>{
  assert.throws(()=>verifyScopedApproval(fixture().build()));const f=scopedFixture(),v=f.build();
  assert.equal(verifyScopedApproval(v).officialAudit,'FAIL');assert.equal(verifyScopedApproval(v).mergeApproved,false);
  assert.throws(()=>verifyApproval(v));v.approvalBytes=Buffer.from(v.approvalBytes.toString()+' ');assert.throws(()=>verifyScopedApproval(v),/signature mismatch/);
});
test('scoped approvals reject missing roles, self approval, revocation, expiry, exceptions and license shortcuts',()=>{
  const a=scopedFixture(),v=a.build();v.signatures.pop();assert.throws(()=>verifyScopedApproval(v));
  const b=scopedFixture();for(const k of b.trust.keys)k.owner='Single owner';assert.throws(()=>verifyScopedApproval(b.build()),/two named/);
  const c=scopedFixture();c.trust.revokedKeyIds=[c.trust.keys[0].id];assert.throws(()=>verifyScopedApproval(c.build()),/revoked/);
  const d=scopedFixture();d.approval.expiresAt='2026-10-13T00:00:00Z';assert.throws(()=>verifyScopedApproval(d.build()));
  const e=scopedFixture();e.approval.auditExceptionApproved=true;assert.throws(()=>verifyScopedApproval(e.build()));
  const g=scopedFixture();g.approval.licenseElections['node-forge']='invented';assert.throws(()=>verifyScopedApproval(g.build()));
});
test('scoped readback binding rejects public origins, embedded tokens and identity/version substitutions',()=>{
  for(const url of ['https://registry.npmjs.org/download/@gycha0109-beep/braces/3.0.3/abc',
    'https://token@npm.pkg.github.com/download/@gycha0109-beep/braces/3.0.3/abc',
    'https://npm.pkg.github.com/download/@gycha0109-beep/braces-evil/3.0.3/abc',
    'https://npm.pkg.github.com/download/@gycha0109-beep/braces/3.0.4/abc',
    'https://npm.pkg.github.com/download/@gycha0109-beep/braces/3.0.3/abc?token=secret']){
    const f=scopedFixture();f.approval.tarballUrls.braces=url;assert.throws(()=>verifyScopedApproval(f.build()));
  }
});
test('GitHub private metadata must bind owner, identity and repository; auth-only public packages are rejected',()=>{
  const valid={package_type:'npm',visibility:'private',owner:{login:'gycha0109-beep'},name:'braces',repository:{full_name:'gycha0109-beep/K_beauty'}};
  assertGithubPrivateMetadata(valid,'braces');
  for(const m of [{...valid,visibility:'public'},{...valid,owner:{login:'someone-else'}},{...valid,name:'unrelated'},
    {...valid,repository:{full_name:'someone-else/repo'}}])assert.throws(()=>assertGithubPrivateMetadata(m,'braces'));
});
test('scoped anonymous and authenticated unprivileged readback must both deny, without redirect credentials',async()=>{
  const url='https://npm.pkg.github.com/download/@gycha0109-beep/braces/3.0.3/abc';
  for(const status of [401,403,404])for(const unauthorizedToken of [undefined,'TEST_ONLY_NOT_A_REAL_TOKEN'])await assertScopedAccessDenied(url,{unauthorizedToken,fetcher:async(u,o)=>{
    assert.equal(o.redirect,'error');assert.equal(o.headers?.Authorization,unauthorizedToken?'Bearer '+unauthorizedToken:undefined);return new Response(null,{status});
  }});
  for(const status of [200,302,500])await assert.rejects(()=>assertScopedAccessDenied(url,{fetcher:async()=>new Response(null,{status})}));
});
test('document byte tampering or candidate substitution is rejected',()=>{
  const v=fixture().build();v.approvalBytes=Buffer.from(v.approvalBytes.toString()+' ');assert.throws(()=>verifyApproval(v),/signature mismatch/);
  const v2=fixture().build();v2.candidateSha256='b'.repeat(64);assert.throws(()=>verifyApproval(v2));
});
test('wrong role, duplicate role and revoked key fail closed',()=>{
  const f=fixture(),v=f.build();v.signatures[0].role='maintenance';assert.throws(()=>verifyApproval(v));
  const v2=fixture().build();v2.signatures[1]=v2.signatures[0];assert.throws(()=>verifyApproval(v2),/duplicate/);
  f.trust.revokedKeyIds.push('test-only-0');assert.throws(()=>verifyApproval(f.build()),/revoked/);
});
test('expired approvals and keys or excessive approval window are rejected',()=>{
  const f=fixture();f.approval.expiresAt='2026-10-13T00:00:00Z';assert.throws(()=>verifyApproval(f.build()),/expired/);
  f.approval.expiresAt='2026-10-30T00:00:00Z';assert.throws(()=>verifyApproval(f.build()),/seven-day/);
  f.approval.expiresAt='2026-10-15T00:00:00Z';f.trust.keys[0].notAfter='2026-10-14T08:00:00Z';assert.throws(()=>verifyApproval(f.build()),/key invalid/);
});
test('single-owner self approval is rejected',()=>{const f=fixture();f.trust.keys.forEach(k=>k.owner='Test sole owner');assert.throws(()=>verifyApproval(f.build()),/two named owners/);});
test('security exception, production permission and mutable/public registry are not admitted',()=>{
  for(const [k,value]of [['auditExceptionApproved',true],['auditGateRemainsRequired',false],['purpose','PRODUCTION'],['immutableVersions',false],['privateRepository',false],['noUpstreamShadowing',false]]){
    const f=fixture();f.approval[k]=value;assert.throws(()=>verifyApproval(f.build()));
  }
  for(const u of ['https://registry.npmjs.org/','http://registry.internal/','https://user:token@registry.internal/','https://registry.example.invalid/','https://registry.internal/no-slash'])assert.throws(()=>registryUrl(u));
});
test('credential-bearing or cross-origin/outside-repository readback URLs rejected',()=>{
  for(const url of ['https://other.test.internal/reviewed/braces/-/braces-3.0.3.tgz','https://registry.test.internal/outside/braces-3.0.3.tgz','https://token@registry.test.internal/reviewed/braces-3.0.3.tgz','https://registry.test.internal/reviewed/braces-3.0.3.tgz?token=secret']){const f=fixture();f.approval.tarballUrls.braces=url;assert.throws(()=>verifyApproval(f.build()));}
});
test('operator upload/staging CLIs fail before execution when approval inputs are absent',()=>{
  for(const file of ['publish-approved-sca-candidate.mjs','stage-approved-sca-product-graph.mjs']){
    const p=spawnSync(process.execPath,[new URL(file,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],{encoding:'utf8',timeout:5000});
    assert.ok(!p.error&&p.status!==0);assert.ok(!p.stdout.includes('UPLOAD_READBACK')&&!p.stdout.includes('PRIVATE_GRAPH'));
  }
});
test('dual-license election is signed and cannot be omitted or invented',()=>{
  const f=fixture();delete f.approval.licenseElections;assert.throws(()=>verifyApproval(f.build()),/license elections/);
  f.approval.licenseElections={braces:'MIT','node-forge':'arbitrary-license'};assert.throws(()=>verifyApproval(f.build()),/reviewer decision/);
});
test('anonymous private readback denies public access and never attaches credentials',async()=>{
  for(const status of [401,403,404])await assertPrivateReadback('https://registry.test.internal/archive',async(url,options)=>{
    assert.equal(options.headers,undefined);assert.equal(options.redirect,'error');return new Response(null,{status});
  });
  for(const status of [200,302,500])await assert.rejects(()=>assertPrivateReadback('https://registry.test.internal/archive',async()=>new Response(null,{status})),/anonymous/);
});
