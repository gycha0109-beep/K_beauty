# Face Lab / Skin — S1-D Private real-photo v1/v2 research runner (2026-10-16)

> **Draft research infrastructure, NOT evidence of a successful real-photo Provider call.**
> S1-D source/subject/external-OpenAI-transfer authorization was **affirmed by the user in chat** on 2026-10-16. This is a user attestation, not independently inspected consent documentation. Production eligibility, performance, separate independent Human reference and owner security/privacy signoff are not thereby established.

## Environment and actual execution state

- Five user-provided JPEGs (TC-01…TC-05) exist only in the private conversation runtime. Image sizes 582×894, 539×371, 273×366, 484×413, 452×678. TC-03 is small; TC-04 partial face; TC-05 dark exposure. These are quality **flags**, not skin diagnoses or independent ground truth.
- The private local cohort manifest is **NOT committed**: `skin-private-v1v2-cohort-v1` with five opaque case IDs, local basenames/expected dimensions, all three forms of `user_attested` authorization, and restrictive execution policy. No copy of the private manifest or any actual photo may enter GitHub/CI/PR artifacts/logs.
- The ChatGPT/container process does **not** have `OPENAI_API_KEY2` or `OPENAI_API_KEY` injected. KEY2 was previously shown to work only inside GitHub Actions **Repository Secrets** using a **nonhuman** mock/grid; GitHub Secrets are intentionally not readable or exported to this private runner.
- Therefore **live real-photo Provider calls from this development environment = 0**. Do not claim actual v1/v2 face parity, observation accuracy, total costs or 10 executed calls until the private runner obtains an approved credential by a separate safe channel.
- **NEVER** build a GitHub Actions workflow or GitHub Secret containing the human JPEGs, even as base64, URLs, or encrypted attachments. GitHub Actions is not an acceptable delivery channel for the real human photo cohort.

## Implemented private runner

- `skin-private-v1v2-runner.mjs`: accepts strict five-case local manifest; verifies user attestation, fixed KEY2-only credential, private-only policy, 10-call bound and CI/GITHUB_ACTIONS refusal **before reading photos**. Validates all five JPEG bytes, frame dimensions, file size, symlinks, and private directory containment **before the first billable call**.
- `run-skin-private-v1v2.mjs` has explicit `--validate-private-cohort` (no key, no Provider) and `--live-private-cohort` (requires injected `OPENAI_API_KEY2`; private runner only) modes. No dotenv, production API key fallback, automatic trigger, Vercel deployment or webhook.
- `--live-private-cohort` performs exactly one **v1** and one **research-only v2** OpenAI Vision request for the SAME in-memory photo bytes per case, at most **10** calls total, no retry. Body uses existing pinned `OPENAI_RUNTIME_MODEL`, `OPENAI_RUNTIME_REASONING_EFFORT`, `OPENAI_RUNTIME_IMAGE_DETAIL` and **2,200-token completion cap**, through the existing `executeOpenAiChatJson` transport; no new production API.
- Before building the in-memory image data URL, the private reader removes JPEG COM comments and nonessential APP metadata segments; embedded Exif headers are **rejected** for independent orientation review rather than silently stripped. Five local photos were offline decoded after this metadata-only sanitization: **5/5 still decodable**, and TC-01 had one JPEG comment segment removed (33 bytes), the others zero segments. These observations are local-only, not Provider evaluation. Neither source files nor sanitizer output were committed or permanently saved by this runner.
- Only sanitized metadata is returned: opaque case ID, output completion and token counts, elapsed ms, eligibility, v2 actual axis count and structural status, Face status/available field counts, pairing status and HOLD reasons. **Never** return filenames, filenames in output, raw Provider JSON/evidence text, image base64, image URLs, secret, EXIF or identity. No source or raw result is written by the runner to disk.
- The existing `inspectSkinVisionTrial` and `summarizeSkinVisionTrials` gate logic enforces structural completeness, 2,200 completion cap, Face status/count degradation. Eligible v2 Skin output requires seven valid axis rows; ineligible Skin expected output is zero rows (separate status from eligible-photo failure). Low resolution/lighting/crops are only flagged; **human judgement and actual references are needed** to determine appropriate abstention.
- Failure to open ANY of five files prevents all billable calls. A Provider failure stops the run and produces sanitized HOLD metadata, not an unobserved success. Local prefix or mocked private test cases are never sent by CI.

## Exact operator interfaces (not run here)

