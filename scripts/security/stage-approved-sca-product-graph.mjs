/** Approved private readback + disposable complete graph. Never modifies source checkout. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {args,loadApprovedBundle,requirePinnedTrust,registryUrl,digest,reference,verifyArchive,assertPrivateReadback} from './sca-release-bundle.mjs';
const a=args(process.argv.slice(2),['--source','--bundle','--approval','--signatures','--trust','--output']);
assert.equal(Object.keys(a).length,6,'all source/bundle/approval/signatures/trust/output options required');
requirePinnedTrust(a['--trust']);
const approved=loadApprovedBundle({bundle:a['--bundle'],approval:a['--approval'],signatures:a['--signatures'],trust:a['--trust']});
assert.equal(process.platform,'linux','full graph staging requires isolated Linux runner');
const source=fs.realpathSync(a['--source']),out=path.resolve(a['--output']);
assert.ok(out!==source&&!out.startsWith(source+path.sep)&&!source.startsWith(out+path.sep),'output must be outside source checkout');
assert.ok(!fs.existsSync(out),'output must be new isolated directory');
const original=fs.readFileSync(path.join(source,'package-lock.json')),originalManifest=fs.readFileSync(path.join(source,'package.json'));
const token=process.env.NODE_AUTH_TOKEN;assert.ok(typeof token==='string'&&/^[A-Za-z0-9_.=+/-]{16,}$/.test(token),'scoped read-only NODE_AUTH_TOKEN required');
const registry=registryUrl(approved.approval.registry),privateTemp=fs.mkdtempSync(path.join(os.tmpdir(),'bejewely-sca-stage-auth-'));
const env={...process.env,CI:'true',NODE_OPTIONS:'',EXPO_NO_TELEMETRY:'1',NEXT_TELEMETRY_DISABLED:'1',npm_config_cache:path.join(privateTemp,'cache'),npm_config_update_notifier:'false'};
delete env.NODE_AUTH_TOKEN;
function run(exe,argv,cwd=out,timeout=300000,allowed=[0]){
  const p=spawnSync(exe,argv,{cwd,env,encoding:'utf8',timeout,maxBuffer:32*1024*1024});
  assert.ok(!p.error&&allowed.includes(p.status),'staging command failed: '+exe+' '+argv.join(' ')+' (private logs withheld)');return p;
}
function inventory(dir){const result={};function walk(p,prefix=''){for(const e of fs.readdirSync(p,{withFileTypes:true})){
  assert.ok(!e.isSymbolicLink(),'unexpected installed-package symlink');const rel=prefix+e.name;
  if(e.isDirectory())walk(path.join(p,e.name),rel+'/');else {assert.ok(e.isFile());result[rel]=digest(fs.readFileSync(path.join(p,e.name)));}
}}walk(dir);return Object.fromEntries(Object.entries(result).sort(([x],[y])=>x.localeCompare(y)));}
function installedGraph(lock){
  const physical=[],consumers=[];
  function census(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    if(e.isSymbolicLink()){const real=fs.realpathSync(path.join(dir,e.name));assert.ok(real.startsWith(out+path.sep),'install symlink escapes candidate graph');continue;}
    if(!e.isDirectory())continue;const full=path.join(dir,e.name),pkg=path.join(full,'package.json');
    if(fs.existsSync(pkg)){const m=JSON.parse(fs.readFileSync(pkg));if(['braces','node-forge'].includes(m.name)){
      const rel=path.relative(out,full).split(path.sep).join('/'),expected=reference.installed.find(i=>i.name===m.name),entry=lock.packages[rel];
      assert.ok(entry,'uninventoried installed target');assert.equal(m.version,expected.version);
      assert.deepEqual(inventory(full),expected.fileSha256,'installed patch/dist/license bytes differ');
      const artifact=approved.receipt.artifacts.find(p=>p.name===m.name);assert.equal(entry.integrity,artifact.sha512);
      assert.equal(entry.resolved,approved.approval.tarballUrls[m.name],'target not from approved durable archive');physical.push(rel);
    }}
    if(e.name.startsWith('@'))census(full);if(fs.existsSync(path.join(full,'node_modules')))census(path.join(full,'node_modules'));
  }}
  census(path.join(out,'node_modules'));
  for(const [p,e]of Object.entries(lock.packages))if(p&&!p.includes('node_modules')&&fs.existsSync(path.join(out,p,'node_modules')))census(path.join(out,p,'node_modules'));
  const locked=Object.keys(lock.packages).filter(p=>['braces','node-forge'].some(n=>p.endsWith('node_modules/'+n)));
  assert.deepEqual(physical.sort(),locked.sort(),'nested/aliased package escaped graph census');
  for(const [p,e]of Object.entries(lock.packages))if(p&&!e.link)for(const n of ['braces','node-forge'])if(e.dependencies?.[n]||e.optionalDependencies?.[n]){
    const req=createRequire(path.join(out,p,'package.json')),resolved=path.relative(out,path.dirname(req.resolve(n+'/package.json'))).split(path.sep).join('/');
    assert.ok(physical.includes(resolved),'consumer resolves unverified target');consumers.push({path:p,name:n,resolved});
  }
  return {physical,consumers};
}
try{
  // Verify remote bytes before introducing any remote locator into a candidate lock.
  for(const artifact of approved.receipt.artifacts){
    const r=await fetch(approved.approval.tarballUrls[artifact.name],{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(60000)});
    assert.ok(r.ok,'private candidate readback failed');const chunks=[];let length=0;
    for await(const c of r.body){length+=c.length;assert.ok(length<=24*1024*1024,'private archive too large');chunks.push(c);}verifyArchive(artifact.name,Buffer.concat(chunks));
    await assertPrivateReadback(approved.approval.tarballUrls[artifact.name]);
  }
  fs.mkdirSync(out,{recursive:true,mode:0o700});
  const head=run('git',['rev-parse','HEAD'],source).stdout.trim(),archive=path.join(privateTemp,'source.tar');
  run('git',['archive','--format=tar','--output='+archive,head],source);run('tar',['-xf',archive,'-C',out],privateTemp);
  assert.equal(digest(fs.readFileSync(path.join(out,'package-lock.json'))),digest(original),'source checkout differs from committed lock');
  assert.equal(digest(fs.readFileSync(path.join(out,'package.json'))),digest(originalManifest),'source checkout differs from committed manifest');
  const config=path.join(privateTemp,'npmrc');fs.writeFileSync(config,'//'+registry.host+registry.pathname+':_authToken='+token+'\n',{mode:0o600,flag:'wx'});
  env.npm_config_userconfig=config;
  const manifest=JSON.parse(originalManifest);manifest.overrides={...manifest.overrides,...approved.approval.tarballUrls};
  fs.writeFileSync(path.join(out,'package.json'),JSON.stringify(manifest,null,2)+'\n');
  run('npm',['update','braces','node-forge','--package-lock-only','--ignore-scripts','--no-audit','--no-fund']);
  const lockBytes=fs.readFileSync(path.join(out,'package-lock.json')),lock=JSON.parse(lockBytes),base=JSON.parse(original);
  for(const [p,e]of Object.entries(lock.packages))if(p&&!e.link&&!['braces','node-forge'].some(n=>p.endsWith('node_modules/'+n))){
    const old=base.packages[p];assert.ok(old&&old.version===e.version&&old.resolved===e.resolved&&old.integrity===e.integrity,'unrelated resolver drift');
  }
  for(const p of Object.keys(base.packages))assert.ok(p in lock.packages,'unexpected removed dependency');
  run('npm',['ci','--ignore-scripts','--no-audit','--no-fund']);const graph=installedGraph(lock);
  run('npm',['ci','--no-audit','--no-fund']);assert.deepEqual(installedGraph(lock),graph);
  assert.equal(digest(fs.readFileSync(path.join(out,'package-lock.json'))),digest(lockBytes));
  fs.rmSync(config);delete env.npm_config_userconfig; // registry credential no longer available to app build
  run('npm',['ls','braces','node-forge','--all']);
  run(process.execPath,['scripts/security/verify-private-braces-probe-child.mjs',path.join(out,'node_modules/braces')]);
  run(process.execPath,['scripts/security/verify-private-forge-probe-child.mjs',path.join(out,'node_modules')]);
  const checks=[];
  for(const n of ['build','mobile:typecheck','mobile:lint','verify:mobile-foundation','verify:mobile-entry-routing','mobile:config','mobile:export:android','mobile:prebuild:android','verify:mobile-native']){run('npm',['run',n]);checks.push({name:n,status:'PASS'});}
  run(process.execPath,['scripts/security/verify-local-production-smoke.mjs']);checks.push({name:'local public HTML smoke',status:'PASS'});
  let android='NOT_RUN_NO_SDK';const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
  if(sdk&&fs.existsSync(sdk)){run('bash',['./gradlew',':app:assembleDebug','--no-daemon','--max-workers=2','-Dorg.gradle.jvmargs=-Xmx4g'],path.join(out,'apps/mobile/android'),1800000);android='PASS';}
  const audits={};for(const [label,options]of [['full',[]],['production',['--omit=dev']]]){
    const p=run('npm',['audit','--json',...options],out,120000,[0,1]),r=JSON.parse(p.stdout);
    assert.ok(!r.error&&r.metadata?.vulnerabilities,'audit service error');fs.writeFileSync(path.join(out,'sca-audit-'+label+'.json'),p.stdout);
    audits[label]={exit:p.status,sha256:digest(p.stdout),counts:r.metadata.vulnerabilities};console.log('SCA_B6_RAW_'+label.toUpperCase()+'_BEGIN\n'+p.stdout+'\nSCA_B6_RAW_AUDIT_END');
  }
  const gate=run(process.execPath,['scripts/verify-supply-chain-audit.mjs'],out,120000,[0,1,2]);fs.writeFileSync(path.join(out,'sca-original-verifier.log'),gate.stdout+gate.stderr);
  const receipt={head,candidateSha256:approved.receipt.candidateSha256,lockSha256:digest(lockBytes),graph,checks,android,audits,canonicalGateExit:gate.status,
    productCheckoutChanged:false,releaseAcceptance:'HOLD_REQUIRED_SECURITY_GATE',deviceSmoke:'NOT_RUN'};
  fs.writeFileSync(path.join(out,'sca-product-candidate-evidence.json'),JSON.stringify(receipt,null,2)+'\n');console.log('SCA_B6_PRIVATE_GRAPH='+JSON.stringify(receipt));
  process.exitCode=gate.status||audits.full.exit||audits.production.exit;
}finally{
  fs.rmSync(privateTemp,{recursive:true,force:true});
  assert.equal(digest(fs.readFileSync(path.join(source,'package-lock.json'))),digest(original));
  assert.equal(digest(fs.readFileSync(path.join(source,'package.json'))),digest(originalManifest));
}
