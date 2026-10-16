import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {generateKeyPairSync} from 'node:crypto';
import {sealCandidateEvidence,decryptCandidateEvidence} from './sca-release-encrypted-artifact.mjs';

const keys=bits=>generateKeyPairSync('rsa',{modulusLength:bits,publicExponent:65537,
  publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});

test('only encrypted archive and integrity receipt are exported; owner decrypts',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sca-encrypted-evidence-test-'));
  try{
    for(const dir of ['original-bundle','scoped','browser-notice-kit']){
      fs.mkdirSync(path.join(root,dir));
      fs.writeFileSync(path.join(root,dir,'test-proof.txt'),'SECRET_'+dir);
    }
    const k=keys(3072),privateKeyPath=path.join(root,'private.pem');
    fs.writeFileSync(privateKeyPath,k.privateKey);
    const output=path.join(root,'sealed'),candidateSha256='a'.repeat(64);
    const result=sealCandidateEvidence({root,output,recipientPublicKeyPem:k.publicKey,candidateSha256});
    assert.equal(result.encrypted,true);
    assert.deepEqual(fs.readdirSync(output).sort(),['candidate.tar.gz.enc','receipt.json']);
    const encrypted=path.join(output,'candidate.tar.gz.enc'),receiptPath=path.join(output,'receipt.json'),before=fs.readFileSync(encrypted);
    assert.ok(!before.includes(Buffer.from('SECRET_scoped')));
    const tar=path.join(root,'decrypted.tar.gz');
    assert.equal(decryptCandidateEvidence({input:encrypted,receiptPath,privateKeyPath,output:tar}).candidateSha256,candidateSha256);
    const listed=spawnSync('tar',['-tzf',tar],{encoding:'utf8'});
    assert.equal(listed.status,0);
    assert.ok(listed.stdout.includes('scoped/test-proof.txt'));
    assert.ok(listed.stdout.includes('original-bundle/test-proof.txt'));
    assert.throws(()=>decryptCandidateEvidence({input:encrypted,receiptPath,privateKeyPath,output:tar}),/overwrite/);
    fs.writeFileSync(encrypted,Buffer.concat([before.subarray(0,1),Buffer.from([before[1]^1]),before.subarray(2)]));
    assert.throws(()=>decryptCandidateEvidence({input:encrypted,receiptPath,privateKeyPath,output:path.join(root,'tampered.tar.gz')}),/tampered/);
    assert.equal(fs.existsSync(path.join(root,'tampered.tar.gz')),false);
    const wrong=keys(3072);
    fs.writeFileSync(privateKeyPath,wrong.privateKey);
    fs.writeFileSync(encrypted,before);
    assert.throws(()=>decryptCandidateEvidence({input:encrypted,receiptPath,privateKeyPath,output:path.join(root,'wrong.tar.gz')}),/wrong owner key/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('weak recipient key cannot stage an artifact',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'sca-encrypted-evidence-test-'));
  try{
    for(const dir of ['original-bundle','scoped','browser-notice-kit'])fs.mkdirSync(path.join(root,dir));
    const weak=keys(2048),output=path.join(root,'sealed');
    assert.throws(()=>sealCandidateEvidence({root,output,recipientPublicKeyPem:weak.publicKey,candidateSha256:'a'.repeat(64)}),/>=3072/);
    assert.equal(fs.existsSync(output),false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