```sh
# In an approved private host with the repository code available.
node scripts/facelab/skin/run-skin-private-v1v2.mjs --validate-private-cohort \
  --manifest /PRIVATE/skin_private_v1v2_cohort_20261016.json --photo-dir /PRIVATE/PHOTOS

# This SECOND command, only on that private host and with a securely
# injected OPENAI_API_KEY2, makes up to 10 billed API requests.
node scripts/facelab/skin/run-skin-private-v1v2.mjs --live-private-cohort \
  --manifest /PRIVATE/skin_private_v1v2_cohort_20261016.json --photo-dir /PRIVATE/PHOTOS
```

Do not place secret contents into chat, code, GitHub, Vercel or a CI script. Explicit command examples are for a **separately authorized private host**, not an instruction to bypass the runtime's missing-key gate.

## 2026-10-16 S1-D hardening follow-up

- Metadata-stripped photo bytes now get a **transient SHA-256 content fingerprint** within the private process. Every one of the five photos must have a **different content fingerprint** even when case IDs and filenames differ. Fingerprints are **never** printed, persisted, committed or forwarded to the Provider. This prevents accidentally reusing the same JPEG under two case IDs and incorrectly reporting an independent five-image cohort.
- Local private-only duplicate scan of the **actual five uploaded JPEG files**: **5/5 unique sanitized-content images**, **1 nonessential metadata segment removed**, **0 Provider calls**. The file bytes, names and fingerprints were not published.
- With the real OpenAI transport, the CI denial rule consults **both the passed environment and the actual process environment**. A caller cannot override the environment argument to conceal GitHub Actions/CI and cause an accidental real face-photo Provider request; the mock verifier can still inject a fake transport to exercise offline logic.
- CI denial checks now include active `GITHUB_ACTIONS`, `CI=1`, `GITLAB_CI`, `CIRCLECI`, `TRAVIS`, `TF_BUILD`, `BUILDKITE`, `JENKINS_URL` and related runner markers. Tests supply fake environment flags only and never read the real repository Secret.
- Synthetic verifier now uses five **distinct invented JPEG byte fixtures** rather than identical byte arrays; separately tests deliberate duplicate-content rejection and CI marker variants.
- This upgrade changes only the **private evaluation preflight**, not the deployed app or actual face photo/Provider authorization. Actual five-photo paired Provider calls are still **0/10** because the temporary key is inaccessible in the private runtime.

## Metadata-only independent Human evaluation handoff

The private runner now exposes a narrowly whitelisted, private-host-only **per-axis observation** to support a subsequent independent Human reference comparison without retaining model-originated free-text. For v2, each of at most seven returned rows contains **only** a canonical axis name (or null for an unsupported name), closed state `present | not_seen | unassessable | unknown | invalid`, score in `0..5` or null, and closed confidence `low | medium | high | unknown | invalid`. It never emits raw cue strings, face feature measurements, image areas, narrative evidence, identifiers, provider JSON, local file paths or any image base64.

For v1, the seven visible axes expose only bounded legacy numeric scores, with `v1LegacyZeroUnverifiable=true`: **a v1 zero can NOT be interpreted as verified `not_seen`**. These v1 scores are for instrument/contract comparison only, not verified skin truth. Invalid scores are null rather than silently coerced.

This enables an **independent, separately consented/blinded Human label manifest** to be compared by the existing S1 cue evaluator later; the runner does not create, guess or impersonate reference labels. Even if a private run occurs, the result remains research-only, not an assessment of personalized medical conditions. Raw face information is never persisted by the runner.

## Automated verification

`verify-skin-private-v1v2-runner.mjs` uses *fabricated JPEG headers* inside a disposable temporary directory, and a **mock Provider transport only**. It verifies: five cases/call budget, identical image bytes across v1/v2, key2-only credential, production-key-only rejection, GITHUB_ACTIONS/CI rejection, cohort-wide file-check before traffic, symlink/path/metadata rejection, sanitized error reporting and zero actual Provider calls. This verifier is the only part wired to `verify-current-main-health.mjs`.

Success means **research infrastructure mock PASS**, not real-human accuracy/Face parity or ability to retrieve GitHub Secrets. Until the actual live private Provider outputs and two independent Human assessments are acquired, S1-D remains **EXECUTION_BLOCKED_PENDING_PRIVATE_KEY_PROVISIONING**, S2-E scoring activation/S5 Product Ready/Release Ready remain **HOLD**. Security #1208 and any currently expired advisory exceptions remain an independent blocker. No merge/deploy without approval.

Watchtower-Track: face-lab-skin
