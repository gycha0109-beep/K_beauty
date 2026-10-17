import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash,constants,generateKeyPairSync,privateEncrypt,sign} from 'node:crypto';
const require=createRequire(import.meta.url);
const braces=require('braces');
assert.deepEqual(braces.expand('a/{b,c}/d'),['a/b/d','a/c/d']);
assert.deepEqual(braces.expand('a{1..3}b'),['a1b','a2b','a3b']);
assert.deepEqual(braces.expand('foo/({a,b})'),['foo/(a)','foo/(b)']);
for(const [open,close] of [['{','}'],['(',')']])assert.throws(()=>braces.parse(open.repeat(110)+'a,b'+close.repeat(110)),/exceeds max depth/);
let ast={type:'text',value:'a'};for(let i=0;i<101;i++)ast={type:'brace',nodes:[ast]};
for(const f of ['compile','expand','stringify'])assert.throws(()=>require('braces/lib/'+f)({type:'root',nodes:[ast]}),/exceeds max depth/);
const forge=require('node-forge');
// Ephemeral synthetic keys only: no owner signing key or credential is read.
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const publicKey=forge.pki.publicKeyFromPem(keys.publicKey.export({format:'pem',type:'spki'}));
const message=Buffer.from('product-security-regression'),digest=createHash('sha256').update(message).digest();
const good=sign('sha256',message,keys.privateKey);
assert.equal(publicKey.verify(digest.toString('binary'),good.toString('binary')),true);
assert.equal(publicKey.verify(createHash('sha256').update('wrong').digest('binary'),good.toString('binary')),false);
const tlv=(tag,bytes)=>Buffer.concat([Buffer.from([tag,bytes.length]),bytes]);
const algorithm=tlv(0x30,Buffer.from('060960864801650304020105000500','hex'));
const info=tlv(0x30,Buffer.concat([algorithm,tlv(4,digest)]));
const encoded=Buffer.concat([Buffer.from([0,1]),Buffer.alloc(256-info.length-3,255),Buffer.from([0]),info]);
const malformed=privateEncrypt({key:keys.privateKey,padding:constants.RSA_NO_PADDING},encoded);
let accepted=false;try{accepted=publicKey.verify(digest.toString('binary'),malformed.toString('binary'));}catch{}
assert.equal(accepted,false,'malformed nested DigestAlgorithm accepted');
const signing=require('@expo/code-signing-certificates');
const pair=forge.pki.rsa.generateKeyPair({bits:1024,e:65537});
const certificate=signing.generateSelfSignedCodeSigningCertificate({keyPair:pair,validityNotBefore:new Date(Date.now()-60000),validityNotAfter:new Date(Date.now()+600000),commonName:'Temporary product regression fixture'});
signing.validateSelfSignedCertificate(certificate,pair);
assert.ok(signing.signBufferRSASHA256AndVerify(pair.privateKey,certificate,Buffer.from('fixture')));
const decode=require('decode-uri-component'),query=require('query-string');
assert.equal(typeof decode,'function','Expo Router requires callable CommonJS decoder');
for(let i=0;i<1024;i++){
  const text=String.fromCodePoint(32+i)+'한글 🙂 /?&=+';
  assert.equal(decode(encodeURIComponent(text)),text);
  assert.equal(query.parse(query.stringify({value:text})).value,text);
}
for(const text of ['%','%G0','%80','%C0%AF','%E0%A4','%ED%A0%80','%F4%90%80%80'])assert.equal(decode(text),text);
assert.equal(decode('%E2%82%AC%80%41'),'€%80A');
// Prior decoder recursively subdivides this malformed byte run. The parent kills hangs.
const attack='%80'.repeat(200000);
assert.equal(decode(attack),attack);
assert.equal(query.parse('path='+attack).path,attack);
const selector=require('postcss-selector-parser');
const flat=Array.from({length:20000},(_,i)=>'.selector'+i).join(',');
assert.equal(selector().processSync(flat),flat);
const uuid=require('uuid');assert.ok(uuid.validate(uuid.v4()));
assert.throws(()=>uuid.v3('test',uuid.v3.DNS,new Uint8Array(15)),/bound|length|buffer/i);
console.log('PRODUCT_SECURITY_BEHAVIOR=PASS braces-depth/AST RSA-malformed/valid Expo-signing URL-valid/malformed/large-input selector-flat UUID-bounds');
