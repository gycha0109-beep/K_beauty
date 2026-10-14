/**
 * B4 technical experiment, called only after the B3 full-dist producer passed.
 * Same names/versions, disposable file overrides, no release or audit waiver.
 * Never exports a tarball or candidate lock. Raw audit JSON is printed verbatim.
 */
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {materializePrivateBracesSource} from "./materialize-private-braces-source.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const hash=(bytes,alg="sha256")=>createHash(alg).update(bytes).digest("hex");
const targets=["braces","node-forge"];
function run(exe,args,cwd,timeout=120000,allowed=[0]) {
  const p=spawnSync(exe,args,{cwd,encoding:"utf8",timeout,maxBuffer:32*1024*1024,
    env:{...process.env,CI:"true",NODE_OPTIONS:"",EXPO_NO_TELEMETRY:"1",
      npm_config_update_notifier:"false"}});
  assert.equal(p.error,undefined,`${exe} ${args.join(" ")}: unavailable/timeout`);
  assert.ok(allowed.includes(p.status),`${exe} ${args.join(" ")}: exit ${p.status}\n${p.stderr}\n${p.stdout}`);
  return p;
}
function inventory(dir,out={},prefix="") {
  for(const e of fs.readdirSync(dir,{withFileTypes:true})) {
    const rel=path.posix.join(prefix,e.name),abs=path.join(dir,e.name);
    assert.ok(!e.isSymbolicLink(),"symlink in patched package: "+rel);
    if(e.isDirectory()) { assert.notEqual(e.name,"node_modules"); inventory(abs,out,rel); }
    else { assert.ok(e.isFile()); out[rel]=hash(fs.readFileSync(abs)); }
  }
  return Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b)));
}
function audit(cwd,label,args=[]) {
  const p=run("npm",["audit","--json",...args],cwd,120000,[0,1]);
  // Preserve the exact stdout; never delete findings or apply exception logic.
  console.log(`SCA_B4_RAW_AUDIT_${label}_BEGIN\n${p.stdout}\nSCA_B4_RAW_AUDIT_${label}_END`);
  const report=JSON.parse(p.stdout);
  assert.ok(!report.error && report.metadata?.vulnerabilities,"audit service error");
  const leaves=Object.values(report.vulnerabilities||{}).flatMap(v=>(v.via||[])
    .filter(x=>typeof x==="object").map(x=>({name:x.name,url:x.url,severity:x.severity,range:x.range})));
  return {exit:p.status,rawSha256:hash(p.stdout),counts:report.metadata.vulnerabilities,
    advisoryLeaves:[...new Map(leaves.map(x=>[x.url,x])).values()],
    targetScannerCoverage:Object.fromEntries(targets.map(name=>[name,leaves.some(x=>x.name===name)]))};
}

