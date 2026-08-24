#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const [readerSource, routeSource, calendarSource, detailSource, checkinRouteSource] = await Promise.all([
  read("lib/my/diary-day.js"),
  read("app/api/my/diary-day/route.js"),
  read("components/my/SkinDiaryCalendar.jsx"),
  read("components/my/SkinDiaryDayDetail.jsx"),
  read("app/api/my/check-in/route.js")
]);

assert.match(readerSource, /import "server-only"/);
assert.match(readerSource, /isValidLocalDate\(date\)/);
assert.match(readerSource, /invalid_diary_date/);
assert.match(readerSource, /historicalSnapshot: true/);
assert.doesNotMatch(readerSource, /generateDailyRoutine|routine-generator/);
assert.doesNotMatch(routeSource, /generateDailyRoutine|routine-generator/);

const checkinQueryStart = readerSource.indexOf('.from("daily_checkins")');
const routineQueryStart = readerSource.indexOf('.from("routine_logs")');
assert.ok(checkinQueryStart >= 0 && routineQueryStart > checkinQueryStart);
const checkinQuery = readerSource.slice(checkinQueryStart, routineQueryStart);
const routineQuery = readerSource.slice(routineQueryStart);
assert.match(checkinQuery, /\.eq\("user_id", user\.id\)/);
assert.match(checkinQuery, /\.eq\("checkin_date", date\)/);
assert.match(routineQuery, /\.eq\("user_id", user\.id\)/);
assert.match(routineQuery, /\.eq\("routine_date", date\)/);

for (const field of [
  "am_routine",
  "pm_routine",
  "keep_items",
  "reduce_items",
  "avoid_items",
  "warnings",
  "generation_source"
]) {
  assert.match(readerSource, new RegExp(`"${field}"`), `reader must include stored ${field}`);
  assert.match(checkinRouteSource, new RegExp(`${field}: routinePayload\\.${field}`), `check-in must persist ${field}`);
}

assert.match(routeSource, /searchParams\.get\("date"\)/);
assert.match(routeSource, /isValidLocalDate\(date\)/);
assert.match(routeSource, /invalid_diary_date/);
assert.match(routeSource, /status: 400/);
assert.match(routeSource, /createNoStoreHeaders/);

assert.match(calendarSource, /openDayDetail\(entry\.checkin_date\)/);
assert.match(calendarSource, /\/api\/my\/diary-day\?/);
assert.match(calendarSource, /cache: "no-store"/);
assert.match(calendarSource, /<SkinDiaryDayDetail/);
assert.match(calendarSource, /type="button"/);

assert.match(detailSource, /routine\?\.am_routine/);
assert.match(detailSource, /routine\?\.pm_routine/);
assert.match(detailSource, /routine\?\.keep_items/);
assert.match(detailSource, /routine\?\.reduce_items/);
assert.match(detailSource, /routine\?\.avoid_items/);
assert.match(detailSource, /routine\?\.warnings/);
assert.match(detailSource, /checkin\?\.memo/);
assert.match(detailSource, /getSelectedCheckinEventKeys\(checkin\?\.context\)/);
assert.match(detailSource, /현재 규칙으로 다시 계산하지 않습니다/);
assert.match(detailSource, /without recalculating it with current rules/i);
assert.doesNotMatch(detailSource, /TodayRoutineCard|generateDailyRoutine|routine-generator/);
assert.match(detailSource, /role="dialog"/);
assert.match(detailSource, /aria-modal="true"/);
assert.match(detailSource, /max-h-\[88vh\]/);

console.log("MY DIARY DAY DETAIL VERIFIER: PASS");
