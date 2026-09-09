import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireText(relativePath, text, label) {
  const content = read(relativePath);
  if (!content.includes(text)) {
    throw new Error(`${label}: missing ${JSON.stringify(text)} in ${relativePath}`);
  }
}

function forbidText(relativePath, text, label) {
  const content = read(relativePath);
  if (content.includes(text)) {
    throw new Error(`${label}: forbidden ${JSON.stringify(text)} in ${relativePath}`);
  }
}

const dashboardRoute = "app/api/my/dashboard/route.js";
const dashboardDomain = "lib/my/dashboard.js";
const checkInRoute = "app/api/my/check-in/route.js";
const diaryDayRoute = "app/api/my/diary-day/route.js";
const diaryDayDomain = "lib/my/diary-day.js";
const routineGenerator = "lib/my/routine-generator.js";
const mobileMyClient = "apps/mobile/lib/my.ts";
const mobileMyScreen = "apps/mobile/app/my.tsx";
const mobileMyDiaryView = "apps/mobile/features/my/NativeMyDiaryView.tsx";

for (const route of [dashboardRoute, checkInRoute, diaryDayRoute]) {
  requireText(route, "resolveRouteSupabaseAuth(request)", `${route} dual-auth resolver`);
}

requireText(dashboardDomain, '"am_routine"', "dashboard AM routine projection");
requireText(dashboardDomain, '"pm_routine"', "dashboard PM routine projection");
requireText(diaryDayRoute, "getMyDiaryDayPayload({ date, authContext })", "diary-day auth injection");
requireText(diaryDayDomain, "async function resolveDiaryDayAuth(authContext)", "diary-day auth adapter");
requireText(diaryDayDomain, "authContext?.supabase && authContext?.user", "diary-day injected auth path");
requireText(diaryDayDomain, "await createServerSupabaseClient()", "diary-day cookie fallback");
requireText(diaryDayDomain, "supabase.auth.getUser()", "diary-day cookie user validation");
requireText(diaryDayDomain, '.eq("user_id", user.id)', "diary-day RLS user binding");

requireText(mobileMyClient, "/api/my/dashboard", "native dashboard reuse");
requireText(mobileMyClient, "/api/my/check-in", "native check-in reuse");
requireText(mobileMyClient, "/api/my/diary-day", "native diary-day reuse");
requireText(mobileMyClient, 'Authorization: `Bearer ${session.access_token}`', "native My Bearer transport");
requireText(mobileMyClient, '"Content-Type": "application/json"', "native check-in JSON transport");
requireText(mobileMyClient, "dryness_level", "native dryness contract");
requireText(mobileMyClient, "oiliness_level", "native oiliness contract");
requireText(mobileMyClient, "redness_level", "native redness contract");
requireText(mobileMyClient, "breakout_level", "native breakout contract");
requireText(mobileMyClient, "irritation_level", "native irritation contract");
requireText(mobileMyClient, "checkinEvents", "native check-in event contract");
requireText(mobileMyClient, "monthlyDiaryCheckins", "native monthly diary contract");
requireText(mobileMyClient, "recentTrendCheckins", "native trend contract");

requireText(mobileMyScreen, "NativeMyDiaryView", "native My shared diary presentation");
requireText(mobileMyScreen, "fetchNativeMyDashboard", "native My dashboard screen");
requireText(mobileMyScreen, "saveNativeCheckin", "native My write screen");
requireText(mobileMyScreen, "fetchNativeDiaryDay", "native historical diary screen");
requireText(mobileMyScreen, 'accessibilityLabel="mobile-checkin-save"', "native check-in accessibility target");
requireText(mobileMyScreen, "dashboard.todayRoutine", "server routine rendering");

requireText(mobileMyDiaryView, "dashboard.recentTrendCheckins", "recent trend rendering");
requireText(mobileMyDiaryView, "dashboard.monthlyDiaryCheckins", "monthly diary rendering");
requireText(mobileMyDiaryView, "dashboard.latestSavedReport", "latest saved report rendering");
requireText(mobileMyDiaryView, "dashboard.latestSkinProfile", "latest skin profile rendering");

requireText(checkInRoute, "generateDailyRoutine", "server routine authority");
requireText(routineGenerator, "export function generateDailyRoutine", "canonical routine generator");

for (const relativePath of [mobileMyClient, mobileMyScreen, mobileMyDiaryView]) {
  forbidText(relativePath, "generateDailyRoutine", "routine authority must remain server-side");
  forbidText(relativePath, "service_role", "native secret boundary");
  forbidText(relativePath, "SUPABASE_SERVICE_ROLE", "native secret boundary");
  forbidText(relativePath, "@/lib/", "native must not import Web/server modules");
  forbidText(relativePath, "recommendation-engine", "native recommendation authority forbidden");
  forbidText(relativePath, "face-lab", "native Face Lab authority forbidden");
  forbidText(relativePath, "premium-generator", "native Premium authority forbidden");
}

console.log("MOBILE_MY_COOKIE_PATH=PASS");
console.log("MOBILE_MY_BEARER_PATH=PASS");
console.log("MOBILE_MY_CHECKIN_WRITE=PASS");
console.log("MOBILE_MY_DIARY_READ=PASS");
console.log("MOBILE_MY_SERVER_ROUTINE_AUTHORITY=PASS");
console.log("MOBILE_MY_NATIVE_AUTHORITY_BOUNDARY=PASS");
console.log("MOBILE_MY_SKIN_DIARY=PASS");
