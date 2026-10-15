/** Record exact-HEAD raw npm audit results. Do not alter the mandatory audit gate. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {buildScaReadiness} from './sca-readiness-evidence.mjs';

const expectedHead=process.env.SCA_EXPECTED_HEAD_SHA;
assert.ok(expectedHead,'SCA_EXPECTED_HEAD_SHA is mandatory');
const checkedOutHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sourceReceipt=JSON.parse(fs.readFileSync('security/release/sca-b6-validated-source.json','utf8'));
const outputDir=path.join(process.cwd(),'.sca-readiness-evidence');
fs.mkdirSync(outputDir,{recursive:true,mode:0o700});
const npm=process.platform==='win32'?'npm.cmd':'npm';
function capture(label,options){
  const args=['audit','--json','--registry=https://registry.npmjs.org/',...options];
  const p=spawnSync(npm,args,{encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
  assert.ok(!p.error && [0,1].includes(p.status),label+' audit command failed, no evidence accepted');
  let payload;
  try{payload=JSON.parse(p.stdout)}catch{throw new Error(label+' audit returned invalid JSON');}
  assert.ok(!payload.error,label+' registry returned audit error');
  const filename=path.join(outputDir,'raw-'+label+'.json');
  fs.writeFileSync(filename,p.stdout,{mode:0o600});
  console.log('SCA_B6_RAW_AUDIT_BEGIN='+args.join(' '));
  console.log(p.stdout);
  console.log('SCA_B6_RAW_AUDIT_EXIT='+p.status);
  return {exitCode:p.status,payload};
}
const full=capture('full',[]);
const production=capture('production',['--omit=dev']);
const snapshot=buildScaReadiness({
  checkedOutHead,expectedHead,sourceReceiptHead:sourceReceipt.head,
  runUrl:process.env.GITHUB_SERVER_URL&&process.env.GITHUB_REPOSITORY&&process.env.GITHUB_RUN_ID
    ? process.env.GITHUB_SERVER_URL+'/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID : null,
  full,production
});
fs.writeFileSync(path.join(outputDir,'readiness.json'),JSON.stringify(snapshot,null,2)+'\n',{mode:0o600});
console.log('SCA_READINESS_EVIDENCE='+JSON.stringify({
  head:checkedOutHead,rawAudit: snapshot.rawAudit.gate,
  full:snapshot.rawAudit.full.counts,production:snapshot.rawAudit.production.counts,
  advisoryLeaves:snapshot.rawAudit.full.advisoryLeaves,decision:snapshot.decision,
  releaseAuthorized:snapshot.releaseAuthorized,outputDir:'.sca-readiness-evidence'
}));
