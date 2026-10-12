#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  appendAutomaticEvidenceRunEvent,
  assessAutomaticEvidenceRunHealth,
  readAutomaticEvidenceRunHealth,
  RUN_HEALTH_STALE_HOURS,
  RUN_HEALTH_RUNNING_MINUTES,
} from "../lib/product-intelligence/automatic-evidence-run-health-v1.mjs";

const runId="4608b3b4-8b51-4464-b46e-380b05c1a3d7";
const NOW=new Date("2026-10-12T12:00:00Z");
const time=mins=>new Date(NOW.getTime()-mins*60000).toISOString();
function row(event_id,event_kind,mins,run_id=runId){
  return {event_id,event_kind,run_id,recorded_at:time(mins),
    checked_count:1,inserted_count:0,duplicate_count:1,
    exception_count:0,failed_count:0,error_code:null};
}
assert.equal(RUN_HEALTH_STALE_HOURS,36);
assert.equal(RUN_HEALTH_RUNNING_MINUTES,20);
assert.equal(assessAutomaticEvidenceRunHealth([],NOW).state,"unobserved");
assert.equal(assessAutomaticEvidenceRunHealth([],NOW).warning,true);
assert.equal(assessAutomaticEvidenceRunHealth([row(1,"started",5)],NOW).state,"running");
assert.equal(assessAutomaticEvidenceRunHealth([row(1,"started",21)],NOW).state,"interrupted");
assert.equal(assessAutomaticEvidenceRunHealth([row(1,"started",-3)],NOW).state,"clock_error");
assert.equal(assessAutomaticEvidenceRunHealth([
  row(1,"started",10),row(2,"success",9)
],NOW).state,"healthy");
assert.equal(assessAutomaticEvidenceRunHealth([
  row(1,"started",10),{...row(2,"failure",9),failed_count:1,error_code:"AUTO_EVIDENCE_EVALUATION_FAILED"}
],NOW).state,"failed");
assert.equal(assessAutomaticEvidenceRunHealth([
  row(1,"started",60*37),row(2,"success",60*37)
],NOW).state,"stale");
const second="0b5963bb-67d6-4738-a620-32ec86c1e3d0";
assert.equal(assessAutomaticEvidenceRunHealth([
  row(1,"started",100),row(2,"success",99),row(3,"started",30,second)
],NOW).state,"interrupted");
assert.equal(assessAutomaticEvidenceRunHealth([
  row(1,"started",100),row(2,"success",99),row(3,"started",3,second)
],NOW).state,"running");
assert.equal(assessAutomaticEvidenceRunHealth([
  row(1,"started",99),row(2,"success",98),
  row(3,"started",3,second),row(4,"success",2,second)
],NOW).state,"healthy");
assert.throws(()=>assessAutomaticEvidenceRunHealth([{event_id:1,event_kind:"success",run_id:"bad",recorded_at:time(2)}],NOW),
  /AUTO_EVIDENCE_RUN_INVALID_HISTORY/);

const events=[];
const writer={
  from(table){
    assert.equal(table,"automatic_product_evidence_run_events_v1");
    return {
      async insert(payload){events.push(payload);return {error:null};},
      select(columns){assert.ok(columns.includes("event_id"));return this;},
      order(key,opt){assert.equal(key,"event_id");assert.equal(opt.ascending,false);return this;},
      async limit(count){assert.equal(count,100);return {data:[row(1,"started",5)],error:null};},
    };
  },
};
await appendAutomaticEvidenceRunEvent(writer,runId,"started");
await appendAutomaticEvidenceRunEvent(writer,runId,"success",{
  checked:1,recorded:0,duplicates:1,needsReview:0,failed:0
});
await appendAutomaticEvidenceRunEvent(writer,runId,"failure",{
  checked:1,recorded:1,duplicates:0,needsReview:0,failed:1,
  errorCode:"AUTO_EVIDENCE_EVALUATION_FAILED"
});
assert.deepEqual(events.map(e=>e.event_kind),["started","success","failure"]);
assert.equal(events[0].contract_version,"automatic-evidence-run-health-v1");
assert.equal(events[2].inserted_count,1);
assert.equal(events[2].failed_count,1);
assert.equal((await readAutomaticEvidenceRunHealth(writer,NOW)).state,"running");
await assert.rejects(()=>appendAutomaticEvidenceRunEvent(writer,"invalid","started"),
  /AUTO_EVIDENCE_RUN_INVALID_INPUT/);
await assert.rejects(()=>appendAutomaticEvidenceRunEvent(writer,runId,"success",{
  checked:1,recorded:0,duplicates:0,needsReview:0,failed:0
}),/AUTO_EVIDENCE_RUN_INVALID_SUCCESS/);
const failing={
  from(){return {async insert(){return {error:{code:"42501"}};}};}
};
await assert.rejects(()=>appendAutomaticEvidenceRunEvent(failing,runId,"started"),
  /AUTO_EVIDENCE_RUN_WRITE_FAILED/);
const noRead={
  from(){return {select(){return this;},order(){return this;},
    async limit(){return {data:null,error:{code:"42501"}};}};}
};
await assert.rejects(()=>readAutomaticEvidenceRunHealth(noRead,NOW),
  /AUTO_EVIDENCE_RUN_READ_FAILED/);

const cron=fs.readFileSync("app/api/internal/automatic-evidence-daily/route.js","utf8");
const admin=fs.readFileSync("app/admin/products/automatic-evidence/page.js","utf8");
assert.match(cron,/authorized\(request\)/);
assert.match(cron,/BEJEWELY_AUTO_EVIDENCE_DAILY_ENABLED/);
assert.match(cron,/randomUUID\(\)/);
assert.match(cron,/appendAutomaticEvidenceRunEvent\(client,runId,"started"\)/);
assert.match(cron,/appendAutomaticEvidenceRunEvent\(client,runId,"success",result\)/);
assert.match(cron,/appendAutomaticEvidenceRunEvent\(client,runId,"failure"/);
assert.match(cron,/run_audit_unavailable/);
assert.match(admin,/requireAdminCapability\(ADMIN_CAPABILITIES.PRODUCTS_REVIEW\)/);
assert.match(admin,/readAutomaticEvidenceRunHealth\(client\)/);
assert.match(admin,/실행 기록 없음/);
assert.match(admin,/마지막 정상 실행 36시간 경과/);
assert.match(admin,/시작 후 20분 동안 완료 없음/);
assert.doesNotMatch(admin,/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
console.log("AUTOMATIC_EVIDENCE_RUN_HEALTH_NODE_PASS");
