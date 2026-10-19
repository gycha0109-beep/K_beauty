#!/usr/bin/env node
// Deliberately no dotenv, environment pulling, image flags, raw result or secret output.
import { runKey2SyntheticSmoke } from "./skin-key2-synthetic-provider-smoke.mjs";

if (process.argv.length !== 3 || process.argv[2] !== "--live-synthetic-text") {
  console.error("Usage: node scripts/facelab/skin/run-skin-key2-smoke.mjs --live-synthetic-text");
  console.error("This makes one billable text-only OpenAI call; requires OPENAI_API_KEY2 in the current process.");
  process.exitCode = 2;
} else {
  try {
    const summary = await runKey2SyntheticSmoke();
    console.log(JSON.stringify(summary, null, 2));
    if (summary.result !== "SYNTHETIC_TEXT_CONNECTIVITY_PASSED") process.exitCode = 1;
  } catch (error) {
    // No arbitrary errors from remote providers, secrets or file paths in CLI output.
    const message = error?.message || "";
    const code = message === "dedicated_test_key2_unavailable"
      ? message
      : /^provider_http_(?:400|401|403|404|408|409|422|429|500|502|503|504)$/.test(message)
        ? message
        : ["provider_response_invalid", "provider_response_empty", "provider_redirect_rejected",
           "response_too_large"].includes(message)
          ? message : "provider_smoke_request_failed";
    console.error("skin_key2_smoke_failed: " + code);
    process.exitCode = 1;
  }
}
