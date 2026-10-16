import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {generateKeyPairSync,createHash,randomBytes,publicEncrypt,createCipheriv,constants} from 'node:crypto';
import {sealCandidateEvidence,decryptCandidateEvidence,assertOwnerKeyDestination} from './sca-release-encrypted-artifact.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const keys=bits=>generateKeyPairSync('rsa',{modulusLength:bits,publicExponent:65537,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
const source={head:'b'.repeat(40),runId:'123',runAttempt:'1'};
function fixture(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'sca-encrypted-evidence-test-'));try{
  for(const dir of ['original-bundle','scoped','browser-notice-kit']){fs.mkdirSync(path.join(root,dir));fs.writeFileSync(path.join(root,dir,'test-proof.txt'),'SECRET_'+dir);}
  const manifest=Buffer.from('{"fixture":"NOT_A_RELEASE"}\n');fs.writeFileSync(path.join(root,'scoped/scoped-candidate.json'),manifest);
  const candidateSha256=hash(manifest),k=keys(3072),privateKeyPath=path.join(root,'private.pem');fs.writeFileSync(privateKeyPath,k.privateKey);
  const output=path.join(root,'sealed'),options={root,output,recipientPublicKeyPem:k.publicKey,candidateSha256,source};
  fn({root,k,options,privateKeyPath,candidateSha256});
}finally{fs.rmSync(root,{recursive:true,force:true});}}
function decryptOptions(f){return {input:path.join(f.options.output,'candidate.tar.gz.enc'),receiptPath:path.join(f.options.output,'receipt.json'),privateKeyPath:f.privateKeyPath,output:path.join(f.root,'opened.tar.gz'),expectedCandidateSha256:f.candidateSha256,expectedReceiptSha256:hash(fs.readFileSync(path.join(f.options.output,'receipt.json')))};}
test('only ciphertext and receipt exported; owner decrypts actual independently identified candidate',()=>fixture(f=>{
  const result=sealCandidateEvidence(f.options),a=decryptOptions(f);assert.equal(result.encrypted,true);
  assert.deepEqual(fs.readdirSync(f.options.output).sort(),['candidate.tar.gz.enc','receipt.json']);
  assert.equal(result.receiptSha256,hash(fs.readFileSync(a.receiptPath)));
  assert.throws(()=>decryptCandidateEvidence({...a,expectedReceiptSha256:'f'.repeat(64)}),/trusted CI receipt mismatch/);
  assert.ok(!fs.readFileSync(a.input).includes(Buffer.from('SECRET_scoped')));
  const opened=decryptCandidateEvidence(a);assert.equal(opened.candidateManifestVerified,true);assert.equal(opened.releaseApproved,false);
  assert.deepEqual(opened.source,source);const list=spawnSync('tar',['-tzf',a.output],{encoding:'utf8'});assert.equal(list.status,0);
  assert.ok(list.stdout.includes('scoped/scoped-candidate.json'));assert.ok(!list.stdout.includes('private.pem'));
  assert.throws(()=>decryptCandidateEvidence(a),/overwrite/);
}));
test('ciphertext, GCM tag, wrapped key and source metadata tampering produce no plaintext',()=>fixture(f=>{
  sealCandidateEvidence(f.options);const a=decryptOptions(f),receipt=fs.readFileSync(a.receiptPath),cipher=fs.readFileSync(a.input);
  const bad=Buffer.from(cipher);bad[0]^=1;fs.writeFileSync(a.input,bad);assert.throws(()=>decryptCandidateEvidence(a),/tampered/);fs.writeFileSync(a.input,cipher);
  for(const change of [r=>r.tag=Buffer.alloc(16).toString('base64'),r=>r.wrappedKey=Buffer.alloc(384).toString('base64'),r=>r.source.head='c'.repeat(40),r=>r.status='FAKE_RELEASE']){
    const r=JSON.parse(receipt);change(r);fs.writeFileSync(a.receiptPath,JSON.stringify(r));a.expectedReceiptSha256=hash(fs.readFileSync(a.receiptPath));assert.throws(()=>decryptCandidateEvidence(a));assert.equal(fs.existsSync(a.output),false);
  }
  fs.writeFileSync(a.receiptPath,receipt);a.expectedReceiptSha256=hash(receipt);fs.writeFileSync(f.privateKeyPath,keys(3072).privateKey);assert.throws(()=>decryptCandidateEvidence(a),/wrong owner key/);
}));
test('candidate digest is GCM-authenticated, independently pinned and checked against real archive',()=>fixture(f=>{
  sealCandidateEvidence(f.options);const a=decryptOptions(f);assert.throws(()=>decryptCandidateEvidence({...a,expectedCandidateSha256:'e'.repeat(64)}),/independent candidate/);
  const r=JSON.parse(fs.readFileSync(a.receiptPath));r.candidateSha256='d'.repeat(64);fs.writeFileSync(a.receiptPath,JSON.stringify(r));a.expectedReceiptSha256=hash(fs.readFileSync(a.receiptPath));
  assert.throws(()=>decryptCandidateEvidence({...a,expectedCandidateSha256:r.candidateSha256}),/authenticate/);assert.equal(fs.existsSync(a.output),false);
  assert.throws(()=>sealCandidateEvidence({...f.options,output:path.join(f.root,'wrong'),candidateSha256:'f'.repeat(64)}),/actual candidate manifest mismatch/);
}));
test('weak or private recipient material is rejected before output creation',()=>fixture(f=>{
  assert.throws(()=>sealCandidateEvidence({...f.options,recipientPublicKeyPem:keys(2048).publicKey}),/>=3072/);
  assert.throws(()=>sealCandidateEvidence({...f.options,recipientPublicKeyPem:f.k.privateKey}),/only a public SPKI PEM/);assert.equal(fs.existsSync(f.options.output),false);
}));
test('nested links cannot enter retained archive',()=>fixture(f=>{
  const target=path.join(f.root,'scoped','linked.txt');fs.linkSync(path.join(f.root,'original-bundle/test-proof.txt'),target);
  assert.throws(()=>sealCandidateEvidence(f.options),/links\/special files/);assert.equal(fs.existsSync(f.options.output),false);
}));
test('keygen destination cannot be inside Git checkout or linked worktree',()=>{
  assert.throws(()=>assertOwnerKeyDestination(path.join(process.cwd(),'new-owner-key-folder')),/outside every Git checkout/);
});
test('v1 unauthenticated identity receipt is refused',()=>fixture(f=>{
  sealCandidateEvidence(f.options);const a=decryptOptions(f),r=JSON.parse(fs.readFileSync(a.receiptPath));r.schema='bejewely.sca-owner-encrypted-artifact.v1';fs.writeFileSync(a.receiptPath,JSON.stringify(r));a.expectedReceiptSha256=hash(fs.readFileSync(a.receiptPath));
  assert.throws(()=>decryptCandidateEvidence(a),/legacy receipt/);assert.equal(fs.existsSync(a.output),false);
}));

