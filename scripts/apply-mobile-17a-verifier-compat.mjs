import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

function replaceExact(path, from, to, expected = 1) {
  const source = readFileSync(path, "utf8");
  const count = source.split(from).length - 1;
  assert.equal(count, expected, `${path}: expected ${expected} occurrence(s) of ${JSON.stringify(from)}, found ${count}`);
  writeFileSync(path, source.split(from).join(to));
}

const camera = "scripts/verify-mobile-camera-foundation.mjs";
replaceExact(
  camera,
  'assert.match(copySource, /ANALYZE · MOBILE-5/, "MOBILE-5 copy marker is missing");',
  'assert.match(copySource, /eyebrow:\\s*"SKIN ANALYSIS"/, "Production Analyze copy marker is missing");'
);
replaceExact(
  camera,
  'assert.match(copySource, /로컬 캐시/, "Korean local-only capture disclosure is missing");',
  'assert.match(copySource, /촬영한 사진은 분석을 시작하기 전까지 기기에만 유지됩니다/, "Korean local-only capture disclosure is missing");'
);
replaceExact(
  camera,
  'assert.match(copySource, /local cache/i, "English local-only capture disclosure is missing");',
  'assert.match(copySource, /Your captured photo stays on your device until you choose to start analysis/i, "English local-only capture disclosure is missing");'
);

const guidance = "scripts/verify-mobile-face-guidance.mjs";
replaceExact(
  guidance,
  'assert.match(copySource, /MOBILE-6/, "Analyze copy must identify the active MOBILE-6 slice");',
  'assert.match(copySource, /eyebrow:\\s*"SKIN ANALYSIS"/, "Analyze copy must expose the production skin-analysis marker");'
);
replaceExact(
  guidance,
  'assert.match(copySource, /Guidance samples stay local and are deleted/, "English local-only guidance disclosure is missing");',
  'assert.match(copySource, /Camera-guidance images stay on your device/, "English local-only guidance disclosure is missing");'
);
replaceExact(
  guidance,
  'assert.match(copySource, /가이드용 샘플은 기기 안에서만 판정하고 즉시 삭제/, "Korean local-only guidance disclosure is missing");',
  'assert.match(copySource, /촬영 가이드용 이미지는 기기에만 유지/, "Korean local-only guidance disclosure is missing");'
);

const analyze = "scripts/verify-mobile-analyze-integration.mjs";
replaceExact(
  analyze,
  'assert(screen.includes("Temporary guidance samples are never uploaded."), "guidance-upload-boundary-copy");',
  'assert(screen.includes("Temporary camera-guidance images are not uploaded."), "guidance-upload-boundary-copy");'
);

const premium = "scripts/verify-mobile-premium-entry.mjs";
replaceExact(
  premium,
  'assert(premiumScreen.includes("This mobile slice does not add or change a payment flow."), "payment-boundary-copy");',
  'assert(premiumScreen.includes("Premium access is required to create this report. You can still open saved reports."), "payment-boundary-copy");'
);

console.log("MOBILE_17A_VERIFIER_COMPAT_APPLIED=PASS");
// trigger: workflow now exists on branch
