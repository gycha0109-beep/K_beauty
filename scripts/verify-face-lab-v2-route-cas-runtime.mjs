import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isLatestFaceLabSaveRequest,
  resolveFaceLabRestore
} from "../lib/face-lab-v2/persistence-state.js";

// Run the actual GET/POST handlers, not a lookalike CAS algorithm.
// Dependency injection is confined to this offline test; production imports,
// auth, route exports, and database clients are left untouched.
const routeSource = readFileSync("app/api/premium/face-lab-v2/route.js", "utf8");
const imports = /^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\s*$/gm;
const executable = routeSource
  .replace(imports, "")
  .replace(/export async function (GET|POST)\(/g, "async function $1(");
assert.equal(executable.includes("import "), false, "all production imports must be injected");
assert.ok(executable.includes("async function GET(") && executable.includes("async function POST("));

let updates = 0;
const rows = new Map();
function seed(id, userId = "owner", revision = 0) {
  rows.set(id, {
    id, user_id: userId, report_type: "premium",
    premium_report: {
      faceLabAnalysis: { status: "available" }, locale: "ko",
      faceLabSummary: { analyzedAt: "2026-10-14T00:00:00.000Z" }
    },
    face_lab: null, face_lab_revision: revision
  });
}
seed("saved-one");
seed("saved-two", "another-owner");

const database = {
  from(table) {
    assert.equal(table, "saved_reports");
    const filters = {};
    let patch = null;
    return {
      select() { return this; },
      eq(key, value) { filters[key] = value; return this; },
      update(value) { patch = value; return this; },
      async maybeSingle() {
        const row = rows.get(filters.id);
        const matches = row && Object.entries(filters).every(([key, value]) => row[key] === value);
        if (!matches) return { data: null, error: null };
        if (patch) {
          // Synchronous CAS commit at one atomic state transition:
          // two concurrent requests with the same revision cannot both write.
          Object.assign(row, structuredClone(patch));
          updates += 1;
        }
        return { data: structuredClone(row), error: null };
      }
    };
  }
};

const stubs = {
  NextResponse: {
    json(body, init = {}) {
      return { status: init.status || 200, headers: init.headers, async json() { return body; } };
    }
  },
  isAccountUser: (user) => Boolean(user?.id && !user?.is_anonymous),
  resolvePremiumRouteContext: async (request) => request.context,
  getFaceLabObservationAnalysis: (input) => input?.status === "available" ? input : null,
  sanitizePremiumFaceLabSummary: (input) => input,
  buildFaceLabV2Canonical: ({ surveyAnswers, selectedRouteId }) => ({
    targetStyle: { status: surveyAnswers?.targetSelections?.length ? "available" : "unavailable" },
    routes: {
      selectionState: selectedRouteId ? "selected" : "default_preview",
      selectedRouteId: selectedRouteId || null
    }
  }),
  buildFaceLabRouteChoiceEvidence: () => null,
  normalizeFaceLabRouteChoiceEvidence: (evidence) => evidence || null,
  normalizeFaceLabV2PersistencePayload: (input) => ({
    surveyAnswers: input.surveyAnswers || null,
    targetFinderResult: input.targetFinderResult || null,
    selectedRouteId: input.selectedRouteId || null
  }),
  createNoStoreHeaders: () => ({ "Cache-Control": "no-store" }),
  writeSafeLog: () => {}
};
const names = Object.keys(stubs);
const handlers = Function(...names, executable + "\nreturn { GET, POST };")(...names.map((key) => stubs[key]));

function request(method, { userId = "owner", id = "saved-one", revision, target = "chic", routeId = "balanced" } = {}) {
  const url = new URL("https://fixture.invalid/api/premium/face-lab-v2");
  if (method === "GET") url.searchParams.set("savedReportId", id);
  return {
    url: url.toString(),
    headers: new Headers(),
    context: { user: userId ? { id: userId } : null, supabase: database },
    async json() {
      return {
        savedReportId: id, expectedRevision: revision,
        surveyAnswers: { schemaVersion: "face-lab-target-style-survey-v1", targetSelections: target ? [target] : [] },
        targetFinderResult: null, selectedRouteId: routeId
      };
    }
  };
}
async function run(method, options) {
  const response = await handlers[method](request(method, options));
  return { status: response.status, body: await response.json(), headers: response.headers };
}

const unauthenticated = await run("GET", { userId: null });
assert.equal(unauthenticated.status, 401);
assert.equal((await run("POST", { userId: null, revision: 0 })).status, 401);
assert.equal((await run("GET", { userId: "owner", id: "saved-two" })).status, 404);
assert.equal((await run("POST", { userId: "owner", id: "saved-two", revision: 0 })).status, 404);
assert.equal((await run("POST", { revision: -1 })).status, 400);
assert.equal((await run("POST", { revision: 0, target: null })).status, 400);

const original = await run("GET");
assert.equal(original.status, 200);
assert.equal(original.body.revision, 0);
assert.equal(original.body.faceLabV2, null);
assert.equal(original.headers["Cache-Control"], "no-store");

const first = await run("POST", { revision: 0, target: "chic" });
assert.equal(first.status, 200);
assert.equal(first.body.revision, 1);
assert.deepEqual(first.body.faceLabV2.surveyAnswers.targetSelections, ["chic"]);
assert.equal((await run("GET")).body.revision, 1);

const stale = await run("POST", { revision: 0, target: "soft" });
assert.equal(stale.status, 409);
assert.equal(stale.body.error, "face_lab_state_conflict");
assert.equal(stale.body.currentRevision, 1);
assert.deepEqual(stale.body.faceLabV2.surveyAnswers.targetSelections, ["chic"]);
assert.deepEqual(rows.get("saved-one").face_lab.surveyAnswers.targetSelections, ["chic"]);

// The mocked database commits synchronously, so one of two concurrent
// equal-revision updates must lose the compare-and-swap.
const concurrent = await Promise.all([
  run("POST", { revision: 1, target: "natural" }),
  run("POST", { revision: 1, target: "sophisticated" })
]);
assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 409]);
assert.equal((await run("GET")).body.revision, 2);
assert.equal(updates, 2, "stale and losing concurrent writes must not mutate storage");