export async function validateFullGraphCandidate(forgeTarball,forgeReceipt) {
  assert.equal(process.platform,"linux","B4 clean install requires Linux runner; Windows sandbox denies workspace symlinks");
  const originalLockBytes=fs.readFileSync(path.join(root,"package-lock.json"));
  const originalManifestBytes=fs.readFileSync(path.join(root,"package.json"));
  const baseline=JSON.parse(originalLockBytes);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"bejewely-sca-b4-"));
  const graph=path.join(temp,"graph"),artifacts=path.join(temp,"artifacts");
  fs.mkdirSync(graph);fs.mkdirSync(artifacts);
  try {
    const head=run("git",["rev-parse","HEAD"],root).stdout.trim();
    // Exact committed source, including every workspace; no user/environment files.
    const archive=path.join(temp,"source.tar");
    run("git",["archive","--format=tar",`--output=${archive}`,head],root);
    run("tar",["-xf",archive,"-C",graph],temp);
    assert.equal(hash(fs.readFileSync(path.join(graph,"package-lock.json"))),hash(originalLockBytes));
    const bracesSource=path.join(temp,"braces-source");fs.mkdirSync(bracesSource);
    const bracesProvenance=materializePrivateBracesSource(bracesSource);
    const packed=JSON.parse(run("npm",["pack",bracesSource,"--ignore-scripts","--offline","--json",
      "--pack-destination",artifacts],temp).stdout);
    assert.equal(packed.length,1);assert.equal(packed[0].filename,"braces-3.0.3.tgz");
    const bracesTarball=path.join(artifacts,packed[0].filename);
    const forgeCopy=path.join(artifacts,"node-forge-1.4.0.tgz");
    fs.copyFileSync(forgeTarball,forgeCopy);
    assert.equal(hash(fs.readFileSync(forgeCopy)),forgeReceipt.sha256);
    const expected={};
    for(const [name,tgz] of [["braces",bracesTarball],["node-forge",forgeCopy]]) {
      const unpack=path.join(temp,"unpack-"+name);fs.mkdirSync(unpack);
      run("tar",["-xzf",tgz,"-C",unpack],temp);
      expected[name]=inventory(path.join(unpack,"package"));
      const metadata=JSON.parse(fs.readFileSync(path.join(unpack,"package/package.json")));
      assert.equal(metadata.name,name);assert.equal(metadata.version,baseline.packages["node_modules/"+name].version);
      assert.ok(!metadata.bundleDependencies&&!metadata.bundledDependencies,"unreviewed bundled dependencies");
    }
    assert.equal(Object.keys(expected.braces).length,10);
    assert.equal(Object.keys(expected["node-forge"]).length,59);
    const manifest=JSON.parse(originalManifestBytes);
    manifest.overrides={...manifest.overrides,braces:"file:"+bracesTarball,"node-forge":"file:"+forgeCopy};
    fs.writeFileSync(path.join(graph,"package.json"),JSON.stringify(manifest,null,2)+"\n");
    console.log("SCA_B4_STAGE=resolver full root/workspace graph");
    // npm install can retain the old same-version integrity despite a new override.
    // Explicitly update the two target nodes through Arborist; never hand-edit lock entries.
    run("npm",["update","braces","node-forge","--package-lock-only","--ignore-scripts","--no-audit","--no-fund"],graph,240000);
    const candidateBytes=fs.readFileSync(path.join(graph,"package-lock.json"));
    const candidate=JSON.parse(candidateBytes);
    const paths=Object.keys(candidate.packages).filter(p=>targets.some(n=>p.endsWith("node_modules/"+n)));
    assert.ok(paths.some(p=>p.endsWith("/braces"))&&paths.some(p=>p.endsWith("/node-forge")));
    for(const p of paths) {
      const name=targets.find(n=>p.endsWith("node_modules/"+n));
      const entry=candidate.packages[p];
      const tgz=name==="braces"?bracesTarball:forgeCopy;
      assert.equal(entry.version,baseline.packages["node_modules/"+name].version);
      assert.equal(entry.integrity,"sha512-"+createHash("sha512").update(fs.readFileSync(tgz)).digest("base64"));
      assert.ok(entry.resolved.startsWith("file:"),"registry original remains: "+p);
    }
    // This bounded experiment may change target paths, but must not silently upgrade other packages.
    const unrelatedDrift=[];
    for(const [p,entry] of Object.entries(candidate.packages)) {
      if(!p||entry.link||paths.includes(p))continue;
      const old=baseline.packages[p];
      if(!old||old.version!==entry.version||old.resolved!==entry.resolved||old.integrity!==entry.integrity)
        unrelatedDrift.push(p);
    }
    assert.deepEqual(unrelatedDrift,[],"unrelated dependency drift requires investigation");
    console.log("SCA_B4_STAGE=npm ci full candidate");
    run("npm",["ci","--ignore-scripts","--no-audit","--no-fund"],graph,240000);
    assert.equal(hash(fs.readFileSync(path.join(graph,"package-lock.json"))),hash(candidateBytes));
    const installed=[];
    for(const p of paths) {
      const name=targets.find(n=>p.endsWith("node_modules/"+n));
      const actual=inventory(path.join(graph,p));
      assert.deepEqual(actual,expected[name],"installed bytes differ: "+p);
      installed.push({path:p,name,version:candidate.packages[p].version,files:Object.keys(actual).length,
        contentSha256:hash(JSON.stringify(actual)),fileSha256:actual});
    }
    const consumers=[];
    for(const [p,entry] of Object.entries(candidate.packages)) {
      if(!p||entry.link)continue;
      for(const name of targets) {
        if(!(entry.dependencies?.[name]||entry.optionalDependencies?.[name]))continue;
        const req=createRequire(path.join(graph,p,"package.json"));
        const resolved=path.relative(graph,path.dirname(req.resolve(name+"/package.json"))).split(path.sep).join("/");
        assert.ok(paths.includes(resolved),"consumer resolves outside inventoried patched graph: "+p);
        consumers.push({path:p,name,resolved});
      }
    }
    // Physical census detects unlisted nested targets and package-name aliases.
    const physical=[];
    function census(dir) {
      for(const e of fs.readdirSync(dir,{withFileTypes:true})) {
        if(e.isSymbolicLink()||!e.isDirectory())continue; // workspaces point to archived local source
        const full=path.join(dir,e.name),pkg=path.join(full,"package.json");
        if(fs.existsSync(pkg)) {
          const meta=JSON.parse(fs.readFileSync(pkg));
          if(targets.includes(meta.name))physical.push(path.relative(graph,full).split(path.sep).join("/"));
        }
        if(e.name.startsWith("@"))census(full);
        if(fs.existsSync(path.join(full,"node_modules")))census(path.join(full,"node_modules"));
      }
    }
    census(path.join(graph,"node_modules"));
    assert.deepEqual(physical.sort(),paths.slice().sort(),"nested/aliased package escaped lock census");
    const tree=run("npm",["ls","braces","node-forge","--all","--json"],graph);
    console.log("SCA_B4_NPM_LS="+tree.stdout);
    run(process.execPath,[path.join(root,"scripts/security/verify-private-braces-probe-child.mjs"),
      path.join(graph,"node_modules/braces")],root);
    run(process.execPath,[path.join(root,"scripts/security/verify-private-forge-probe-child.mjs"),
      path.join(graph,"node_modules")],root);
    const consumerProbe=path.join(graph,"sca-b4-consumers.cjs");
    fs.writeFileSync(consumerProbe,`const assert=require('node:assert/strict');
const mm=require('micromatch'); const fg=require('fast-glob');
assert.deepEqual(mm(['src/a.js','src/b.js','other.txt'],'src/{a,b}.js'),['src/a.js','src/b.js']);
// makeRe delegates to picomatch, whereas these APIs invoke the external braces package.
const deep='{'.repeat(110)+'a,b'+'}'.repeat(110);
assert.throws(()=>mm.braces(deep),/exceeds max depth/);
assert.throws(()=>mm.braceExpand(deep),/exceeds max depth/);
assert.deepEqual(mm.braceExpand('src/{a,b}.js'),['src/a.js','src/b.js']);
assert.ok(fg.sync('apps/mobile/{app,src}/**/*.{ts,tsx}').length>0);
console.log('SCA_B4_REAL_CONSUMERS=PASS');\n`);
    run(process.execPath,[consumerProbe],graph);
    const audits={
      baselineFull:audit(root,"BASELINE_FULL"),baselineProduction:audit(root,"BASELINE_PRODUCTION",["--omit=dev"]),
      candidateFull:audit(graph,"CANDIDATE_FULL"),candidateProduction:audit(graph,"CANDIDATE_PRODUCTION",["--omit=dev"])
    };
    const sbom={bomFormat:"CycloneDX",specVersion:"1.6",version:1,
      metadata:{component:{type:"application",name:"BEJEWELY-B4-disposable-graph",version:head}},
      components:Object.entries(candidate.packages).filter(([p,e])=>p&&e.version&&!e.link).map(([p,e])=>{
        const name=e.name||p.split("node_modules/").at(-1);
        const patched=installed.find(x=>x.path===p);
        return {type:"library",name,version:e.version,
          hashes:e.integrity?.startsWith("sha512-")?[{alg:"SHA-512",content:Buffer.from(e.integrity.slice(7),"base64").toString("hex")}]:[],
          properties:[{name:"bejewely:lock-path",value:p},
            {name:"bejewely:status",value:patched?"TEMP_PATCH_NOT_RELEASED":"LOCK_PINNED_DEPENDENCY"},
            ...(patched?[{name:"bejewely:installed-content-sha256",value:patched.contentSha256}]:[])]};
      })};
    console.log("SCA_B4_INSTALLED_SBOM="+JSON.stringify(sbom));
    console.log("SCA_B4_INSTALL_EVIDENCE="+JSON.stringify({head,originalLockSha256:hash(originalLockBytes),
      candidateLockSha256:hash(candidateBytes),installed,consumers,audits,
      fullGraphInstalled:true,acceptance:"HOLD_UNRELEASED_AND_AUDIT_NOT_CLEARED"}));
    // Also exercise ordinary lifecycle installation. This remains inside the disposable graph.
    run("npm",["ci","--no-audit","--no-fund"],graph,300000);
    assert.equal(hash(fs.readFileSync(path.join(graph,"package-lock.json"))),hash(candidateBytes));
    for(const p of paths) {
      const name=targets.find(n=>p.endsWith("node_modules/"+n));
      assert.deepEqual(inventory(path.join(graph,p)),expected[name],"lifecycle install changed patched bytes: "+p);
    }
    run(process.execPath,[path.join(root,"scripts/security/verify-private-forge-probe-child.mjs"),
      path.join(graph,"node_modules")],root);
    // Compatibility can be measured despite audit HOLD; it never promotes B5/release acceptance.
    const checks=[];
    const commands=["mobile:typecheck","mobile:lint","verify:mobile-foundation","verify:mobile-entry-routing",
      "mobile:config","mobile:export:android","mobile:prebuild:android","verify:mobile-native","build"];
    for(const name of commands) {
      console.log("SCA_B4_STAGE="+name);
      const p=spawnSync("npm",["run",name],{cwd:graph,encoding:"utf8",timeout:300000,maxBuffer:16*1024*1024,
        env:{...process.env,CI:"true",NODE_OPTIONS:"",EXPO_NO_TELEMETRY:"1",NEXT_TELEMETRY_DISABLED:"1"}});
      console.log(`SCA_B4_CHECK_${name}_BEGIN\n${p.stdout||""}\n${p.stderr||""}\nSCA_B4_CHECK_${name}_END`);
      checks.push({name,status:p.status===0&&!p.error?"PASS":"FAIL",exit:p.status,error:p.error?.code||null});
    }
    const modifiedMobile=hash(fs.readFileSync(path.join(graph,"apps/mobile/package.json")));
    const archivedMobile=hash(fs.readFileSync(path.join(root,"apps/mobile/package.json")));
    const androidDir=path.join(graph,"apps/mobile/android");
    let android={status:"NOT_RUN",reason:"Android SDK or JDK unavailable",apkSha256:null};
    const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
    const java=spawnSync("java",["-version"],{encoding:"utf8",timeout:10000});
    if(sdk&&fs.existsSync(sdk)&&java.status===0&&fs.existsSync(path.join(androidDir,"gradlew"))) {
      console.log("SCA_B4_STAGE=Android debug build (20 minute bounded attempt, 2 workers)");
      const p=spawnSync("bash",["./gradlew",":app:assembleDebug","--no-daemon","--max-workers=2",
        "-Dorg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g"],{cwd:androidDir,encoding:"utf8",
        timeout:1200000,maxBuffer:32*1024*1024,env:{...process.env,CI:"true"}});
      console.log(`SCA_B4_ANDROID_BUILD_BEGIN\n${p.stdout||""}\n${p.stderr||""}\nSCA_B4_ANDROID_BUILD_END`);
      const apk=path.join(androidDir,"app/build/outputs/apk/debug/app-debug.apk");
      android={status:p.status===0&&!p.error&&fs.existsSync(apk)?"PASS":"FAIL",exit:p.status,
        reason:p.error?.code||null,jdk:java.stderr.trim(),sdkPresent:true,
        apkSha256:fs.existsSync(apk)?hash(fs.readFileSync(apk)):null};
      checks.push({name:"Android debug APK",status:android.status,exit:p.status,error:p.error?.code||null});
    }
    const exports=path.join(graph,"apps/mobile/.expo-ci-dist");
    const metroBundles=[];
    function bundles(dir) {
      if(!fs.existsSync(dir))return;
      for(const e of fs.readdirSync(dir,{withFileTypes:true})) {
        const file=path.join(dir,e.name);
        if(e.isDirectory())bundles(file);
        else if(/\.(?:js|hbc|map)$/.test(e.name))metroBundles.push({path:path.relative(exports,file),sha256:hash(fs.readFileSync(file))});
      }
    }
    bundles(exports);
    const receipt={schema:"bejewely.security.sca-b4-full-graph.v1",head,node:process.version,
      npm:run("npm",["--version"],graph).stdout.trim(),
      originalLockSha256:hash(originalLockBytes),candidateLockSha256:hash(candidateBytes),
      artifacts:{braces:{sha256:hash(fs.readFileSync(bracesTarball)),provenance:bracesProvenance},forge:forgeReceipt},
      installed,consumers,audits,checks,android,metroBundles,
      sbomSha256:hash(JSON.stringify(sbom)),sbomComponents:sbom.components.length,
      prebuildChangedDisposableMobileManifest:modifiedMobile!==archivedMobile,
      technicalInstallEvidence:"PASS",acceptance:"HOLD_UNRELEASED_SAME_VERSION_PATCH_AND_RAW_AUDIT",
      fullGraphInstalled:true,appSourceGraphChanged:false,auditPolicyChanged:false,
      releaseApproved:false,deviceSmoke:"NOT_RUN_NO_DEVICE_OR_ISOLATED_BACKEND",
      artifactsDeletedOnExit:true};
    console.log("SCA_B4_FULL_GRAPH_EVIDENCE="+JSON.stringify(receipt));
    assert.ok(checks.every(c=>c.status==="PASS"),"candidate compatibility failed; see command logs above");
    return receipt;
  } finally {
    assert.equal(hash(fs.readFileSync(path.join(root,"package-lock.json"))),hash(originalLockBytes));
    assert.equal(hash(fs.readFileSync(path.join(root,"package.json"))),hash(originalManifestBytes));
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
