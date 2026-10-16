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

export function sealCandidateEvidence({root,output,recipientPublicKeyPem,candidateSha256}){
  assert.ok(hex64(candidateSha256),'exact scoped candidate SHA256 required');
  const key=createPublicKey(recipientPublicKeyPem);
  assert.equal(key.asymmetricKeyType,'rsa','owner RSA recipient key required');
  assert.ok(key.asymmetricKeyDetails?.modulusLength>=3072,'owner recipient RSA key >=3072 bits required');
  for(const d of dirs){const s=fs.lstatSync(path.join(root,d));assert.ok(s.isDirectory()&&!s.isSymbolicLink(),'missing verified directory: '+d);}
  assert.ok(!fs.existsSync(output),'encrypted evidence output must be new');
  fs.mkdirSync(output,{recursive:true,mode:0o700});
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'sca-owner-seal-'));
  try{
    const tar=path.join(scratch,'candidate.tar.gz');
    const p=spawnSync('tar',['-C',root,'-czf',tar,...dirs],{encoding:'utf8',timeout:120000});
    assert.ok(!p.error&&p.status===0,'evidence archive creation failed: '+(p.stderr||''));
    const plain=read(tar),secret=randomBytes(32),iv=randomBytes(12);
    const cipher=createCipheriv('aes-256-gcm',secret,iv);
    const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
    const receipt={
      schema:'bejewely.sca-owner-encrypted-artifact.v1',
      status:'OWNER_ENCRYPTED_CI_EVIDENCE_ONLY_NOT_A_RELEASE',
      candidateSha256,payload:'candidate.tar.gz.enc',
      encryption:'RSA-OAEP-SHA256+AES-256-GCM',
      recipientKeyFingerprint:sha(key.export({format:'der',type:'spki'})),
      wrappedKey:publicEncrypt({key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},secret).toString('base64'),
      iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),
      ciphertextSha256:sha(ciphertext),plaintextSha256:sha(plain),
      includedDirectories:dirs,originalAudit:'FAIL_NOT_WAIVED',registryUpload:false
    };
    fs.writeFileSync(path.join(output,'candidate.tar.gz.enc'),ciphertext,{flag:'wx',mode:0o600});
    fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
    return {candidateSha256,recipientKeyFingerprint:receipt.recipientKeyFingerprint,ciphertextSha256:receipt.ciphertextSha256,encrypted:true};
  }finally{fs.rmSync(scratch,{recursive:true,force:true});}
}

export function decryptCandidateEvidence({input,receiptPath,privateKeyPath,output}){
  const r=JSON.parse(read(receiptPath).toString('utf8'));
  assert.equal(r.schema,'bejewely.sca-owner-encrypted-artifact.v1');
  assert.equal(r.payload,'candidate.tar.gz.enc');
  assert.equal(r.encryption,'RSA-OAEP-SHA256+AES-256-GCM');
  assert.deepEqual(r.includedDirectories,dirs);
  for(const n of ['candidateSha256','recipientKeyFingerprint','ciphertextSha256','plaintextSha256'])assert.ok(hex64(r[n]),'invalid receipt digest: '+n);
  const encrypted=read(input);assert.equal(sha(encrypted),r.ciphertextSha256,'encrypted evidence tampered');
  const key=createPrivateKey(fs.readFileSync(privateKeyPath,'utf8'));
  assert.equal(sha(createPublicKey(key).export({format:'der',type:'spki'})),r.recipientKeyFingerprint,'wrong owner key');
  const secret=privateDecrypt({key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(r.wrappedKey,'base64'));
  assert.equal(secret.length,32);
  const iv=Buffer.from(r.iv,'base64'),tag=Buffer.from(r.tag,'base64');
  assert.equal(iv.length,12);assert.equal(tag.length,16);
  const decipher=createDecipheriv('aes-256-gcm',secret,iv);decipher.setAuthTag(tag);
  const plain=Buffer.concat([decipher.update(encrypted),decipher.final()]);
  assert.equal(sha(plain),r.plaintextSha256,'decrypted archive digest mismatch');
  assert.ok(!fs.existsSync(output),'refuse to overwrite existing archive');
  fs.writeFileSync(output,plain,{flag:'wx',mode:0o600});
  return {output,candidateSha256:r.candidateSha256,plaintextSha256:r.plaintextSha256};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [action,...a]=process.argv.slice(2);
  if(action==='keygen'){
    assert.equal(a.length,1,'usage: keygen <NEW_OWNER_FOLDER_OUTSIDE_REPO>');
    const dest=path.resolve(a[0]);assert.ok(!fs.existsSync(dest),'new owner-only folder required');
    const k=generateKeyPairSync('rsa',{modulusLength:3072,publicExponent:65537,
      publicKeyEncoding:{format:'pem',type:'spki'},privateKeyEncoding:{format:'pem',type:'pkcs8'}});
    fs.mkdirSync(dest,{mode:0o700});
    fs.writeFileSync(path.join(dest,'owner-private.pem'),k.privateKey,{flag:'wx',mode:0o600});
    fs.writeFileSync(path.join(dest,'owner-public.pem'),k.publicKey,{flag:'wx',mode:0o600});
    console.log('OWNER_PUBLIC_KEY_B64='+Buffer.from(k.publicKey).toString('base64'));
    console.log('OWNER_PRIVATE_KEY_PATH='+path.join(dest,'owner-private.pem')+' (DO NOT SHARE)');
  }else if(action==='decrypt'){
    assert.equal(a.length,4,'usage: decrypt <candidate.tar.gz.enc> <receipt.json> <owner-private.pem> <NEW_OUTPUT.tar.gz>');
    console.log('SCA_OWNER_DECRYPT='+JSON.stringify(decryptCandidateEvidence({input:a[0],receiptPath:a[1],privateKeyPath:a[2],output:a[3]})));
  }else throw Error('supported actions: keygen, decrypt');
}
