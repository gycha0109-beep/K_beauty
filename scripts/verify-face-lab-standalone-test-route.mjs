import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const client = readFileSync(
  "app/face-lab-test/FaceLabTestClient.jsx",
  "utf8"
);
const page = readFileSync(
  "app/face-lab-test/page.js",
  "utf8"
);
const layout = readFileSync(
  "app/face-lab-test/layout.js",
  "utf8"
);
const analysisRoute = readFileSync(
  "app/api/face-reading-test/route.js",
  "utf8"
);

for (const required of [
  'fetch("/api/face-reading-test"',
  "getFaceLabObservationAnalysis",
  "buildPremiumFaceLabSummary",
  "<PremiumFaceLabSection",
  "savedReportId={null}",
  'resultKey={resultKey}',
  'payload?.failureReason === "vision_request_failed"',
  '"Face Lab 분석 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."',
  "FACE_LAB_PRODUCTION_DAILY_LIMIT",
  "일반 Face Lab 이용 횟수",
  "별도 개발 한도"
]) {
  assert.ok(client.includes(required), "standalone test client missing: " + required);
}

for (const forbidden of [
  "/api/full-report",
  "/api/premium/face-lab-v2",
  "payment_required",
  "premium_unavailable",
  "savedReportId:"
]) {
  assert.equal(
    client.includes(forbidden),
    false,
    "temporary Face Lab test route must not depend on premium access/persistence: " + forbidden
  );
}

assert.ok(
  page.includes('import FaceLabTestClient from "./FaceLabTestClient"')
);
assert.ok(layout.includes("index: false"));
assert.ok(layout.includes("follow: false"));
assert.ok(layout.includes("nocache: true"));
assert.ok(analysisRoute.includes('guardEndpoint: "face-reading-test"'));
assert.equal(analysisRoute.includes('guardEndpoint: "face-reading"'), false);

console.log(JSON.stringify({
  ok: true,
  route: "/face-lab-test",
  analysisEndpoint: "/api/face-reading-test",
  premiumAccessDependency: false,
  premiumPersistence: false,
  productionQuotaConsumed: false,
  noindex: true
}, null, 2));