// The browser tracks both monotonically increasing sequence AND fingerprint.
// A -> B -> A must not let the first A response overwrite the final A draft.
const latest = { latestFingerprint: "A", latestSequence: 3 };
assert.equal(isLatestFaceLabSaveRequest({ requestFingerprint: "A", requestSequence: 1, ...latest }), false);
assert.equal(isLatestFaceLabSaveRequest({ requestFingerprint: "B", requestSequence: 2, ...latest }), false);
assert.equal(isLatestFaceLabSaveRequest({ requestFingerprint: "A", requestSequence: 3, ...latest }), true);

assert.deepEqual(resolveFaceLabRestore({
  serverState: { surveyAnswers: rows.get("saved-one").face_lab.surveyAnswers },
  serverRevision: 2,
  localState: { surveyAnswers: { targetSelections: ["soft"] }, syncStatus: "pending", baseServerRevision: 1 }
}), { source: "server", shouldRetryPersist: false, conflict: true });
assert.deepEqual(resolveFaceLabRestore({
  serverState: { surveyAnswers: rows.get("saved-one").face_lab.surveyAnswers },
  serverRevision: 2,
  localState: { surveyAnswers: { targetSelections: ["soft"] }, syncStatus: "pending", baseServerRevision: 2 }
}), { source: "local", shouldRetryPersist: true, conflict: false });

console.log(JSON.stringify({
  ok: true,
  mode: "isolated_route_handler_with_mocked_auth_and_atomic_revision_db",
  actualProductionHandlers: ["GET", "POST"],
  cases: ["401", "404_owner", "400_revision", "400_target", "GET", "POST_success", "409_stale", "simultaneous_CAS", "A_B_A_stale_response", "reentry_conflict_and_retry"],
  writes: updates,
  realSupabase: false,
  realUser: false
}, null, 2));
