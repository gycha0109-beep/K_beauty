#!/usr/bin/env node
/**
 * Read-only SCA-3 preflight: real Expo code-signing and glob consumers with
 * reviewed, unmerged patch candidates loaded ONLY from ephemeral copies.
 * No production credentials, native build, registry publication or audit bypass.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sourceRoot = path.resolve("node_modules");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bejewely-sca-integration-"));
const targetModules = path.join(tmp, "node_modules");
const evidence = {
  mode: "EPHEMERAL_UPSTREAM_CANDIDATES_ONLY",
  advisoryGate: "CANONICAL_NPM_AUDIT_UNCHANGED",
  expoCodeSigning: "NOT_RUN",
  micromatch: "NOT_RUN",
  fastGlob: "NOT_RUN",
  metroFileMaps: "NOT_RUN",
  chokidar: "NOT_RUN",
};

function installed(name, version) {
  const full = path.join(sourceRoot, ...name.split("/"));
  const p = JSON.parse(fs.readFileSync(path.join(full, "package.json"), "utf8"));
  assert.equal(p.version, version, name + " locked version changed");
  return full;
}
function dest(name) {
  return path.join(targetModules, ...name.split("/"));
}
function copyPackage(name, version, include = null) {
  const src = installed(name, version);
  const out = dest(name);
  fs.mkdirSync(out, { recursive: true });
  for (const entry of include || fs.readdirSync(src)) {
    fs.cpSync(path.join(src, entry), path.join(out, entry), { recursive: true });
  }
  return out;
}
function linkInstalled(name) {
  const to = dest(name);
  if (fs.existsSync(to)) return;
  const original = path.join(sourceRoot, ...name.split("/"));
  assert.ok(fs.existsSync(original), "required dependency not installed: " + name);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.symlinkSync(original, to, "dir");
}
function linkOtherDependencies(name) {
  const json = JSON.parse(fs.readFileSync(path.join(dest(name), "package.json"), "utf8"));
  for (const dependency of Object.keys(json.dependencies || {})) linkInstalled(dependency);
}
function expectLocalRequire(name, consumer) {
  const expected = fs.realpathSync(dest(name));
  const actual = require.resolve(name, { paths: [dest(consumer)] });
  assert.ok(actual.startsWith(expected + path.sep), "unexpected real package resolution: " + name);
}
function patchForge() {
  const root = copyPackage("node-forge", "1.4.0", ["package.json", "lib"]);
  const rsa = path.join(root, "lib", "rsa.js");
  const before = [
    "if(!asn1.validate(obj, digestInfoValidator, capture, errors) ||",
    "            obj.value.length !== 2) {",
  ].join("\n");
  const after = [
    "if(!asn1.validate(obj, digestInfoValidator, capture, errors) ||",
    "            obj.value.length !== 2 ||",
    "            obj.value[0].value.length !==",
    "              (('parameters' in capture) ? 2 : 1)) {",
  ].join("\n");
  const source = fs.readFileSync(rsa, "utf8");
  assert.equal(source.split(before).length - 1, 1, "upstream forge patch anchor drift");
  fs.writeFileSync(rsa, source.replace(before, after));
}
function patchBraces() {
  const root = copyPackage("braces", "3.0.3");
  linkOtherDependencies("braces");
  const encoded = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "candidates", "braces-pr72-library.patch.b64"),
    "utf8",
  ).replace(/\s/g, "");
  assert.match(encoded, /^[A-Za-z0-9+/]+=*$/, "invalid fixed patch");
  const patchFile = path.join(tmp, "reviewed-braces.patch");
  const patchBytes = Buffer.from(encoded, "base64");
  const verifiedBlob = createHash("sha1")
    .update("blob " + patchBytes.length + "\0").update(patchBytes).digest("hex");
  assert.equal(verifiedBlob, "b6aa05571a91ec9c6c4bc80ae7c6a26cb5db31af",
    "braces reviewed upstream diff identity changed");
  fs.writeFileSync(patchFile, patchBytes);
  for (const extra of [["--check"], []]) {
    const proc = spawnSync("git", ["apply", ...extra, patchFile], {
      cwd: root, encoding: "utf8", timeout: 15000,
    });
    assert.equal(proc.status, 0, "braces reviewed hunk application failed: " + (proc.stderr || "").slice(0, 500));
  }
}
function verifyExpoSigning() {
  copyPackage("@expo/code-signing-certificates", "0.0.6", ["package.json", "build"]);
  expectLocalRequire("node-forge", "@expo/code-signing-certificates");
  const signing = require(dest("@expo/code-signing-certificates"));
  const forge = require(dest("node-forge"));
  for (const name of ["generateSelfSignedCodeSigningCertificate",
    "validateSelfSignedCertificate", "signBufferRSASHA256AndVerify",
    "convertCertificateToCertificatePEM", "convertCertificatePEMToCertificate"]) {
    assert.equal(typeof signing[name], "function", "Expo signing API missing: " + name);
  }
  const keyPair = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 65537 });
  const now = Date.now();
  const certificate = signing.generateSelfSignedCodeSigningCertificate({
    keyPair,
    validityNotBefore: new Date(now - 60000),
    validityNotAfter: new Date(now + 600000),
    commonName: "Bejewely isolated signing fixture",
  });
  signing.validateSelfSignedCertificate(certificate, keyPair);
  const pem = signing.convertCertificateToCertificatePEM(certificate);
  const parsed = signing.convertCertificatePEMToCertificate(pem);
  signing.validateSelfSignedCertificate(parsed, keyPair);
  const signature = signing.signBufferRSASHA256AndVerify(
    keyPair.privateKey, parsed, Buffer.from("isolated-expo-manifest"),
  );
  assert.ok(typeof signature === "string" && signature.length > 0);
  evidence.expoCodeSigning = "PASS_SELF_SIGNED_CERT_PEM_VALIDATION_MANIFEST_SIGNATURE";
}
function verifyGlobConsumers() {
  copyPackage("micromatch", "4.0.8");
  linkOtherDependencies("micromatch");
  expectLocalRequire("braces", "micromatch");
  const mm = require(dest("micromatch"));
  const globbed = mm(["src/a.js", "src/b.ts", "test/c.js"], ["**/*.js", "!test/**"]);
  assert.deepEqual(globbed, ["src/a.js"]);
  assert.equal(mm.isMatch("src/a.js", "**/*.js"), true);
  assert.deepEqual(mm.braces("src/{a,b}.js", { expand: true }), ["src/a.js", "src/b.js"]);
  evidence.micromatch = "PASS_MATCH_NEGATE_BRACE_EXPANSION";

  copyPackage("fast-glob", "3.3.3");
  linkOtherDependencies("fast-glob");
  // npm ci nests glob-parent@5 within fast-glob, while is-glob is hoisted.
  // The copied nested consumer must see that original hoisted dependency.
  linkInstalled("is-glob");
  expectLocalRequire("micromatch", "fast-glob");
  const scratch = path.join(tmp, "glob-fixtures");
  fs.mkdirSync(path.join(scratch, "src"), { recursive: true });
  fs.mkdirSync(path.join(scratch, "test"), { recursive: true });
  for (const file of ["src/a.js", "src/b.ts", "test/c.js"]) {
    fs.writeFileSync(path.join(scratch, file), "export {};\n");
  }
  const fg = require(dest("fast-glob"));
  const files = fg.sync(["**/*.js", "!test/**"], { cwd: scratch, onlyFiles: true });
  assert.deepEqual(files, ["src/a.js"]);
  evidence.fastGlob = "PASS_MATCH_AND_NEGATIVE_GLOB";
}
function verifyRemainingConsumers() {
  // Verify that every installed Metro watcher client resolves to the patched
  // temporary micromatch copy, which in turn resolves to patched braces.
  // Merely loading a watcher is a smoke test, NOT an end-to-end Metro build.
  const consumers = [
    ["@expo/metro-file-map", "57.0.3", "build/watchers/common.js"],
    ["metro-file-map", "0.84.5", "src/watchers/common.js"],
    ["metro-config/node_modules/metro-file-map", "0.84.6", "src/watchers/common.js"],
  ];
  for (const [name, version, modulePath] of consumers) {
    const root = copyPackage(name, version);
    linkOtherDependencies(name);
    expectLocalRequire("micromatch", name);
    const loaded = require(path.join(root, modulePath));
    assert.ok(loaded !== null && (typeof loaded === "object" || typeof loaded === "function"),
      name + " watcher helper failed to load");
  }
  evidence.metroFileMaps = "PASS_THREE_WATCHER_HELPERS_USING_PATCHED_MICROMATCH";

  copyPackage("chokidar", "3.6.0");
  linkOtherDependencies("chokidar");
  expectLocalRequire("braces", "chokidar");
  const watcherLibrary = require(dest("chokidar"));
  assert.equal(typeof watcherLibrary.watch, "function");
  evidence.chokidar = "PASS_INSTALLED_WATCHER_LIBRARY_LOAD_AND_PATCHED_BRACES_RESOLUTION";
}

try {
  fs.mkdirSync(targetModules, { recursive: true });
  patchForge();
  patchBraces();
  verifyExpoSigning();
  verifyGlobConsumers();
  verifyRemainingConsumers();
  assert.equal(evidence.expoCodeSigning.startsWith("PASS"), true);
  assert.equal(evidence.micromatch.startsWith("PASS"), true);
  assert.equal(evidence.fastGlob.startsWith("PASS"), true);
  assert.equal(evidence.metroFileMaps.startsWith("PASS"), true);
  assert.equal(evidence.chokidar.startsWith("PASS"), true);
  console.log("SCA_CANDIDATE_DEPENDENT_INTEGRATION=" + JSON.stringify(evidence));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
