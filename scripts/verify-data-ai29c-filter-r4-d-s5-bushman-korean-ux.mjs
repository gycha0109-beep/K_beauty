#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BUSHMAN_REVIEW_GUIDE,
  BUSHMAN_REVIEW_VALUE_LABELS,
  BUSHMAN_SOURCE_LABELS,
  bushmanReviewStateLabel,
} from "../lib/admin/bushman-review-korean-guide.mjs";
import {
  BUSHMAN_SEMANTIC_REVIEW_FIELDS,
} from "../lib/admin/bushman-sunscreen-semantic-review-contract.mjs";

const s2 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-d-s2-bushman-web-review-evidence-v1.json","utf8"));
const ui = fs.readFileSync(
  "app/admin/products/bushman-semantic-review/BushmanSemanticReviewWorkbench.js", "utf8");
const page = fs.readFileSync(
  "app/admin/products/bushman-semantic-review/page.js", "utf8");
const route = fs.readFileSync(
  "app/api/admin/products/bushman-semantic-review/confirm/route.js", "utf8");
const korean = /[가-힣]/;

assert.deepEqual(Object.keys(BUSHMAN_REVIEW_GUIDE).sort(),[...BUSHMAN_SEMANTIC_REVIEW_FIELDS].sort());
assert.deepEqual(Object.keys(BUSHMAN_SOURCE_LABELS).sort(),s2.sources.map(x=>x.id).sort());
for(const [name,info] of Object.entries(BUSHMAN_REVIEW_GUIDE)) {
  for(const key of ["label","explanation","instruction"]) {
    assert.ok(typeof info[key]==="string" && info[key].length>=4 && korean.test(info[key]),
      `한국어 설명 누락: ${name} / ${key}`);
  }
}
assert.equal(BUSHMAN_REVIEW_VALUE_LABELS.sunscreen,"선크림");
assert.equal(BUSHMAN_REVIEW_VALUE_LABELS.hybrid,"혼합자차");
for(const state of ["established","reviewed_not_established","not_reviewed","unexpected"]) {
  assert.ok(korean.test(bushmanReviewStateLabel(state)));
}
for(const token of [
  "제품 정보 관리 · 관리자 검토",
  "이번에 확인할 내용",
  "실제로 저장될 검토 결과",
  "이 내용으로 검토 기록",
  "확인에 사용한 자료",
  "판단을 보류할 정보",
  "확인할 수 있는 정보",
  "감사 기록 대조",
  "window.confirm(",
  "fieldName: field.name",
  "requestId:",
  "router.refresh()",
  "workbench.s4?.reviewReady",
  "workbench.s4?.subjectAuthorityReady",
]) assert.ok(ui.includes(token), "필수 사용자 흐름 누락: "+token);
for(const forbidden of [
  "{field.rationale}", "{field.blocker}", "{source.id}",
  "workbench.s4?.blockers.map", "Audit ID:",
  "DATA-AI29C-FILTER-R4-D-S3", "font-mono",
]) assert.ok(!ui.includes(forbidden),"내부 시스템 표현이 화면에 노출될 가능성: "+forbidden);
assert.ok(page.includes("부쉬맨 선크림 · 제품 정보 검토"));
assert.ok(!page.includes("{code}") && !page.includes("BUSHMAN Semantic Review"));
assert.ok(ui.includes("BUSHMAN_SOURCE_LABELS[id]"),"근거 링크의 한국어 명칭이 필요합니다.");
assert.ok(ui.includes('href={source.url}') && ui.includes('rel="noopener noreferrer"'));
assert.ok(ui.includes('field.status === "ready"') && ui.includes("disabled={Boolean(busy)}"));
assert.ok(!ui.includes("Promise.all(fields"),"관리자 일괄 승인은 지원하지 않습니다.");
assert.ok(route.includes("actorUserId: access.userId"),"관리자 신원은 기존 세션을 사용해야 합니다.");
assert.ok(!route.includes("body.actorUserId"),"클라이언트가 관리자 신원을 지정해서는 안 됩니다.");

console.log(JSON.stringify({
  status:"PASS",stage:"R4-D-S5_KOREAN_REVIEW_UX",
  verifiedFieldGuides:BUSHMAN_SEMANTIC_REVIEW_FIELDS.length,
  verifiedSourceNames:s2.sources.length,
  internalCodeLeakChecks:6,
  explicitPerFieldReview:true,
  productionWritePerformed:false,
  authorityContractChanged:false,
},null,2));
