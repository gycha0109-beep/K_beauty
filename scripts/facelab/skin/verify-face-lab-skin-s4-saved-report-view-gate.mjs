import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSavedReportViewGate } from "../../../apps/mobile/features/reports/saved-report-view-gate.ts";

// Synthetic identities/tickets only; no user session, photo or server traffic.
const view = createSavedReportViewGate();
assert.equal(view.snapshot(), null);
assert.throws(() => view.begin(""), /user_id_required/);

const oldAccount = view.begin("anonymous_A");
assert.equal(view.isCurrent(oldAccount), true);
assert.deepEqual(view.snapshot(), oldAccount);
const retry = view.begin("anonymous_A");
assert.equal(view.isCurrent(oldAccount), false, "slow retry must not restore an older report");
assert.equal(view.isCurrent(retry), true);

const otherAccount = view.begin("anonymous_B");
assert.equal(view.isCurrent(retry), false, "account switch must discard account A's payload");
assert.equal(view.isCurrent(otherAccount), true);
assert.notEqual(otherAccount.userId, oldAccount.userId);

view.invalidate(); // logout, route teardown, or locale transition
assert.equal(view.isCurrent(otherAccount), false);
assert.equal(view.snapshot(), null);
const fresh = view.begin("anonymous_A");
assert.equal(view.isCurrent(fresh), true);
assert.equal(view.isCurrent(oldAccount), false);

// Deterministic out-of-order completion: newer account finishes first.
function pending() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return {promise, resolve};
}
const asyncView = createSavedReportViewGate();
const slow = pending();
const fast = pending();
const presented = [];
const first = asyncView.begin("anonymous_A");
const taskA = slow.promise.then(() => {
  if (asyncView.isCurrent(first)) presented.push("A");
});
const second = asyncView.begin("anonymous_B");
const taskB = fast.promise.then(() => {
  if (asyncView.isCurrent(second)) presented.push("B");
});
fast.resolve();
await taskB;
slow.resolve();
await taskA;
assert.deepEqual(presented, ["B"], "late account A response must not overwrite B");

// Assert the actual saved-report screen uses the pure gate for both loads and
// public-share UI and cancels old session reads on auth/locale changes.
const source = readFileSync("apps/mobile/app/saved-report.tsx", "utf8");
assert(source.includes('import { getNativeSession, subscribeNativeAuth } from "../lib/auth";'));
assert(source.includes('createSavedReportViewGate'));
assert(source.includes('viewGate.current.begin(activeSession.user.id)'));
assert(source.includes('if (!viewGate.current.isCurrent(ticket)) return;'));
assert(source.includes('if (viewGate.current.isCurrent(ticket)) setState({ status: "error" });'));
assert(source.includes('const ticket = viewGate.current.snapshot();'));
assert(source.includes('ticket?.userId !== session.user.id'));
assert(source.includes('if (!viewGate.current.isCurrent(ticket)) return;\n\n    try {\n      await Share.share({'));
assert(source.includes('authEventSeen = true;'));
assert(source.includes('if (active && !authEventSeen) applySession(nextSession)'));
assert(source.includes('subscription?.unsubscribe();'));
assert(source.includes('viewGate.current.invalidate();'));

console.log("verify-face-lab-skin-s4-saved-report-view-gate: PASS (synthetic account race, logout, retry, sharing, no network)");
