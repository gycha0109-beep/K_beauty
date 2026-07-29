# SEC-06 Saved Report Boundary Verifier Recovery

## Finding

The saved-report premium persistence boundary was already fail-closed: the verified session payload is passed through `sanitizePremiumReportForBoundary()` before `persistPremiumSavedReport()` receives it.

The failing `negative control 5 was not rejected` result was a verifier mutation defect. The control used an LF-specific multiline string replacement against a route file that can be checked out with CRLF line endings. When the replacement did not apply, the unchanged safe route was verified and the control produced a false failure.

## Repair

The verifier now:

- locates the sanitizer assignment with a line-ending-independent regular expression;
- requires exactly one mutation target before the negative-control loop;
- materializes the unsafe route before running the negative control;
- verifies that the unsafe direct assignment is rejected by the existing boundary assertions.

No production route, persistence, migration, RLS, database, or runtime policy was changed.

## Required verification

- `node scripts/verify-sec06-saved-report-boundary.mjs` passes with all five negative controls rejected;
- `npm run verify:security-closeout` reports an exact `56/56 PASS` manifest;
- `npm run architecture:guard` and `npm run build` pass;
- tracked mutation remains zero;
- the temporary verification workflow is removed before final review.
