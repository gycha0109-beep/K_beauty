import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const mode = process.argv[2] || "source";
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const fail = (m) => { throw new Error(m); };
const requireText = (text, marker, label) => { if (!text.includes(marker)) fail(`${label}: missing ${marker}`); };
const forbidText = (text, marker, label) => { if (text.includes(marker)) fail(`${label}: forbidden ${marker}`); };

const screens = [
  ["results-en", "03-results-en-1080x1920.png", "03-results-en-window.xml", ["Skin analysis result", "PERSONALIZED SKIN-CARE ROUTINE", "Top pick", "Alternative", "닥터지", "라운드랩", "Home", "Analyze", "My"]],
  ["diary-en", "04-diary-en-1080x1920.png", "04-diary-en-window.xml", ["Signed in", "Active skin profile", "Skin type", "Sensitivity", "Recent 7 days", "Skin diary", "Latest saved report", "Skin Match · Sep 3", "Home", "Analyze", "My"]],
  ["results-ko", "03-results-ko-1080x1920.png", "03-results-ko-window.xml", ["피부 분석 결과", "맞춤 스킨케어 루틴", "요약", "우선 추천", "대안", "닥터지", "라운드랩", "홈", "분석", "마이"]],
  ["diary-ko", "04-diary-ko-1080x1920.png", "04-diary-ko-window.xml", ["로그인 상태", "현재 피부 프로필", "피부 타입", "복합성", "수분 부족, 붉음", "민감도", "보통", "최근 7일", "스킨 다이어리", "오늘은 편안하고 균형 잡힌 피부 상태입니다.", "최근 저장 리포트", "스킨 매치 · 9월 3일", "홈", "분석", "마이"]]
];

const screenForbidden = {
  "results-ko": ['text="Home"', 'text="Analyze"', 'text="My"'],
  "diary-ko": ['text="Home"', 'text="Analyze"', 'text="My"', "combination", "dehydration", "moderate", "Comfortable and balanced", "Slight dryness after cleansing", "Skin Match · Sep 3"]
};

function verifySource() {
  const route = read("apps/mobile/app/store-capture.tsx");
  const layout = read("apps/mobile/app/_layout.tsx");
  const shell = read("apps/mobile/lib/mobile-shell.tsx");
  const my = read("apps/mobile/app/my.tsx");
  const fixture = read("apps/mobile/features/store-capture/store-capture-fixtures.ts");
  const resultView = read("apps/mobile/features/analyze/NativeAnalyzeResult.tsx");
  const diaryView = read("apps/mobile/features/my/NativeMyDiaryView.tsx");
  const captureScript = read("scripts/capture-mobile-20b-store-assets.sh");
  const workflow = read(".github/workflows/mobile-20b-store-capture.yml");
  const verifier = read("scripts/verify-mobile-20b-store-capture.mjs");
  const appJson = read("apps/mobile/app.json");
  requireText(route, "__DEV__ === true && process.env.EXPO_PUBLIC_STORE_CAPTURE_MODE === \"1\"", "route guard");
  requireText(route, "NativeAnalyzeResultView", "production results reuse");
  requireText(route, "NativeMyDiaryView", "production diary reuse");
  requireText(route, "setLocale(locale)", "deterministic capture shell locale");
  requireText(route, "shellLocale !== locale", "capture locale render gate");
  requireText(route, "recentTrendCheckins.slice(0, 2)", "compact diary recent narrative");
  requireText(route, "monthlyDiaryCheckins.slice(0, 1)", "compact diary visible saved report");
  requireText(route, 'skin_type: "복합성"', "localized Korean diary profile");
  requireText(route, 'title: "스킨 매치 · 9월 3일"', "localized Korean saved report");
  requireText(shell, "setLocale: (locale: SupportedLocale) => void", "mobile shell explicit locale setter");
  requireText(layout, '<Tabs.Screen name="store-capture" options={{ href: null, headerShown: false }} />', "hidden store capture chrome");
  requireText(my, "NativeMyDiaryView", "My production presentation reuse");
  requireText(resultView, "Top pick", "results production presentation");
  requireText(diaryView, "Latest saved report", "diary saved report presentation");
  requireText(fixture, "NativeAnalyzeResult", "results fixture contract");
  requireText(fixture, "NativeMyDashboard", "diary fixture contract");
  requireText(fixture, "2026-09-03", "fixed capture date");
  requireText(fixture, "6d560546-80f1-4ccf-9d2c-34023722d2a7", "catalog product authority");
  requireText(fixture, "d7bb44e4-d585-41ca-8a74-04781470d1de", "catalog alternative authority");
  requireText(captureScript, "QUICKSTEP_RECOVERY_LIMIT=2", "bounded Quickstep recovery");
  requireText(captureScript, "Quickstep isn't responding", "Quickstep ANR detection");
  requireText(captureScript, 'tap_text_from_dump "$xml_path" "Close app"', "Quickstep scoped close action");
  requireText(captureScript, "MOBILE_20B_QUICKSTEP_ANR_RECOVERY=PASS", "Quickstep recovery evidence");
  requireText(captureScript, 'launch_scenario "$scenario"', "scenario-preserving recovery restart");
  requireText(workflow, 'ref: ${{ github.event.pull_request.head.sha || github.sha }}', "exact-head checkout");
  requireText(workflow, 'MOBILE_20B_EXPECTED_SHA: ${{ github.event.pull_request.head.sha || github.sha }}', "exact-head verifier binding");
  requireText(verifier, 'execFileSync("git", ["rev-parse", "HEAD"]', "manifest checkout SHA authority");
  requireText(verifier, "process.env.MOBILE_20B_EXPECTED_SHA", "manifest expected SHA assertion");
  forbidText(appJson, "EXPO_PUBLIC_STORE_CAPTURE_MODE", "app.json permanent fixture enablement");
  for (const token of ["access_token", "@gmail", "@naver", "@kakao", "supabase.co", "service_role", "openai_api_key"]) forbidText(fixture.toLowerCase(), token, "fixture secret/PII boundary");
  for (const token of ["fetch(", "getnativesession", "signinnative", "savenativecheckin", "supabase", "openai"]) forbidText(route.toLowerCase(), token, "store route live dependency");
  for (const name of fs.readdirSync(path.join(root, ".github/workflows"))) {
    if (name === "mobile-20b-store-capture.yml") continue;
    forbidText(fs.readFileSync(path.join(root, ".github/workflows", name), "utf8"), "EXPO_PUBLIC_STORE_CAPTURE_MODE", `workflow fixture leakage ${name}`);
  }
  console.log("MOBILE_20B_SOURCE_CONTRACT=PASS");
}

