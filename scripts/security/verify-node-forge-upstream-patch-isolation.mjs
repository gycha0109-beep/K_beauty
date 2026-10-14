#!/usr/bin/env node
/**
 * SCA-2 isolated upstream-candidate evaluation (digitalbazaar/forge PR #1152).
 *
 * Only touches an ephemeral copy of npm-installed node-forge under os.tmpdir().
 * Source patch anchor matches the reviewed upstream diff at
 * ceba34402e329f0365134f23fe19898756527d65 (UNMERGED).
 * Never mutates node_modules, package.json, package-lock.json, audit rules,
 * deployment signing credentials or production configuration.
 *
 * This is compatibility evidence, NOT a patched distribution or audit PASS.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { observeRsaDigestAlgorithmValidation } from "./report-supply-chain-runtime-boundaries.mjs";

const require = createRequire(import.meta.url);
const result = {
  patchCandidate: "digitalbazaar/forge#1152",
  upstreamHead: "ceba34402e329f0365134f23fe19898756527d65",
  scope: "EPHEMERAL_COPY_ONLY_NO_PACKAGE_OR_LOCKFILE_CHANGE",
  observed: "NOT_RUN",
  securityConclusion: "NOT_ATTESTED_CANONICAL_NPM_AUDIT_REQUIRED",
};
let packageJsonPath;
try {
  packageJsonPath = require.resolve("node-forge/package.json");
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") throw error;
}
if (!packageJsonPath) {
  result.observed = "NOT_INSTALLED";
  console.log("SCA_FORGE_PATCH_ISOLATION=" + JSON.stringify(result));
} else {
  const packageRoot = path.dirname(packageJsonPath);
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  result.installedVersion = pkg.version;

  if (pkg.version !== "1.4.0") {
    result.observed = "VERSION_NOT_BASELINE_REEVALUATION_REQUIRED";
    console.log("SCA_FORGE_PATCH_ISOLATION=" + JSON.stringify(result));
  } else {
    const original = [
      "if(!asn1.validate(obj, digestInfoValidator, capture, errors) ||",
      "            obj.value.length !== 2) {",
    ].join("\n");
    const replacement = [
      "if(!asn1.validate(obj, digestInfoValidator, capture, errors) ||",
      "            obj.value.length !== 2 ||",
      "            obj.value[0].value.length !==",
      "              (('parameters' in capture) ? 2 : 1)) {",
    ].join("\n");
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bejewely-sca-forge-candidate-"));
    try {
      fs.mkdirSync(path.join(temp, "lib"), { recursive: true });
      fs.cpSync(path.join(packageRoot, "lib"), path.join(temp, "lib"), { recursive: true });
      fs.copyFileSync(packageJsonPath, path.join(temp, "package.json"));
      const sourcePath = path.join(temp, "lib", "rsa.js");
      const source = fs.readFileSync(sourcePath, "utf8");
      const count = source.split(original).length - 1;
      assert.equal(count, 1, "pinned upstream source patch anchor changed; fail closed");
      const unchangedPackage = require("node-forge");
      const before = observeRsaDigestAlgorithmValidation(unchangedPackage);
      assert.equal(before.extraNestedDigestAlgorithmChildAccepted, true, "unpatched baseline changed");
      fs.writeFileSync(sourcePath, source.replace(original, replacement));
      const patchedCopy = require(temp);
      const after = observeRsaDigestAlgorithmValidation(patchedCopy);
      assert.equal(after.healthySignatureAccepted, true, "candidate broke normal RSA verification");
      assert.equal(after.wrongMessageRejected, true, "candidate broke bad-message rejection");
      assert.equal(after.extraNestedDigestAlgorithmChildRejected, true, "candidate did not reject nonconformant ASN.1");
      result.observed = "ISOLATED_CANDIDATE_BEHAVIOR_PASS";
      result.patchAnchorCount = count;
      result.before = {
        healthySignatureAccepted: before.healthySignatureAccepted,
        wrongMessageRejected: before.wrongMessageRejected,
        extraNestedDigestAlgorithmChildAccepted: before.extraNestedDigestAlgorithmChildAccepted,
      };
      result.after = {
        healthySignatureAccepted: after.healthySignatureAccepted,
        wrongMessageRejected: after.wrongMessageRejected,
        extraNestedDigestAlgorithmChildRejected: after.extraNestedDigestAlgorithmChildRejected,
      };
      console.log("SCA_FORGE_PATCH_ISOLATION=" + JSON.stringify(result));
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}
