import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getTargetFinderRound
} from "../lib/face-lab-v2/target-finder.js";

const premium = readFileSync(
  "components/full-report/PremiumFaceLabSection.jsx",
  "utf8"
);
const resultUi = readFileSync(
  "components/full-report/face-lab/FaceLabV2Result.jsx",
  "utf8"
);
const testClient = readFileSync(
  "app/face-lab-test/FaceLabTestClient.jsx",
  "utf8"
);

const firstRound = getTargetFinderRound(0, "ko");

assert.equal(firstRound.roundId, "natural-vs-sophisticated");
assert.deepEqual(firstRound.candidateA.reference.cues, [
  "결을 그대로 살림",
  "낮은 대비",
  "완벽히 고정하지 않은 마감"
]);
assert.deepEqual(firstRound.candidateB.reference.cues, [
  "매끈하게 정돈된 마감",
  "선명한 한 포인트",
  "대비를 의도적으로 통제"
]);

for (const required of [
  "const goBack = () => {",
  "if (roundIndex > 0)",
  "current.slice(0, -1)",
  "Math.max(0, value - 1)",
  'data-face-lab-finder-back={roundIndex > 0 ? "previous-round" : "previous-stage"}',
  "onClick={goBack}"
]) {
  assert.ok(
    premium.includes(required),
    "Target Finder previous-question behavior missing: " + required
  );
}

assert.ok(
  premium.includes("photoUrl={photoUrl}"),
  "Premium Face Lab must pass the uploaded face into the V2 result"
);

for (const required of [
  'photoUrl = ""',
  'alt={locale === "en" ? "Face Lab analyzed face" : "Face Lab 분석 얼굴"}',
  'className="h-32 w-28 shrink-0',
  "sm:h-40 sm:w-32"
]) {
  assert.ok(
    resultUi.includes(required),
    "Face Lab V2 result face enlargement missing: " + required
  );
}

assert.ok(
  testClient.includes(
    'className="h-28 w-24 shrink-0 rounded-xl border border-zinc-200 object-cover object-center dark:border-zinc-800 sm:h-32 sm:w-28"'
  ),
  "standalone test preview must use the enlarged face thumbnail"
);

console.log(JSON.stringify({
  ok: true,
  fixes: {
    finderBack: "previous_round_before_previous_stage",
    naturalSophisticatedContrast: true,
    resultFaceSize: "112x128_mobile__128x160_sm",
    standalonePreviewSize: "96x112_mobile__112x128_sm"
  }
}, null, 2));
