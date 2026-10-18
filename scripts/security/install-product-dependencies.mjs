/** Private registry credentials exist only during npm ci with lifecycle scripts disabled. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {npmCli} from './npm-cli.mjs';

const token=process.env.SCA_PACKAGES_READ_TOKEN;
delete process.env.SCA_PACKAGES_READ_TOKEN;
delete process.env.NODE_AUTH_TOKEN;
delete process.env.NPM_TOKEN;
const args=process.argv.slice(2);
if(args.some(a=>!['--ignore-scripts','--no-audit','--no-fund'].includes(a)))throw new Error('UNSUPPORTED_INSTALL_ARGUMENT');
if(!token||/[\r\n\s]/.test(token))throw new Error('SCA_PACKAGES_READ_TOKEN_REQUIRED: configure an owner read:packages credential in the runner secret store');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'bejewely-private-install-'));
function run(command,environment){
  const result=spawnSync(process.execPath,[npmCli(),...command],{env:environment,encoding:'utf8',timeout:600000,maxBuffer:16000000});
  // npm may include credential-bearing registry responses in diagnostics. Never relay raw output.
  if(result.error||result.status!==0)throw new Error('PRIVATE_DEPENDENCY_'+command[0].toUpperCase()+'_FAILED: check token expiry/access or the pinned lockfile; raw output withheld');
}
try{
  if(process.platform==='win32'){
    const identity=spawnSync('whoami.exe',['/user','/fo','csv','/nh'],{encoding:'utf8'});
    const sid=identity.stdout?.match(/S-1-5-(?:\d+-)*\d+/)?.[0];
    if(identity.status!==0||!sid)throw new Error('PRIVATE_INSTALL_ACL_IDENTITY_FAILED');
    const acl=spawnSync('icacls.exe',[scratch,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F'],{encoding:'utf8'});
    if(acl.status!==0)throw new Error('PRIVATE_INSTALL_ACL_FAILED');
  }else fs.chmodSync(scratch,0o700);
  const config=path.join(scratch,'npmrc');
  fs.writeFileSync(config,'//npm.pkg.github.com/:_authToken='+token+'\n',{mode:0o600});
  const base={...process.env};
  // Do not inherit another credential source into npm or later package lifecycle scripts.
  for(const key of Object.keys(base))if(/(?:token|password|secret|auth|userconfig)/i.test(key))delete base[key];
  run(['ci','--ignore-scripts','--no-audit','--no-fund','--loglevel=error'],{...base,npm_config_userconfig:config,npm_config_cache:path.join(scratch,'cache')});
}finally{
  if(path.dirname(path.resolve(scratch))!==path.resolve(os.tmpdir())||!path.basename(scratch).startsWith('bejewely-private-install-'))throw new Error('PRIVATE_INSTALL_CLEANUP_PATH_INVALID');
  fs.rmSync(scratch,{recursive:true,force:true});
}
const clean={...process.env};
for(const key of Object.keys(clean))if(/(?:token|password|secret|auth|userconfig)/i.test(key))delete clean[key];
clean.npm_config_userconfig=path.join(scratch,'removed-npmrc');
// Verify actual installed bytes before executing any dependency lifecycle script.
const check=spawnSync(process.execPath,['scripts/security/verify-product-installed-security.mjs'],{env:clean,encoding:'utf8',timeout:60000,maxBuffer:1000000});
if(check.error||check.status!==0)throw new Error('INSTALLED_SECURITY_VERIFICATION_FAILED');
if(!args.includes('--ignore-scripts'))run(['rebuild','--no-audit','--no-fund','--loglevel=error'],clean);
console.log('PRODUCT_PRIVATE_INSTALL=PASS credentialRemovedBeforeLifecycle=true upstreamFallback=false');
