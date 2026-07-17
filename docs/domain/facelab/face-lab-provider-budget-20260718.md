# Face Lab provider budget follow-up — 2026-07-18

## Evidence

The hosted smoke output recorded eight planned cases, two successful provider-backed cases, one HTTP 429 case, and five cases left unattempted after the rate-limit circuit opened. The current remote `/api/face-reading` implementation already caps completion output at 1,400 tokens and uses `gpt-4o-mini`; an excessive completion-token setting is therefore not established as the cause.

The exact source of the dashboard total of 119,544 tokens remains unconfirmed. The hosted evaluator and its `Retry-After` parser are not present on this remote branch, so the local `retryAfterMs = 11,491,000` value cannot be audited or corrected here. In particular, a decimal duration such as `11.491s` must not be assumed to mean 11,491 seconds without inspecting the local parser.

## Bounded change

Provider-bound canonical images are now resized only when an edge exceeds 1,024 pixels. Aspect ratio is preserved, smaller images are not enlarged, and the existing signature, MIME, frame-count, source-size, decoded-dimension, and canonicalization checks still run before resizing. No source image, base64 payload, provider response, error message, credential, or absolute path is persisted or logged.

This shared server boundary is used by the two existing image-analysis routes. The change reduces provider image-token exposure without changing their response contracts, model, prompt, eligibility logic, or completion-token cap.

## Verification boundary

`npm run verify:face-lab-provider-budget` is a synthetic verifier. It checks a 2,048×1,536 input is reduced to 1,024×768, a 640×480 input is not enlarged, dimensions remain within the hard cap, and bytes/data URL metadata remain consistent.

No real OpenAI request or hosted smoke run was performed by this change. The local hosted evaluator still needs a separate review of duration parsing, retry policy, and resume behavior before its 429 cause can be declared resolved.
