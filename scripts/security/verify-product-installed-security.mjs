import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(import.meta.url);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'security/product-installed-patches.json')));
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json')));
const hash=b=>createHash('sha256').update(b).digest('hex');
const relative=p=>path.relative(root,p).split(path.sep).join('/');
const verified=[];
for(const artifact of manifest.artifacts){
  const candidates=Object.entries(lock.packages).filter(([p])=>p.endsWith('node_modules/'+artifact.originalName));
  assert.ok(candidates.length,'missing installed replacement: '+artifact.originalName);
  for(const [p,entry] of candidates){
    assert.equal(entry.name,artifact.name,'upstream/unreviewed identity remains: '+p);
    assert.equal(entry.version,artifact.version);
    assert.equal(entry.integrity,artifact.integrity,'replacement archive changed: '+p);
    const directory=path.join(root,p);
    const metadata=JSON.parse(fs.readFileSync(path.join(directory,'package.json')));
    assert.equal(metadata.name,artifact.name);assert.equal(metadata.version,artifact.version);
    for(const [file,expected] of Object.entries(artifact.fileSha256)){
      assert.ok(!path.isAbsolute(file)&&!file.split(/[\\/]/).includes('..'));
      const filename=path.join(directory,file);
      assert.ok(!fs.lstatSync(filename).isSymbolicLink(),'symlink in approved package');
      assert.equal(hash(fs.readFileSync(filename)),expected,'installed code differs: '+p+'/'+file);
    }
    verified.push({path:p,name:artifact.name,version:artifact.version,verifiedFiles:Object.keys(artifact.fileSha256).length});
  }
}
const consumers=[];
for(const [p,entry] of Object.entries(lock.packages)){
  if(entry.link)continue;
  for(const artifact of manifest.artifacts){
    if(!entry.dependencies?.[artifact.originalName]&&!entry.optionalDependencies?.[artifact.originalName])continue;
    const resolved=createRequire(path.join(root,p,'package.json')).resolve(artifact.originalName+'/package.json');
    assert.ok(verified.some(v=>relative(path.dirname(resolved))===v.path),'consumer bypasses patched bytes: '+p);
    consumers.push({path:p||'.',dependency:artifact.originalName,resolved:relative(path.dirname(resolved))});
  }
}
// Reject extra physical copies, including copies hidden behind a different install name.
const actual=[];
function census(directory){
  if(!fs.existsSync(directory))return;
  for(const item of fs.readdirSync(directory,{withFileTypes:true})){
    if(!item.isDirectory()||item.isSymbolicLink())continue;
    const folder=path.join(directory,item.name),pkg=path.join(folder,'package.json');
    if(fs.existsSync(pkg)){
      const meta=JSON.parse(fs.readFileSync(pkg));
      if(manifest.artifacts.some(a=>a.name===meta.name||a.originalName===meta.name))actual.push(relative(folder));
    }
    if(item.name.startsWith('@'))census(folder);
    census(path.join(folder,'node_modules'));
  }
}
census(path.join(root,'node_modules'));
for(const [p,e] of Object.entries(lock.packages))if(p&&!p.includes('node_modules')&&!e.link)census(path.join(root,p,'node_modules'));
assert.deepEqual(actual.sort(),verified.map(v=>v.path).sort(),'unverified nested/aliased vulnerable package');
for(const [name,version] of [['next','15.5.28'],['uuid','11.1.1'],['postcss-selector-parser','7.1.6']]){
  for(const [p,entry] of Object.entries(lock.packages))if(p.endsWith('node_modules/'+name))assert.equal(entry.version,version,'old official package remains: '+p);
}
const behavior=spawnSync(process.execPath,[path.join(root,'scripts/security/verify-product-security-behavior.mjs')],{cwd:root,encoding:'utf8',timeout:20000,maxBuffer:100000});
assert.ifError(behavior.error);assert.equal(behavior.status,0,behavior.stdout+'\n'+behavior.stderr);
console.log(behavior.stdout.trim());
console.log('PRODUCT_INSTALLED_SECURITY='+JSON.stringify({status:'PASS',verified,consumers,scannerNamespaceAloneIsProof:false}));
