import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const source = read("apps/mobile/lib/date-display-i18n.ts");
const diary = read("apps/mobile/features/my/NativeMyDiaryView.tsx");
const shared = read("components/result/SharedResultLoader.jsx");

const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { formatNativeCalendarDate } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

// Reading a saved diary day must not shift that calendar date in any timezone.
assert.equal(formatNativeCalendarDate("2026-10-21", "en"), "Oct 21, 2026");
assert.equal(formatNativeCalendarDate("2026-10-21", "ko"), "2026년 10월 21일");
assert.equal(formatNativeCalendarDate("2026-10", "en", true), "Oct 2026");
assert.equal(formatNativeCalendarDate("2026-10", "ko", true), "2026년 10월");
assert.equal(formatNativeCalendarDate("2024-02-29", "en"), "Feb 29, 2024");
assert.equal(formatNativeCalendarDate("2026-02-29", "en"), "2026-02-29");
assert.equal(formatNativeCalendarDate("custom date", "en"), "custom date");
assert.equal(formatNativeCalendarDate("2026-10-21T01:00:00Z", "en"), "2026-10-21T01:00:00Z");
assert.equal(formatNativeCalendarDate(null, "en"), "");
assert.match(source, /timeZone: "UTC"/);
assert.match(diary, /formatNativeCalendarDate\(checkin\.checkin_date, locale\)/);
assert.match(diary, /formatNativeCalendarDate\(dashboard\.diaryMonth, locale, true\)/);
assert.match(diary, /onDiaryDay\(checkin\.checkin_date\)/);
assert.match(diary, /formatNativeCalendarDate\(report\.created_at\.slice\(0, 10\), locale\)/);
assert.match(shared, /aria-label=\{displayLocale === "en" \? "Display language" : "표시 언어"\}/);
assert.match(shared, /aria-pressed=\{displayLocale === option\}/);

// The home page must pass its actual pathname locale to Google sign-in.
// An implicit AuthNav default silently displayed Korean on /en.
const home = read("app/page.js");
const auth = read("components/auth/AuthNav.jsx");
const login = read("components/auth/LoginButtons.jsx");
assert.match(home, /<AuthNav locale=\{locale\} \/>/);
assert.doesNotMatch(home, /<AuthNav \/>/);
assert.match(auth, /label=\{copy\.signInGoogle\}/);
assert.match(auth, /locale=\{locale\}/);
assert.match(login, /const copy = getCommonCopy\(locale\)\.auth/);
assert.equal(read("lib/ui/i18n.js").includes('signInGoogle: "Sign in with Google"'), true);

// The My KO/EN switch is presentational: no second server render, database
// query, dashboard API refresh, or saved-history remount on language change.
const my = read("components/my/MyDashboard.jsx");
const myMenu = read("components/my/MyDashboardMenu.jsx");
const appMenu = read("components/navigation/AppHamburgerMenu.jsx");
assert.match(my, /const \[displayLocale, setDisplayLocale\] = useState\(locale\)/);
assert.match(my, /window\.history\.pushState\(null, "", targetPath\)/);
assert.match(my, /setDisplayLocale\(nextLocale\)/);
assert.match(my, /<MyDashboardMenu locale=\{displayLocale\} onLocaleChange=\{handleLocaleChange\} \/>/);
assert.match(my, /getReportHref\(latestSharePath, displayLocale\)/);
assert.match(my, /<SavedReportHistory locale=\{displayLocale\} \/>/);
assert.match(myMenu, /event\.preventDefault\(\); onLocaleChange\("en"\)/);
assert.match(myMenu, /event\.preventDefault\(\); onLocaleChange\("ko"\)/);
assert.match(appMenu, /item\.onClick\?\.\(event\)/);
assert.equal((my.match(/refreshDashboard\(\);/g) || []).length, 1,
  "date-context dashboard reconciliation must only run on mount");
const history = read("components/my/SavedReportHistory.jsx");
assert.match(history, /void loadInitialHistory\(\);[\s\S]*?\}, \[\]\);/);
const documentLocale = read("components/i18n/DocumentLocaleSync.jsx");
assert.match(documentLocale, /resolveDocumentLocale\(pathname\)/);

console.log("I18N_KO_EN_M4_DISPLAY=PASS");
