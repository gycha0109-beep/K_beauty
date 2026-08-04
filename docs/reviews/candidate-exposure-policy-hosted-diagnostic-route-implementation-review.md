# CandidateExposurePolicy Hosted Diagnostic Route Implementation Review

## Scope

Stage 11K implements and independently reviews the temporary Preview-only synthetic CandidateExposurePolicy diagnostic route designed in Stage 11J.

```text
branch: codex/candidate-exposure-policy-synthetic-diagnostic-route
Draft PR: #122
base: codex/candidate-exposure-policy-synthetic-diagnostic-route-design
```

The final diff remains limited to the approved ten-file boundary. `/api/analyze`, product recommendation assembly, UI, database, project configuration, workflow files, and Production files are unchanged.

## Implemented route boundary

```text
POST /api/internal/candidate-exposure-policy-diagnostic
```

The route:

- is unavailable unless the real exported handler runs in Vercel Preview with Node production runtime;
- requires valid Git SHA, deployment ID, execution-grant digest, Vercel automation material, and immutable `VERCEL_URL`;
- rejects a request-host mismatch before reading the body;
- authenticates method, path, host, content type, timestamp, nonce, and body digest with HMAC-SHA-256;
- accepts only the strict internal scenario-selection request contract;
- runs no evaluator in control mode;
- runs the CandidateExposurePolicy evaluator exactly once in canary mode;
- returns aggregate-only evidence;
- performs no persistence, Provider, user-session, cookie, or external-network work.

## Follow-up independent findings

### Critical — signed host was not bound to the runtime deployment host

The original implementation authenticated the host contained in the request URL but did not separately compare it with the host owned by the executing deployment.

Resolution:

- require a valid runtime `VERCEL_URL` in the real exported route;
- normalize it through the same immutable Vercel-host contract;
- reject any request-host mismatch before request-body reads;
- preserve dependency-injected local checker support without weakening the exported route.

Status: resolved.

### Important — Preview branch aliases and Production aliases were conflated

The earlier adapter rejected any alias array, although every normal Preview may have a branch alias.

Resolution:

- Preview aliases are permitted;
- the metadata capability must provide the independent boolean `productionAliasPresent`;
- missing or true Production-alias evidence fails closed;
- `target=production` remains rejected.

Status: resolved.

### Important — response contamination could still reach a nominal probe result

The adapter previously counted and discarded `Set-Cookie`, but did not immediately reject the probe. It also did not require JSON and `no-store` response headers.

Resolution:

- base Content-Type must be `application/json`;
- `Cache-Control` must contain `no-store`;
- any `Set-Cookie` increments the incident counter and immediately throws;
- successful checker evidence requires zero cookie contamination.

Status: resolved.

## Verification performed

```text
modified route syntax: PASS
modified adapter syntax: PASS
independent hardening smoke: PASS, 12 assertions
exact code-head Vercel Preview: READY
Next.js production build in Vercel: PASS
build error entries: 0
GitHub Actions runs: 0
Hosted diagnostic requests: 0
Production changes: 0
```

The original implementation checker result remains historical evidence:

```text
route checker: 63 assertions PASS
execution checker: 107 assertions PASS
total: 170 assertions PASS
```

The execution checker fixtures have now been aligned with the stricter Production-alias and cookie contracts. The final full repository checker and security-closeout suite were not executed through GitHub Actions.

## Final review result

```text
Critical unresolved: 0
Important unresolved: 0
Blocking Minor unresolved: 0
```

## Claims explicitly prohibited

- Hosted CandidateExposurePolicy diagnostic execution PASS;
- `/api/analyze` integration PASS;
- end-to-end user analysis PASS;
- runtime activation PASS;
- public traffic authorization;
- Production readiness.

## Lifecycle

The route remains a temporary stacked-branch verification asset. A separately reviewed cleanup branch must delete the route and route-only modules and prove their absence before integration toward `main`.
