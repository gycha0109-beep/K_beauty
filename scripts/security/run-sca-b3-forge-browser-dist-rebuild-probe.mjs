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
   "<!doctype html><html><head><meta charset="utf-8">",
   "<script src="jquery.min.js"></script>",
   "<script src="forge.all.min.js"></script>",
   "</head><body><div id="b3-output" data-status="NOT_RUN"></div>",
   "<script type="application/json" id="b3-input">",
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

 const report={
  status:"PASS_DISPOSABLE_CORE_AND_FORGE_ALL_CHROMIUM_RSA_ONLY_NOT_RELEASE",
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
  primeWorkerBundleBuiltButRuntime:"NOT_APPLICABLE_TO_RSA_VERIFY",
  originalNpmTarballUnmodified:true,candidateTarballUnmodified:true,
  officialAuditBypass:false,distributionApproved:false,onlyTempFiles:true
 };
 console.log("SCA_B3_FORGE_BROWSER_REBUILD="+JSON.stringify(report));
} finally {
 fs.rmSync(temp,{recursive:true,force:true});
}
