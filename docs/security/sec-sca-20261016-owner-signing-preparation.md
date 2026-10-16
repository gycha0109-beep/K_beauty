# Owner-local cryptographic preparation — 2026-10-16

## Actual rights approval and remaining boundary

The project owner approved final rights review ONLY for candidate **17119d9a264faba07951e8db3519a8ef23452504e30212b6a18c34994980621d** / packet **859448143dbd676ad549f0abb9e1e63a4439c12ee58859b75dd12f2382ac7e87**. [Actual human decision](sec-sca-20261016-owner-final-rights-approval.json), SHA256 **70c4200b850d936eaf5078499066c905a4cdb8ab5858169c393f4841562860e5**. No other candidate inherits approval. B-level exact historical copying versions remain unknown; verified grants and all notice conditions stay intact.

This is not a legal conformity guarantee, security audit PASS, cryptographic signature, upload/actual redistribution/spending/ACL/product/merge/production approval. Frozen packet generation-time approval flags remain unchanged; this separate owner decision binds its exact hash. [Prepared public interfaces](sec-sca-20261016-signing-preparation.json) contain no secrets and are deliberately non-executable. Original audit fullHIGH22/prodHIGH19/C0 FAIL remains. New-candidate owner decryption is now PASS (see update below). Release signatures and trusted key provisioning remain NOT_RUN.

## 1. Decrypt the NEW retained candidate locally

