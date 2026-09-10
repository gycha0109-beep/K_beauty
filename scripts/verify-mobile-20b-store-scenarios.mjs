import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const assert = (condition, label) => {
  if (!condition) {
    console.error(`MOBILE_20B_STORE_SCENARIOS=FAIL ${label}`);
    process.exit(1);
  }
};

const route = read("apps/mobile/app/store-capture.tsx");
const fixtures = read("apps/mobile/features/store-capture/store-capture-fixtures.ts");
const capture = read("scripts/capture-mobile-store-scenarios.sh");
const workflow = read(".github/workflows/mobile-20a-store-capture.yml");

assert(route.includes('process.env.EXPO_PUBLIC_STORE_CAPTURE_MODE === "1"'), "dev-switch-present");
assert(route.includes("__DEV__ === true"), "dev-build-only");
assert(route.includes("NativeAnalyzeResultView"), "real-result-component");
assert(route.includes("NativeMyDiaryView"), "real-diary-component");
for (const scenario of ["results-en", "diary-en", "results-ko", "diary-ko"]) {
  assert(route.includes(`\"${scenario}\"`), `route-scenario:${scenario}`);
}

assert(fixtures.includes('STORE_CAPTURE_FIXTURE_VERSION = "mobile-20b-v1"'), "fixture-version");
assert(fixtures.includes('source: "deterministic-store-capture"'), "deterministic-result-source");
assert(!fixtures.includes("accuracy"), "no-fake-accuracy-field");
assert(!fixtures.includes("confidence"), "no-fake-confidence-field");

assert(capture.includes("EXPO_PUBLIC_STORE_CAPTURE_MODE=1"), "capture-mode-enabled-only-in-scenario-metro");
assert(capture.includes('local uri="bejewely://store-capture?scenario=$scenario"'), "runtime-deep-link-route");
assert(capture.includes('-n "$PACKAGE_ID/.MainActivity"'), "explicit-runtime-activity");
assert(capture.includes("adb shell wm size 1080x1920"), "target-viewport");
assert(capture.includes("if (width, height) != (1080, 1920)"), "png-dimension-guard");
assert(!capture.includes("EXPO_PUBLIC_API_BASE_URL"), "no-api-base-injection");
assert(!capture.includes("curl "), "no-curl-network-call");
assert(!capture.includes("wget "), "no-wget-network-call");

for (const marker of [
  'open_store_scenario "results-en" "Your skin routine, made clear" "03-results-en-1080x1920.png"',
  'open_store_scenario "diary-en" "Active skin profile" "04-diary-en-1080x1920.png"',
  'open_store_scenario "results-ko" "내 피부에 맞는 루틴을 한눈에" "03-results-ko-1080x1920.png"',
  'open_store_scenario "diary-ko" "현재 피부 프로필" "04-diary-ko-1080x1920.png"',
  "MOBILE_20B_RESULTS_CAPTURE=PASS",
  "MOBILE_20B_DIARY_CAPTURE=PASS",
  "MOBILE_20B_STORE_SCENARIOS=PASS"
]) {
  assert(capture.includes(marker), `capture-marker:${marker}`);
}

assert(workflow.includes("node scripts/verify-mobile-20b-store-scenarios.mjs"), "workflow-verifier");
assert(workflow.includes("bash scripts/capture-mobile-store-scenarios.sh"), "workflow-runtime-capture");
assert(workflow.includes("apps/mobile/.mobile-store-artifacts/**"), "workflow-artifact-upload");

console.log("MOBILE_20B_DEV_ONLY_ROUTE=PASS");
console.log("MOBILE_20B_REAL_RUNTIME_COMPONENTS=PASS");
console.log("MOBILE_20B_DETERMINISTIC_FIXTURES=PASS");
console.log("MOBILE_20B_RESULTS_DIARY_CAPTURE=PASS");
console.log("MOBILE_20B_STORE_SCENARIOS=PASS");
