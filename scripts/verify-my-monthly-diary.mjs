#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  addDiaryMonths,
  buildDiaryCalendar,
  getDiaryMonthRange,
  isValidDiaryMonth
} from "../lib/my/diary-month.js";
import { getMyCopy } from "../lib/my/i18n.js";

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

assert.equal(isValidDiaryMonth("2026-08"), true);
assert.equal(isValidDiaryMonth("2026-13"), false);
assert.equal(isValidDiaryMonth("2026-8"), false);
assert.equal(isValidDiaryMonth("not-a-month"), false);

assert.deepEqual(getDiaryMonthRange("2026-08", { localDate: "2026-08-24" }), {
  month: "2026-08",
  startDate: "2026-08-01",
  endDate: "2026-08-24",
  isFutureMonth: false
});
assert.deepEqual(getDiaryMonthRange("2026-07", { localDate: "2026-08-24" }), {
  month: "2026-07",
  startDate: "2026-07-01",
  endDate: "2026-07-31",
  isFutureMonth: false
});
assert.deepEqual(getDiaryMonthRange("2026-09", { localDate: "2026-08-24" }), {
  month: "2026-09",
  startDate: "2026-09-01",
  endDate: null,
  isFutureMonth: true
});
assert.equal(addDiaryMonths("2026-01", -1), "2025-12");
assert.equal(addDiaryMonths("2026-12", 1), "2027-01");

const oldSameMonthEntry = { id: "older", checkin_date: "2026-08-02" };
const recentSameMonthEntry = { id: "recent", checkin_date: "2026-08-18" };
const augustCalendar = buildDiaryCalendar(
  [recentSameMonthEntry, oldSameMonthEntry, { id: "outside", checkin_date: "2026-07-31" }],
  "2026-08"
);
assert.equal(augustCalendar.find((cell) => cell.key === "2026-08-02")?.entry?.id, "older");
assert.equal(augustCalendar.find((cell) => cell.key === "2026-08-18")?.entry?.id, "recent");
assert.equal(augustCalendar.some((cell) => cell.entry?.id === "outside"), false);

const emptyJulyCalendar = buildDiaryCalendar([], "2026-07");
assert.ok(emptyJulyCalendar.length >= 31, "empty month must still render calendar cells");
assert.equal(emptyJulyCalendar.some((cell) => cell.entry), false);

const ko = getMyCopy("ko");
const en = getMyCopy("en");
assert.equal(ko.diary.currentMonth, "이번 달");
assert.equal(en.diary.currentMonth, "This month");
assert.match(ko.diary.body, /선택한 달/);
assert.match(en.diary.body, /selected month/i);

const [dashboardSource, routeSource, dashboardUiSource, calendarUiSource] = await Promise.all([
  read("lib/my/dashboard.js"),
  read("app/api/my/dashboard/route.js"),
  read("components/my/MyDashboard.jsx"),
  read("components/my/SkinDiaryCalendar.jsx")
]);

const trendStart = dashboardSource.indexOf("const recentTrendCheckins");
const monthlyStart = dashboardSource.indexOf("const monthlyDiaryCheckins");
const routineStart = dashboardSource.indexOf("const todayRoutine");
assert.ok(trendStart >= 0 && monthlyStart > trendStart && routineStart > monthlyStart);
const trendQuerySource = dashboardSource.slice(trendStart, monthlyStart);
const monthlyQuerySource = dashboardSource.slice(monthlyStart, routineStart);

assert.match(trendQuerySource, /\.eq\("user_id", user\.id\)/);
assert.match(trendQuerySource, /\.gte\("checkin_date", recentStartDate\)/);
assert.match(trendQuerySource, /\.limit\(7\)/);
assert.match(monthlyQuerySource, /\.eq\("user_id", user\.id\)/);
assert.match(monthlyQuerySource, /diaryMonthRange\.startDate/);
assert.match(monthlyQuerySource, /diaryMonthRange\.endDate/);
assert.match(monthlyQuerySource, /\.limit\(31\)/);
assert.match(dashboardSource, /recentTrendCheckins:/);
assert.match(dashboardSource, /monthlyDiaryCheckins:/);

assert.match(routeSource, /searchParams\.get\("diaryMonth"\)/);
assert.match(routeSource, /invalid_diary_month/);
assert.match(routeSource, /status: 400/);

assert.match(dashboardUiSource, /const trendCheckins = recentTrendCheckins \|\| recentCheckins \|\| \[\]/);
assert.match(dashboardUiSource, /<SkinTrendPreview checkins=\{trendCheckins\}/);
assert.match(dashboardUiSource, /checkins=\{monthlyDiaryCheckins\}/);
assert.match(dashboardUiSource, /diaryMonth/);
assert.match(dashboardUiSource, /handleDiaryMonthChange/);

assert.match(calendarUiSource, /onMonthChange\?\.\(previousMonth\)/);
assert.match(calendarUiSource, /onMonthChange\?\.\(nextMonth\)/);
assert.match(calendarUiSource, /disabled=\{loading \|\| !canGoNext\}/);
assert.match(calendarUiSource, /min-w-0/);
assert.match(calendarUiSource, /overflow-hidden/);

console.log("MY MONTHLY DIARY VERIFIER: PASS");
