import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function loadPersistenceFunctions() {
  const source = readFileSync("lib/face-lab-v2/persistence-state.js", "utf8")
    .replace(/export function /g, "function ");
  return Function(`${source}\nreturn { normalizeFaceLabRevision, readFaceLabLocalSyncState, resolveFaceLabRestore, buildFaceLabLocalState };`)();
}

const {
  normalizeFaceLabRevision,
  resolveFaceLabRestore,
  buildFaceLabLocalState
} = loadPersistenceFunctions();

const surveyAnswers = { schemaVersion: "face-lab-target-style-survey-v1", targetSelections: ["chic"] };
const serverState = { surveyAnswers, targetFinderResult: null, selectedRouteId: "balanced" };

assert.equal(normalizeFaceLabRevision(-1), 0);
assert.equal(normalizeFaceLabRevision(3), 3);
assert.equal(normalizeFaceLabRevision("3"), 0);

assert.deepEqual(
  resolveFaceLabRestore({
    serverState,
    serverRevision: 4,
    localState: {
      surveyAnswers,
      syncStatus: "synced",
      acknowledgedRevision: 4,
      baseServerRevision: 4
    }
  }),
  { source: "server", shouldRetryPersist: false, conflict: false }
);

for (const syncStatus of ["pending", "auth_required"]) {
  assert.deepEqual(
    resolveFaceLabRestore({
      serverState,
      serverRevision: 4,
      localState: {
        surveyAnswers,
        syncStatus,
        baseServerRevision: 4,
        acknowledgedRevision: 4,
        localEditedAt: "2099-01-01T00:00:00.000Z"
      }
    }),
    { source: "local", shouldRetryPersist: true, conflict: false },
    `${syncStatus} draft based on the current server revision must be retryable`
  );
}

assert.deepEqual(
  resolveFaceLabRestore({
    serverState,
    serverRevision: 5,
    localState: {
      surveyAnswers,
      syncStatus: "pending",
      baseServerRevision: 4,
      acknowledgedRevision: 4,
      localEditedAt: "2099-01-01T00:00:00.000Z"
    }
  }),
  { source: "server", shouldRetryPersist: false, conflict: true },
  "future client timestamps must not outrank a newer server revision"
);

assert.deepEqual(
  resolveFaceLabRestore({
    serverState,
    serverRevision: 5,
    localState: {
      surveyAnswers,
      syncStatus: "conflict",
      baseServerRevision: 4,
      acknowledgedRevision: 5
    }
  }),
  { source: "server", shouldRetryPersist: false, conflict: true }
);

assert.deepEqual(
  resolveFaceLabRestore({
    serverState: null,
    serverRevision: 0,
    localState: { surveyAnswers }
  }),
  { source: "local", shouldRetryPersist: true, conflict: false },
  "legacy local fallback may replay only when the server has accepted no V2 mutation"
);

assert.deepEqual(
  resolveFaceLabRestore({
    serverState,
    serverRevision: 1,
    localState: { surveyAnswers, localEditedAt: "2099-01-01T00:00:00.000Z" }
  }),
  { source: "server", shouldRetryPersist: false, conflict: false },
  "legacy timestamp-only local state must not overwrite accepted server state"
);

const localEnvelope = buildFaceLabLocalState(serverState, {
  syncStatus: "pending",
  baseServerRevision: 7,
  acknowledgedRevision: 6
});
assert.equal(localEnvelope.syncStatus, "pending");
assert.equal(localEnvelope.baseServerRevision, 7);
assert.equal(localEnvelope.acknowledgedRevision, 6);
assert.ok(localEnvelope.localEditedAt);

const route = readFileSync("app/api/premium/face-lab-v2/route.js", "utf8");
const component = readFileSync("components/full-report/PremiumFaceLabSection.jsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260928045032_face_lab_v2_persistence_revision.sql",
  "utf8"
);

assert.ok(route.includes("face_lab_revision"));
assert.ok(route.includes("const expectedRevision = body?.expectedRevision"));
assert.ok(route.includes('.eq("face_lab_revision", expectedRevision)'));
assert.ok(route.includes('error: "face_lab_state_conflict"'));
assert.ok(route.includes("{ status: 409 }"));
const getBlock = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
assert.equal(getBlock.includes("body?.expectedRevision"), false, "GET must not require mutation revision");

assert.ok(component.includes("const serverRevisionRef = useRef(0)"));
assert.ok(component.includes("resolveFaceLabRestore({"));
assert.ok(component.includes("expectedRevision,"));
assert.ok(component.includes('syncStatus: "conflict"'));
assert.ok(component.includes('syncStatus: "auth_required"'));
assert.ok(
  component.includes("const conflictEpochRef = useRef(0)") &&
    component.includes("const requestConflictEpoch = conflictEpochRef.current") &&
    component.includes("requestConflictEpoch !== conflictEpochRef.current"),
  "queued requests created before a 409 conflict must be invalidated"
);
assert.ok(
  component.includes("const isLatestRequest = () =>") &&
    component.includes("if (isLatestRequest())"),
  "older queued failures must not overwrite the newest local recovery draft"
);
assert.equal(component.includes("updatedAtMs("), false, "client clock must not decide restore authority");
assert.equal(
  component.includes("Date.parse(stored?.updatedAt"),
  false,
  "server/local freshness must not compare wall-clock timestamps"
);

assert.ok(migration.includes("face_lab_revision bigint not null default 0"));
assert.ok(migration.includes("saved_reports_face_lab_revision_nonnegative"));

console.log(JSON.stringify({
  ok: true,
  checks: [
    "server_revision_authority",
    "cas_conflict",
    "pending_retry",
    "auth_retry",
    "queued_failure_latest_draft_protection",
    "conflict_epoch_invalidation",
    "client_clock_ignored",
    "legacy_revision_zero_boundary",
    "route_revision_contract",
    "migration_revision_constraint"
  ]
}, null, 2));
