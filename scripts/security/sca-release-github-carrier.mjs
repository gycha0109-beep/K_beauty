/** Offline GitHub npm transport prototype. Never upload, rename inner packages or install into the product. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {verifyBundle,verifyArchive,inspectArchive,digest} from './sca-release-bundle.mjs';

export function carrierMetadata(scope,candidateSha256){
  assert.match(scope,/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/,'lowercase GitHub namespace required');
  assert.match(candidateSha256,/^[a-f0-9]{64}$/,'exact inner manifest digest required');
  return {name:'@'+scope+'/bejewely-sca-artifacts',version:'0.0.0-candidate.'+candidateSha256,
    private:true,description:'Review-only transport envelope, not a replacement dependency',license:'UNLICENSED',
    files:['bundle','licenses','README.md'],publishConfig:{registry:'https://npm.pkg.github.com/'},
    bejewely:{schema:'bejewely.github-carrier-prototype.v1',innerCandidateSha256:candidateSha256,
      originalIdentities:['braces@3.0.3','node-forge@1.4.0'],productInstallable:false,officialAudit:'FAIL',releaseApproved:false}};
}
const readme='# Review-only GitHub Packages transport prototype\n\nNot published or approved. Original braces/node-forge tgz identities, bytes and LICENSE are preserved in bundle/. This envelope has no install hooks, exports or dependency substitutions. Installing this envelope does not patch the application. Original full HIGH22 / production HIGH19 remain FAIL. Existing B6 approval cannot authorize this different outer archive. Legal review, independent signers, new exact outer digest approval, real ACL/readback and a reviewed product installation design remain required. private=true deliberately prevents npm publish.\n';

export function prepareGithubCarrier({bundle,output,scope}){
  const receipt=verifyBundle(bundle),metadata=carrierMetadata(scope,receipt.candidateSha256);
  const source=fs.realpathSync(bundle),target=path.resolve(output);
  assert.ok(target!==source&&!target.startsWith(source+path.sep),'carrier must not modify the original bundle');
  assert.ok(!fs.existsSync(target),'NEW carrier output required');
  fs.mkdirSync(target,{mode:0o700});
  try{
    fs.mkdirSync(path.join(target,'bundle'));fs.mkdirSync(path.join(target,'licenses'));
    for(const n of fs.readdirSync(source))fs.writeFileSync(path.join(target,'bundle',n),fs.readFileSync(path.join(source,n)),{flag:'wx',mode:0o600});
    for(const a of receipt.artifacts){
      const bytes=fs.readFileSync(path.join(source,a.filename));verifyArchive(a.name,bytes);
      fs.writeFileSync(path.join(target,'licenses',a.name+'.LICENSE'),inspectArchive(bytes).LICENSE,{flag:'wx',mode:0o600});
    }
    fs.writeFileSync(path.join(target,'package.json'),JSON.stringify(metadata,null,2)+'\n',{flag:'wx',mode:0o600});
    fs.writeFileSync(path.join(target,'README.md'),readme,{flag:'wx',mode:0o600});
    return {metadata,inner:receipt,uploadExecuted:false,productApplied:false};
  }catch(e){fs.rmSync(target,{recursive:true,force:true});throw e;}
}

export function verifyGithubCarrier({archive,bundle,scope}){
  const receipt=verifyBundle(bundle),metadata=carrierMetadata(scope,receipt.candidateSha256),files=inspectArchive(archive);
  const expected=['package.json','README.md',...fs.readdirSync(bundle).map(n=>'bundle/'+n),...receipt.artifacts.map(a=>'licenses/'+a.name+'.LICENSE')];
  assert.deepEqual(Object.keys(files).sort(),expected.sort(),'unreviewed carrier content');
  assert.deepEqual(JSON.parse(files['package.json']),metadata,'carrier metadata differs');
  assert.equal(files['README.md'].toString(),readme);
  for(const n of fs.readdirSync(bundle))assert.equal(digest(files['bundle/'+n]),digest(fs.readFileSync(path.join(bundle,n))),'inner bundle byte substitution');
  for(const a of receipt.artifacts){verifyArchive(a.name,files['bundle/'+a.filename]);assert.equal(digest(files['licenses/'+a.name+'.LICENSE']),a.licenseSha256);}
  return {schema:'bejewely.github-carrier-receipt.v1',outerSha256:digest(archive),outerBytes:archive.length,
    innerCandidateSha256:receipt.candidateSha256,innerBytesPreserved:true,licensesPreserved:true,
    originalIdentities:metadata.bejewely.originalIdentities,officialAudit:'FAIL',fullHigh:22,productionHigh:19,
    productInstallable:false,releaseApproval:'PENDING',uploadExecuted:false,productApplied:false};
}