Old800e decryption and RSA recipient registration are already complete; do not repeat them. [Download new artifact12033259971](https://github.com/gycha0109-beep/K_beauty/actions/runs/38869911393/artifacts/12033259971). Keep the private key on the owner machine. Update the same feature branch, preserving local changes, and run from **D:\cha\K_beauty_sca**. Destinations below must be NEW and outside Git.

```powershell
$ErrorActionPreference = 'Stop'
$scaZip = Join-Path $env:USERPROFILE 'Downloads\sca-b6-owner-encrypted-38869911393-1.zip'
if ((Get-FileHash -LiteralPath $scaZip -Algorithm SHA256).Hash.ToLower() -ne '6bc2aeed1ee203c3e51d46be3e4fed57566542e702bd3b97666ac3ec12cff092') { throw 'Artifact ZIP mismatch' }
$scaEnvelope = Join-Path $env:USERPROFILE 'Downloads\BEJEWELY-SCA-38869911393-1-envelope'
if (Test-Path -LiteralPath $scaEnvelope) { throw 'Choose a new envelope destination' }
Expand-Archive -LiteralPath $scaZip -DestinationPath $scaEnvelope
node .\scripts\security\sca-release-encrypted-artifact.mjs decrypt "$scaEnvelope\candidate.tar.gz.enc" "$scaEnvelope\receipt.json" "$env:USERPROFILE\BEJEWELY-SCA-Archive-Key\owner-private.pem" "$env:USERPROFILE\Downloads\BEJEWELY-SCA-38869911393-1.tar.gz" 17119d9a264faba07951e8db3519a8ef23452504e30212b6a18c34994980621d 9330b0522ea248a3de1e671ea8aae33952ddf06d6917356f4c2033d1107e5a1f
if ($LASTEXITCODE -ne 0) { throw 'Decryption failed; stop' }
```

Only share the nonsecret SCA_OWNER_DECRYPT result. Expected source ba12b646f89f2f5eab610b4ed79c2cd45a4758ee/run38869911393/attempt1, candidateManifestVerified=true, releaseApproved=false, plaintext SHA256 bf5e25f5012b7ab5e0672dfafdbce19b3b6fdafff506d06ee6c306f7c9ccd97b. Stop on errors; do not replace independent expected hashes with downloaded metadata. This does not extract the plaintext tar or publish. Use existing bounded safe inventory/extraction and bundle/publication/browser-kit verifiers before release use. Do not upload plaintext or use the Windows-local9fee archive as the retained Linux candidate.

## 2. Prepare genuine owner Ed25519 public identity

The RSA archive key cannot substitute for the release verifier's Ed25519 key. If a suitable owner-controlled Ed25519 PKCS8 key already exists, retain it and prepare its PUBLIC SPKI/fingerprint locally; do not rotate it unnecessarily. No new mandatory rights-only signature is introduced.

Otherwise, this is an OWNER-RUN example, never executed by the agent. Choose a restricted location outside Git. It writes unencrypted PKCS8: secure the private file and backup. Windows mode0600 alone does not establish a private NTFS ACL; inspect the chosen parent permissions before running. This task changes no ACL. Never send private PEM or PAT values to chat, Git or CI.

Run from the owner's repository root, with a NEW destination:

```powershell
@'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {assertOwnerKeyDestination} from './scripts/security/sca-release-encrypted-artifact.mjs';
const destination=path.join(process.env.USERPROFILE,'BEJEWELY-SCA-Signing-Key');
assertOwnerKeyDestination(destination);
assert.ok(!fs.existsSync(destination),'Choose a NEW outside-Git owner-only folder');
const keys=generateKeyPairSync('ed25519');
fs.mkdirSync(destination,{mode:0o700});
fs.writeFileSync(path.join(destination,'owner-signing-private.pem'),keys.privateKey.export({format:'pem',type:'pkcs8'}),{mode:0o600,flag:'wx'});
fs.writeFileSync(path.join(destination,'owner-signing-public.pem'),keys.publicKey.export({format:'pem',type:'spki'}),{mode:0o600,flag:'wx'});
console.log('SCA_OWNER_SIGNING_PUBLIC='+JSON.stringify({algorithm:'ed25519',publicKeyPath:path.join(destination,'owner-signing-public.pem'),spkiDerSha256:createHash('sha256').update(keys.publicKey.export({format:'der',type:'spki'})).digest('hex'),releaseApproved:false}));
'@ | node --input-type=module
if ($LASTEXITCODE -ne 0) { throw 'Signing-key preparation failed; stop' }
```

Only PUBLIC key/fingerprint information may enter reviewed external trust configuration. A key's existence alone is not proof of owner identity or approved trust. The agent syntax-checks the example without running it; actual owner key creation/signing remains NOT_RUN.

## 3. Final signing and authentication plan — not executable yet

One owner may hold all four roles: security, license-redistribution, maintenance, distribution. Existing signing bytes remain `UTF8("BEJEWELY-SCA-OWNER-v2:SCOPED_UPLOAD_READBACK_ONLY:" + role + "\n") || exact approval.json bytes`, with ONE newline byte. Do not sign a template or flip upload/redistribution/operational booleans now. The rights-only record cannot be substituted for the separate final upload document. The existing default signed dry-run also requires genuine final upload approval and operational evidence, so it remains NOT_RUN.

Frozen policy licensePacketSha256 **d6648013ec8713c867c5dd6f8accfecfcfbfdcb20bf0644f4e35432b78ea4d12** differs from derived candidateLicensePacketSha256 **859448143dbd676ad549f0abb9e1e63a4439c12ee58859b75dd12f2382ac7e87**. The current rights-decision evidence hash is **70c4200b850d936eaf5078499066c905a4cdb8ab5858169c393f4841562860e5**. No trust fingerprint is invented.

Authentication is preparation only; no token issuance requested now:

- [Official npm registry docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) and [permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages), checked2026-10-16: the isolated unlinked bootstrap uses owner classic PAT write:packages/read:packages. GITHUB_TOKEN applies to associated repository/package access and is not silently substituted for unlinked publication.
- Future UI: GitHub avatar → Settings → Developer settings → Personal access tokens → Tokens(classic). Short expiry/minimum scopes; no delete/admin/broad repo scope. Do not issue a token under this instruction or put it in chat/CLI arguments/repository npmrc.
- Later approved secret injection only: NODE_AUTH_TOKEN and separate valid unauthorized identity's SCA_UNPRIVILEGED_TOKEN. The technical denial identity is not a second license approver; invalid/duplicate owner tokens are insufficient.
- Genuine public trust plus externally pinned SCA_TRUST_POLICY_SHA256, current no-charge/quota proof, reviewed private ACL/notice delivery and actual authenticated/anonymous/unprivileged readback remain required. Package linking and Actions access retain their separate permission boundaries.

Next owner action is local cryptographic preparation, reporting only nonsecret results. Actual release signing waits for its exact authorized final document; publishing/account/ACL/payment/product/main/production remain untouched.

## Owner decryption completed and independently checked

The owner executed decryption of candidate17119/packet8594 successfully. Agent then read ONLY the resulting plaintext archive, verified its expected SHA bf5e25f5012b7ab5e0672dfafdbce19b3b6fdafff506d06ee6c306f7c9ccd97b, checked all117 TAR entries for safe bounded paths/types/checksums/duplicates/parents BEFORE extraction, and ran existing verifyBundle, verifyPublicationCandidate and verifyOaepBrowserNoticeKit: all PASS. Candidate/packet/kit and13+64 installed package inventories match the canonical independent CI proof. [Receipt](sec-sca-20261016-owner-decryption-verified.json). No private key/PAT accessed. This supersedes historical NOT_RUN decryption statements for this exact candidate only.

Step1 is COMPLETE; do not repeat decryption or recipient registration. Next is step2 owner-held Ed25519 public identity preparation, using an existing suitable key if available. Actual release signing/trust/authentication/publication remain NOT_RUN and owner rights approval remains exact-pair-only. Original audit fullHIGH22/prodHIGH19/C0 FAIL remains.

## Real owner public signing identity received

Owner reported Ed25519 public SPKI fingerprint **8d09ade272fe502989c607502358a456d8bbc8b90e0c91c96be7e563ddcb5231**. Agent read ONLY owner-signing-public.pem and independently verified algorithm/fingerprint; private key never accessed. [Public identity receipt](sec-sca-20261016-owner-public-signing-identity.json). Owner key preparation is complete; do not generate another key or request private material. This is not cryptographic proof of private-key possession or a real release signature.

[Public trust draft](sec-sca-20261016-owner-trust.draft.json) includes the actual public key, owner and existing four roles, but organizationApproved=false and null validity bounds make it deliberately non-admissible. Draft SHA **e73b6f5bf3d7089a42afa185c0ef3b5f0645951c3b810df20c83cd0abbab25a6** is an informational digest, not a configured SCA_TRUST_POLICY_SHA256 pin. No live trust configuration or account setting changed. At the future exact-authorized upload ceremony, owner must confirm key-role/validity binding and independently pin the final reviewed trust, then sign the exact final approval bytes. No final upload document exists yet because current authority withholds execution and operational evidence/credentials are not provisioned. Do not sign a permissive template now.

Current human boundary is actual publisher authentication provisioning: classic PAT write:packages/read:packages, short expiry and secure owner-local storage; no token value in chat/repo/logs/CLI arguments. Token issuance/storage settings remain unapproved and have not been executed. No second license approver is required; valid unauthorized-reader credentials remain a distinct technical denial test. Actual publication/cost/ACL/product/main/production changes remain unapproved. Original audit FAIL unchanged.
