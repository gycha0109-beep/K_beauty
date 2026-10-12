#!/usr/bin/env node
/**
 * Controlled, read-only runtime observations against npm-ci-installed packages.
 *
 * Does NOT establish remote exploitability, Android inclusion, or remediation.
 * Creates test-only keys in memory; never logs keys, signatures or DER payloads.
 * Uses bounded braces inputs, never an unbounded stack-exhaustion test.
 * Canonical npm audit remains the security authority.
 */
import assert from "node:assert/strict";
import { createHash, constants, generateKeyPairSync, privateEncrypt, sign } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const braces = require("braces");
const forge = require("node-forge");
const BRACE_DEPTH = 110;
const FIXTURE_MESSAGE = Buffer.from("bejewely-security-der-boundary-fixture-v1");

function derLength(n) {
  assert.ok(Number.isInteger(n) && n >= 0 && n <= 65535, "bounded DER length");
  if (n < 128) return Buffer.from([n]);
  if (n < 256) return Buffer.from([0x81, n]);
  return Buffer.from([0x82, n >> 8, n & 0xff]);
}

function tlv(tag, value) {
  return Buffer.concat([Buffer.from([tag]), derLength(value.length), value]);
}

function verifyOrFalse(publicKey, hash, signature) {
  try {
    return publicKey.verify(hash.toString("binary"), signature.toString("binary")) === true;
  } catch {
    return false;
  }
}

function observeRsaDigestAlgorithmValidation() {
  // Ephemeral, test-only key pair. No production keys, certs, credentials or network.
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048, publicExponent: 65537,
  });
  const sourceDigest = createHash("sha256").update(FIXTURE_MESSAGE).digest();
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" });
  const forgePublicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  const normalSignature = sign("sha256", FIXTURE_MESSAGE, {
    key: privateKey, padding: constants.RSA_PKCS1_PADDING,
  });
  const normalSignatureAccepted = verifyOrFalse(forgePublicKey, sourceDigest, normalSignature);
  const differentMessageRejected = !verifyOrFalse(
    forgePublicKey, createHash("sha256").update("different-test-message").digest(), normalSignature,
  );
  // Controlled DER-structure boundary test: an extra NULL child is invalid.
  // This does NOT construct an attacker-without-private-key signature forgery.
  const sha256Oid = Buffer.from("0609608648016503040201", "hex");
  const derNull = Buffer.from("0500", "hex");
  const malformedAlgorithm = tlv(0x30, Buffer.concat([sha256Oid, derNull, derNull]));
  const digestInfo = tlv(0x30, Buffer.concat([malformedAlgorithm, tlv(0x04, sourceDigest)]));
  const keyBytes = 256;
  const paddingLength = keyBytes - digestInfo.length - 3;
  assert.ok(paddingLength >= 8, "fixture fits PKCS#1 v1.5 padding");
  const encodedMessage = Buffer.concat([
    Buffer.from([0x00, 0x01]), Buffer.alloc(paddingLength, 0xff),
    Buffer.from([0x00]), digestInfo,
  ]);
  assert.equal(encodedMessage.length, keyBytes, "RSA length");
  const malformedSignature = privateEncrypt({
    key: privateKey, padding: constants.RSA_NO_PADDING,
  }, encodedMessage);
  const malformedNestedAlgorithmAccepted = verifyOrFalse(
    forgePublicKey, sourceDigest, malformedSignature,
  );
  assert.ok(normalSignatureAccepted, "healthy RSA signature rejected");
  assert.ok(differentMessageRejected, "bad-message RSA signature accepted");
  return {
    package: "node-forge",
    healthySignatureAccepted: normalSignatureAccepted,
    wrongMessageRejected: differentMessageRejected,
    extraNestedDigestAlgorithmChildAccepted: malformedNestedAlgorithmAccepted,
    extraNestedDigestAlgorithmChildRejected: !malformedNestedAlgorithmAccepted,
    fixture: "ephemeral-rsa-2048-and-nonconformant-digestinfo-only",
    inference: "CODE_PATH_BEHAVIOR_ONLY_NOT_REMOTE_EXPLOITABILITY_OR_REMEDIATION",
  };
}

function observeBraceDepthBoundary() {
  const input = "{".repeat(BRACE_DEPTH) + "a,b" + "}".repeat(BRACE_DEPTH);
  assert.ok(input.length < 500, "bounded brace diagnostic input");
  let accepted;
  let errorName = null;
  try {
    braces.parse(input);
    accepted = true;
  } catch (error) {
    accepted = false;
    errorName = error?.name || "UnknownError";
  }
  // Whether a low-stress nested pattern is accepted is not a DoS proof.
  // Existing versions may also reject for reasons unrelated to a depth guard.
  return {
    package: "braces",
    inputDepth: BRACE_DEPTH,
    inputBytes: Buffer.byteLength(input),
    nestedPatternAccepted: accepted,
    nestedPatternRejectionName: errorName,
    inference: "BOUNDED_PARSE_BEHAVIOR_ONLY_NOT_STACK_EXHAUSTION_OR_REMEDIATION",
  };
}

const forgeObservation = observeRsaDigestAlgorithmValidation();
const bracesObservation = observeBraceDepthBoundary();
console.log("SUPPLY_CHAIN_RUNTIME_BOUNDARY_FORGE=" + JSON.stringify(forgeObservation));
console.log("SUPPLY_CHAIN_RUNTIME_BOUNDARY_BRACES=" + JSON.stringify(bracesObservation));
console.log("SUPPLY_CHAIN_RUNTIME_BOUNDARY_STATUS=OBSERVATION_ONLY canonical-npm-audit-remains-authoritative");
