import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { applyScreensPatch, normalizedHash, screensPatchRoot } from "./apply-mobile-screens-android-compat.mjs";

const contract = JSON.parse(readFileSync(join(screensPatchRoot, "manifest.json")));
function fixture(t) {
  const repoRoot = mkdtempSync(join(tmpdir(), "bejewely-screens-"));
  t.after(() => rmSync(repoRoot, { recursive: true, force: true }));
  const packageRoot = join(repoRoot, "node_modules/react-native-screens");
  cpSync(join(screensPatchRoot, "fixtures"), packageRoot, { recursive: true });
  mkdirSync(join(repoRoot, "apps/mobile"), { recursive: true });
  writeFileSync(join(repoRoot, "apps/mobile/package.json"), '{}');
  writeFileSync(join(packageRoot, "package.json"), JSON.stringify({ name: contract.package, version: contract.version }));
  const snapshot = () => contract.rows.map((row) => readFileSync(join(packageRoot, row.local)));
  return { repoRoot, packageRoot, snapshot };
}

test("exact upstream backport applies and repeat is idempotent, including CRLF input", (t) => {
  const f = fixture(t);
  for (const row of contract.rows) {
    const path = join(f.packageRoot, row.local);
    writeFileSync(path, readFileSync(path, "utf8").replace(/\r?\n/g, "\r\n"));
  }
  assert.equal(applyScreensPatch(f).state, "applied");
  for (const row of contract.rows) assert.equal(normalizedHash(readFileSync(join(f.packageRoot, row.local))), row.afterSha256);
  const patched = f.snapshot();
  assert.equal(applyScreensPatch(f).state, "already-applied");
  assert.deepEqual(f.snapshot(), patched);
});

for (const scenario of ["version", "source", "mixed", "replacement", "escape", "duplicate"]) {
  test(`${scenario} drift fails before any installed source is written`, (t) => {
    const f = fixture(t);
    const options = { ...f };
    if (scenario === "version") writeFileSync(join(f.packageRoot, "package.json"), JSON.stringify({ name: contract.package, version: "4.28.0" }));
    if (scenario === "source") writeFileSync(join(f.packageRoot, contract.rows[0].local), "unknown source");
    if (scenario === "mixed") cpSync(join(screensPatchRoot, contract.rows[0].local), join(f.packageRoot, contract.rows[0].local));
    if (["replacement", "escape", "duplicate"].includes(scenario)) {
      options.patchRoot = join(f.repoRoot, "patch");
      cpSync(screensPatchRoot, options.patchRoot, { recursive: true });
      if (scenario === "replacement") writeFileSync(join(options.patchRoot, contract.rows[3].local), "tampered replacement");
      else {
        const altered = structuredClone(contract);
        altered.rows[3].local = scenario === "escape" ? "../outside.cpp" : altered.rows[0].local;
        writeFileSync(join(options.patchRoot, "manifest.json"), JSON.stringify(altered));
      }
    }
    const original = f.snapshot();
    assert.throws(() => applyScreensPatch(options));
    assert.deepEqual(f.snapshot(), original);
  });
}

test("write failure after the first atomic replacement rolls back original bytes", (t) => {
  const f = fixture(t), original = f.snapshot();
  let replacements = 0;
  assert.throws(() => applyScreensPatch({ ...f, replaceFile: (from, to) => {
    if (++replacements === 2) throw new Error("simulated filesystem failure");
    renameSync(from, to);
  } }), /simulated filesystem failure/);
  assert.deepEqual(f.snapshot(), original);
});

test("concurrent drift is not overwritten and prior files are restored", (t) => {
  const f = fixture(t), original = f.snapshot();
  let replacements = 0;
  assert.throws(() => applyScreensPatch({ ...f, replaceFile: (from, to) => {
    renameSync(from, to);
    if (++replacements === 1) writeFileSync(join(f.packageRoot, contract.rows[1].local), "external mutation");
  } }), /Installed source changed/);
  assert.deepEqual(readFileSync(join(f.packageRoot, contract.rows[0].local)), original[0]);
  assert.equal(readFileSync(join(f.packageRoot, contract.rows[1].local), "utf8"), "external mutation");
});

for (const scenario of ["healthy", "native-crash", "process-death"]) {
  test(`actual cold-launch shell fails closed for ${scenario}`, (t) => {
    const temp = mkdtempSync(join(tmpdir(), "bejewely-cold-launch-"));
    t.after(() => rmSync(temp, { recursive: true, force: true }));
    const source = readFileSync(new URL("./verify-mobile-android-smoke.sh", import.meta.url), "utf8").replace(/\r\n/g, "\n");
    const start = source.indexOf("for launch in $(seq 1 10); do");
    const end = source.indexOf('printf \'MOBILE_ANDROID_COLD_LAUNCH_REPETITIONS=10', start);
    assert.ok(start > 0 && end > start);
    const shell = `set -euo pipefail
ARTIFACT_DIR="$(pwd)"
PACKAGE_ID="com.bejewely.mobile"
running=1
dead=0
sleep() { :; }
wait_for_text() { if [[ "$SCENARIO" == process-death && "$launch" == 3 ]]; then dead=1; fi; }
adb() {
  case "$*" in
    "shell am force-stop "*) running=0 ;;
    "shell am start "*) running=1 ;;
    "shell pidof "*) if [[ "$running" == 1 && "$dead" == 0 ]]; then echo "90$launch"; fi ;;
    "logcat -b crash -d") if [[ "$SCENARIO" == native-crash && "$launch" == 3 ]]; then echo ">>> com.bejewely.mobile <<<"; fi ;;
    *) echo "Unexpected mock adb call: $*" >&2; return 1 ;;
  esac
}
${source.slice(start, end)}
echo COLD_LOOP_COMPLETE
`;
    const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
    const result = spawnSync(bash, ["-s"], { cwd: temp, input: shell, encoding: "utf8", env: { ...process.env, SCENARIO: scenario } });
    assert.ifError(result.error);
    assert.equal((result.stdout.match(/MOBILE_ANDROID_COLD_LAUNCH=PASS/g) || []).length, scenario === "healthy" ? 10 : 2);
    assert.equal(result.status === 0, scenario === "healthy", result.stderr);
    assert.equal(result.stdout.includes("COLD_LOOP_COMPLETE"), scenario === "healthy");
  });
}
