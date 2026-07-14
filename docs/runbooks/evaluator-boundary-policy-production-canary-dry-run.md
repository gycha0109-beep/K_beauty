# CandidatePolicy Production Canary Dry-run

This runbook is a dry-run contract. It does not deploy, change Vercel environment variables, modify traffic, or activate CandidatePolicy runtime in production.

1. Keep the baseline state default-off and run the synthetic baseline/canary probe plus production-observability verifier.
2. Validate the non-`main` Preview Deployment plan with the canary runtime flags and the explicit `deployment_canary` scope marker. Do not assume a weighted traffic split; the isolation mechanism must be confirmed separately.
3. Before any production action, obtain separate approval for Vercel environment changes and confirm the `main` push path is the intended Production Deployment.
4. If a stop condition occurs, enable `DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME=1`, verify enabled/executed/connected are all false within the configured timeout, then return to the previous known-good Vercel deployment if the deployment itself must be rolled back.

Required verification order:

1. `node scripts/run-evaluator-boundary-policy-synthetic-canary-probe.mjs test/fixtures/analyze/candidate-policy-synthetic-canary-probe.fixture.json --run-id <unique-safe-run-id>`
2. `node scripts/verify-evaluator-boundary-policy-kill-switch-propagation.mjs --run-id <same-unique-safe-run-id>`
3. `node scripts/verify-evaluator-boundary-policy-production-observability.mjs`

Stop for any nonzero safety or unexpected receiver/exposure count, response-schema change, unexpected recommendation or DB/Storage delta, forbidden telemetry field, SLO breach, kill-switch propagation failure, or unconfirmed canary isolation.

No product/user/recommendation detail, URL, token, key, secret, project ID, or team ID belongs in plan evidence.
