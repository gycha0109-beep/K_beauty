#!/usr/bin/env node
// Research-only: max 2 provider requests with in-memory synthetic nonhuman PNG.
// Requires a GitHub Actions runner or authorized private environment with OPENAI_API_KEY2.
import { runKey2NonfaceVisionPair } from "./skin-key2-nonface-vision-pair.mjs";

if (process.argv.length !== 3 || process.argv[2] !== "--live-nonface-pair") {
  console.error("Usage: node scripts/facelab/skin/run-skin-key2-nonface-pair.mjs --live-nonface-pair");
  process.exitCode = 2;
} else {
  try {
    const result = await runKey2NonfaceVisionPair();
    console.log(JSON.stringify(result, null, 2));
    if (result.verdict !== "NONFACE_PROVIDER_RESPONSE_CAPTURED_REVIEW_ONLY") process.exitCode = 1;
  } catch (error) {
    // Never expose arbitrary Provider errors, prompts, bearer tokens or response bodies.
    console.error("skin_key2_nonface_pair_failed: " +
      (error?.message === "key2_not_injected" ? "key2_not_injected" : "research_probe_failed"));
    process.exitCode = 1;
  }
}
