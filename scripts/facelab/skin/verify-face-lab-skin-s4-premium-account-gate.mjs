import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPremiumViewGate } from "../../../apps/mobile/features/premium/premium-view-gate.ts";

// Synthetic account IDs and promise timing only. No auth tokens, payments or network.
const gate = createPremiumViewGate();
assert.equal(gate.snapshot(), null);
assert.throws(() => gate.begin(""), /premium_user_id_required/);
assert.throws(() => gate.begin("   "), /premium_user_id_required/);

const accountA = gate.begin("account_A");
assert.equal(gate.isCurrent(accountA), true);
assert.deepEqual(gate.snapshot(), accountA);
assert.equal(gate.tryBeginFinalize(accountA), true);
assert.equal(gate.tryBeginFinalize(accountA), false, "two rapid taps must create only one request");
assert.equal(gate.finishFinalize(accountA), true);
assert.equal(gate.tryBeginFinalize(accountA), true, "explicit retry after completion is allowed");
gate.invalidate();
assert.equal(gate.snapshot(), null);
assert.equal(gate.isCurrent(accountA), false);
assert.equal(gate.finishFinalize(accountA), false, "old completion cannot release a new account lock");

const accountB = gate.begin("account_B");
assert.equal(gate.isCurrent(accountB), true);
assert.equal(gate.tryBeginFinalize(accountB), true);
assert.equal(gate.finishFinalize(accountA), false);
assert.equal(gate.tryBeginFinalize(accountB), false, "old completion cannot enable a duplicate submit");
assert.equal(gate.finishFinalize(accountB), true);
assert.equal(gate.tryBeginFinalize(accountB), true);

const sameAccountRetry = gate.begin("account_B");
assert.equal(gate.isCurrent(accountB), false, "new access request revokes the previous generation");
assert.equal(gate.isCurrent(sameAccountRetry), true);
assert.equal(gate.tryBeginFinalize(accountB), false);
assert.equal(gate.tryBeginFinalize(sameAccountRetry), true);

// Out-of-order access results: B succeeds before A; A cannot replace the UI.
function pending() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
const asyncGate = createPremiumViewGate();
const slow = pending(), fast = pending();
const presented = [];
const first = asyncGate.begin("account_A");
const taskA = slow.promise.then(() => {
  if (asyncGate.isCurrent(first)) presented.push("A");
});
const second = asyncGate.begin("account_B");
const taskB = fast.promise.then(() => {
  if (asyncGate.isCurrent(second)) presented.push("B");
});
fast.resolve();
await taskB;
slow.resolve();
await taskA;
assert.deepEqual(presented, ["B"]);

// A stale finalize completion after logout must not navigate, display errors,
// or release the single-flight lock of a newly signed-in account.
const finalizeGate = createPremiumViewGate();
const oldTicket = finalizeGate.begin("account_A");
assert.equal(finalizeGate.tryBeginFinalize(oldTicket), true);
finalizeGate.invalidate();
const newTicket = finalizeGate.begin("account_B");
assert.equal(finalizeGate.tryBeginFinalize(newTicket), true);
assert.equal(finalizeGate.isCurrent(oldTicket), false);
assert.equal(finalizeGate.finishFinalize(oldTicket), false);
assert.equal(finalizeGate.tryBeginFinalize(newTicket), false);
assert.equal(finalizeGate.finishFinalize(newTicket), true);

// Check the actual React screen wires auth changes, request gating,
// same-user token refresh, teardown and finalization to the pure gate.
const source = readFileSync("apps/mobile/app/premium.tsx", "utf8");
for (const required of [
  'import { getNativeSession, subscribeNativeAuth } from "../lib/auth";',
  'createPremiumViewGate',
  'viewGate.current.begin(session.user.id)',
  'viewGate.current.isCurrent(ticket)',
  'viewGate.current.tryBeginFinalize(ticket)',
  'viewGate.current.finishFinalize(ticket)',
  'activeSessionRef.current',
  'previousUserId === nextUserId',
  'authEventSeen = true;',
  'if (active && !authEventSeen) applySession(nextSession)',
  'subscription?.unsubscribe();',
  'setCurrentProducts([]);',
  'viewGate.current.invalidate();',
  'if (viewGate.current.isCurrent(ticket)) router.replace("/saved-report");'
]) {
  assert(source.includes(required), "missing premium account safety wiring: " + required);
}
console.log("verify-face-lab-skin-s4-premium-account-gate: PASS (synthetic auth, retry, double-submit and stale completion)");
