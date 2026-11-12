#!/usr/bin/env node
/** Disposable child: tests RSA-2048 positive/negative DigestInfo and Expo signing. */
import assert from "node:assert/strict";
import {createHash, constants, generateKeyPairSync, privateEncrypt, sign} from "node:crypto";
import {createRequire} from "node:module";
import path from "node:path";
const require=createRequire(import.meta.url);
const temp=process.argv[2];
assert.ok(path.isAbsolute(temp),"absolute isolated fixture path expected");
const forgeOriginal=require(path.join(process.cwd(),"node_modules/node-forge"));
const forgePatched=require(path.join(temp,"node-forge"));
const message=Buffer.from("bejewely-private-node-forge-rsa-boundary-20261013");
const other=Buffer.from("another-message");
const keys=generateKeyPairSync("rsa",{modulusLength:2048,publicExponent:65537});
const pem=keys.publicKey.export({format:"pem",type:"spki"});
const goodSignature=sign("sha256",message,{key:keys.privateKey,padding:constants.RSA_PKCS1_PADDING});
const encodeLength=(n)=>{
  assert.ok(Number.isInteger(n)&&n>=0&&n<=65535);
  if(n<128)return Buffer.from([n]);
  if(n<256)return Buffer.from([0x81,n]);
  return Buffer.from([0x82,n>>8,n&255]);
};
const tlv=(tag,buf)=>Buffer.concat([Buffer.from([tag]),encodeLength(buf.length),buf]);
const digest=createHash("sha256").update(message).digest();
const sha256Oid=Buffer.from("0609608648016503040201","hex");
const derNull=Buffer.from("0500","hex");
const malformed=tlv(0x30,Buffer.concat([sha256Oid,derNull,derNull]));
const digestInfo=tlv(0x30,Buffer.concat([malformed,tlv(0x04,digest)]));
const pad=256-digestInfo.length-3;
assert.ok(pad>=8);
const messageEncoded=Buffer.concat([Buffer.from([0,1]),Buffer.alloc(pad,255),
  Buffer.from([0]),digestInfo]);
assert.equal(messageEncoded.length,256);
const badSignature=privateEncrypt({key:keys.privateKey,padding:constants.RSA_NO_PADDING},messageEncoded);
const verify=(module,hash,signature)=>{
  const pk=module.pki.publicKeyFromPem(pem);
  try {return pk.verify(hash.toString("binary"),signature.toString("binary"))===true;}
  catch{return false;}
};
const okHash=createHash("sha256").update(message).digest();
const otherHash=createHash("sha256").update(other).digest();
assert.equal(verify(forgeOriginal,okHash,goodSignature),true);
assert.equal(verify(forgeOriginal,otherHash,goodSignature),false);
assert.equal(verify(forgeOriginal,okHash,badSignature),true,
  "original forge ASN.1 acceptance baseline drifted");
assert.equal(verify(forgePatched,okHash,goodSignature),true,
  "patched forge rejects valid signature");
assert.equal(verify(forgePatched,otherHash,goodSignature),false,
  "patched forge accepts different message");
assert.equal(verify(forgePatched,okHash,badSignature),false,
  "patched forge accepts malformed extra nested ASN.1 child");

// The consumer below has only node-forge as a runtime dependency. Copies
// are under a throwaway module resolution tree controlled by the parent.
const signing=require(path.join(temp,"@expo/code-signing-certificates"));
const rsa=forgePatched.pki.rsa.generateKeyPair({bits:1024,e:65537});
const now=Date.now();
const certificate=signing.generateSelfSignedCodeSigningCertificate({
  keyPair:rsa,
  validityNotBefore:new Date(now-60000),
  validityNotAfter:new Date(now+600000),
  commonName:"Bejewely B2 temporary self-signed fixture",
});
signing.validateSelfSignedCertificate(certificate,rsa);
const pemCert=signing.convertCertificateToCertificatePEM(certificate);
const certificate2=signing.convertCertificatePEMToCertificate(pemCert);
signing.validateSelfSignedCertificate(certificate2,rsa);
const signature=signing.signBufferRSASHA256AndVerify(
  rsa.privateKey,certificate2,Buffer.from("bejewely-b2-test-manifest"));
assert.equal(typeof signature,"string");
assert.ok(signature.length>0);
const otherKeys=forgePatched.pki.rsa.generateKeyPair({bits:1024,e:65537});
assert.throws(()=>signing.validateSelfSignedCertificate(certificate2,otherKeys),
  /key pair public key/);
const expired=signing.convertCertificatePEMToCertificate(pemCert);
expired.validity.notAfter=new Date(now-120000);
assert.throws(()=>signing.validateSelfSignedCertificate(expired,rsa),/validity expired/);
console.log("SCA_B2_PRIVATE_FORGE_BEHAVIOR=PASS normal-rsa/wrong-message/malformed-digest/"+
  "expo-pem-signing/wrong-key/expired-cert");
