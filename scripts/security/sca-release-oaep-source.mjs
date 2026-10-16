import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const vendor=path.join(root,'security/vendor/node-forge-oaep-replacement');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const primaryPins={
  'upstream/src/crypto/bytes.ts':'446c963b6d06949964ab068b0601f3f8600865494633bccd920cd5e526cd773d',
  'upstream/src/crypto/digest-length.ts':'857c1e2145d59de432f17bd7aefdaf612e85c09a375dcda9534facdd492cb90f',
  'upstream/src/schemes/oaep.ts':'6c63a66bb11c810c553aa054b3ed2e21add571b7c03bf505def6f606b13494b1',
  'upstream/LICENSE':'81bcc8d1055ee4af1f7e78241cdf5d768a3bcb98d59666b65bee120ff69a175d'
};
const mappings=[['pkcs1.js','lib/pkcs1.js'],['bejewely-node-rsa-oaep.js','lib/bejewely-node-rsa-oaep.js'],['LICENSE.node-rsa.txt','LICENSE.node-rsa.txt']];
function verifiedManifest() {
  const manifestBytes=fs.readFileSync(path.join(vendor,'source-manifest.json'));
  const manifest=JSON.parse(manifestBytes);
  if(manifest.schema!=='BEJEWELY_OAEP_SOURCE_V1'||manifest.commit!=='54798624ba5b15521763c6d1ca69b93115a61d67'||manifest.license!=='MIT'||manifest.compiler!=='typescript@5.9.3'||manifest.target!=='ES5')throw Error('OAEP source identity mismatch');
  const listed=new Map();
  for(const entry of manifest.files) {
    if(typeof entry.path!=='string'||entry.path.includes('\\')||path.posix.isAbsolute(entry.path)||entry.path.split('/').includes('..')||listed.has(entry.path))throw Error('Unsafe or duplicate OAEP source path');
    const bytes=fs.readFileSync(path.join(vendor,entry.path));
    if(bytes.length!==entry.bytes||hash(bytes)!==entry.sha256)throw Error(`OAEP source SHA mismatch: ${entry.path}`);
    listed.set(entry.path,entry);
  }
  if(listed.get('LICENSE.node-rsa.txt')?.sha256!==primaryPins['upstream/LICENSE'])throw Error('OAEP license mirror mismatch');
  const expected=[...Object.keys(primaryPins),'adapter.cjs','bejewely-node-rsa-oaep.js','pkcs1.js','provenance.json','LICENSE.node-rsa.txt'];
  if(listed.size!==expected.length||expected.some(name=>!listed.has(name)))throw Error('OAEP source inventory mismatch');
  for(const [name,sha]of Object.entries(primaryPins))if(listed.get(name).sha256!==sha)throw Error(`Primary OAEP source pin mismatch: ${name}`);
  if(JSON.stringify(manifest.mappings)!==JSON.stringify(mappings.map(([source,target])=>({source,target}))))throw Error('OAEP materialization map mismatch');
  return {manifest,manifestSha256:hash(manifestBytes)};
}

export function verifyOaepSources({typescript}={}) {
  const {manifest,manifestSha256}=verifiedManifest();
  const ts=typescript;
  if(!ts||ts.version!=='5.9.3')throw Error('OAEP reproducibility requires pinned typescript@5.9.3');
  const opts={target:ts.ScriptTarget.ES5,module:ts.ModuleKind.None,newLine:ts.NewLineKind.LineFeed,removeComments:false,useDefineForClassFields:false};
  const compile=file=>ts.transpileModule(fs.readFileSync(path.join(vendor,'upstream',file),'utf8').replace(/^import .*$/mg,'').replace(/\bexport\s+/g,''),{compilerOptions:opts}).outputText;
  const allHelpers=compile('src/crypto/bytes.ts');
  const helpers=allHelpers.slice(allHelpers.indexOf('function concat('),allHelpers.indexOf('function toHex('))+'\n'+allHelpers.slice(allHelpers.indexOf('function writeUInt32BE('));
  const commit=manifest.commit;
  const backend=`/* node-rsa v2.0.0 ${commit}. MIT; see upstream/LICENSE.\n * Mechanical TypeScript 5.9.3 compilation to ES5, import/export wiring only.\n * Only complete concat/constantTimeEqual/writeUInt32BE helper functions retained.\n * DIGEST_LENGTH is supplied by the Forge adapter to support custom digest objects.\n */\nmodule.exports = function createOaep(DIGEST_LENGTH) {\n${helpers}\n${compile('src/schemes/oaep.ts')}\nreturn {oaepScheme:oaepScheme, mgf1:mgf1};\n};\n`;
  const adapter=fs.readFileSync(path.join(vendor,'adapter.cjs'),'utf8').replace('module.exports = function(forge)','function createForgeOaep(forge)');
  const source="var forge=require('./forge');\nrequire('./sha1');\nrequire('./random');\n"+adapter+"\nmodule.exports=forge.pkcs1=createForgeOaep(forge);\n";
  const wrapper=ts.transpileModule(source,{compilerOptions:opts}).outputText;
  if(backend!==fs.readFileSync(path.join(vendor,'bejewely-node-rsa-oaep.js'),'utf8'))throw Error('OAEP generated backend reconstruction mismatch');
  if(wrapper!==fs.readFileSync(path.join(vendor,'pkcs1.js'),'utf8'))throw Error('OAEP generated Forge wrapper reconstruction mismatch');
  return {status:'PASS',sourceCommit:commit,license:'MIT',compiler:'typescript@5.9.3',manifestSha256,backendSha256:hash(backend),wrapperSha256:hash(wrapper),primarySourcePins:primaryPins,sourceFiles:manifest.files.length,algorithm:'Unchanged pinned node-rsa OAEP/MGF1, mechanically compiled with Forge API adapter',legalConclusion:'No legal clearance inferred; observed primary MIT grant retained'};
}

export function materializeOaepSources(target) {
  if(!path.isAbsolute(target))throw Error('OAEP target must be absolute');
  const {manifestSha256}=verifiedManifest();
  const installed=[];
  for(const [source,destination]of mappings) {
    const bytes=fs.readFileSync(path.join(vendor,source));
    const output=path.join(target,destination);
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,bytes);
    if(hash(fs.readFileSync(output))!==hash(bytes))throw Error('OAEP materialized source mismatch');
    installed.push({path:destination,sha256:hash(bytes),bytes:bytes.length});
  }
  return {status:'PASS',manifestSha256,files:installed};
}
