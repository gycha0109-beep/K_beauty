import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const mode = process.argv[2] || "source";
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const fail = (m) => { throw new Error(m); };
const requireText = (text, marker, label) => { if (!text.includes(marker)) fail(`${label}: missing ${marker}`); };
const forbidText = (text, marker, label) => { if (text.includes(marker)) fail(`${label}: forbidden ${marker}`); };

const pngs = [
  ["results-en", "03-results-en-1080x1920.png", "03-results-en-window.xml", ["Skin analysis result", "PERSONALIZED SKIN-CARE ROUTINE", "Top pick", "Alternative", "닥터지", "라운드랩"]],
  ["diary-en", "04-diary-en-1080x1920.png", "04-diary-en-window.xml", ["Signed in", "Active skin profile", "Skin type", "Sensitivity", "Recent 7 days", "Skin diary", "Latest saved report"]],
  ["results-ko", "03-results-ko-1080x1920.png", "03-results-ko-window.xml", ["피부 분석 결과", "맞춤 스킨케어 루틴", "요약", "우선 추천", "대안", "닥터지", "라운드랩"]],
  ["diary-ko", "04-diary-ko-1080x1920.png", "04-diary-ko-window.xml", ["로그인 상태", "현재 피부 프로필", "피부 타입", "민감도", "최근 7일", "스킨 다이어리", "최근 저장 리포트"]]
];

function source() {
  const route = read("apps/mobile/app/store-capture.tsx");
  const fixture = read("apps/mobile/features/store-capture/store-capture-fixtures.ts");
  const resultView = read("apps/mobile/features/analyze/NativeAnalyzeResult.tsx");
  const diaryView = read("apps/mobile/features/my/NativeMyDiaryView.tsx");
  const appJson = read("apps/mobile/app.json");

  requireText(route, "__DEV__ === true && process.env.EXPO_PUBLIC_STORE_CAPTURE_MODE === \"1\"", "route guard");
  requireText(route, "NativeAnalyzeResultView", "production results reuse");
  requireText(route, "NativeMyDiaryView", "production diary reuse");
  requireText(resultView, "Top pick", "results production presentation");
  requireText(diaryView, "Latest saved report", "diary saved report presentation");
  requireText(fixture, "NativeAnalyzeResult", "results fixture contract");
  requireText(fixture, "NativeMyDashboard", "diary fixture contract");
  requireText(fixture, "2026-09-03", "fixed capture date");
  requireText(fixture, "6d560546-80f1-4ccf-9d2c-34023722d2a7", "catalog product authority");
  requireText(fixture, "d7bb44e4-d585-41ca-8a74-04781470d1de", "catalog alternative authority");
  forbidText(appJson, "EXPO_PUBLIC_STORE_CAPTURE_MODE", "app.json permanent fixture enablement");
  for (const token of ["access_token", "@gmail", "@naver", "@kakao", "supabase.co", "service_role", "OPENAI_API_KEY"]) {
    forbidText(fixture.toLowerCase(), token.toLowerCase(), "fixture secret/PII boundary");
  }
  for (const token of ["fetch(", "getNativeSession", "signInNative", "saveNativeCheckin", "supabase", "openai"]) {
    forbidText(route.toLowerCase(), token.toLowerCase(), "store route live dependency");
  }

  const workflowsDir = path.join(root, ".github/workflows");
  for (const name of fs.readdirSync(workflowsDir)) {
    if (name === "mobile-20b-store-capture.yml") continue;
    const text = fs.readFileSync(path.join(workflowsDir, name), "utf8");
    forbidText(text, "EXPO_PUBLIC_STORE_CAPTURE_MODE", `release/workflow fixture leakage ${name}`);
  }
  console.log("MOBILE_20B_SOURCE_CONTRACT=PASS");
}

function pngInfo(buffer) {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  if (!buffer.subarray(0, 8).equals(signature)) fail("invalid PNG signature");
  if (buffer.toString("ascii", 12, 16) !== "IHDR") fail("missing IHDR");
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (!buffer.includes(Buffer.from("IDAT"))) fail("PNG has no IDAT payload");
  if (!buffer.includes(Buffer.from("IEND"))) fail("PNG has no IEND");
  return { width, height };
}

function markerBounds(xml, marker) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const candidates = [...xml.matchAll(new RegExp(`<node[^>]*(?:text|content-desc)=\"[^\"]*${escaped}[^\"]*\"[^>]*bounds=\"\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]\"`, "g"))];
  if (!candidates.length) return null;
  return candidates.map((m) => m.slice(1).map(Number)).find(([, y1, , y2]) => y1 >= 0 && y2 <= 1920 && y2 > y1) || null;
}

function artifact(dirArg) {
  const dir = path.resolve(root, dirArg || "apps/mobile/.mobile-20b-store-artifacts");
  const manifest = { exactSha: process.env.GITHUB_SHA || "local", fixtureVersion: "mobile-20b-v1", screens: [] };
  const forbidden = ["Quickstep", "isn't responding", "ANR", "Auth unavailable", "Sign in with Google", "Sign in with Apple", "로그인 필요", "No profile", "프로필 없음", "network error", "analysis failed", "loading"];
  for (const [id, file, xmlFile, markers] of pngs) {
    const buffer = fs.readFileSync(path.join(dir, file));
    if (buffer.length < 15000) fail(`${file}: suspiciously small image`);
    const { width, height } = pngInfo(buffer);
    if (width !== 1080 || height !== 1920) fail(`${file}: expected 1080x1920, got ${width}x${height}`);
    const xml = fs.readFileSync(path.join(dir, xmlFile), "utf8");
    for (const bad of forbidden) if (xml.toLowerCase().includes(bad.toLowerCase())) fail(`${xmlFile}: forbidden UI marker ${bad}`);
    const bounds = {};
    for (const marker of markers) {
      if (!xml.includes(marker)) fail(`${xmlFile}: required marker absent: ${marker}`);
      const box = markerBounds(xml, marker);
      if (!box) fail(`${xmlFile}: marker not proven in physical viewport: ${marker}`);
      bounds[marker] = box;
    }
    manifest.screens.push({ id, file, width, height, sha256: crypto.createHash("sha256").update(buffer).digest("hex"), requiredMarkers: markers, markerBounds: bounds, technicalPass: true });
  }
  fs.writeFileSync(path.join(dir, "capture-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("MOBILE_20B_ARTIFACT_CONTRACT=PASS");
}

if (mode === "source") source();
else if (mode === "artifact") artifact(process.argv[3]);
else fail(`unknown mode: ${mode}`);
