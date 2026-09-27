# Product Query DATA-AI25 Post-Launch Operations

Watchtower-Track: taxonomy-ai

## Purpose

This runbook starts DATA-AI25 only after the real service launch boundary exists. PRELAUNCH QA and synthetic traffic must never satisfy the operational evidence gate.

## 1. Freeze the real launch boundary

Run once, immediately after the real Production launch is confirmed.

```powershell
npm run data-ai25:launch:freeze -- --launched-at "<ISO-8601 launch timestamp>" --deployment-id "<dpl_...>" --deployment-sha "<40-char git sha>" --confirm I_CONFIRM_REAL_SERVICE_LAUNCH
```

Default local evidence file:

```text
tmp/data-ai25/operational-baseline-start.json
```

The command is intentionally immutable:
- repeating the exact same boundary is idempotent;
- attempting to change an already-frozen timestamp/deployment fails closed;
- it does not authorize cohort expansion or public Product Query cutover.

## 2. Collect only DATA-AI24-safe Production observations

Source only real Production Vercel runtime observations emitted by the existing `product-query-beta-observability-v1` diagnostic contract.

Input to DATA-AI25 must be a JSON array containing only already-extracted safe `provider_runtime` events for `operation=product_query_beta`.

Do not persist or feed:
- raw runtime log dumps;
- raw/normalized queries;
- user/account identity or hashes;
- email, IP, UA, fingerprint, session identity;
- skin/profile/preference values;
- provider request/response payloads;
- product identity/result payloads;
- cross-request correlation identity.

Store temporary extracted events only under an ignored local path such as:

```text
tmp/data-ai25/production-safe-events.json
```

## 3. Evaluate operational readiness

Security and persistence regression counts must come from the corresponding verified checks for the observation window. They are explicit inputs and fail closed when omitted.

```powershell
Get-Content "tmp/data-ai25/production-safe-events.json" -Raw |
  npm run data-ai25:readiness -- --source production-vercel-runtime --security-regression-count 0 --persistence-leakage-count 0 --confirm I_CONFIRM_REAL_PRODUCTION_OBSERVATIONS
```

The evaluator loads the frozen launch boundary, excludes all earlier observations before telemetry scoring, aggregates only safe contract fields, and emits sanitized evidence.

## 4. Decision semantics

Possible states:

- `insufficient_evidence`: launch boundary exists but fewer than 30 valid runtime observations exist.
- `hold`: at least 30 valid observations exist and one or more hard gates fail.
- `ready_for_manual_expansion_review`: all DATA-AI25 hard gates pass.

Hard gates remain:

- valid runtime observations >= 30;
- runtime success >= 95%;
- fallback <= 5%;
- provider/model drift = 0;
- telemetry contract violations = 0;
- security regressions = 0;
- persistence leakage = 0;
- current approved-account cap remains 3.

`ready_for_manual_expansion_review` is review authority only. It does not authorize cohort expansion, environment mutation, anonymous access, or public Product Query cutover.

## 5. Evidence handling

Permanent evidence may contain only the sanitized launch boundary, aggregate baseline, readiness result, and authority flags.

Do not commit raw Production observations or raw Vercel logs.

Issue #776 remains the canonical DATA-AI25 operational record until a real post-launch readiness decision is reached.
