#!/usr/bin/env node
/**
 * Experimental source-pinned browser rebuild in disposable temp only.
 * Not adopted by B3 tarballs; no release approval or npm audit adjustment.
 */
import assert from "node:assert/strict";
import {createHash,constants,generateKeyPairSync,privateEncrypt,sign} from "node:crypto";
import {spawnSync} from "node:child_process";
import {runInNewContext} from "node:vm";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {materializePrivateForgeSource} from "./materialize-private-forge-source.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const sha="ceba34402e329f0365134f23fe19898756527d65";
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"bejewely-b3-browser-rebuild-"));
const hex=x=>createHash("sha256").update(x).digest("hex");
function run(exe,args,cwd,timeout=120000,env=process.env){
 const p=spawnSync(exe,args,{cwd,env,encoding:"utf8",timeout,maxBuffer:5*1024*1024});
 assert.equal(p.error,undefined,"process timeout/unavailable: "+exe);
 assert.equal(p.status,0,"command failed: "+exe+" "+(p.stderr||"").slice(-900)+" "+(p.stdout||"").slice(-500));
 return p.stdout.trim();
}
const length=n=>n<128?Buffer.from([n]):n<256?Buffer.from([129,n]):Buffer.from([130,n>>8,n&255]);
const tlv=(tag,b)=>Buffer.concat([Buffer.from([tag]),length(b.length),b]);
try{
 const original=path.join(root,"node_modules/node-forge");
 const target=path.join(temp,"patched");
 const upstream=path.join(temp,"upstream");
 const harness=path.join(temp,"webpack-harness");
 fs.mkdirSync(target);fs.mkdirSync(upstream);fs.mkdirSync(harness);
 const source=materializePrivateForgeSource(target);
 assert.equal(source.patchedRsaBlobSha1,"43090545115be1b1ffc484a2a27ecf31f840437e");
 run("git",["init","-q"],upstream,15000);
 run("git",["fetch","--depth=1","https://github.com/digitalbazaar/forge.git",sha],upstream,90000);
 run("git",["checkout","--quiet","--detach","FETCH_HEAD"],upstream,15000);
 assert.equal(run("git",["rev-parse","HEAD"],upstream,15000),sha);
 const upstreamConfig=path.join(upstream,"webpack.config.js");
 assert.ok(fs.statSync(upstreamConfig).isFile());
 const configBytes=fs.readFileSync(upstreamConfig);
 fs.copyFileSync(upstreamConfig,path.join(target,"webpack.config.js"));
 const pkg=JSON.parse(fs.readFileSync(path.join(original,"package.json"),"utf8"));
 assert.equal(pkg.version,"1.4.0");
 const pinnedToolchain={webpack:"4.44.1","webpack-cli":"3.3.12"};
 fs.writeFileSync(path.join(harness,"package.json"),JSON.stringify({
  name:"bejewely-sca-b3-browser-rebuild-only",private:true,version:"0.0.0",
  dependencies:pinnedToolchain
 },null,2)+"\n");
 run("npm",["install","--ignore-scripts","--no-audit","--no-fund","--package-lock=false","--no-save"],harness,190000,
  {...process.env,CI:"true",npm_config_update_notifier:"false",NODE_OPTIONS:""});
 const cli=path.join(harness,"node_modules/webpack-cli/bin/cli.js");
 assert.ok(fs.existsSync(cli),"pinned webpack 4 CLI unavailable");
 const webpackLog=run(process.execPath,[cli,"--config","webpack.config.js"],target,200000,{
  ...process.env,CI:"true",NODE_OPTIONS:"--openssl-legacy-provider",
  NODE_PATH:path.join(harness,"node_modules"),npm_config_update_notifier:"false"
 });
 assert.ok(!/\bERROR in\b/.test(webpackLog),"webpack compilation reported errors");
 const dist=path.join(target,"dist");
 const files=fs.readdirSync(dist).filter(p=>p.endsWith(".min.js")||p.endsWith(".min.js.map")).sort();
 const expected=["forge.all.min.js","forge.all.min.js.map","forge.min.js","forge.min.js.map",
 "prime.worker.min.js","prime.worker.min.js.map"].sort();
 assert.deepEqual(files,expected,"rebuilt browser distributable filenames changed");
 for(const p of files){
  assert.ok(fs.lstatSync(path.join(dist,p)).isFile()&&!fs.lstatSync(path.join(dist,p)).isSymbolicLink());
 }
 const rsaCode=fs.readFileSync(path.join(target,"lib/rsa.js"),"utf8");
 const mapped=[];
 for(const entry of ["forge.min.js.map","forge.all.min.js.map"]){
  const v=JSON.parse(fs.readFileSync(path.join(dist,entry),"utf8"));
  assert.ok(Array.isArray(v.sources)&&v.sources.length>0,
    "missing compiled browser source map");
  // Webpack 4's pinned cheap-module-source-map outputs a single minified
  // bundle source, not the original lib/rsa.js source. Never misstate this
  // as source-level provenance. Actual RSA acceptance/rejection is below.
  const matched=v.sources.filter(x=>/(?:^|[/\\])rsa\.js(?:\?.*)?$/.test(x));
  if(matched.length){
   assert.equal(matched.length,1,"duplicated RSA source map records");
   if(Array.isArray(v.sourcesContent)){
    const idx=v.sources.indexOf(matched[0]);
    assert.equal(v.sourcesContent[idx],rsaCode,
      "RSA source-map content differs from independently SHA-pinned RSA");
   }
  }
  mapped.push({file:entry,sourceCount:v.sources.length,
   containsOriginalRsaBytes:Boolean(matched.length&&Array.isArray(v.sourcesContent)),
   provenanceAuthority:"LIMITED_CHEAP_MODULE_MAP_NOT_SOURCE_PROOF"});
 }
 const message=Buffer.from("bejewely-b3-browser-build-rsa-negative");
 const wrong=Buffer.from("other-message");
 const key=generateKeyPairSync("rsa",{modulusLength:2048,publicExponent:65537});
 const pem=key.publicKey.export({format:"pem",type:"spki"});
 const digest=createHash("sha256").update(message).digest();
 const normal=sign("sha256",message,{key:key.privateKey,padding:constants.RSA_PKCS1_PADDING});
 const badAlgorithm=tlv(0x30,Buffer.concat([
  Buffer.from("0609608648016503040201","hex"),Buffer.from("0500","hex"),Buffer.from("0500","hex")]));
 const digestInfo=tlv(0x30,Buffer.concat([badAlgorithm,tlv(0x04,digest)]));
 const padding=256-digestInfo.length-3;assert.ok(padding>=8);
 const encoded=Buffer.concat([Buffer.from([0,1]),Buffer.alloc(padding,255),Buffer.from([0]),digestInfo]);
 const malicious=privateEncrypt({key:key.privateKey,padding:constants.RSA_NO_PADDING},encoded);
 const loadUMD=(filename)=>{
  const code=fs.readFileSync(filename,"utf8");
  assert.ok(code.length>10000&&code.length<15*1024*1024,
    "unexpected browser bundle size");
  const browser={Buffer,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,
    setTimeout,clearTimeout,console:{log(){},warn(){},error(){}}};
  browser.window=browser;
  browser.self=browser;
  browser.globalThis=browser;
  browser.navigator={userAgent:"BEJEWELY test browser",appName:"Netscape"};
  try{runInNewContext(code,browser,{filename:path.basename(filename),timeout:20000});}
  catch(e){throw new Error("B3_BROWSER_VM_DIAGNOSTIC file="+path.basename(filename)+
    " type="+String(e?.name).slice(0,50)+" message="+String(e?.message).slice(0,280));}
  assert.ok(browser.forge?.pki?.publicKeyFromPem,
    "browser UMD entry point not registered in isolated browser context");
  return browser.forge;
 };
 const tested=[];
 // forge.all.min.js initializes jQuery form/XHR integrations that require
 // a real browser. Building its bytes is verified, but behavioral validation
 // is HOLD until a real browser fixture exists. Do not fake jQuery calls.
 for(const filename of ["forge.min.js"]){
  const patched=loadUMD(path.join(dist,filename));
  const upstreamOriginal=loadUMD(path.join(original,"dist",filename));
  const verify=(forge,hash,signature)=>{
   assert.ok(forge?.pki?.publicKeyFromPem,"UMD browser forge RSA API unavailable: "+filename);
   const pk=forge.pki.publicKeyFromPem(pem);
   try{return pk.verify(hash.toString("binary"),signature.toString("binary"))===true;}
   catch{return false;}
  };
  assert.equal(verify(upstreamOriginal,digest,normal),true,
    "original browser bundle normal RSA baseline drift");
  assert.equal(verify(upstreamOriginal,digest,malicious),true,
    "original browser bundle unexpected ASN.1 rejection, baseline changed");
  assert.equal(verify(patched,digest,normal),true,"rebuilt browser bundle rejects valid RSA");
  assert.equal(verify(patched,createHash("sha256").update(wrong).digest(),normal),false,
   "rebuilt browser bundle accepts wrong message");
  assert.equal(verify(patched,digest,malicious),false,
   "rebuilt browser bundle accepts malformed ASN.1 nested child");
  tested.push(filename);
 }

 // Real Chromium is required for forge.all: jQuery's document initialization
 // cannot be simulated with a fake function or a Node-only VM.
 // jQuery tarball source is SHA512-pinned, installed ONLY under tmp.
 const jqDir=path.join(temp,"jquery-registry");
 fs.mkdirSync(jqDir);
 const jqPackText=run("npm",[
  "pack","jquery@3.7.1","--ignore-scripts","--json","--no-audit","--no-fund",
  "--pack-destination",jqDir
 ],root,45000,{...process.env,CI:"true",npm_config_update_notifier:"false"});
 const jqPack=JSON.parse(jqPackText);
 assert.ok(Array.isArray(jqPack)&&jqPack.length===1);
 assert.equal(jqPack[0].filename,"jquery-3.7.1.tgz");
 const jqArchive=fs.readFileSync(path.join(jqDir,"jquery-3.7.1.tgz"));
 const jqIntegrity="sha512-m4avr8yL8kmFN8psrbFFFmB/If14iN5o9nw/NgnnM+kybDJpRsAynV2BsfpTYrTRysYUdADVD7CkUUizgkpLfg==";
 assert.equal("sha512-"+createHash("sha512").update(jqArchive).digest("base64"),jqIntegrity,
  "real browser jQuery dependency registry provenance changed");
 run("tar",["-xzf",path.join(jqDir,"jquery-3.7.1.tgz"),"-C",jqDir,
   "--no-same-owner","--no-same-permissions"],root,12000);
 const jqSource=path.join(jqDir,"package/dist/jquery.min.js");
 assert.ok(fs.lstatSync(jqSource).isFile());
 const chromeCandidates=["google-chrome","google-chrome-stable","chromium","chromium-browser"];
 const chrome=chromeCandidates.find(c=>{
  const probe=spawnSync("which",[c],{encoding:"utf8",timeout:3000});
  return probe.status===0;
 });
 assert.ok(chrome,"real Google Chrome/Chromium unavailable: forge.all browser test HOLD");
 const allBrowserChecks=[];
 for(const [kind,bundle,expectMalformed] of [
   ["original",path.join(original,"dist/forge.all.min.js"),true],
   ["patched",path.join(dist,"forge.all.min.js"),false]
 ]){
  const page=path.join(temp,"chrome-"+kind);
  fs.mkdirSync(page);
  fs.copyFileSync(jqSource,path.join(page,"jquery.min.js"));
  fs.copyFileSync(bundle,path.join(page,"forge.all.min.js"));
  const input={
   publicPem:pem,
   digest64:digest.toString("base64"),
   wrongDigest64:createHash("sha256").update(wrong).digest("base64"),
   normalSignature64:normal.toString("base64"),
   malformedSignature64:malicious.toString("base64")
  };
  const execJs=String.raw`
   (() => {
     let outcome={status:"FAIL",jquery:"",bundle:"",normal:null,wrong:null,malformed:null,error:""};
     try{
       const data=JSON.parse(document.getElementById("b3-input").textContent);
       outcome.jquery=window.jQuery?.fn?.jquery||"";
       if(outcome.jquery!=="3.7.1")throw new Error("real jQuery absent");
       outcome.bundle=typeof window.forge?.pki?.publicKeyFromPem;
       if(outcome.bundle!=="function")throw new Error("forge.all browser API unavailable");
       const pub=window.forge.pki.publicKeyFromPem(data.publicPem);
       const verify=(hash,sig)=>{
         try {return pub.verify(atob(hash),atob(sig))===true;}
         catch {return false;}
       };
       outcome.normal=verify(data.digest64,data.normalSignature64);
       outcome.wrong=verify(data.wrongDigest64,data.normalSignature64);
       outcome.malformed=verify(data.digest64,data.malformedSignature64);
       outcome.status="PASS";
     }catch(e){outcome.error=String(e?.message||e).slice(0,120);}
     const elem=document.getElementById("b3-output");
     elem.setAttribute("data-status",outcome.status);
     elem.setAttribute("data-normal",String(outcome.normal));
     elem.setAttribute("data-wrong",String(outcome.wrong));
     elem.setAttribute("data-malformed",String(outcome.malformed));
     elem.setAttribute("data-jquery",outcome.jquery);
     elem.setAttribute("data-error",outcome.error);
   })();
  `;
  const html=[
   '<!doctype html><html><head><meta charset="utf-8">',
   '<script src="jquery.min.js"></script>',
   '<script src="forge.all.min.js"></script>',
   '</head><body><div id="b3-output" data-status="NOT_RUN"></div>',
   '<script type="application/json" id="b3-input">',
   JSON.stringify(input).replace(/</g,"\\u003c"),
   "</script><script>",execJs,"</script></body></html>"
  ].join("");
  fs.writeFileSync(path.join(page,"probe.html"),html);
  const profile=path.join(temp,"chrome-user-"+kind);
  const dom=run(chrome,[
   "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
   "--disable-extensions","--disable-background-networking","--no-first-run",
   "--no-default-browser-check","--no-proxy-server","--virtual-time-budget=6000",
   "--user-data-dir="+profile,"--dump-dom",
   "file://"+path.join(page,"probe.html")
  ],page,45000);
  const element=dom.match(/<div id="b3-output"[^>]*>/)?.[0]||"";
  const attr=k=>element.match(new RegExp('data-'+k+'="([^"]*)"'))?.[1]||"";
  const actual={kind,status:attr("status"),jquery:attr("jquery"),
    normal:attr("normal"),wrong:attr("wrong"),
    malformed:attr("malformed"),error:attr("error")};
  console.log("SCA_B3_CHROMIUM_FORGE_ALL_CASE="+JSON.stringify(actual));
  assert.equal(actual.status,"PASS","real browser forge.all initialization failed: "+actual.error);
  assert.equal(actual.jquery,"3.7.1");
  assert.equal(actual.normal,"true","forge.all browser valid RSA rejected");
  assert.equal(actual.wrong,"false","forge.all browser wrong RSA message accepted");
  assert.equal(actual.malformed,String(expectMalformed),
   kind+" forge.all original/patch ASN.1 negative control failed");
  allBrowserChecks.push(actual);
 }


 // A *separate* B3 full-dist candidate: only disposable npm pack, never
 // overwrites the existing no-dist B3 output or application package-lock.
 // Restores the six official distribution entrypoints using *patched* builds.
 const distroNames=["forge.all.min.js","forge.all.min.js.map",
  "forge.min.js","forge.min.js.map","prime.worker.min.js",
  "prime.worker.min.js.map"].sort();
 const approvedLicenseSha="f63ff0e4e239244aa79280da2dd4811a0469e5e201caf5cbc0d97c3a1dff8e82";
 const walk=(dir)=>{
  const contents={};
  const visit=(location,prefix="")=>{
   for(const e of fs.readdirSync(location,{withFileTypes:true})){
    const rel=path.posix.join(prefix,e.name),absolute=path.join(location,e.name);
    assert.ok(!e.isSymbolicLink()&&(e.isDirectory()||e.isFile()),
      "disallowed symlink/special filesystem candidate: "+rel);
    assert.ok(!/(?:^|\/)(?:\.env(?:\.|$)|\.npmrc|\.netrc|node_modules|id_rsa|id_ed25519)(?:\/|$)/i.test(rel),
      "secret-like candidate file path: "+rel);
    if(e.isDirectory()){visit(absolute,rel);continue;}
    const size=fs.statSync(absolute).size;
    assert.ok(size<20*1024*1024,"unexpected candidate file size: "+rel);
    contents[rel]=hex(fs.readFileSync(absolute));
    assert.ok(Object.keys(contents).length<1000,"unexpected candidate file count");
   }
  };
  visit(dir);
  return contents;
 };
 const originalFiles=walk(original);
 assert.equal(originalFiles["LICENSE"],approvedLicenseSha,"original forge LICENSE provenance changed");
 const originalPkg=JSON.parse(fs.readFileSync(path.join(original,"package.json"),"utf8"));
 assert.equal(originalPkg.version,"1.4.0");
 assert.deepEqual(Object.keys(originalPkg.scripts||{}).filter(x=>
  /^(?:preinstall|install|postinstall|prepublish|prepublishOnly|prepare|prepack|postpack)$/.test(x)),
  ["prepublish"],"original upstream lifecycle drift, stop before packing");
 const fullDistPacks=[];
 for(let iteration=1;iteration<=2;iteration++){
  const packFolder=path.join(temp,"full-dist-pack-"+iteration);
  const pkgFolder=path.join(packFolder,"candidate");
  const outFolder=path.join(packFolder,"output");
  fs.mkdirSync(packFolder);fs.mkdirSync(outFolder);
  fs.cpSync(original,pkgFolder,{recursive:true,force:false,errorOnExist:true});
  fs.copyFileSync(path.join(target,"lib/rsa.js"),path.join(pkgFolder,"lib/rsa.js"));
  fs.rmSync(path.join(pkgFolder,"dist"),{recursive:true});
  fs.mkdirSync(path.join(pkgFolder,"dist"));
  for(const name of distroNames)fs.copyFileSync(path.join(dist,name),path.join(pkgFolder,"dist",name));
  const pkgJsonFile=path.join(pkgFolder,"package.json");
  const metadata=JSON.parse(fs.readFileSync(pkgJsonFile,"utf8"));
  assert.equal(metadata.name,"node-forge");
  assert.equal(metadata.version,"1.4.0");
  delete metadata.scripts.prepublish;
  fs.writeFileSync(pkgJsonFile,JSON.stringify(metadata,null,2)+"\n");
  const candidateFiles=walk(pkgFolder);
  const differences=Object.keys(originalFiles).filter(x=>candidateFiles[x]!==originalFiles[x]).sort();
  // Exact pinned upstream webpack emits byte-identical worker and cheap source
  // maps; RSA changes must affect the two forged core bundles, *not* worker.
  // Rebuilt unchanged dist files are still byte-checked against fresh output.
  assert.deepEqual(differences,[
   "dist/forge.all.min.js","dist/forge.min.js","lib/rsa.js","package.json"
  ].sort(),"full-dist candidate modified unexpected original package files");
  assert.deepEqual(Object.keys(candidateFiles).sort(),Object.keys(originalFiles).sort(),
   "full-dist candidate lost/gained source files");
  const output=JSON.parse(run("npm",[
   "pack",pkgFolder,"--ignore-scripts","--offline","--json",
   "--no-audit","--no-fund","--pack-destination",outFolder
  ],packFolder,55000));
  assert.equal(output.length,1);
  assert.equal(output[0].filename,"node-forge-1.4.0.tgz");
  const tgz=path.join(outFolder,output[0].filename);
  const bytes=fs.readFileSync(tgz);
  const archiveSha256=hex(bytes);
  const names=run("tar",["-tzf",tgz],packFolder,16000).split("\n").filter(Boolean);
  assert.equal(names.filter(x=>x.startsWith("package/dist/")).length,6,
   "full-dist archive leaked or omitted browser assets");
  assert.deepEqual(names.filter(x=>x.startsWith("package/dist/")).map(x=>x.slice(13)).sort(),
   distroNames,"full-dist archive missing exact browser bundle set");
  assert.ok(names.every(x=>x.startsWith("package/")&&!x.includes("..")&&!x.includes("\\")),
   "unsafe full-dist archive member");
  const unpack=path.join(packFolder,"unpacked");
  fs.mkdirSync(unpack);
  run("tar",["-xzf",tgz,"-C",unpack,"--no-same-owner",
   "--no-same-permissions"],packFolder,15000);
  const actualDir=path.join(unpack,"package");
  const artifactFiles=walk(actualDir);
  assert.equal(Object.keys(artifactFiles).length,59,
   "original forge 59-file npm browser compatibility surface changed");
  assert.equal(artifactFiles["LICENSE"],approvedLicenseSha);
  assert.equal(artifactFiles["lib/rsa.js"],hex(fs.readFileSync(path.join(target,"lib/rsa.js"))));
  for(const n of distroNames)assert.equal(artifactFiles["dist/"+n],
   hex(fs.readFileSync(path.join(dist,n))),"packed browser bundle digest mismatch "+n);
  const packedJson=JSON.parse(fs.readFileSync(path.join(actualDir,"package.json"),"utf8"));
  assert.equal(packedJson.name,"node-forge");
  assert.equal(packedJson.version,"1.4.0");
  assert.ok(!("prepublish" in packedJson.scripts),"packed lifecycle hook reintroduced");
  fullDistPacks.push({sha256:archiveSha256,sha512:
   "sha512-"+createHash("sha512").update(bytes).digest("base64"),
   files:Object.keys(artifactFiles).length,distCount:distroNames.length,
   rsaSha256:artifactFiles["lib/rsa.js"],browserBundleSha256:
   distroNames.map(n=>({path:"dist/"+n,sha256:artifactFiles["dist/"+n]}))});
 }
 assert.deepEqual(fullDistPacks[0],fullDistPacks[1],
  "B3 browser-complete patch tarballs non-reproducible within same runner");

 // B3.5 non-production install acceptance. The tarball is installed by npm,
 // not unpacked or symlinked into the application's actual node_modules.
 // The package+lock are generated ONLY inside OS temp, with offline/no hooks.
 const tarball=path.join(temp,"full-dist-pack-1","output","node-forge-1.4.0.tgz");
 assert.ok(fs.lstatSync(tarball).isFile()&&!fs.lstatSync(tarball).isSymbolicLink());
 assert.equal(hex(fs.readFileSync(tarball)),fullDistPacks[0].sha256);
 const fixture=path.join(temp,"npm-installed-forge-consumer");
 fs.mkdirSync(fixture);
 fs.writeFileSync(path.join(fixture,"package.json"),JSON.stringify({
  name:"bejewely-b3-quarantined-install-consumer",private:true,version:"0.0.0",
  dependencies:{"node-forge":"file:"+tarball}
 },null,2)+"\n");
 const npmConfig=path.join(temp,"empty-user-npmrc");
 fs.writeFileSync(npmConfig,"");
 const isolatedNpmEnv={...process.env,CI:"true",NODE_OPTIONS:"",
  npm_config_userconfig:npmConfig,npm_config_update_notifier:"false",
  npm_config_registry:"http://127.0.0.1:9"};
 run("npm",["install","--package-lock-only","--ignore-scripts","--offline",
  "--no-audit","--no-fund"],fixture,40000,isolatedNpmEnv);
 const consumerLock=JSON.parse(fs.readFileSync(path.join(fixture,"package-lock.json"),"utf8"));
 assert.equal(consumerLock.lockfileVersion,3,"fixture lockfile v3 required");
 const lockedForge=consumerLock.packages["node_modules/node-forge"];
 assert.equal(lockedForge.version,"1.4.0");
 assert.equal(lockedForge.integrity,fullDistPacks[0].sha512,
  "npm resolver recorded a different node-forge packed SHA512");
 assert.equal(lockedForge.resolved,"file:"+tarball,
  "npm resolver did not use local temporary full-dist package");
 run("npm",["ci","--ignore-scripts","--offline","--no-audit","--no-fund"],fixture,
   45000,isolatedNpmEnv);
 const tree=JSON.parse(run("npm",["ls","node-forge","--all","--json",
   "--offline"],fixture,30000,isolatedNpmEnv));
 assert.equal(tree.dependencies?.["node-forge"]?.version,"1.4.0");
 const installed=path.join(fixture,"node_modules","node-forge");
 assert.ok(fs.lstatSync(installed).isDirectory()&&!fs.lstatSync(installed).isSymbolicLink(),
  "patched forge must be physically installed by npm ci");
 const installedFiles=walk(installed);
 assert.equal(Object.keys(installedFiles).length,59,
  "npm installed node-forge full-dist file count changed");
 assert.equal(installedFiles["LICENSE"],approvedLicenseSha);
 assert.equal(installedFiles["lib/rsa.js"],fullDistPacks[0].rsaSha256);
 for(const entry of fullDistPacks[0].browserBundleSha256){
  assert.equal(installedFiles[entry.path],entry.sha256,
   "actual npm-installed browser dist differs from source-pinned packed bundle");
 }
 assert.equal(JSON.parse(fs.readFileSync(path.join(installed,"package.json"),"utf8")).name,
   "node-forge");
 const signingSource=path.join(root,"node_modules","@expo","code-signing-certificates");
 const signingOriginal=JSON.parse(fs.readFileSync(path.join(signingSource,"package.json"),"utf8"));
 assert.equal(signingOriginal.version,"0.0.6","Expo signing consumer version drift");
 assert.deepEqual(signingOriginal.dependencies,{"node-forge":"^1.3.0"},
   "Expo signing direct consumer dependencies changed");
 const signing=path.join(fixture,"@expo","code-signing-certificates");
 fs.mkdirSync(signing,{recursive:true});
 fs.copyFileSync(path.join(signingSource,"package.json"),path.join(signing,"package.json"));
 fs.cpSync(path.join(signingSource,"build"),path.join(signing,"build"),{recursive:true});
 const installedEntrypoint=path.join(installed,"lib","index.js");
 fs.symlinkSync(installed,path.join(fixture,"node-forge"),"dir");
 const probeSigning=run(process.execPath,[
   path.join(root,"scripts/security/verify-private-forge-probe-child.mjs"),fixture
 ],root,70000,isolatedNpmEnv);
 assert.match(probeSigning,/SCA_B2_PRIVATE_FORGE_BEHAVIOR=PASS/,
   "real npm-installed patched forge failed Expo signing consumer integration");
 const npmInstalledConsumer={result:"PASS_OFFLINE_NPM_CI_INSTALLED_FULL_DIST_FORGE_RSA_EXPO",
  fixtureOnly:true,lockfileVersion:consumerLock.lockfileVersion,
  physicalInstalledFileCount:Object.keys(installedFiles).length,
  fullDistTarballSha256:fullDistPacks[0].sha256,
  installedRsaSha256:installedFiles["lib/rsa.js"],
  expoSigningVersion:signingOriginal.version,
  originalAppGraphUnaffected:true,appLockUnchanged:true,
  localRegistryAccessDisabled:true,
  npmAuditResult:"NOT_RUN_NOT_AN_AUDIT_PASS",
  realAppReplacementAuthorized:false};

 if("SCA_B3_EXPECTED_FORGE_FULL_DIST_SHA256" in process.env){
  assert.match(process.env.SCA_B3_EXPECTED_FORGE_FULL_DIST_SHA256,/^[a-f0-9]{64}$/);
  assert.equal(fullDistPacks[0].sha256,process.env.SCA_B3_EXPECTED_FORGE_FULL_DIST_SHA256,
   "B3 browser-complete package not reproducible across clean CI runners");
 }
 if(process.env.GITHUB_OUTPUT){
  fs.appendFileSync(process.env.GITHUB_OUTPUT,
   "forge_full_dist_sha256="+fullDistPacks[0].sha256+"\n");
 }

 const report={
  status:"PASS_TEMP_FULL_DIST_PACK_AND_CHROMIUM_RSA_NOT_A_RELEASE",
  verifiedUpstreamCommit:sha,buildConfigSha256:hex(configBytes),
  patchedRsaSha256:hex(Buffer.from(rsaCode)),
  toolchain:pinnedToolchain,nodeVersion:process.version,
  browserBundles:files.map(p=>({path:"dist/"+p,sha256:hex(fs.readFileSync(path.join(dist,p)))})),
  sourceMapLimits:mapped,
  unpatchedBrowserBundleMalformationAcceptedAsNegativeControl:tested.length,
  RSAUMDPositiveNegativePassed:tested,
  forgeAllChromiumRsaChecks:allBrowserChecks,
  jqueryRegistryIntegrity:jqIntegrity,
  forgeAllBroaderBrowserBehavior:"NOT_ATTESTED_RSA_ONLY",
  browserCompleteTempPack:fullDistPacks[0],
  browserCompleteTempPackReproducibleWithinRunner:true,
  npmInstalledConsumer,
  artifactsDeletedOnExit:true,
  actualInstallGraphStillOriginal:true,
  primeWorkerBundleBuiltButRuntime:"NOT_APPLICABLE_TO_RSA_VERIFY",
  originalNpmTarballUnmodified:true,candidateTarballUnmodified:true,
  officialAuditBypass:false,distributionApproved:false,onlyTempFiles:true
 };
 console.log("SCA_B3_FORGE_BROWSER_REBUILD="+JSON.stringify(report));
} finally {
 fs.rmSync(temp,{recursive:true,force:true});
}
