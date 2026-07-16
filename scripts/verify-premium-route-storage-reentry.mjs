import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const importModule = (path) => import(pathToFileURL(resolve(root, path)).href);

const snapshotModule = await importModule("lib/premium-report-snapshot.js");
const principalModule = await importModule("lib/premium-route-principal.js");
const finalizationModule = await importModule("lib/premium-finalization.js");

const baseReport = {
  locale: "ko",
  freeResult: { topPick: { id: "p1" } },
  decisionBundle: {
    version: "premium-decision-bundle-v5",
    contextHash: "ctx-a",
    contextRevision: 2,
    rawPolicies: { functional: { planMode: "START" } },
    functionalPolicy: { planMode: "START" }
  },
  currentProducts: { selections: [{ productId: "p1", status: "selected" }] },
  meta: { generatedAt: "2026-01-01T00:00:00.000Z" }
};

const sameSemanticReport = structuredClone(baseReport);
sameSemanticReport.meta.generatedAt = "2026-02-01T00:00:00.000Z";
const changedReport = structuredClone(baseReport);
changedReport.currentProducts.selections[0].productId = "p2";

const first = snapshotModule.buildPremiumReportSnapshot(baseReport);
const second = snapshotModule.buildPremiumReportSnapshot(sameSemanticReport);
const changed = snapshotModule.buildPremiumReportSnapshot(changedReport);
assert.equal(first.version, "premium-report-snapshot-v1");
assert.equal(first.reportVersion, "premium-v2");
assert.equal(first.decisionBundleVersion, "premium-decision-bundle-v5");
assert.equal(first.locale, "ko");
assert.equal(first.fingerprint, second.fingerprint, "transient timestamps must not alter the snapshot fingerprint");
assert.notEqual(first.fingerprint, changed.fingerprint, "meaningful product changes must alter the snapshot fingerprint");
assert.equal(snapshotModule.classifyPremiumSnapshotReplay(baseReport, sameSemanticReport).status, "existing");
assert.equal(snapshotModule.classifyPremiumSnapshotReplay(baseReport, changedReport).status, "conflict");
assert.deepEqual(baseReport.currentProducts.selections, [{ productId: "p1", status: "selected" }]);

const cookieUser = { id: "cookie-user" };
const bearerUser = { id: "bearer-user" };
const cookieClient = { name: "cookie-client" };
const bearerClient = { name: "bearer-client" };
const conflictPrincipal = principalModule.selectPremiumRoutePrincipal({
  cookieUser,
  cookieClient,
  bearerUser,
  bearerClient
});
assert.equal(conflictPrincipal.authError, "principal_conflict");
assert.equal(conflictPrincipal.principalAligned, false);
assert.equal(conflictPrincipal.user, null);
assert.equal(conflictPrincipal.supabase, null);

const alignedPrincipal = principalModule.selectPremiumRoutePrincipal({
  cookieUser,
  cookieClient,
  bearerUser: { id: cookieUser.id },
  bearerClient
});
assert.equal(alignedPrincipal.authSource, "cookie");
assert.equal(alignedPrincipal.user, cookieUser);
assert.equal(alignedPrincipal.supabase, cookieClient);

const bearerPrincipal = principalModule.selectPremiumRoutePrincipal({
  bearerUser,
  bearerClient
});
assert.equal(bearerPrincipal.authSource, "bearer");
assert.equal(bearerPrincipal.user, bearerUser);
assert.equal(bearerPrincipal.supabase, bearerClient);

const savedReport = { id: "saved-1", premium_report: baseReport };
assert.equal(
  finalizationModule.classifyFinalizedPremiumSession(null, baseReport).status,
  "open"
);
assert.equal(
  finalizationModule.classifyFinalizedPremiumSession(savedReport, sameSemanticReport).status,
  "existing"
);
assert.equal(
  finalizationModule.classifyFinalizedPremiumSession(savedReport, changedReport).status,
  "conflict"
);

const fullRoute = read("app/api/full-report/route.js");
const sessionRoute = read("app/api/full-report/session/route.js");
const routeContext = read("lib/premium-route-context.js");
const routePrincipal = read("lib/premium-route-principal.js");
const currentProducts = read("lib/premium-current-products.js");
const reentry = read("lib/premium-report-reentry.js");
const migrationPath = "supabase/migrations/20260717031925_premium_saved_report_snapshot_immutability.sql";
const migration = read(migrationPath);

