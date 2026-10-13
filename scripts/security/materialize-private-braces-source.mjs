/**
 * B1 only: materialize source-reviewed braces mitigation from npm-ci installed
 * original bytes into an OS-temp checkout. No publishing, npm override,
 * source dependency mutation, registry permission or security-policy waiver.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = path.join(root, "security/vendor/braces/source-manifest.json");
const hash = (input) => createHash("sha256").update(input).digest("hex");
const blob = (buffer) => createHash("sha1")
  .update("blob " + buffer.length + "\0").update(buffer).digest("hex");

function assertRegularFile(filepath) {
  const info = fs.lstatSync(filepath);
  assert.ok(info.isFile() && !info.isSymbolicLink(),
    "expected a regular source file: " + path.basename(filepath));
}
function inventory(dir, out = {}, prefix = "") {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.posix.join(prefix, ent.name);
    const full = path.join(dir, ent.name);
    assert.ok(!ent.isSymbolicLink(), "symlink in original package: " + rel);
    if (ent.isDirectory()) {
      assert.notEqual(ent.name, "node_modules", "bundled dependency needs separate review");
      inventory(full, out, rel);
    } else {
      assert.ok(ent.isFile(), "unexpected source entry: " + rel);
      assert.ok(fs.statSync(full).size <= 10 * 1024 * 1024,
        "oversized source file: " + rel);
      out[rel] = hash(fs.readFileSync(full));
      assert.ok(Object.keys(out).length <= 1000, "package source file count overflow");
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a],[b]) => a.localeCompare(b)));
}
const git = (cwd, args) => {
  const proc = spawnSync("git", args, {
    cwd, encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024,
  });
  assert.equal(proc.error, undefined, "git patch process failed");
  assert.equal(proc.status, 0, "pinned patch rejected by git");
  return proc.stdout.trim();
};

export function materializePrivateBracesSource(destination) {
  assert.ok(fs.existsSync(destination) && fs.statSync(destination).isDirectory(),
    "existing disposable destination directory required");
  assert.equal(fs.readdirSync(destination).length, 0,
    "destination must be empty; refuse overwrite");
  assert.ok(!fs.lstatSync(destination).isSymbolicLink(),
    "destination symlink refused");

  const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(m.stage, "B1_ISOLATED_SOURCE_CANDIDATE_ONLY");
  assert.equal(m.upstreamPackage, "braces");
  assert.equal(m.originalVersion, "3.0.3");
  assert.equal(m.distributionApproved, false);
  assert.equal(m.vulnerabilityRemediated, false);
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  const installed = lock.packages["node_modules/braces"];
  assert.equal(installed.version, m.originalVersion);
  assert.equal(installed.integrity, m.originalLockIntegritySha512);
  assert.equal(installed.resolved, m.originalRegistryTarball);

  const source = path.join(root, "node_modules/braces");
  const sourcePkg = path.join(source, "package.json");
  assertRegularFile(sourcePkg);
  assert.equal(JSON.parse(fs.readFileSync(sourcePkg, "utf8")).version, m.originalVersion);
  // Refuse symlinked source; patch only the package installed from the
  // original, unchanged npm-ci graph.
  assert.equal(fs.realpathSync(source), path.resolve(source));
  const before = inventory(source);
  fs.cpSync(source, destination, {recursive:true, force:false, errorOnExist:true});
  // Avoid misleading signatures: this is review of installed original source,
  // NOT independently verified registry tarball / publish provenance.
  assert.deepEqual(inventory(destination), before, "copied source bytes changed");

  const patch = path.join(root, m.upstreamPatch.existingPatchPath);
  assertRegularFile(patch);
  const encoded = fs.readFileSync(patch, "utf8").replace(/\s/g, "");
  assert.match(encoded, /^[A-Za-z0-9+/]+=*$/, "invalid reviewed patch encoding");
  const bytes = Buffer.from(encoded, "base64");
  assert.equal(blob(bytes), m.upstreamPatch.reviewedLibraryPatchGitBlobSha1,
    "reviewed upstream source patch blob changed");
  const patchPath = path.join(path.dirname(destination), "reviewed-braces-library.patch");
  fs.writeFileSync(patchPath, bytes);
  const numstat = git(destination, ["apply", "--numstat", patchPath]);
  const expected = [...m.upstreamPatch.expectedChangedFiles].sort();
  const touched = numstat.split("\n").filter(Boolean).map(s=>s.split("\t")[2]).sort();
  assert.deepEqual(touched, expected, "unreviewed library patch files detected");
  git(destination, ["apply", "--check", patchPath]);
  git(destination, ["apply", patchPath]);
  const after = inventory(destination);
  const modified = Object.keys(before).filter(p=>before[p] !== after[p]).sort();
  assert.deepEqual(modified, expected, "patch source changes differ from approved paths");
  assert.deepEqual(Object.keys(after), Object.keys(before),
    "patch introduced or deleted unreviewed source files");
  return {
    mode:"B1_TEMPORARY_SOURCE_ONLY",
    advisory:m.advisory,
    sourceVersion:m.originalVersion,
    upstreamCommit:m.upstreamPatch.headSha,
    originalLockIntegrity:m.originalLockIntegritySha512,
    reviewedPatchGitBlobSha1:blob(bytes),
    reviewedPatchSha256:hash(bytes),
    modifiedFiles:modified,
    modifiedFileSha256:Object.fromEntries(modified.map(p=>[p,after[p]])),
    installedSourceUntouched:Object.entries(before).every(([p,digest]) =>
      hash(fs.readFileSync(path.join(source,p)))===digest),
    releaseArtifact:false,
    independentRegistryTarballAttested:false,
  };
}
