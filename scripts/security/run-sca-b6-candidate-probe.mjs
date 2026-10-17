import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {materializePrivateBracesSource} from './materialize-private-braces-source.mjs';
import {prepareBundle,verifyBundle,reference} from './sca-release-bundle.mjs';
import {prepareGithubCarrier,verifyGithubCarrier} from './sca-release-github-carrier.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function run(exe,a,cwd){const p=spawnSync(exe,a,{cwd,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});assert.ok(!p.error&&p.status===0,'B6 command failed: '+exe+' '+a.join(' ')+'\n'+p.stderr);return p.stdout;}
export function validateB6Candidate(forge){
  assert.equal(process.platform,'linux','use clean Linux release builder');
  // Reuse B4/B5 only if the entire product, graph, patch and prior verifier scopes are unchanged.
  run('git',['diff','--exit-code',reference.head,'HEAD','--','package.json','package-lock.json','apps','packages','tools','app','components','lib','security/vendor',
    'scripts/security/candidates','scripts/security/materialize-private-braces-source.mjs','scripts/security/materialize-private-forge-source.mjs',
    'scripts/security/run-sca-b4-full-graph-candidate.mjs','scripts/security/verify-private-braces-probe-child.mjs','scripts/security/verify-private-forge-probe-child.mjs'],root);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bejewely-sca-b6-'));
  try{
    const source=path.join(temp,'braces');fs.mkdirSync(source);materializePrivateBracesSource(source);
    const pack=JSON.parse(run('npm',['pack',source,'--ignore-scripts','--offline','--json','--pack-destination',temp],temp));
    assert.equal(pack.length,1);
    const retain=Boolean(process.env.SCA_B6_CANDIDATE_OUTPUT);
    const output=retain?path.resolve(process.env.SCA_B6_CANDIDATE_OUTPUT):path.join(temp,'candidate');
    assert.ok(output!==root&&!output.startsWith(root+path.sep),'private candidate output must be outside checkout');
    const receipt=prepareBundle({braces:path.join(temp,pack[0].filename),forge,output});
    assert.deepEqual(verifyBundle(output),receipt);
    const notice=fs.readFileSync(path.join(output,'NOTICE.md'));
    fs.writeFileSync(path.join(output,'NOTICE.md'),'tampered notice');assert.throws(()=>verifyBundle(output),/checksum mismatch/);
    fs.writeFileSync(path.join(output,'NOTICE.md'),notice);
    const archive=path.join(output,'braces-3.0.3.tgz'),bytes=fs.readFileSync(archive);
    fs.writeFileSync(archive,bytes.subarray(1));assert.throws(()=>verifyBundle(output),/checksum mismatch/);
    fs.writeFileSync(archive,bytes);
    assert.deepEqual(verifyBundle(output),receipt);
    if(process.env.SCA_B6_EXPECTED_CANDIDATE_SHA256)assert.equal(receipt.candidateSha256,process.env.SCA_B6_EXPECTED_CANDIDATE_SHA256,'candidate differs on independent runner');
    const carrier=path.join(temp,'github-carrier');
    prepareGithubCarrier({bundle:output,output:carrier,scope:'gycha0109-beep'});
    const carrierPack=JSON.parse(run('npm',['pack',carrier,'--ignore-scripts','--offline','--json','--pack-destination',temp],temp));
    assert.equal(carrierPack.length,1);
    const carrierBytes=fs.readFileSync(path.join(temp,carrierPack[0].filename));
    const carrierReceipt=verifyGithubCarrier({archive:carrierBytes,bundle:output,scope:'gycha0109-beep'});
    assert.throws(()=>verifyGithubCarrier({archive:carrierBytes.subarray(1),bundle:output,scope:'gycha0109-beep'}));
    console.log('SCA_B6_GITHUB_CARRIER_PROTOTYPE='+JSON.stringify({...carrierReceipt,tamperedArchiveRejected:true}));
    if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'b6_candidate_sha256='+receipt.candidateSha256+'\n');
    console.log('SCA_B6_VERIFIED_RELEASE_STRUCTURE='+JSON.stringify({...receipt,
      reusedFullGraphHead:reference.head,reusedFullGraphRun:38514455251,sourceScopeUnchanged:true,
      licenseAndNoticeVerified:true,sbomVerified:true,archiveTamperRejected:true,
      candidateRetainedForPrivateOperator:retain,packageUploadExecuted:false,artifactsDeletedOnExit:!retain}));
    return receipt;
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