for (const fragment of [
  "resolvePremiumRouteContext(request)",
  "classifyPremiumSnapshotReplay",
  "buildPremiumReportSnapshot",
  'error: "premium_snapshot_finalized"',
  'error: "premium_save_unavailable"',
  '"premium_principal_conflict"',
  "loadSavedPremiumReportForSession",
  "finalizedSavedReport",
  "report_version: snapshot.reportVersion",
  "savedFreeResult?.topPick || null",
  'status: "existing"'
]) {
  assert.ok(fullRoute.includes(fragment), `full-report route is missing ${fragment}`);
}
assert.ok(!fullRoute.includes(".update({"), "saved premium snapshots must not be updated");
assert.ok(!fullRoute.includes("body?.topPick || savedFreeResult?.topPick"), "saved reentry must ignore request topPick");
assert.ok(
  fullRoute.indexOf("const finalizedLookup = await loadSavedPremiumReportForSession") <
    fullRoute.indexOf("updatePremiumReportSession(premiumCookie, responsePremiumReport)"),
  "finalized snapshot lookup must happen before any mutable session update"
);
assert.ok(
  fullRoute.indexOf("if (finalizedSavedReport?.premium_report)") <
    fullRoute.indexOf("updatePremiumReportSession(premiumCookie, responsePremiumReport)"),
  "finalized sessions must return before mutable session persistence"
);

for (const fragment of [
  "const cookieUser = await resolveClientUser(cookieClient)",
  "const bearerUser = await resolveClientUser(bearerClient)",
  "selectPremiumRoutePrincipal",
  "resolvePremiumAccessForUser(principal.user)"
]) {
  assert.ok(routeContext.includes(fragment), `route context is missing ${fragment}`);
}
assert.ok(!routeContext.includes("resolvePremiumAccessForRequest"), "route context must not preselect a bearer principal");
assert.ok(routePrincipal.includes('authError: "principal_conflict"'), "principal conflicts must fail closed");

assert.ok(currentProducts.includes("rebuildPremiumDecisionState("), "current-product enrichment must use the canonical rebuild entrypoint");
assert.ok(!currentProducts.includes("Object.assign("), "current-product enrichment must not mutate the report through Object.assign");
assert.ok(!currentProducts.includes("report.currentProducts ="), "current-product enrichment must not mutate report.currentProducts");
assert.ok(!currentProducts.includes("applyPremiumDecisionState"), "route enrichment must not hide mutation behind applyPremiumDecisionState");

for (const fragment of [
  'reason: "principal_conflict"',
  'reason: "current_session_missing"',
  'reason: "premium_creation_not_allowed"',
  'reason: "saved_snapshot_not_found"',
  'reason: "session_store_unavailable"',
  'reason: "new_session_created"'
]) {
  assert.ok(sessionRoute.includes(fragment), `session route is missing ${fragment}`);
}
for (const forbiddenResponseFragment of [
  "{ rotated: true, sessionId",
  "{ rotated: true, premiumSessionToken",
  "{ rotated: true, accessToken",
  "{ rotated: false, sessionId",
  "{ rotated: false, premiumSessionToken",
  "{ rotated: false, accessToken"
]) {
  assert.ok(!sessionRoute.includes(forbiddenResponseFragment), `session route exposes sensitive response data: ${forbiddenResponseFragment}`);
}
assert.ok(!sessionRoute.includes(".update("), "session rotation must not update saved reports");
assert.ok(!sessionRoute.includes(".delete("), "session rotation must not delete saved reports");

for (const fragment of [
  "currentProducts: null",
  "currentProductVerdicts: []",
  "conditionResponses: []",
  'source: "premium_report_session_rotation"'
]) {
  assert.ok(reentry.includes(fragment), `rotation payload is missing ${fragment}`);
}

for (const fragment of [
  "create unique index if not exists saved_reports_premium_session_owner_uidx",
  "on public.saved_reports (user_id, report_type, source_type, source_session_id)",
  "where report_type = 'premium'",
  "and source_type = 'premium_report_session'",
  'drop policy if exists "Users can update own saved reports"',
  'create policy "Users can update own mutable saved reports"',
  "source_type is distinct from 'premium_report_session'"
]) {
  assert.ok(migration.includes(fragment), `premium snapshot migration is missing ${fragment}`);
}
assert.ok(existsSync(resolve(root, migrationPath)), "the repository migration must match the applied database version");
assert.ok(
  !existsSync(resolve(root, "supabase/migrations/20260717031000_premium_saved_report_snapshot_immutability.sql")),
  "the mismatched migration version must not remain in the repository"
);

console.log("premium route/storage/reentry verification passed");
