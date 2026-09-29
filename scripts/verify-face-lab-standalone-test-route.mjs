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

for (const required of [
  'fetch("/api/face-reading"',
  "getFaceLabObservationAnalysis",
  "buildPremiumFaceLabSummary",
  "<PremiumFaceLabSection",
  "savedReportId={null}",
  'resultKey={resultKey}'
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

console.log(JSON.stringify({
  ok: true,
  route: "/face-lab-test",
  analysisEndpoint: "/api/face-reading",
  premiumAccessDependency: false,
  premiumPersistence: false,
  noindex: true
}, null, 2));
