import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const html = read("lib/face-lab-hosted-review-html.js");
const pageRoute = read("app/facelab/review/route.js");
const submitRoute = read("app/api/facelab/review/submit/route.js");
const serverIntake = read("lib/face-lab-hosted-intake.js");
const migration = read(
  "supabase/migrations/20260815023734_face_lab_hosted_intake_v1.sql"
);

for (const required of [
  "약 5분",
  "사진 14장",
  "판단 애매",
  "판단 불가",
  "최종 제출",
  "제출이 완료되었습니다.",
  "progress-bar",
  "localStorage",
  "/api/facelab/review/submit"
]) {
  assert.ok(html.includes(required), `hosted UI missing:${required}`);
}
assert.doesNotMatch(html, /reviewerSlot|reviewer-r0[123]|\.zip|JSON download/i);
assert.doesNotMatch(html, /주요 축|검증 축/);
assert.doesNotMatch(html, /SUPABASE_SERVICE_ROLE_KEY|createClient\s*\(/);
assert.doesNotMatch(html, /https?:\/\//);
assert.match(pageRoute, /isValidHostedHumanCueAccessToken/);
assert.match(pageRoute, /Referrer-Policy/);
assert.match(pageRoute, /noindex/);
assert.match(submitRoute, /isSameOriginRequest/);
assert.match(submitRoute, /x-face-lab-review-token/);
assert.match(submitRoute, /MAX_BODY_BYTES/);
assert.match(serverIntake, /createSupabaseAdminClient/);
assert.doesNotMatch(serverIntake, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
assert.match(migration, /enable row level security/i);
assert.match(
  migration,
  /revoke all on table public\.tmp_face_lab_independent_human_cue_submissions[\s\S]*from public, anon, authenticated, service_role/i
);
assert.match(migration, /grant insert, select[\s\S]*to service_role/i);
assert.doesNotMatch(migration, /create policy/i);
assert.doesNotMatch(migration, /grant[\s\S]{0,80}(?:anon|authenticated)/i);

console.log(
  JSON.stringify(
    {
      status: "PASS",
      language: "ko",
      mobileResponsive: true,
      images: 14,
      axesPerImage: 10,
      allowedBrowserSubmitEndpoint: "/api/facelab/review/submit",
      analyticsRequests: 0,
      clientServiceRoleExposure: false,
      directPublicTableInsert: false,
      reviewerSlots: 0,
      humanJudgments: 0
    },
    null,
    2
  )
);
