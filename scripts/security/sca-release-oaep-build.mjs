/** New source-changing profile. Old B6 archives/pins are inputs, never rewritten. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {generateKeyPairSync,publicEncrypt,privateDecrypt,createHash,constants,sign,privateEncrypt} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {inspectArchive,verifyArchive,digest,browserReference} from './sca-release-bundle.mjs';
import {verifyOaepSources,materializeOaepSources} from './sca-release-oaep-source.mjs';

const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const vendor='security/vendor/node-forge-oaep-replacement/';
function run(exe,args,cwd,env=process.env){const p=spawnSync(exe,args,{cwd,env,encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024});assert.ok(!p.error&&p.status===0,'OAEP build/compatibility failed: '+exe+'\n'+p.stdout+'\n'+p.stderr);return p.stdout;}
function files(dir,out={},prefix=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name),n=path.posix.join(prefix,e.name);assert.ok(!e.isSymbolicLink());if(e.isDirectory())files(p,out,n);else {assert.ok(e.isFile());out[n]=digest(fs.readFileSync(p));}}return Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b)));}
function writeEntries(entries,dir){fs.mkdirSync(dir);for(const [n,b] of Object.entries(entries)){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b,{flag:'wx',mode:0o600});}}
function pack(dir,out){const win=process.platform==='win32';const cmd=win?process.execPath:'npm';const argv=['pack',dir,'--ignore-scripts','--offline','--json','--pack-destination',out];if(win)argv.unshift(path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'));return path.join(out,JSON.parse(run(cmd,argv,out))[0].filename);}

function browserInput(original){
  const pair=generateKeyPairSync('rsa',{modulusLength:2048});
  const label='browser\0label\xff',message='OAEP replacement\0\xff';
  const cipher=publicEncrypt({key:pair.publicKey,oaepHash:'sha256',oaepLabel:Buffer.from(label,'binary')},Buffer.from(message,'binary'));
  const vectors=[];const key={n:{bitLength:()=>2048}};
  for(const hash of ['sha1','sha256','sha384','sha512'])for(const mgf of ['sha1','sha256']){
    const seed='s'.repeat(original.md[hash].create().digestLength),opts={md:original.md[hash].create(),mgf1:{md:original.md[mgf].create()},label,seed};
    vectors.push({hash,mgf,seed,label,message,em:original.util.bytesToHex(original.pkcs1.encode_rsa_oaep(key,message,opts))});
  }
  const digestBytes=createHash('sha256').update(message,'binary').digest();
  const good=sign('sha256',Buffer.from(message,'binary'),pair.privateKey);
  const algorithm=Buffer.from('300f060960864801650304020105000500','hex');
  const di=Buffer.concat([algorithm,Buffer.from([4,32]),digestBytes]);
  const outer=Buffer.concat([Buffer.from([0x30,di.length]),di]);
  const bad=privateEncrypt({key:pair.privateKey,padding:constants.RSA_NO_PADDING},Buffer.concat([Buffer.from([0,1]),Buffer.alloc(256-outer.length-3,255),Buffer.from([0]),outer]));
  return {pair,data:{vectors,label,message,publicPem:pair.publicKey.export({type:'spki',format:'pem'}),privatePem:pair.privateKey.export({type:'pkcs1',format:'pem'}),cipher64:cipher.toString('base64'),digest64:digestBytes.toString('base64'),good64:good.toString('base64'),bad64:bad.toString('base64')}};
}
const browserChecks=String.raw`(function(){
  var out={status:'FAIL',checks:0};
  try {
    var f=window.forge,d=JSON.parse(document.getElementById('oaep-input').textContent),k={n:{bitLength:function(){return 2048;}}};
    if(!f||!f.pkcs1)throw Error('Forge missing');
    d.vectors.forEach(function(v){var o={md:f.md[v.hash].create(),mgf1:{md:f.md[v.mgf].create()},label:v.label,seed:v.seed};
      var em=f.pkcs1.encode_rsa_oaep(k,v.message,o);if(f.util.bytesToHex(em)!==v.em)throw Error('OAEP bytes differ');out.checks++;
      if(f.pkcs1.decode_rsa_oaep(k,f.util.hexToBytes(v.em),o)!==v.message)throw Error('OAEP decode differs');out.checks++;
      var denied=false;try{f.pkcs1.decode_rsa_oaep(k,'\x01'+em.slice(1),o);}catch(e){denied=true;}if(!denied)throw Error('invalid Y accepted');out.checks++;
    });
    var priv=f.pki.privateKeyFromPem(d.privatePem),pub=f.pki.publicKeyFromPem(d.publicPem);
    if(priv.decrypt(atob(d.cipher64),'RSA-OAEP',{md:f.md.sha256.create(),label:d.label})!==d.message)throw Error('native ciphertext rejected');out.checks++;
    out.cipher64=btoa(pub.encrypt(d.message,'RSA-OAEP',{md:f.md.sha256.create(),label:d.label}));out.checks++;
    if(!pub.verify(atob(d.digest64),atob(d.good64)))throw Error('normal RSA signature rejected');out.checks++;
    var accepted=false;try{accepted=pub.verify(atob(d.digest64),atob(d.bad64));}catch(e){}if(accepted)throw Error('malformed DigestAlgorithm accepted');out.checks++;
    out.status='PASS';
  }catch(e){out.error=String(e.message||e).slice(0,160);}
  document.getElementById('oaep-output').textContent=JSON.stringify(out);
})();`;

export function verifyReplacementBrowsers({dir,originalDir,jquerySource,chrome,temp}){
  const original=require(path.join(originalDir,'lib/index.js')),input=browserInput(original),results=[];
  for(const name of ['forge.min.js','forge.all.min.js']){
    const source=fs.readFileSync(path.join(dir,'dist',name),'utf8');assert.ok(!/Ellis Pritchard|webrsa\.cvs|RSAES-OAEP\.js,v/.test(source),'historical OAEP survived browser rebuild');
    const page=path.join(temp,'oaep-browser-'+name);fs.mkdirSync(page);fs.copyFileSync(jquerySource,path.join(page,'jquery.min.js'));fs.writeFileSync(path.join(page,name),source);
    const html='<!doctype html><meta charset="utf-8"><script src="jquery.min.js"></script><script src="'+name+'"></script><pre id="oaep-output"></pre><script type="application/json" id="oaep-input">'+JSON.stringify(input.data).replace(/</g,'\\u003c')+'</script><script>'+browserChecks+'</script>';
    fs.writeFileSync(path.join(page,'probe.html'),html);
    const dom=run(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-extensions','--disable-background-networking','--no-first-run','--no-default-browser-check','--no-proxy-server','--virtual-time-budget=8000','--user-data-dir='+path.join(page,'profile'),'--dump-dom',pathToFileURL(path.join(page,'probe.html')).href],page);
    const raw=dom.match(/<pre id="oaep-output">([^<]*)<\/pre>/)?.[1];assert.ok(raw,'real Chromium OAEP output absent');const result=JSON.parse(raw.replace(/&quot;/g,'"').replace(/&amp;/g,'&'));
    assert.equal(result.status,'PASS','Chromium '+name+' '+result.error);assert.equal(result.checks,28);
    assert.equal(privateDecrypt({key:input.pair.privateKey,oaepHash:'sha256',oaepLabel:Buffer.from(input.data.label,'binary')},Buffer.from(result.cipher64,'base64')).toString('binary'),input.data.message,'browser ciphertext incompatible');
    results.push({file:name,status:'PASS',checks:result.checks,nativeInteroperability:true,rsaMalformationRejected:true});
  }
  return results;
}

export function buildOaepReplacement({originalForgeTarball,webpackCli,webpackConfig,typescript,jquerySource,chrome,temp}){
  const oldBytes=fs.readFileSync(originalForgeTarball),old=verifyArchive('node-forge',oldBytes),entries=inspectArchive(oldBytes);
  const source=verifyOaepSources({typescript});assert.equal(digest(fs.readFileSync(webpackConfig)),browserReference.buildConfigSha256,'unreviewed upstream webpack config');
  const baseline=path.join(temp,'oaep-original'),target=path.join(temp,'oaep-replacement');writeEntries(entries,baseline);writeEntries(entries,target);
  materializeOaepSources(target);
  const before=files(target),recipe=digest(fs.readFileSync(path.join(root,vendor,'source-manifest.json')));
  fs.copyFileSync(webpackConfig,path.join(target,'webpack.config.js'));
  const webpackLog=run(process.execPath,[webpackCli,'--config','webpack.config.js'],target,{...process.env,CI:'true',NODE_OPTIONS:'--openssl-legacy-provider',NODE_PATH:path.dirname(path.dirname(path.dirname(webpackCli)))});
  assert.ok(!/\bERROR in\b/.test(webpackLog));fs.unlinkSync(path.join(target,'webpack.config.js'));
  // Upstream webpack also emits non-distributed debug bundles and a local Terser cache.
  for(const n of ['dist/forge.js','dist/forge.all.js','dist/prime.worker.js','node_modules']){
    assert.ok(!Object.keys(entries).some(p=>p===n||p.startsWith(n+'/')));
    const discard=path.resolve(target,n);assert.ok(discard.startsWith(path.resolve(target)+path.sep));
    fs.rmSync(discard,{recursive:true,force:true});
  }
  const after=files(target),bundles=browserReference.browserBundles.map(x=>x.path),allowed=['lib/pkcs1.js',...bundles],added=['lib/bejewely-node-rsa-oaep.js','LICENSE.node-rsa.txt'];
  assert.deepEqual(Object.keys(after).sort(),[...Object.keys(entries),...added].sort(),'new profile changed unexpected package inventory');
  for(const n of Object.keys(entries))if(!allowed.includes(n))assert.equal(after[n],digest(entries[n]),'unexpected original change: '+n);
  for(const n of Object.keys(before))if(!bundles.includes(n))assert.equal(after[n],before[n],'webpack changed source/notice: '+n);
  for(const n of ['lib/pkcs1.js','lib/bejewely-node-rsa-oaep.js',...bundles])assert.ok(!/Ellis Pritchard|webrsa\.cvs|RSAES-OAEP\.js,v/.test(fs.readFileSync(path.join(target,n),'utf8')),'historical OAEP implementation survived: '+n);
  const compatibility=run(process.execPath,[path.join(root,'scripts/security/verify-sca-oaep-installed.mjs'),target,baseline],root);console.log(compatibility);
  const browserResults=verifyReplacementBrowsers({dir:target,originalDir:baseline,jquerySource,chrome,temp});
  const firstOut=path.join(temp,'oaep-pack-1'),secondOut=path.join(temp,'oaep-pack-2');fs.mkdirSync(firstOut);fs.mkdirSync(secondOut);
  const first=pack(target,firstOut),second=pack(target,secondOut);assert.equal(digest(fs.readFileSync(first)),digest(fs.readFileSync(second)),'replacement tarball non-reproducible within runner');
  assert.deepEqual(Object.fromEntries(Object.entries(inspectArchive(fs.readFileSync(first))).map(([n,b])=>[n,digest(b)]).sort(([a],[b])=>a.localeCompare(b))),after,'packed replacement file inventory differs');
  const build={profile:'NODE_RSA_MIT_V1',originalForgeSha256:old.sha256,sourceRecipeSha256:recipe,
    pinnedFiles:{'lib/pkcs1.js':vendor+'pkcs1.js','lib/bejewely-node-rsa-oaep.js':vendor+'bejewely-node-rsa-oaep.js','LICENSE.node-rsa.txt':vendor+'LICENSE.node-rsa.txt'},
    replacementSourcePath:vendor+'pkcs1.js',nodeRsaLicensePath:vendor+'LICENSE.node-rsa.txt',allowedChangedFiles:allowed,addedFiles:added,fileSha256:after,
    browserBundleSha256:bundles.map(n=>({path:n,sha256:after[n]})),toolchain:{webpack:'4.44.1','webpack-cli':'3.3.12',typescript:'5.9.3'},
    sourceReconstruction:'PASS',historicalOaepImplementationDistributed:false,originalRsaSourcePreserved:true,browserCompatibility:'PASS_REAL_CHROMIUM_BOTH_BUNDLES'};
  const receipt={sha256:digest(fs.readFileSync(first)),files:Object.keys(after).length,build};
  if(process.env.SCA_B6_EXPECTED_CANDIDATE_SHA256)assert.equal(receipt.sha256,process.env.SCA_B6_EXPECTED_CANDIDATE_SHA256,'independent replacement archive mismatch');
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'b6_candidate_sha256='+receipt.sha256+'\n');
  console.log('SCA_OAEP_REPLACEMENT_BUILD='+JSON.stringify({...receipt,sourceVerification:source,browserResults,publication:'NOT_RUN'}));
  return {tarball:first,receipt,build};
}
