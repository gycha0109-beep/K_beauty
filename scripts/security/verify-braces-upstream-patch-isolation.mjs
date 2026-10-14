#!/usr/bin/env node
/**
 * SCA-2 isolated upstream-candidate verification (micromatch/braces PR #72).
 *
 * Applies a reviewed, pinned *library-only* patch to an ephemeral package copy.
 * Does not modify real node_modules, root lockfile, npm audit, Expo or CI policy.
 * This does not approve the upstream PR or constitute vulnerability remediation.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const encodedPatchPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "candidates", "braces-pr72-library.patch.b64");
const candidate = {
  source: "micromatch/braces#72",
  upstreamHead: "28d440b5dd449dbf1fe6f3506cf94ecca4d02660",
  scope: "TEMPORARY_LIBRARY_COPY_ONLY",
  status: "NOT_RUN",
  conclusion: "NOT_A_RELEASED_PATCH_OR_CANONICAL_SECURITY_PASS",
};
function normalContract(mod) {
  return {
    compile: mod("a/{b,c}/d"),
    expand: mod.expand("a/{b,c}/d"),
    nestedParentheses: mod("foo/({a,b})"),
  };
}
function depthAccepted(mod) {
  try {
    mod.parse("{".repeat(110) + "a,b" + "}".repeat(110));
    return true;
  } catch {
    return false;
  }
}
function deepAstRejected(mod) {
  let ast = { type: "text", value: "a" };
  for (let i = 0; i < 101; i++) ast = { type: "brace", nodes: [ast] };
  ast = { type: "root", nodes: [ast] };
  try {
    mod.compile(ast);
    return false;
  } catch (error) {
    return error instanceof RangeError && /exceeds max depth/.test(error.message);
  }
}
let installed;
try {
  installed = require.resolve("braces/package.json");
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") throw error;
}
if (!installed) {
  candidate.status = "PACKAGE_NOT_INSTALLED";
  console.log("SCA_BRACES_PATCH_ISOLATION=" + JSON.stringify(candidate));
} else {
  const root = path.dirname(installed);
  const pkg = JSON.parse(fs.readFileSync(installed, "utf8"));
  candidate.installedVersion = pkg.version;
  if (pkg.version !== "3.0.3") {
    candidate.status = "VERSION_MISMATCH_REVIEW_REQUIRED";
    console.log("SCA_BRACES_PATCH_ISOLATION=" + JSON.stringify(candidate));
  } else {
    const original = require("braces");
    const beforeContract = normalContract(original);
    assert.equal(depthAccepted(original), true, "unpatched braces baseline no longer accepts depth=110");
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bejewely-sca-braces-candidate-"));
    try {
      fs.cpSync(root, temp, { recursive: true });
      // Resolve unchanged fill-range/is-number dependencies from npm-ci install.
      // Only a symlink inside the ephemeral directory is created.
      fs.symlinkSync(path.resolve("node_modules"), path.join(temp, "node_modules"), "dir");
      const patchPath = path.join(temp, "reviewed-library.patch");
      const encodedPatch = fs.readFileSync(encodedPatchPath, "utf8").replace(/\s/g, "");
      assert.match(encodedPatch, /^[A-Za-z0-9+/]+=*$/, "invalid pinned base64 patch");
      const patchBytes = Buffer.from(encodedPatch, "base64");
      const gitBlobIdentity = createHash("sha1")
        .update("blob " + patchBytes.length + "\0").update(patchBytes).digest("hex");
      assert.equal(gitBlobIdentity, "b6aa05571a91ec9c6c4bc80ae7c6a26cb5db31af",
        "reviewed upstream braces patch bytes drifted; fail closed");
      fs.writeFileSync(patchPath, patchBytes);
      const run = (args) => spawnSync("git", ["apply", ...args, patchPath], {
        cwd: temp, encoding: "utf8", timeout: 15000,
      });
      const check = run(["--check"]);
      assert.equal(check.status, 0, "pinned upstream patch not applicable: " + (check.stderr || "").slice(0, 800));
      const apply = run([]);
      assert.equal(apply.status, 0, "pinned upstream patch application failed: " + (apply.stderr || "").slice(0, 800));
      const patched = require(temp);
      const afterContract = normalContract(patched);
      assert.deepEqual(afterContract, beforeContract, "normal brace/glob behavior regressed");
      assert.equal(depthAccepted(patched), false, "candidate did not enforce parser depth boundary");
      assert.equal(deepAstRejected(patched), true, "candidate did not enforce compile walker depth boundary");
      assert.throws(
        () => patched.parse("{{a,b},c}", { maxDepth: 1 }),
        /exceeds max depth/,
        "stricter caller depth limit ignored",
      );
      candidate.status = "ISOLATED_CANDIDATE_BEHAVIOR_PASS";
      candidate.verified = {
        normalPatternsPreserved: true,
        parserDepth110Rejected: true,
        recursiveCompileDepth101Rejected: true,
        callerMaxDepthRespected: true,
        installedSourceUnmodified: true,
      };
      console.log("SCA_BRACES_PATCH_ISOLATION=" + JSON.stringify(candidate));
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}
