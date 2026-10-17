/** Operator-only: signed organizational admission is required even for dry-run. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {args,loadApprovedBundle,verifyArchive,registryUrl,requirePinnedTrust,assertPrivateReadback} from './sca-release-bundle.mjs';
const raw=process.argv.slice(2),execute=raw.includes('--execute-approved-upload');
const a=args(raw.filter(x=>x!=='--execute-approved-upload'),['--bundle','--approval','--signatures','--trust']);
if(Object.keys(a).length!==4)throw Error('Require bundle, approval, signatures and organization-provided trust file');
requirePinnedTrust(a['--trust']);
const admitted=loadApprovedBundle({bundle:a['--bundle'],approval:a['--approval'],signatures:a['--signatures'],trust:a['--trust']});
if(!execute){console.log('SCA_B6_SIGNED_UPLOAD_DRY_RUN='+JSON.stringify({candidateSha256:admitted.receipt.candidateSha256,uploadExecuted:false,officialAudit:'FAIL',mergeApproved:false,productionApproved:false}));}
else {
  assert.equal(process.platform,'linux','execute only in isolated Linux release runner');
  const token=process.env.NODE_AUTH_TOKEN;
  assert.ok(typeof token==='string'&&/^[A-Za-z0-9_.=+/-]{16,}$/.test(token),'scoped NODE_AUTH_TOKEN required');
  const registry=registryUrl(admitted.approval.registry),temp=fs.mkdtempSync(path.join(os.tmpdir(),'bejewely-private-publish-'));
  const config=path.join(temp,'npmrc');
  try{
    fs.writeFileSync(config,'registry='+registry.href+'\n//'+registry.host+registry.pathname+':_authToken='+token+'\n',{mode:0o600,flag:'wx'});
    const env={...process.env,npm_config_userconfig:config,npm_config_cache:path.join(temp,'cache'),npm_config_registry:registry.href,
      npm_config_update_notifier:'false',npm_config_ignore_scripts:'true'};
    delete env.NODE_AUTH_TOKEN; // only registry/path-scoped npmrc can supply the token
    // Preflight BOTH identities before any upload; never overwrite or unpublish versions.
    for(const artifact of admitted.receipt.artifacts){
      const p=spawnSync('npm',['view',artifact.name+'@'+artifact.version,'dist.integrity','--json','--registry',registry.href],{env,cwd:temp,encoding:'utf8',timeout:60000});
      let error;try{error=JSON.parse(p.stdout||p.stderr).error;}catch{}
      assert.ok(!p.error&&p.status!==0&&error?.code==='E404','identity already exists or registry access/preflight failed');
    }
    for(const artifact of admitted.receipt.artifacts){
      // Revalidate immediately before the irreversible upload; no shell command construction.
      loadApprovedBundle({bundle:a['--bundle'],approval:a['--approval'],signatures:a['--signatures'],trust:a['--trust']});
      const p=spawnSync('npm',['publish',path.resolve(a['--bundle'],artifact.filename),'--registry',registry.href,'--ignore-scripts','--tag','bejewely-reviewed-patch'],{env,cwd:temp,encoding:'utf8',timeout:120000});
      assert.ok(!p.error&&p.status===0,'private upload failed; inspect private operator logs, preserve partial immutable release, do not switch product');
      // Readback does not follow redirects or forward credentials to another host.
      const response=await fetch(admitted.approval.tarballUrls[artifact.name],{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(60000)});
      assert.ok(response.ok,'approved private archive readback failed');
      const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;assert.ok(size<=24*1024*1024,'readback too large');chunks.push(chunk);}
      verifyArchive(artifact.name,Buffer.concat(chunks));
      await assertPrivateReadback(admitted.approval.tarballUrls[artifact.name]);
      console.log('SCA_B6_PRIVATE_UPLOAD_READBACK='+JSON.stringify({name:artifact.name,sha256:artifact.sha256,verified:true}));
    }
    console.log('SCA_B6_UPLOAD_SCOPE_COMPLETE_PRODUCT_AND_AUDIT_STILL_HOLD');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
