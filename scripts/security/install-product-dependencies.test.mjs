import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const source=path.dirname(fileURLToPath(import.meta.url));
const fake='synthetic-fixture-not-a-credential';
function fixture(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bejewely-install-fixture-'));
  const scripts=path.join(directory,'scripts/security');fs.mkdirSync(scripts,{recursive:true});
  for(const file of ['install-product-dependencies.mjs','npm-cli.mjs'])fs.copyFileSync(path.join(source,file),path.join(scripts,file));
  const pkg={name:'install-isolation-fixture',version:'1.0.0',private:true,scripts:{postinstall:'node lifecycle.cjs'}};
  fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify(pkg));
  fs.writeFileSync(path.join(directory,'package-lock.json'),JSON.stringify({name:pkg.name,version:pkg.version,lockfileVersion:3,packages:{'':pkg}}));
  // This fixture tests installer isolation and ordering; actual patch verification has separate adversarial checks.
  fs.writeFileSync(path.join(scripts,'verify-product-installed-security.mjs'),`import fs from 'node:fs';import assert from 'node:assert/strict';assert.equal(process.env.SCA_PACKAGES_READ_TOKEN,undefined);assert.equal(process.env.UNRELATED_SECRET,undefined);assert.equal(fs.existsSync(process.env.npm_config_userconfig),false);fs.writeFileSync('verified-before-lifecycle','yes');`);
  fs.writeFileSync(path.join(directory,'lifecycle.cjs'),`const fs=require('fs'),assert=require('assert/strict');assert.equal(fs.readFileSync('verified-before-lifecycle','utf8'),'yes');assert.equal(process.env.SCA_PACKAGES_READ_TOKEN,undefined);assert.equal(process.env.UNRELATED_SECRET,undefined);assert.equal(fs.existsSync(process.env.npm_config_userconfig),false);fs.writeFileSync('lifecycle-isolated','yes');`);
  return directory;
}
function run(directory,token){
  const env={...process.env,UNRELATED_SECRET:'synthetic-fixture'};
  if(token)env.SCA_PACKAGES_READ_TOKEN=token;else delete env.SCA_PACKAGES_READ_TOKEN;
  return spawnSync(process.execPath,['scripts/security/install-product-dependencies.mjs'],{cwd:directory,env,encoding:'utf8',timeout:60000});
}
function cleanup(directory){
  assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith('bejewely-install-fixture-'));
  fs.rmSync(directory,{recursive:true,force:true});
}
test('credentials are removed and content verification runs before lifecycle scripts',()=>{
  const directory=fixture();try{
    const result=run(directory,fake);assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
    assert.equal(fs.readFileSync(path.join(directory,'lifecycle-isolated'),'utf8'),'yes');
    assert.ok(!(result.stdout+result.stderr).includes(fake));
  }finally{cleanup(directory);}
});
test('missing credentials fail before an existing installation is touched',()=>{
  const directory=fixture();try{
    fs.mkdirSync(path.join(directory,'node_modules'));fs.writeFileSync(path.join(directory,'node_modules/retain'),'retained');
    const result=run(directory);assert.ifError(result.error);assert.notEqual(result.status,0);
    assert.match(result.stderr,/SCA_PACKAGES_READ_TOKEN_REQUIRED/);
    assert.equal(fs.readFileSync(path.join(directory,'node_modules/retain'),'utf8'),'retained');
    assert.equal(fs.existsSync(path.join(directory,'lifecycle-isolated')),false);
  }finally{cleanup(directory);}
});
test('failed npm installation does not expose the credential or run lifecycle scripts',()=>{
  const directory=fixture();try{
    fs.writeFileSync(path.join(directory,'package-lock.json'),'{ malformed fixture');
    const result=run(directory,fake);assert.ifError(result.error);assert.notEqual(result.status,0);
    assert.match(result.stderr,/PRIVATE_DEPENDENCY_CI_FAILED/);
    assert.ok(!(result.stdout+result.stderr).includes(fake));
    assert.equal(fs.existsSync(path.join(directory,'lifecycle-isolated')),false);
  }finally{cleanup(directory);}
});
