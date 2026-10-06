import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const source = readFileSync(new URL("./verify-mobile-ios-smoke.sh", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const start = source.indexOf("wait_for_screenshot_contains() {");
const end = source.indexOf("\n}\n", start) + 3;
assert.ok(start > 0 && end > start);

for (const scenario of ["ready", "delayed", "wrong-screen", "process-exited", "process-exited-after-ocr"]) {
  test(`same-process screenshot observer: ${scenario}`, (t) => {
    const temp = mkdtempSync(join(tmpdir(), "bejewely-ios-observer-"));
    t.after(() => rmSync(temp, { recursive: true, force: true }));
    const shell = `set -euo pipefail
APP_PID=12345
UDID=fixture-device
frames=0
dead=0
sleep() { :; }
kill() { [[ "$SCENARIO" != process-exited && "$dead" == 0 ]]; }
xcrun() {
  [[ "$*" == "simctl io fixture-device screenshot "* ]] || return 99
  frames=$((frames + 1))
  printf '%s' "$frames" > "$5"
}
assert_screenshot_contains() {
  [[ "$*" == *"BEJEWELY Find what fits your skin today" ]] || return 99
  if [[ "$SCENARIO" == process-exited-after-ocr ]]; then dead=1; return 0; fi
  [[ "$SCENARIO" == ready || ( "$SCENARIO" == delayed && "$frames" -ge 4 ) ]]
}
${source.slice(start, end)}
wait_for_screenshot_contains "$PWD/home.png" "BEJEWELY" "Find what fits your skin today"
echo OBSERVER_COMPLETE
`;
    const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
    const result = spawnSync(bash, ["-s"], { cwd: temp, input: shell, encoding: "utf8", env: { ...process.env, SCENARIO: scenario } });
    assert.ifError(result.error);
    const success = ["ready", "delayed"].includes(scenario);
    assert.equal(result.status === 0, success, result.stderr);
    assert.equal(result.stdout.includes("OBSERVER_COMPLETE"), success);
    assert.equal(result.stdout.includes("MOBILE_IOS_TRANSITION_OBSERVED=PASS"), success);
    if (success) assert.equal(readFileSync(join(temp, "home.png"), "utf8"), scenario === "ready" ? "1" : "4");
  });
}
