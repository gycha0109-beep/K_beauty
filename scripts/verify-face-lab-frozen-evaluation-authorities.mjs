import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const AUTHORITIES = Object.freeze({
  koreanReviewUi: "61d9d40db0f7fdac9aa2db1b68cad259f11e6ec0",
  hostedIntake: "a865cebcb64cd9c0fcebae691ba4e406def62673",
});

const eventName = process.env.EVENT_NAME || "";
const prBaseSha = process.env.PR_BASE_SHA || "";

function assertAncestor(ancestor, descendant, label) {
  const result = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", ancestor, descendant],
    { encoding: "utf8" },
  );
  assert.equal(
    result.status,
    0,
    `${label}: expected ${ancestor} to be an ancestor of ${descendant}`,
  );
}

for (const [label, sha] of Object.entries(AUTHORITIES)) {
  assert.match(sha, /^[0-9a-f]{40}$/, `${label}: invalid frozen authority SHA`);
  assertAncestor(sha, "HEAD", `${label} candidate authority`);
}

if (eventName === "pull_request") {
  assert.match(prBaseSha, /^[0-9a-f]{40}$/i, "pull request base SHA is required");
  for (const [label, sha] of Object.entries(AUTHORITIES)) {
    assertAncestor(sha, prBaseSha, `${label} base authority`);
  }
  assertAncestor(prBaseSha, "HEAD", "pull request base ancestry");
}

console.log(
  JSON.stringify(
    {
      status: "PASS",
      contractVersion: "face-lab-frozen-evaluation-authorities-v1",
      eventName,
      authorityCount: Object.keys(AUTHORITIES).length,
      pullRequestBaseChecked: eventName === "pull_request",
    },
    null,
    2,
  ),
);
