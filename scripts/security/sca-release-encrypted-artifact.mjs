/** Owner-readable encrypted CI evidence. Not a package release or a redistribution approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash,createPublicKey,createPrivateKey,generateKeyPairSync,publicEncrypt,privateDecrypt,randomBytes,createCipheriv,createDecipheriv,constants} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const sha=b=>createHash('sha256').update(b).digest('hex');
const hex64=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const dirs=['original-bundle','scoped','browser-notice-kit'];
const max=48*1024*1024;
function read(file){const st=fs.lstatSync(file);assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=max,'bounded regular file required');return fs.readFileSync(file);}
const bindingFields=['schema','status','candidateSha256','payload','encryption','recipientKeyFingerprint','wrappedKey','iv','plaintextSha256','includedDirectories','source'];
const aad=r=>Buffer.from(JSON.stringify(Object.fromEntries(bindingFields.map(k=>[k,r[k]]))));
function recipient(pem){
  assert.ok(typeof pem==='string'&&pem.length<=16384&&/^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+-----END PUBLIC KEY-----\s*$/.test(pem),'only a public SPKI PEM is accepted; never supply a private key');
  const key=createPublicKey(pem);assert.equal(key.asymmetricKeyType,'rsa','owner RSA recipient key required');
  assert.ok(key.asymmetricKeyDetails?.modulusLength>=3072&&key.asymmetricKeyDetails.modulusLength<=8192,'owner recipient RSA key >=3072 and <=8192 bits required');return key;
}
function checkInventory(root){
  let total=0,count=0;
  const walk=dir=>{for(const e of fs.readdirSync(dir)){const p=path.join(dir,e),s=fs.lstatSync(p);assert.ok(!s.isSymbolicLink(),'evidence symlink refused');
    assert.ok(++count<=1000,'evidence inventory too large');
    if(s.isDirectory())walk(p);else {assert.ok(s.isFile()&&s.nlink===1,'evidence links/special files refused');total+=s.size;assert.ok(total<=max,'uncompressed evidence size exceeded');}}};
  for(const d of dirs)walk(path.join(root,d));return total;
}
export function assertOwnerKeyDestination(dest){
  let parent=path.dirname(path.resolve(dest));while(!fs.existsSync(parent))parent=path.dirname(parent);
  parent=fs.realpathSync(parent);
  for(;;){assert.ok(!fs.existsSync(path.join(parent,'.git')),'owner keys must be outside every Git checkout');
    const next=path.dirname(parent);if(next===parent)break;parent=next;}
}

export function sealCandidateEvidence({root,output,recipientPublicKeyPem,candidateSha256,source}){
  assert.ok(hex64(candidateSha256),'exact scoped candidate SHA256 required');
  const key=recipient(recipientPublicKeyPem);
  assert.match(source?.head||'',/^[a-f0-9]{40}$/,'exact source HEAD required');
  for(const k of ['runId','runAttempt'])assert.match(source[k]||'',/^[1-9][0-9]*$/,'CI run identity required');
  assert.deepEqual(Object.keys(source).sort(),['head','runAttempt','runId']);
  assert.equal(sha(read(path.join(root,'scoped/scoped-candidate.json'))),candidateSha256,'actual candidate manifest mismatch');
  for(const d of dirs){const s=fs.lstatSync(path.join(root,d));assert.ok(s.isDirectory()&&!s.isSymbolicLink(),'missing verified directory: '+d);}
  checkInventory(root);
  assert.ok(!fs.existsSync(output),'encrypted evidence output must be new');
  fs.mkdirSync(output,{recursive:true,mode:0o700});
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'sca-owner-seal-'));
  try{
    const tar=path.join(scratch,'candidate.tar.gz');
    const p=spawnSync('tar',['-C',root,'-czf',tar,...dirs],{encoding:'utf8',timeout:120000});
    assert.ok(!p.error&&p.status===0,'evidence archive creation failed: '+(p.stderr||''));
    const plain=read(tar),secret=randomBytes(32),iv=randomBytes(12);
    const receipt={
      schema:'bejewely.sca-owner-encrypted-artifact.v2',
      status:'OWNER_ENCRYPTED_CI_EVIDENCE_ONLY_NOT_A_RELEASE',
      candidateSha256,payload:'candidate.tar.gz.enc',
      encryption:'RSA-OAEP-SHA256+AES-256-GCM',
      recipientKeyFingerprint:sha(key.export({format:'der',type:'spki'})),
      wrappedKey:publicEncrypt({key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},secret).toString('base64'),
      iv:iv.toString('base64'),plaintextSha256:sha(plain),includedDirectories:dirs,source
    };
    const cipher=createCipheriv('aes-256-gcm',secret,iv);cipher.setAAD(aad(receipt));
    const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
    receipt.tag=cipher.getAuthTag().toString('base64');receipt.ciphertextSha256=sha(ciphertext);
    fs.writeFileSync(path.join(output,'candidate.tar.gz.enc'),ciphertext,{flag:'wx',mode:0o600});
    fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
    return {candidateSha256,source,recipientKeyFingerprint:receipt.recipientKeyFingerprint,ciphertextSha256:receipt.ciphertextSha256,receiptSha256:sha(read(path.join(output,'receipt.json'))),encrypted:true,originalAudit:'FAIL_NOT_WAIVED',registryUpload:false};
  }finally{fs.rmSync(scratch,{recursive:true,force:true});}
}

export function decryptCandidateEvidence({input,receiptPath,privateKeyPath,output,expectedCandidateSha256,expectedReceiptSha256}){
  assert.ok(hex64(expectedCandidateSha256),'independently verified expected candidate SHA256 required');
  assert.ok(hex64(expectedReceiptSha256),'receipt SHA256 from the trusted CI log required');
  assertOwnerKeyDestination(privateKeyPath);assertOwnerKeyDestination(output);
  const receiptBytes=read(receiptPath);assert.equal(sha(receiptBytes),expectedReceiptSha256,'trusted CI receipt mismatch');
  const r=JSON.parse(receiptBytes.toString('utf8'));
  assert.equal(r.schema,'bejewely.sca-owner-encrypted-artifact.v2','legacy receipt does not authenticate candidate identity');
  assert.deepEqual(Object.keys(r).sort(),[...bindingFields,'tag','ciphertextSha256'].sort(),'unknown or missing receipt field');
  assert.equal(r.status,'OWNER_ENCRYPTED_CI_EVIDENCE_ONLY_NOT_A_RELEASE');
  assert.match(r.source?.head||'',/^[a-f0-9]{40}$/);
  for(const k of ['runId','runAttempt'])assert.match(r.source[k]||'',/^[1-9][0-9]*$/);
  assert.equal(r.candidateSha256,expectedCandidateSha256,'independent candidate identity mismatch');
  assert.equal(r.payload,'candidate.tar.gz.enc');
  assert.equal(r.encryption,'RSA-OAEP-SHA256+AES-256-GCM');
  assert.deepEqual(r.includedDirectories,dirs);
  for(const n of ['candidateSha256','recipientKeyFingerprint','ciphertextSha256','plaintextSha256'])assert.ok(hex64(r[n]),'invalid receipt digest: '+n);
  const encrypted=read(input);assert.equal(sha(encrypted),r.ciphertextSha256,'encrypted evidence tampered');
  const key=createPrivateKey(read(privateKeyPath).toString('utf8'));
  assert.equal(sha(createPublicKey(key).export({format:'der',type:'spki'})),r.recipientKeyFingerprint,'wrong owner key');
  const secret=privateDecrypt({key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(r.wrappedKey,'base64'));
  assert.equal(secret.length,32);
  const iv=Buffer.from(r.iv,'base64'),tag=Buffer.from(r.tag,'base64');
  assert.equal(iv.length,12);assert.equal(tag.length,16);
  const decipher=createDecipheriv('aes-256-gcm',secret,iv);decipher.setAAD(aad(r));decipher.setAuthTag(tag);
  const plain=Buffer.concat([decipher.update(encrypted),decipher.final()]);
  assert.equal(sha(plain),r.plaintextSha256,'decrypted archive digest mismatch');
  // Inspect one bounded member through stdout, without extracting paths to disk.
  const manifest=spawnSync('tar',['-xzOf','-','scoped/scoped-candidate.json'],{input:plain,timeout:30000,maxBuffer:4*1024*1024});
  assert.ok(!manifest.error&&manifest.status===0,'candidate manifest missing in decrypted archive');
  assert.equal(sha(manifest.stdout),expectedCandidateSha256,'archive candidate manifest substitution');
  assert.ok(!fs.existsSync(output),'refuse to overwrite existing archive');
  fs.writeFileSync(output,plain,{flag:'wx',mode:0o600});
  return {output,candidateSha256:r.candidateSha256,plaintextSha256:r.plaintextSha256,source:r.source,candidateManifestVerified:true,releaseApproved:false};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [action,...a]=process.argv.slice(2);
  if(action==='keygen'){
    assert.equal(a.length,1,'usage: keygen <NEW_OWNER_FOLDER_OUTSIDE_REPO>');
    const dest=path.resolve(a[0]);assert.ok(!fs.existsSync(dest),'new owner-only folder required');
    assertOwnerKeyDestination(dest);
    const k=generateKeyPairSync('rsa',{modulusLength:3072,publicExponent:65537,
      publicKeyEncoding:{format:'pem',type:'spki'},privateKeyEncoding:{format:'pem',type:'pkcs8'}});
    fs.mkdirSync(dest,{mode:0o700});
    fs.writeFileSync(path.join(dest,'owner-private.pem'),k.privateKey,{flag:'wx',mode:0o600});
    fs.writeFileSync(path.join(dest,'owner-public.pem'),k.publicKey,{flag:'wx',mode:0o600});
    console.log('OWNER_PUBLIC_KEY_B64='+Buffer.from(k.publicKey).toString('base64'));
    console.log('OWNER_PUBLIC_KEY_SHA256='+sha(createPublicKey(k.publicKey).export({format:'der',type:'spki'})));
    console.log('OWNER_PRIVATE_KEY_PATH='+path.join(dest,'owner-private.pem')+' (DO NOT SHARE)');
  }else if(action==='decrypt'){
    assert.equal(a.length,6,'usage: decrypt <candidate.tar.gz.enc> <receipt.json> <owner-private.pem> <NEW_OUTPUT.tar.gz> <INDEPENDENT_CANDIDATE_SHA256> <TRUSTED_CI_RECEIPT_SHA256>');
    console.log('SCA_OWNER_DECRYPT='+JSON.stringify(decryptCandidateEvidence({input:a[0],receiptPath:a[1],privateKeyPath:a[2],output:a[3],expectedCandidateSha256:a[4],expectedReceiptSha256:a[5]})));
  }else throw Error('supported actions: keygen, decrypt');
}
