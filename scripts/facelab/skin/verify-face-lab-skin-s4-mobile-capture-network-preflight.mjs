import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Static/synthetic contract: no device frames or images, no Provider/network call.
const camera = readFileSync("apps/mobile/features/camera/NativeFaceCamera.tsx", "utf8");
const guidance = readFileSync("apps/mobile/features/camera/NativeFaceGuidance.ts", "utf8");
const copy = readFileSync("apps/mobile/lib/copy.ts", "utf8");
const analyze = readFileSync("apps/mobile/features/analyze/analyze-client.ts", "utf8");
const screen = readFileSync("apps/mobile/app/analyze.tsx", "utf8");
const env = readFileSync("apps/mobile/lib/env.ts", "utf8");

assert(guidance.includes("NATIVE_FACE_GUIDANCE_SAMPLE_INTERVAL_MS = 1400"));
assert(guidance.includes("NATIVE_FACE_GUIDANCE_STABLE_SAMPLES = 2"));
assert(!camera.includes("setInterval("), "no repeated still-image capture while preview is idle");
assert(!camera.includes("setTimeout("), "no timer-based still-image capture loop");
assert(camera.includes("guidanceRequestRevision === 0"), "guidance must be opt-in");
assert(camera.includes("onPress={checkGuidance}"));
assert(camera.includes('testID="native-face-guidance-check"'));
assert(camera.includes('copy.checkGuidance'));
assert(camera.includes("now - lastGuidanceRequestAtRef.current < NATIVE_FACE_GUIDANCE_SAMPLE_INTERVAL_MS"));
assert(camera.includes("now - lastReadySampleAtRef.current <= 8_000"), "old manual checks cannot become a stable-frame claim");
assert(camera.includes("await pendingGuidance.catch"), "final shutter must not overlap manual face check");
assert(camera.includes("finalCaptureLockRef.current = true"));
assert(camera.includes("onPhotoChange?.(uploadReadyPhoto)"), "final capture/upload handoff preserved");
assert(camera.includes("quality: 0.85"), "final image quality preserved");
assert(camera.includes("shutterSound: false"), "explicit guidance sample must be silent");
assert(copy.includes('checkGuidance: "Check face position (optional)"'));
assert(copy.includes('checkGuidance: "얼굴 위치 확인 (선택)"'));

assert(env.includes('"EXPO_PUBLIC_API_BASE_URL"'), "server is configured through public build env");
assert(analyze.includes("export function isNativeAnalyzeApiConfigured()"));
assert(analyze.includes('"mobile_analyze_build_unconfigured"'), "build failure must be distinguishable from real server outage");
assert(analyze.includes('if (!isNativeAnalyzeApiConfigured())'), "missing config must fail before fetch and photo upload");
assert(analyze.includes('"mobile_analyze_network_failed"'), "real transport failure retains distinct status");
assert(analyze.indexOf('if (!isNativeAnalyzeApiConfigured())') < analyze.indexOf('response = await fetch('));
assert(screen.includes('testID="native-analyze-build-unconfigured"'));
assert(screen.includes('!apiConfigured || !isNativeAnalyzeFormReady(survey)'));
assert(screen.includes('disabled={submitting || !apiConfigured || !isNativeAnalyzeFormReady(survey)}'));
assert(!camera.includes('fetch('), "native camera guidance must not upload frames or call services");
console.log("verify-face-lab-skin-s4-mobile-capture-network-preflight: PASS (static opt-in camera / build-env failure separation only)");