test('public workflow uploads only ciphertext and receipt after producer success',()=>{
  const workflow=fs.readFileSync(new URL('../../.github/workflows/sca-release-readiness.yml',import.meta.url),'utf8');
  const upload=workflow.slice(workflow.indexOf('      - name: Preserve owner-encrypted'),workflow.indexOf('  independent-candidate:'));
  assert.equal((workflow.match(/uses: actions\/upload-artifact@/g)||[]).length,1);
  assert.match(upload,/success\(\).*encrypted_candidate_ready == 'true'/);
  const paths=upload.match(/path: \|\r?\n([\s\S]*?)\s+if-no-files-found:/)?.[1].trim().split(/\r?\n/).map(s=>s.trim());
  assert.deepEqual(paths,['${{ runner.temp }}/bejewely-sca-owner-artifact/candidate.tar.gz.enc','${{ runner.temp }}/bejewely-sca-owner-artifact/receipt.json']);
  assert.match(upload,/if-no-files-found: error/);assert.match(upload,/retention-days: 3/);
  assert.ok(!/owner-private\.pem|\.mjs keygen/.test(workflow));
});

// Anyone can encrypt to a public recipient key: encryption alone is not sender provenance.
test('valid public-key envelope cannot substitute the archived candidate manifest',()=>fixture(f=>{
  sealCandidateEvidence(f.options);const a=decryptOptions(f),r=JSON.parse(fs.readFileSync(a.receiptPath));
  fs.writeFileSync(path.join(f.root,'scoped/scoped-candidate.json'),'different candidate');
  const archive=spawnSync('tar',['-C',f.root,'-czf','-','original-bundle','scoped','browser-notice-kit'],{maxBuffer:1048576});assert.equal(archive.status,0);
  const secret=randomBytes(32),iv=randomBytes(12);r.wrappedKey=publicEncrypt({key:f.k.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},secret).toString('base64');r.iv=iv.toString('base64');r.plaintextSha256=hash(archive.stdout);
  const fields=['schema','status','candidateSha256','payload','encryption','recipientKeyFingerprint','wrappedKey','iv','plaintextSha256','includedDirectories','source'];
  const cipher=createCipheriv('aes-256-gcm',secret,iv);cipher.setAAD(Buffer.from(JSON.stringify(Object.fromEntries(fields.map(k=>[k,r[k]])))));
  const bytes=Buffer.concat([cipher.update(archive.stdout),cipher.final()]);r.tag=cipher.getAuthTag().toString('base64');r.ciphertextSha256=hash(bytes);
  fs.writeFileSync(a.input,bytes);fs.writeFileSync(a.receiptPath,JSON.stringify(r));a.expectedReceiptSha256=hash(fs.readFileSync(a.receiptPath));
  assert.throws(()=>decryptCandidateEvidence(a),/archive candidate manifest substitution/);assert.equal(fs.existsSync(a.output),false);
}));