function pngInfo(buffer) {
  if (!buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) fail("invalid PNG signature");
  if (buffer.toString("ascii", 12, 16) !== "IHDR") fail("missing IHDR");
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
  if (!buffer.includes(Buffer.from("IDAT")) || !buffer.includes(Buffer.from("IEND"))) fail("incomplete PNG payload");
  return { width, height };
}

function findBounds(xml, marker) {
  for (const tag of xml.match(/<node\b[^>]*>/g) || []) {
    if (!tag.includes(marker)) continue;
    const match = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!match) continue;
    const box = match.slice(1).map(Number);
    if (box[1] >= 0 && box[3] <= 1920 && box[3] > box[1]) return box;
  }
  return null;
}

function resolveCheckedOutSha() {
  let checkedOutSha = "";
  try {
    checkedOutSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch (error) {
    fail(`unable to resolve checked-out SHA: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!/^[0-9a-f]{40}$/.test(checkedOutSha)) fail(`invalid checked-out SHA: ${checkedOutSha}`);
  const expectedSha = process.env.MOBILE_20B_EXPECTED_SHA;
  if (expectedSha && checkedOutSha !== expectedSha) fail(`checked-out SHA mismatch: expected ${expectedSha}, got ${checkedOutSha}`);
  return checkedOutSha;
}

function verifyArtifact(dirArg) {
  const dir = path.resolve(root, dirArg || "apps/mobile/.mobile-20b-store-artifacts");
  const manifest = { exactSha: resolveCheckedOutSha(), fixtureVersion: "mobile-20b-v1", screens: [] };
  const forbidden = ["Quickstep", "isn't responding", "ANR", "Auth unavailable", "Sign in with Google", "Sign in with Apple", "로그인 필요", "No profile", "프로필 없음", "network error", "analysis failed", "store-capture"];
  for (const [id, file, xmlFile, markers] of screens) {
    const buffer = fs.readFileSync(path.join(dir, file));
    if (buffer.length < 15000) fail(`${file}: suspiciously small image`);
    const { width, height } = pngInfo(buffer);
    if (width !== 1080 || height !== 1920) fail(`${file}: expected 1080x1920, got ${width}x${height}`);
    const xml = fs.readFileSync(path.join(dir, xmlFile), "utf8");
    for (const bad of forbidden) if (xml.toLowerCase().includes(bad.toLowerCase())) fail(`${xmlFile}: forbidden UI marker ${bad}`);
    for (const bad of screenForbidden[id] || []) forbidText(xml, bad, `${xmlFile} locale purity`);
    const markerBounds = {};
    for (const marker of markers) {
      const box = findBounds(xml, marker);
      if (!box) fail(`${xmlFile}: marker not proven in physical viewport: ${marker}`);
      markerBounds[marker] = box;
    }
    manifest.screens.push({ id, file, width, height, sha256: crypto.createHash("sha256").update(buffer).digest("hex"), requiredMarkers: markers, markerBounds, technicalPass: true });
  }
  fs.writeFileSync(path.join(dir, "capture-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`MOBILE_20B_ARTIFACT_SHA=${manifest.exactSha}`);
  console.log("MOBILE_20B_ARTIFACT_CONTRACT=PASS");
}

if (mode === "source") verifySource();
else if (mode === "artifact") verifyArtifact(process.argv[3]);
else fail(`unknown mode: ${mode}`);
