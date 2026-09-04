import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ORIGIN = "https://k-beauty-two.vercel.app";
const QUESTION =
  "눈, 코, 입 등 얼굴의 정확한 특징을 판별할 수 있을 정도로 보이는 사람은 몇 명인가요?";
const EXPECTED_GIT_SHA = String(process.env.EXPECTED_GIT_SHA || "").trim();
const PROBE_URL = `${ORIGIN}/api/internal/facelab-review-self-smoke?probe=browser`;
const SCREENSHOT_PATH = path.join(
  process.cwd(),
  "artifacts/facelab-neutral-stage-a-production-browser.png"
);

if (!/^[0-9a-f]{40}$/i.test(EXPECTED_GIT_SHA)) {
  throw new Error("expected_git_sha_required");
}

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForExactProduction() {
  let last = { status: 0, sha: "" };
  for (let attempt = 0; attempt < 48; attempt += 1) {
    try {
      const response = await fetch(PROBE_URL, {
        headers: { accept: "text/html", "cache-control": "no-cache" },
        cache: "no-store",
        redirect: "follow"
      });
      const body = await response.text();
      const sha = String(response.headers.get("x-facelab-smoke-source-sha") || "");
      last = { status: response.status, sha };
      if (
        response.status === 200 &&
        sha === EXPECTED_GIT_SHA &&
        body.includes("얼굴 수 중립 평가")
      ) {
        return;
      }
    } catch {
      last = { status: 0, sha: "" };
    }
    await sleep(5000);
  }
  throw new Error(
    `exact_production_probe_unavailable:${last.status}:${last.sha || "none"}`
  );
}

await waitForExactProduction();
await mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "ko-KR" });
const page = await context.newPage();
const submitRequests = [];
page.on("request", (request) => {
  if (
    request.method() === "POST" &&
    request.url().includes("/api/facelab/review/neutral/submit")
  ) {
    submitRequests.push(request.url());
  }
});

try {
  const response = await page.goto(PROBE_URL, {
    waitUntil: "networkidle",
    timeout: 60_000
  });
  if (!response || response.status() !== 200) {
    throw new Error(`browser_probe_status:${response?.status() ?? "none"}`);
  }
  const sourceSha = await response.headerValue("x-facelab-smoke-source-sha");
  if (sourceSha !== EXPECTED_GIT_SHA) {
    throw new Error(`browser_source_sha_mismatch:${sourceSha || "none"}`);
  }

  await page.getByRole("heading", { name: "얼굴 수 중립 평가" }).waitFor();
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "1단계 시작" }).click();

  const instruction = page.locator("#instruction");
  if ((await instruction.textContent()) !== QUESTION) {
    throw new Error("exact_question_wording_mismatch");
  }

  for (let index = 1; index <= 8; index += 1) {
    const progress = String(await page.locator("#progress").textContent()).trim();
    if (progress !== `${index} / 8`) {
      throw new Error(`progress_mismatch:${progress}:expected:${index} / 8`);
    }

    const optionButtons = page.locator("#options button");
    const optionCount = await optionButtons.count();
    if (optionCount !== 4) {
      throw new Error(`response_option_count_mismatch:${optionCount}`);
    }
    await optionButtons.first().click();

    const nextButton = page.locator("#next");
    if (index < 8) {
      if ((await nextButton.textContent()) !== "다음 사진") {
        throw new Error(`next_button_label_mismatch:${index}`);
      }
      await nextButton.click();
    } else if ((await nextButton.textContent()) !== "1단계 제출") {
      throw new Error("final_submit_label_mismatch");
    }
  }

  await page.waitForTimeout(500);
  if (submitRequests.length !== 0) {
    throw new Error(`unexpected_submit_request_count:${submitRequests.length}`);
  }

  const state = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) =>
      candidate.startsWith("face-lab-neutral-count::")
    );
    if (!key) return null;
    return JSON.parse(localStorage.getItem(key));
  });
  if (!state || state.attested !== true) {
    throw new Error("local_progress_state_missing");
  }
  if (state.imageIndex !== 7) {
    throw new Error(`local_image_index_mismatch:${state.imageIndex}`);
  }
  const localResponseCount = Object.keys(state.responses || {}).length;
  if (localResponseCount !== 8) {
    throw new Error(`local_response_count_mismatch:${localResponseCount}`);
  }

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });

  process.stdout.write(
    `${JSON.stringify({
      status: "FACE_LAB_NEUTRAL_STAGE_A_PRODUCTION_BROWSER_PASS",
      sourceGitSha: sourceSha,
      exactQuestion: true,
      itemCount: 8,
      finalProgress: "8 / 8",
      finalButton: "1단계 제출",
      localResponseCount,
      neutralSubmitPostRequests: submitRequests.length,
      finalSubmitActivated: false,
      screenshot: path.relative(process.cwd(), SCREENSHOT_PATH)
    })}\n`
  );
} finally {
  await browser.close();
}
