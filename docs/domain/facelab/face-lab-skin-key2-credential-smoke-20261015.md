# Face Lab / Skin S1-B — dedicated test key2 probe (2026-10-15)

> **Research-only; not production.** The operator designated `OPENAI_API_KEY2` as the temporary API key for Face Lab testing. This PR adds a purposefully narrow text-only one-shot credential/provider connectivity test. **No live API request or photo was run while preparing this PR.**

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

## Scope and next gates

1. Once the operator execution environment can **securely supply `OPENAI_API_KEY2`**, run the one-shot nonphoto connectivity test; record only the sanitized telemetry and exact model/HEAD/conditions, never the key. A successful test confirms **only connectivity/credential access**, not Skin/Face v1 or v2 or image transfer policy.
2. Independently verify authorization and privacy retention/access/deletion for the five user-supplied faces, shared Vision owner review, and the #1326 provider structural/Face metrics gate + #1328 paired cost/latency data schema. **Until then no face photo is sent** to Provider and no real photo accuracy is claimed.
3. #1310 independent Human signal agreement and S2-E product safety, #1208 SCA and S4/S5 acceptance are separately pending; product and release remain HOLD. The operational application, scores, recommendations, Top Pick, Style and deployment remain unchanged.

Watchtower-Track: face-lab-skin
