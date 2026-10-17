/** Local-only standalone browser review kit. No publication or legal approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {verifyArchive,inspectArchive,browserReference,digest} from './sca-release-bundle.mjs';

function expectedKit(forgeTarball,candidateSha256,candidatePacket){
  assert.match(candidateSha256,/^[a-f0-9]{64}$/);const bytes=fs.readFileSync(forgeTarball);
  const source=verifyArchive('node-forge',bytes),entries=inspectArchive(bytes),files={};
  for(const b of browserReference.browserBundles){assert.equal(digest(entries[b.path]),b.sha256);files[path.basename(b.path)]=entries[b.path];}
  files['LICENSE.node-forge.txt']=entries.LICENSE;
  for(const n of ['THIRD-PARTY-NOTICES.md','license-review-sbom.json','license-review.json','public-license-findings.json'])
    files[n]=fs.readFileSync(new URL('../../security/release/license-review/'+n,import.meta.url));
  if(candidatePacket){
    assert.equal(candidatePacket.candidateSha256,candidateSha256,'browser kit candidate binding');
    const names=['THIRD-PARTY-NOTICES.md','license-review-sbom.json','license-review.json','public-license-findings.json','bootstrap-license-lineage.json'];
    assert.deepEqual(Object.keys(candidatePacket.resources).sort(),names.sort());
    for(const n of names){const b=candidatePacket.resources[n];assert.equal(digest(b),candidatePacket.fileSha256[n],'candidate packet byte mismatch');files[n]=b;}
    // The metadata-derived packet cannot rewrite the actual legal notices.
    for(const n of ['THIRD-PARTY-NOTICES.md','public-license-findings.json'])assert.equal(digest(files[n]),digest(fs.readFileSync(new URL('../../security/release/license-review/'+n,import.meta.url))));
  }
  const manifest={schema:'bejewely.browser-notice-review-kit.v1',status:'LOCAL_REVIEW_ONLY_NOT_AUTHORIZED_DISTRIBUTION',
    candidateSha256,originalForgeArchiveSha256:source.sha256,legalApproved:false,uploadExecuted:false,
    files:Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([n,b])=>[n,{sha256:digest(b),bytes:b.length}]))};
  return {files,manifest};
}
export function verifyBrowserNoticeKit({forgeTarball,candidateSha256,output,candidatePacket}){
  const expected=expectedKit(forgeTarball,candidateSha256,candidatePacket);
  const root=fs.lstatSync(output);assert.ok(root.isDirectory()&&!root.isSymbolicLink(),'physical browser notice directory required');
  assert.deepEqual(fs.readdirSync(output).sort(),[...Object.keys(expected.files),'browser-notice-kit.json'].sort(),'standalone notices or browser files missing/extra');
  for(const [n,b] of Object.entries({...expected.files,'browser-notice-kit.json':Buffer.from(JSON.stringify(expected.manifest,null,2)+'\n')})){
    const p=path.join(output,n),s=fs.lstatSync(p);assert.ok(s.isFile()&&!s.isSymbolicLink()&&s.size===b.length,'unsafe or truncated browser notice kit');
    assert.equal(digest(fs.readFileSync(p)),digest(b),'standalone browser/notice bytes mismatch');
  }
  return {manifestSha256:digest(Buffer.from(JSON.stringify(expected.manifest,null,2)+'\n')),files:expected.manifest.files,
    sourceAndNotices:'PASS_LOCAL_COLOCATED_BYTES',actualDistribution:'NOT_RUN',legalApproved:false};
}
export function prepareBrowserNoticeKit(options){
  const {files,manifest}=expectedKit(options.forgeTarball,options.candidateSha256,options.candidatePacket);
  assert.ok(!fs.existsSync(options.output),'new isolated browser notice directory required');fs.mkdirSync(options.output,{mode:0o700});
  for(const [n,b] of Object.entries({...files,'browser-notice-kit.json':Buffer.from(JSON.stringify(manifest,null,2)+'\n')}))
    fs.writeFileSync(path.join(options.output,n),b,{flag:'wx',mode:0o600});
  return verifyBrowserNoticeKit(options);
}
