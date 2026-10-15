/** Dormant operator CLI: never invoked by CI. Signed actual release approval required. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {args,verifyBundle,requirePinnedTrust} from './sca-release-bundle.mjs';
import {verifyScopedCandidate,verifyScopedApproval,verifyScopedReadbackBytes,assertScopedAccessDenied} from './sca-release-scoped.mjs';

export function checkScopedExecutionControls(approval){
  assert.equal(approval.schema,'bejewely.scoped-upload-approval.v2');
  assert.equal(approval.uploadApproved,true);assert.equal(approval.redistributionApproval?.approved,true);
  const c=approval.operationalChecks;
  for(const key of ['noChargeControlsVerified','privateAclReviewed','noticeDeliveryReviewed','credentialsProvisioned'])
    assert.equal(c?.[key],true,'signed operational evidence required: '+key);
  assert.match(c.evidenceSha256||'',/^[a-f0-9]{64}$/,'operational evidence digest required');
}
export async function runScopedPublication({admit,checkAbsent,publish,readback}){
  const first=await admit();checkScopedExecutionControls(first.approval);
  assert.equal(first.receipt.artifacts.length,2);
  // Both identities must be absent before the first irreversible operation.
  for(const a of first.receipt.artifacts)await checkAbsent(a);
  const completed=[];
  for(const artifact of first.receipt.artifacts){
    const current=await admit();checkScopedExecutionControls(current.approval);
    assert.equal(current.receipt.candidateSha256,first.receipt.candidateSha256,'candidate changed during publication');
    assert.deepEqual(current.approval,first.approval,'approval changed during publication');
    await publish(artifact);await readback(artifact,first.approval);completed.push(artifact.name);
  }
  return {publishedAndReadBack:completed,officialAudit:'FAIL_NOT_WAIVED',productApplied:false,mergeApproved:false,productionApproved:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const raw=process.argv.slice(2),execute=raw.includes('--execute-approved-upload');
  const a=args(raw.filter(x=>x!=='--execute-approved-upload'),['--original-bundle','--candidate','--approval','--signatures','--trust']);
  assert.equal(Object.keys(a).length,5,'require original bundle, candidate, actual approval, signatures and pinned trust');
  requirePinnedTrust(a['--trust']);
  const originals={braces:path.join(a['--original-bundle'],'braces-3.0.3.tgz'),'node-forge':path.join(a['--original-bundle'],'node-forge-1.4.0.tgz')};
  const admit=()=>{
    requirePinnedTrust(a['--trust']);
    verifyBundle(a['--original-bundle']);
    const receipt=verifyScopedCandidate({originals,output:a['--candidate']}),approvalBytes=fs.readFileSync(a['--approval']);
    verifyScopedApproval({candidateSha256:receipt.candidateSha256,approvalBytes,
      signatures:JSON.parse(fs.readFileSync(a['--signatures'])),trust:JSON.parse(fs.readFileSync(a['--trust']))});
    const approval=JSON.parse(approvalBytes);checkScopedExecutionControls(approval);return {receipt,approval};
  };
  const admitted=admit();
  if(!execute)console.log('SCA_SCOPED_SIGNED_OPERATOR_DRY_RUN='+JSON.stringify({candidateSha256:admitted.receipt.candidateSha256,uploadExecuted:false,officialAudit:'FAIL_NOT_WAIVED'}));
  else {
    assert.equal(process.platform,'linux','execute only in isolated Linux operator environment');
    const token=process.env.NODE_AUTH_TOKEN,other=process.env.SCA_UNPRIVILEGED_TOKEN;
    for(const t of [token,other])assert.ok(typeof t==='string'&&/^[A-Za-z0-9_.=+/-]{16,}$/.test(t),'separately provisioned credentials required');
    assert.notEqual(token,other,'independent unprivileged credential required');
    const get=async(url,t,limit=24*1024*1024)=>{
      const r=await fetch(url,{headers:{Authorization:'Bearer '+t,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(60000)});
      assert.ok(r.ok,'private operator request failed');const chunks=[];let size=0;
      for await(const b of r.body){size+=b.length;assert.ok(size<=limit,'bounded private response required');chunks.push(b);}return Buffer.concat(chunks);
    };
    // An invalid token is not evidence of an authenticated, unprivileged account.
    const otherUser=JSON.parse(await get('https://api.github.com/user',other,65536));
    assert.ok(typeof otherUser.login==='string'&&otherUser.login.toLowerCase()!=='gycha0109-beep','distinct valid unprivileged identity required');
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bejewely-scoped-publish-'));
    try {
      const config=path.join(temp,'npmrc');
      fs.writeFileSync(config,'@gycha0109-beep:registry=https://npm.pkg.github.com/\n//npm.pkg.github.com/:_authToken='+token+'\n',{mode:0o600,flag:'wx'});
      const env={...process.env,npm_config_userconfig:config,npm_config_cache:path.join(temp,'cache'),npm_config_registry:'https://npm.pkg.github.com/',npm_config_ignore_scripts:'true',npm_config_update_notifier:'false'};
      delete env.NODE_AUTH_TOKEN;delete env.SCA_UNPRIVILEGED_TOKEN;
      const npm=argv=>spawnSync('npm',argv,{env,cwd:temp,encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024});
      const result=await runScopedPublication({admit,
        checkAbsent:async artifact=>{const p=npm(['view',artifact.name+'@'+artifact.version,'dist.integrity','--json','--registry','https://npm.pkg.github.com/']);let error;try{error=JSON.parse(p.stdout||p.stderr).error;}catch{}
          assert.ok(!p.error&&p.status!==0&&error?.code==='E404','identity exists or authenticated registry preflight failed');},
        publish:async artifact=>{const p=npm(['publish',path.resolve(a['--candidate'],artifact.filename),'--registry','https://npm.pkg.github.com/','--access','restricted','--ignore-scripts','--tag','bejewely-reviewed-patch']);assert.ok(!p.error&&p.status===0,'upload failed; quarantine any partial immutable release and do not switch product');},
        readback:async(artifact,approval)=>{
          const metadata=JSON.parse(await get('https://api.github.com/users/gycha0109-beep/packages/npm/'+encodeURIComponent(artifact.originalName),token,1024*1024));
          const bytes=await get(approval.tarballUrls[artifact.originalName],token);
          verifyScopedReadbackBytes({metadata,originalName:artifact.originalName,originalBytes:fs.readFileSync(originals[artifact.originalName]),artifact,bytes});
          await assertScopedAccessDenied(approval.tarballUrls[artifact.originalName]);
          await assertScopedAccessDenied(approval.tarballUrls[artifact.originalName],{unauthorizedToken:other});
        }});
      console.log('SCA_SCOPED_PRIVATE_OPERATOR_RESULT='+JSON.stringify(result));
    }finally{fs.rmSync(temp,{recursive:true,force:true});}
  }
}
