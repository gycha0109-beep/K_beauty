# Face Lab / Skin S1-B — dedicated test key2 probe (2026-10-15)

> **Research-only; not production.** The operator designated `OPENAI_API_KEY2` as the temporary API key for Face Lab testing. A dedicated one-shot test workflow was temporarily committed on a research branch, executed with the GitHub Actions repository secret, then **deleted** (as was its CI registry entry) to avoid permanent secret-bearing workflows and preserve CI inventory count policy. The standalone CLI and mock tests remain. No photo was transmitted.

## Exact key and authority boundaries

- The only credential name read by this experiment is **`OPENAI_API_KEY2`**, from the **same process environment where the operator explicitly executes the command**. There is deliberately **no fallback** to `OPENAI_API_KEY`, production environment variables, .env files, deployment secrets, GitHub secrets or remote key-management tools.
- The current chat/container environment did **not** expose either `OPENAI_API_KEY2` or `OPENAI_API_KEY`. Connected Vercel identified `k-beauty` project but denied environment-variable enumeration (403); **that does not prove the key is missing from Vercel or GitHub**. GitHub secret values cannot be read through this connector. The newly registered key's storage/location and ability to perform a billed API call are **unverified**.
- Do not move or print the key to GitHub, chat, CI, artifact, database, logs or a README. Never use an unrelated production key if key2 is missing. No remote environment settings are changed.
- The current prod shared Vision/Style call remains one per onboarding flow, with 2,200 completion-token cap. The standalone smoke makes one **additional nonproduction text-only** API call only when deliberately invoked, not by normal CI, Vercel deployments, or the live app.
- The smoke uses existing `executeOpenAiChatJson` transport + repo-pinned model and reasoning effort. Exactly one attempt (no retries), timeout 25s, 16 KiB response cap and 256-token completion cap, fixed synthetic JSON prompt. No image, face, personal data, product data, or user input is sent.
- The only emitted result contains safe provider HTTP/finish status, request count, token usage and elapsed milliseconds. No raw provider output is logged or persisted. API cost cannot be called zero if a live smoke executes.

## Commands

```sh
# Safe mock/synthetic CI test — no credential, no external API
node scripts/facelab/skin/verify-skin-key2-synthetic-provider-smoke.mjs

# Operator's private shell with OPENAI_API_KEY2 already provisioned — ONE billable text-only call
node scripts/facelab/skin/run-skin-key2-smoke.mjs --live-synthetic-text
```

The second command fails closed with `dedicated_test_key2_unavailable` if the dedicated key is not injected. The first command exercises a simulated successful provider, response truncation, 429 rate limit, malformed JSON, production-key-only failure, mixed-key priority, and nonleakage. It cannot authenticate to the real OpenAI Provider.


## Confirmed GitHub Actions execution (real Provider, text only)

- [Exact branch commit `c0acf1524a840b7879071b26ed1273be065af03f`, run #38702440175](https://github.com/gycha0109-beep/K_beauty/actions/runs/38702440175): **SUCCESS**. Live `OPENAI_API_KEY2` request HTTP **200**, response matched `{"probe":"synthetic_ok"}` (match boolean only logged), model `gpt-5.6-luna`, 38 prompt / 13 completion tokens, `finish_reason=stop`. One billable **text-only** provider call.
- [Workflow-name correction run #38702819285](https://github.com/gycha0109-beep/K_beauty/actions/runs/38702819285): **SUCCESS** with the same HTTP 200, model, token counts, `finish_reason=stop`. One additional billable **text-only** provider call; total **2** observed real calls. No real or synthetic image sent by this task.
- The temporary workflow originally caused CI workflow-registry mismatch and then strict overlap-inventory count failure. **The workflow and one-entry registry were deleted** in commits `ad164f8daf6895a6ac711f3ae86060f40b0008a6` and `21e3ac27d20914723b11544f03c83ee1892d901b`; canonical inventory policy was **not** changed, secrets were not printed, and no persistent paid-triggering workflow is part of the PR's final diff.
- These results confirm the key was securely available in the GitHub Actions job and the pinned model accepted a synthetic text request. They do not confirm image inputs, v1/v2 Face/Skin compatibility, real-photo accuracy, or production readiness. Any later key2 tests require a separate pre-approved bounded research workflow / isolated runner; do not mistake the retired ephemeral workflow for an active scheduler.

## Scope and next gates

1. Once the operator execution environment can **securely supply `OPENAI_API_KEY2`**, run the one-shot nonphoto connectivity test; record only the sanitized telemetry and exact model/HEAD/conditions, never the key. A successful test confirms **only connectivity/credential access**, not Skin/Face v1 or v2 or image transfer policy.
2. Independently verify authorization and privacy retention/access/deletion for the five user-supplied faces, shared Vision owner review, and the #1326 provider structural/Face metrics gate + #1328 paired cost/latency data schema. **Until then no face photo is sent** to Provider and no real photo accuracy is claimed.
3. #1310 independent Human signal agreement and S2-E product safety, #1208 SCA and S4/S5 acceptance are separately pending; product and release remain HOLD. The operational application, scores, recommendations, Top Pick, Style and deployment remain unchanged.

Watchtower-Track: face-lab-skin
