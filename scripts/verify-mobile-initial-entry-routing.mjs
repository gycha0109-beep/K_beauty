import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const homePath = path.join(root, "apps/mobile/app/index.tsx");
const cameraPath = path.join(root, "apps/mobile/features/camera/NativeFaceCamera.tsx");
const myPath = path.join(root, "apps/mobile/lib/my.ts");
const smokePath = path.join(root, "scripts/verify-mobile-android-smoke.sh");

function fail(message) {
  console.error(`MOBILE_INITIAL_ENTRY_ROUTING=FAIL ${message}`);
  process.exit(1);
}

function requireText(source, token, label) {
  if (!source.includes(token)) fail(`${label}:missing:${token}`);
}

function forbidText(source, token, label) {
  if (source.includes(token)) fail(`${label}:forbidden:${token}`);
}

for (const file of [homePath, cameraPath, myPath, smokePath]) {
  if (!fs.existsSync(file)) fail(`missing-file:${path.relative(root, file)}`);
}

const home = fs.readFileSync(homePath, "utf8");
const camera = fs.readFileSync(cameraPath, "utf8");
const my = fs.readFileSync(myPath, "utf8");
const smoke = fs.readFileSync(smokePath, "utf8");

requireText(home, 'import { getNativeSession } from "../lib/auth";', "session-authority");
requireText(home, 'import { fetchNativeMyDashboard } from "../lib/my";', "dashboard-authority");
requireText(home, "let initialEntryResolvedForRuntime = false;", "cold-start-only-gate");
requireText(home, "const session = await getNativeSession();", "session-read");
requireText(home, "const dashboard = await fetchNativeMyDashboard(session);", "dashboard-read");
requireText(home, "return Boolean(dashboard.latestSavedReport?.id);", "saved-report-positive-gate");
requireText(home, 'router.replace("/analyze");', "first-use-analyze-route");
requireText(home, 'testID="mobile-initial-entry-gate"', "no-home-flash-gate");
requireText(home, "initialEntryResolvedForRuntime = true;", "same-runtime-home-access");
requireText(
  home,
  '__DEV__ === true && process.env.EXPO_PUBLIC_STORE_CAPTURE_MODE === "1";',
  "store-capture-dev-only-home-bypass"
);
requireText(
  home,
  "initialEntryResolvedForRuntime || storeCaptureInitialHomeBypass",
  "store-capture-initial-home-render"
);
requireText(home, "if (storeCaptureInitialHomeBypass) {", "store-capture-bypass-branch");
if ((home.match(/EXPO_PUBLIC_STORE_CAPTURE_MODE/g) ?? []).length !== 1) {
  fail("store-capture-mode-must-have-one-dev-only-authority");
}

forbidText(home, "AsyncStorage", "no-local-report-authority");
forbidText(home, "localStorage", "no-web-storage-authority");
forbidText(home, "dashboard.hasProfile", "report-not-profile-gate");
forbidText(home, "dashboard.todayCheckin", "report-not-checkin-gate");
forbidText(home, "latestSavedReport !== null", "missing-field-must-not-count-as-report");

requireText(my, "latestSavedReport: NativeSavedReport | null;", "dashboard-report-contract");
requireText(my, "export async function fetchNativeMyDashboard", "dashboard-fetch-contract");

// Analyze already opens its full-screen camera surface on focus. The initial
// redirect therefore lands directly in the camera-first flow rather than a
// second marketing/landing step.
requireText(camera, "const [isFullscreenOpen, setIsFullscreenOpen] = useState(true);", "camera-default-open");
requireText(camera, "setIsFullscreenOpen(true);", "camera-focus-open");

// The physical Android smoke must prove the guest/no-report cold start and
// also prove that the one-time gate does not permanently disable Home.
requireText(smoke, 'wait_for_text "SKIN ANALYSIS"', "android-cold-start-analyze");
requireText(smoke, 'wait_for_text "Camera ready"', "android-cold-start-camera");
requireText(smoke, "MOBILE_ANDROID_INITIAL_ENTRY_ANALYZE=PASS", "android-cold-start-evidence");
requireText(smoke, "MOBILE_ANDROID_SAME_RUNTIME_HOME_ACCESS=PASS", "android-home-reentry-evidence");
forbidText(smoke, 'wait_for_text "Find what fits your skin today"\nadb exec-out screencap -p > "$ARTIFACT_DIR/home-light-en.png"\n\ntap_text "Analyze"', "stale-home-first-smoke");

console.log("MOBILE_INITIAL_ENTRY_ROUTING=PASS");
