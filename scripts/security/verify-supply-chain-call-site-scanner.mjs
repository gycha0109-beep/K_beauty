import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanPackageTree } from "./supply-chain-call-site-scanner.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "bejewely-sca-call-site-"));
try {
  const fixture = path.join(root, "some-package");
  fs.mkdirSync(path.join(fixture, "dist"), { recursive: true });
  fs.writeFileSync(
    path.join(fixture, "dist", "test.js"),
    [
      'import { pki } from "node-forge";',
      "const isValid = certificate.publicKey.verify(bytes, signature);",
      'const micromatch = require("micromatch");',
      "micromatch.braces(pattern);",
      'const braces = require("braces");',
      "braces.parse(pattern);",
      "signBufferRSASHA256AndVerify(key, cert, buffer);",
    ].join("\n"),
  );
  fs.mkdirSync(path.join(fixture, "__tests__"));
  fs.writeFileSync(path.join(fixture, "__tests__", "not-source.js"), 'require("node-forge")');
  const report = scanPackageTree(fixture, "fixture");
  assert.equal(report.exists, true);
  assert.equal(report.scanned, 1);
  assert.equal(report.incomplete, false);
  assert.deepEqual(report.markerCounts, {
    "node-forge-import": 1,
    "node-forge-verify-method": 1,
    "micromatch-import": 1,
    "explicit-brace-ast-api": 2,
    "braces-import": 1,
    "expo-signature-verify-function": 1,
  });
  assert.ok(report.matches.every((m) => m.file === "dist/test.js" && m.line >= 1));
  assert.match(report.assertion, /NOT_EXPLOITABILITY_OR_REMEDIATION/);
  const missing = scanPackageTree(path.join(root, "not-installed"), "missing");
  assert.equal(missing.exists, false);
  assert.equal(missing.scanned, 0);
  assert.deepEqual(missing.matches, []);
  fs.writeFileSync(path.join(fixture, "dist", "too-large.js"), "x".repeat(262145));
  const bounded = scanPackageTree(fixture, "bounded");
  assert.equal(bounded.incomplete, true);
  assert.equal(bounded.skippedOversize, 1);
  console.log("SUPPLY_CHAIN_CALL_SITE_SCANNER_TEST=PASS cases=5 observational-only");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
