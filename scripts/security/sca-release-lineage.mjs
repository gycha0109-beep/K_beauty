/** Distribution lineage checks; classifications are technical evidence, never final approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {digest} from './sca-release-bundle.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const vendor='security/vendor/node-forge-license-cleanup/';
export const cleanupProfile='NATIVE_UTIL_NO_FLASH_V1';
export const removedFlash='flash/swf/SocketPool.swf';
const pins={'carta-rand31-source.txt':'902cde3250944081a083cbc27ad4251f6ccb68a04b1dbc42efef20adc899d5c7','phpjs-MIT.txt':'61cd914fad645fe7eb5ee66df80dedbe3365e335f28673a9d1d5e4ed02a22ff3','phpjs-number-format.js':'47b08d9a0c9b6d3bbfa8548fc762db23bc45e5b31c82ef6bb7f1192340643c90','webpack-MIT.txt':'9068a8782d2fb4c6e432cfa25334efa56f722822180570802bf86e71b6003b1e','webpack-global.js':'a870f8c8c9f0a96a273e497b73e681937511a79b4a8692e9d511a666dce22ce5','forge-aes-2010.txt':'f8ca7a85d21fe531fe0f66da26f7a2c7e00e2f3e2df1adb65c859b47c5bb46fc','tweetnacl-fast-0.14.5.txt':'432333a18cef679d16c71328fcc18cc547e58d7d1c2b880a581b2d7ee4248027','flash-build.json':'9e5e3328ccd7f5fefeaf0d57804d621832bf22338c2ed806f906cd187231966e','util-replacements.json':'c7102b1785204bd477180508a057f08321697153664ec784b43b671a6e09b779'};
export function lineageEvidence(){
  const manifestBytes=fs.readFileSync(path.join(root,vendor,'manifest.json')),manifest=JSON.parse(manifestBytes),files={};
  assert.equal(manifest.profile,cleanupProfile);assert.equal(manifest.legalApproval,false);
  assert.deepEqual(manifest.evidence.map(x=>x.path).sort(),Object.keys(pins).sort());
  for(const e of manifest.evidence){const p=path.join(root,vendor,e.path),stat=fs.lstatSync(p);assert.ok(stat.isFile()&&!stat.isSymbolicLink());const b=fs.readFileSync(p);assert.equal(b.length,e.bytes);assert.equal(digest(b),pins[e.path],'primary evidence substitution');assert.equal(e.sha256,pins[e.path]);files[e.path]=b;}
  return {manifest,manifestSha256:digest(manifestBytes),files};
}
export function cleanedUtility(original){const {files}=lineageEvidence(),patch=JSON.parse(files['util-replacements.json']);assert.equal(digest(original),patch.originalSha256);let text=original.toString();let upper=text.length;for(const h of [...patch.hunks].sort((a,b)=>b.start-a.start)){assert.ok(Number.isInteger(h.start)&&h.start>=0&&h.end>h.start&&h.end<=upper);assert.equal(digest(text.slice(h.start,h.end)),h.beforeSha256,'original helper range mismatch');text=text.slice(0,h.start)+h.after+text.slice(h.end);upper=h.start;}const result=Buffer.from(text);assert.equal(digest(result),patch.resultSha256);return result;}
export function materializeLicenseCleanup(target){const {files,manifest}=lineageEvidence(),util=path.join(target,'lib/util.js'),flash=path.join(target,removedFlash);fs.writeFileSync(util,cleanedUtility(fs.readFileSync(util)));assert.equal(digest(fs.readFileSync(flash)),manifest.removedSha256);fs.unlinkSync(flash);fs.writeFileSync(path.join(target,'LICENSE.webpack.txt'),files['webpack-MIT.txt'],{flag:'wx'});}
export function verifyCleanupFiles(before,after,build){
  const {files}=lineageEvidence();assert.equal(build.sourceLineageCleanup,cleanupProfile);assert.deepEqual(build.removedFiles,[removedFlash]);assert.ok(!after[removedFlash],'legacy opaque Flash must not ship');assert.equal(digest(after['lib/util.js']),digest(cleanedUtility(before['lib/util.js'])));assert.equal(digest(after['LICENSE.webpack.txt']),digest(files['webpack-MIT.txt']));
  assert.deepEqual(build.moduleInventory.map(b=>b.bundle).sort(),['dist/forge.all.min.js','dist/forge.min.js','dist/prime.worker.min.js']);
  for(const b of build.moduleInventory){
    assert.equal(new Set(b.modules.map(m=>m.path)).size,b.modules.length,'duplicate compiler module');
    const entry=b.bundle.includes('prime.worker')?'lib/prime.worker.js':b.bundle.includes('forge.all')?'lib/index.all.js':'lib/index.js';assert.ok(b.modules.some(m=>m.path===entry),'missing bundle entrypoint');
    for(const m of b.modules){if(m.path==='webpack/buildin/global.js')assert.equal(m.sha256,pins['webpack-global.js']);else {assert.match(m.path,/^lib\/[A-Za-z0-9_.-]+\.js$/);assert.ok(after[m.path],'unknown compiler module');assert.equal(m.sha256,digest(after[m.path]),'compiler source inventory drift');}}
  }
}
export function bundleModuleInventory(stats,dir){
  const evidence=lineageEvidence(),output=[];
  for(const child of stats.children||[stats]){assert.deepEqual(child.errors,[]);const asset=(child.assets||[]).find(a=>/^(forge(?:\.all)?|prime\.worker)\.min\.js$/.test(a.name));if(!asset)continue;
    const modules=[];for(const m of child.modules||[]){let n=m.name;if(n.startsWith('multi ')||n==='crypto (ignored)')continue;
      if(n==='(webpack)/buildin/global.js'||/(?:^|\/)node_modules\/webpack\/buildin\/global\.js$/.test(n)){assert.equal(JSON.parse(fs.readFileSync(path.resolve(m.identifier,'../../package.json'))).version,'4.44.1','unreviewed webpack runtime version');assert.equal(digest(fs.readFileSync(m.identifier)),digest(evidence.files['webpack-global.js']));modules.push({path:'webpack/buildin/global.js',sha256:pins['webpack-global.js'],component:'webpack@4.44.1'});}
      else {assert.match(n,/^\.\/lib\/[A-Za-z0-9_.-]+\.js$/,'unreviewed runtime module');n=n.slice(2);modules.push({path:n,sha256:digest(fs.readFileSync(path.join(dir,n))),component:n==='lib/bejewely-node-rsa-oaep.js'?'node-rsa OAEP':'node-forge'});}}
    output.push({bundle:'dist/'+asset.name,modules:modules.sort((a,b)=>a.path.localeCompare(b.path))});
  }
  assert.deepEqual(output.map(x=>x.bundle).sort(),['dist/forge.all.min.js','dist/forge.min.js','dist/prime.worker.min.js']);return output.sort((a,b)=>a.bundle.localeCompare(b.bundle));
}
export function lineageAssessment(build){
  const {manifest,manifestSha256}=lineageEvidence();assert.equal(build.sourceLineageCleanup,cleanupProfile);assert.ok(Array.isArray(build.moduleInventory));
  const included=paths=>build.moduleInventory.filter(b=>b.modules.some(m=>paths.includes(m.path))).map(b=>b.bundle);
  return {schema:'bejewely.distribution-lineage-assessment.v1',profile:cleanupProfile,evidenceManifestSha256:manifestSha256,legalApproval:false,redistributionApproved:false,
    scope:'All npm entries checked by exact inventory; compiler module inventory binds all three minified JS outputs and rebuilt maps. External whole libraries/tools are not inferred from name searches alone.',
    components:[
      {id:'forge-own-source',classification:'A',license:'BSD-3-Clause',basis:'Explicit original Forge grant and retained source copyright; unchanged original files pinned. RSA security patch and native helper changes separately identified.'},
      {id:'braces',classification:'A',license:'MIT',basis:'Original complete MIT grant and patched parser/AST bytes retained.'},
      {id:'aes-jscrypto-sjcl',classification:'B',paths:['lib/aes.js'],bundles:included(['lib/aes.js']),licenseEvidence:'Historical Stanford public-domain declaration and full BSD-2-Clause grant both retained; Forge first commit521fd6018d350a54c5f3b5ab5258a145bcc613e0 already identifies same authors.',copiedRevision:'UNKNOWN',replacement:false},
      {id:'openssl-aes',classification:'B',paths:['lib/aes.js'],bundles:included(['lib/aes.js']),licenseEvidence:'OpenSSL1.0.0 aes_core.c component public-domain grant/disclaimer; not a whole-toolkit license assertion.',copiedRevision:'UNKNOWN',replacement:false},
      {id:'tweetnacl-ed25519',classification:'B',paths:['lib/ed25519.js'],bundles:included(['lib/ed25519.js']),license:'Unlicense',licenseEvidence:'Primary v0.14.5 full grant and public-domain source; Forge introduction470793c0ac7217e512ba3775cd75d106e7fb2b64 attribution. Seven complete function token streams match pinned primary nacl-fast.js; not proof of a unique copied version.',copiedRevision:'UNKNOWN',replacement:false},
      {id:'base-x',classification:'A',paths:['lib/baseN.js'],bundles:included(['lib/baseN.js']),license:'MIT',basis:'Full original embedded MIT grant and copyright retained in source and full distribution notices.'},
      {id:'tom-wu-jsbn',classification:'A',paths:['lib/jsbn.js','lib/rsa.js'],bundles:included(['lib/jsbn.js']),license:'LicenseRef-Tom-Wu-JSBN',basis:'Full custom grant, all copyright notices and intact-redistribution condition retained.'},
      {id:'paul-tero-des',classification:'B',paths:['lib/des.js'],bundles:included(['lib/des.js']),license:'BSD-2-Clause',basis:'Author explicit permission and complete BSD2 conditions retained with Hayworth/Siegl/Forge attribution.',copiedRevision:'UNKNOWN'},
      {id:'carta-prng-fallback',classification:'B',paths:['lib/prng.js'],bundles:included(['lib/prng.js']),licenseEvidence:'Forge explicitly identifies the Carta optimization as public domain; pinned Robin Whittle primary source independently publishes this mathematical method as public domain with attribution/comment retention request. No unique copied revision inferred.',copiedRevision:'UNKNOWN',replacement:false},
      {id:'phpjs-number-format',classification:'B',paths:['lib/util.js'],bundles:included(['lib/util.js']),license:'MIT',basis:'Pinned historical php.js1.3.2 full MIT grant and number_format source identify the same original/improvement/bugfix contributors as the retained formatter. Exact copied revision unknown; full grant added to npm/browser notices.',copiedRevision:'UNKNOWN',replacement:false},
      {id:'webpack-runtime',classification:'A',bundles:included(['webpack/buildin/global.js']),license:'MIT',basis:'Compiler inventory admits only pinned webpack4.44.1 global shim, generated bootstrap and inventoried Forge modules; full primary MIT grant added.'},
      {id:'historical-oaep',classification:'D',baselineClassification:'C',basis:'Historical implementation absent; unchanged MIT node-rsa replacement remains source-pinned, tested and separately noticed. Original historical terms not established.'},
      {id:'legacy-flash-flex',classification:'D',baselineClassification:'C',removedSha256:manifest.removedSha256,basis:'Opaque SWF contains Adobe Flex4 mx.* runtime; upstream statically links an unpinned Flex SDK and candidate lacked runtime notices/source obligations evidence. No BEJEWELY source consumer found. Binary removed; legacy Flash distribution explicitly unsupported.'},
      {id:'stackoverflow-isempty',classification:'D',baselineClassification:'C',basis:'Copied answer attribution alone did not demonstrate fulfilled applicable CC conditions. Entire helper replaced with Object.keys(Object(value)). No copied answer remains.'},
      {id:'snipplr-size-formatter',classification:'D',baselineClassification:'C',basis:'Original snippet-specific terms unestablished. Entire helper replaced with a separately written unit-table presentation; not variable renaming or cryptographic algorithm work.'},
      {id:'native-helper-replacements',classification:'A',paths:['lib/util.js'],bundles:included(['lib/util.js']),basis:'New Object.keys and binary-unit-table helpers, exact hunk/hash pinned, no third-party implementation copied; existing number formatter retained.'},
      {id:'node-rsa-oaep',classification:'A',paths:['lib/pkcs1.js','lib/bejewely-node-rsa-oaep.js'],bundles:included(['lib/bejewely-node-rsa-oaep.js']),license:'MIT',basis:'Pinned complete primary MIT grant and mechanical source reconstruction; prior OAEP compatibility and RSA tests retained.'}
    ],evidence:manifest.evidence,remainingProvenanceLimits:['Exact copied jscrypto/SJCL, OpenSSL, TweetNaCl, DES, php.js and Carta fallback revisions remain unknown; recorded B not asserted A.'],unresolvedApplicableConditionsIdentified:[],finalOwnerDecision:'PENDING_NOT_AUTOMATIC_APPROVAL'};
}
export function supplementalNotices(){const {files}=lineageEvidence();return Buffer.concat([Buffer.from('\n## php.js number formatter — MIT (historical source and contributors)\n\n'),files['phpjs-MIT.txt'],Buffer.from('\n\n## webpack4.44.1 distributed runtime — MIT\n\n'),files['webpack-MIT.txt'],Buffer.from('\n\n## Park-Miller-Carta fallback — public-domain source evidence\n\nThe Forge attribution to David G. Carta remains intact. Robin Whittle publishes the corresponding method as public domain; a unique copied version is not asserted.\n\n'),Buffer.from(files['carta-rand31-source.txt'].toString().split(/\r?\n/).slice(9,154).join('\n')),Buffer.from('\n\n## Private distribution scope\n\nThe legacy SocketPool.swf/Flex binary is excluded and Flash integration is not shipped. The copied isEmpty and formatSize snippets were replaced using standard object operations and a new binary-unit table. Cryptographic primitives (including AES and Ed25519) remain unchanged.\n')]);}
export function verifyNativeUtilities(target,baseline){const require=createRequire(import.meta.url),actual=require(path.join(target,'lib/util.js')),old=require(path.join(baseline,'lib/util.js'));let assertions=0;
  for(const value of [null,undefined,false,0,'','x',[],[1],{},Object.create({inherited:true}),{a:1}]){assert.equal(actual.isEmpty(value),old.isEmpty(value));assertions++;}
  for(const value of [undefined,null,NaN,Infinity,-Infinity,-1,-1024,0,1,1023.9,1024,1048575,1048576,1073741823,1073741824,1e15,...Array.from({length:128},(_,i)=>i*13379113.125)]){assert.equal(actual.formatSize(value),old.formatSize(value));assertions++;}
  assert.equal(actual.formatNumber.toString(),old.formatNumber.toString(),'retained B formatter changed');assertions++;
  assert.ok(!fs.existsSync(path.join(target,removedFlash)));assertions++;
  return {status:'PASS',assertions,cryptoPrimitivesChanged:false,retainedNumberFormatterUnchanged:true,flashSupport:'NOT_SHIPPED'};
}

export function verifyPrimaryCorrespondence({typescript,dir}){
  assert.equal(typescript.version,'5.9.3');const {files}=lineageEvidence();
  const source=fs.readFileSync(path.join(dir,'lib/ed25519.js'),'utf8'),primary=files['tweetnacl-fast-0.14.5.txt'].toString();
  function functions(text){const ast=typescript.createSourceFile('evidence.js',text,typescript.ScriptTarget.Latest,true,typescript.ScriptKind.JS),result={};
    const visit=node=>{if(typescript.isFunctionDeclaration(node)&&node.name&&node.body){const scanner=typescript.createScanner(typescript.ScriptTarget.Latest,true,typescript.LanguageVariant.Standard,node.body.getText(ast)),tokens=[];for(let kind=scanner.scan();kind!==typescript.SyntaxKind.EndOfFileToken;kind=scanner.scan())tokens.push(scanner.getTokenText());result[node.name.text]=tokens.join(' ');}typescript.forEachChild(node,visit);};visit(ast);return result;}
  const actual=functions(source),upstream=functions(primary),matches=[];for(const n of ['add','pack','crypto_verify_32','scalarmult','scalarbase','S','M']){assert.equal(actual[n],upstream[n],'primary TweetNaCl correspondence changed: '+n);assert.ok(actual[n]);matches.push({name:n,tokenSha256:digest(actual[n])});}
  const util=fs.readFileSync(path.join(dir,'lib/util.js'),'utf8'),number=files['phpjs-number-format.js'].toString();for(const name of ['Jonas Raoni Soares Silva','Kevin van Zonneveld','Michael White','Benjamin Lupton','Allan Jensen']){assert.ok(util.includes(name));assert.ok(number.includes(name));}
  const aes=fs.readFileSync(path.join(dir,'lib/aes.js'),'utf8');for(const name of ['Emily Stark','Mike Hamburg','Dan Boneh','jscrypto']){assert.ok(aes.includes(name));assert.ok(files['forge-aes-2010.txt'].toString().includes(name));}
  return {tweetNaClWholeFunctionMatches:matches,uniqueCopiedVersionEstablished:false,numberFormatterPrimaryContributors:'MATCH',aesInitialHistoryAttribution:'MATCH'};
}
