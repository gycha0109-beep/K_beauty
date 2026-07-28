import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import {
  FAILURE_CATEGORIES,
  JourneyFailure,
  requireCondition
} from "./premium-browser-journey-core.mjs";

function systemChromeCandidates() {
  const candidates = [];
  const explicit = String(process.env.PREMIUM_E2E_SYSTEM_CHROME || "").trim();
  if (explicit) candidates.push(resolve(explicit));

  if (process.platform === "win32") {
    for (const root of [
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA
    ].filter(Boolean)) {
      candidates.push(resolve(root, "Google/Chrome/Application/chrome.exe"));
    }
  } else if (process.platform === "darwin") {
    candidates.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/opt/google/chrome/google-chrome"
    );
  }

  return [...new Set(candidates)];
}

export function resolveSystemChromeExecutable() {
  const executable = systemChromeCandidates().find((candidate) => existsSync(candidate));
  if (!executable) {
    throw new JourneyFailure(
      FAILURE_CATEGORIES.PRECONDITION,
      "system-browser",
      "system_chrome_not_found",
      "Google Chrome을 찾지 못했습니다. PREMIUM_E2E_SYSTEM_CHROME에 chrome 실행 파일 경로를 지정하십시오."
    );
  }
  return executable;
}

async function waitForBrowserStart(child, label) {
  await new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(resolvePromise, 750);
    child.once("error", (error) => {
      clearTimeout(timer);
      rejectPromise(new JourneyFailure(
        FAILURE_CATEGORIES.INFRASTRUCTURE,
        `system-browser-${label}`,
        "system_chrome_launch_failed",
        error?.message || "system_chrome_launch_failed"
      ));
    });
  });
}

export async function openManualSystemChromeSession({ label, profilePath, baseUrl }) {
  requireCondition(
    baseUrl?.protocol === "https:",
    FAILURE_CATEGORIES.PRECONDITION,
    `system-browser-${label}`,
    "system_browser_target_invalid"
  );

  const executable = resolveSystemChromeExecutable();
  const child = spawn(executable, [
    `--user-data-dir=${profilePath}`,
    "--profile-directory=Default",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-mode",
    "--new-window",
    baseUrl.origin
  ], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
    shell: false
  });

  await waitForBrowserStart(child, label);
  child.unref();

  console.log(`[${label}] 일반 Google Chrome을 열었습니다.`);
  console.log(`[${label}] 이 창에서 앱의 Google 로그인을 완료하십시오. Playwright가 Google 로그인 화면을 제어하지 않습니다.`);

  const prompt = createInterface({ input, output });
  try {
    await prompt.question(`[${label}] 앱 화면으로 돌아온 뒤 이 전용 Chrome 창을 모두 닫고 Enter를 누르십시오: `);
  } finally {
    prompt.close();
  }

  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
}
