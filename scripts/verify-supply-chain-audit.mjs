import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {npmCli} from './security/npm-cli.mjs';

// Same full and production npm audit scopes; no advisory exceptions or count adjustments.
const root=process.cwd(),cli=npmCli();
const manifest=JSON.parse(fs.readFileSync('security/product-installed-patches.json'));
const lock=JSON.parse(fs.readFileSync('package-lock.json'));
const verification=spawnSync(process.execPath,['scripts/security/verify-product-installed-security.mjs'],{encoding:'utf8',timeout:60000,maxBuffer:1000000});
assert.ifError(verification.error);assert.equal(verification.status,0,verification.stdout+'\n'+verification.stderr);
console.log(verification.stdout.trim());
const reports={};
function audit(cwd,args){
  const result=spawnSync(process.execPath,[cli,'audit','--json','--package-lock-only','--registry=https://registry.npmjs.org/',...args],{cwd,encoding:'utf8',timeout:120000,maxBuffer:16000000});
  assert.ifError(result.error);assert.ok(result.status===0||result.status===1,'npm audit execution failed');
  const report=JSON.parse(result.stdout);
  assert.ok(!report.error&&report.metadata?.vulnerabilities,'audit service failed');
  return {exitCode:result.status,report};
}
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'bejewely-advisory-identity-'));
try{
  const identityLock=structuredClone(lock),identityManifest=JSON.parse(fs.readFileSync('package.json'));
  // This scan deliberately restores original names/versions only in a throwaway lock.
  // It installs nothing and preserves raw FAIL results; content proof is reported separately.
  for(const a of manifest.artifacts){
    identityManifest.dependencies[a.originalName]=a.originalVersion;
    delete identityManifest.overrides[a.originalName];
    identityLock.packages[''].dependencies[a.originalName]=a.originalVersion;
    for(const [p,e] of Object.entries(identityLock.packages))if(p.endsWith('node_modules/'+a.originalName)){
      delete e.name;e.version=a.originalVersion;
      // Advisory lookup metadata only; never present patched bytes as an upstream archive.
      delete e.resolved;delete e.integrity;
    }
  }
  for(const [p,e]of Object.entries(lock.packages))if(p&&!p.includes('node_modules')&&!e.link){
    assert.ok(!path.isAbsolute(p)&&!p.split(/[\\/]/).includes('..'));
    const source=path.join(root,p,'package.json');if(!fs.existsSync(source))continue;
    fs.mkdirSync(path.join(scratch,p),{recursive:true});fs.copyFileSync(source,path.join(scratch,p,'package.json'));
  }
  fs.writeFileSync(path.join(scratch,'package.json'),JSON.stringify(identityManifest));
  fs.writeFileSync(path.join(scratch,'package-lock.json'),JSON.stringify(identityLock));
  const covered=new Set(manifest.artifacts.flatMap(a=>a.remediatedAdvisories));
  for(const [scope,args]of [['all',[]],['production',['--omit=dev']]]){
    const installed=audit(root,args),originalIdentity=audit(scratch,args);
    const leaves=Object.values(originalIdentity.report.vulnerabilities||{}).flatMap(v=>v.via.filter(x=>typeof x==='object'));
    const uncovered=leaves.filter(a=>!covered.has(a.url.split('/').pop()));
    reports[scope]={installed,originalIdentity,uncovered,contentRemediation:'VERIFIED',namespaceChangeIsRemediation:false};
    console.log('SUPPLY_CHAIN_AUDIT_'+scope.toUpperCase()+'='+JSON.stringify(installed.report.metadata.vulnerabilities));
    console.log('SUPPLY_CHAIN_ORIGINAL_IDENTITY_'+scope.toUpperCase()+'='+JSON.stringify({status:originalIdentity.exitCode===0?'PASS':'FAIL',counts:originalIdentity.report.metadata.vulnerabilities,advisories:[...new Set(leaves.map(a=>a.url))]}));
  }
  reports.crawler={};
  for(const [scope,args]of [['all',[]],['production',['--omit=dev']]]){
    reports.crawler[scope]=audit(path.join(root,'crawler'),args);
    console.log('SUPPLY_CHAIN_CRAWLER_'+scope.toUpperCase()+'='+JSON.stringify(reports.crawler[scope].report.metadata.vulnerabilities));
  }
  fs.mkdirSync('tmp',{recursive:true});fs.writeFileSync('tmp/supply-chain-audit.json',JSON.stringify(reports,null,2)+'\n');
  for(const scope of ['all','production']){
    const r=reports[scope];
    assert.equal(r.installed.report.metadata.vulnerabilities.total,0,scope+': unresolved registry finding');
    assert.equal(r.uncovered.length,0,scope+': new original-name advisory lacks a verified fix');
    assert.equal(reports.crawler[scope].report.metadata.vulnerabilities.total,0,scope+': unresolved crawler vulnerability');
  }
  console.log('PRODUCT_SECURITY_REMEDIATION=PASS installed-content-and-original-advisory-coverage; raw original identity FAIL remains FAIL');
}finally{
  assert.equal(path.dirname(path.resolve(scratch)),path.resolve(os.tmpdir()));
  assert.ok(path.basename(scratch).startsWith('bejewely-advisory-identity-'));
  fs.rmSync(scratch,{recursive:true,force:true});
}
