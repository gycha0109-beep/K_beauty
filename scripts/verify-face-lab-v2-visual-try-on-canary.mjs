#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  spawnSync
} from "node:child_process";
import {
  fileURLToPath
} from "node:url";
import {
  FACE_LAB_VISUAL_TRY_ON_CANARY_PLAN_VERSION,
  FACE_LAB_VISUAL_TRY_ON_CANARY_REFERENCE_ASSETS,
  buildFaceLabVisualTryOnCanaryAuthority
} from "../lib/face-lab-v2/visual-try-on-canary-plan.js";

const authority =
  buildFaceLabVisualTryOnCanaryAuthority();

assert.equal(
  FACE_LAB_VISUAL_TRY_ON_CANARY_PLAN_VERSION,
  "face-lab-visual-try-on-canary-plan-v1"
);
assert.equal(
  authority.status,
  "ready"
);
assert.deepEqual(
  authority.renderSpec
    .operations
    .map((item) =>
      item.slotKey
    ),
  [
    "face_highlight",
    "iris_appearance",
    "lip_color"
  ]
);
assert.deepEqual(
  authority.referenceAssets
    .map((item) =>
      item.assetRef
    ),
  [
    FACE_LAB_VISUAL_TRY_ON_CANARY_REFERENCE_ASSETS
      .highlight,
    FACE_LAB_VISUAL_TRY_ON_CANARY_REFERENCE_ASSETS
      .lens,
    FACE_LAB_VISUAL_TRY_ON_CANARY_REFERENCE_ASSETS
      .lip
  ]
);
assert.equal(
  authority.imageModelInvoked,
  false
);
assert.equal(
  authority.providerPayload,
  null
);

const root =
  path.resolve(
    process.cwd(),
    "private",
    "face-lab-visual-try-on"
  );
const inputRoot =
  path.join(
    root,
    "input"
  );
const statePath =
  path.join(
    root,
    "current-campaign.json"
  );
const campaignId =
  "VT-CI-VERIFY";
const campaignDir =
  path.join(
    root,
    campaignId
  );
const runnerPath =
  fileURLToPath(
    new URL(
      "./run-face-lab-v2-visual-try-on-canary.mjs",
      import.meta.url
    )
  );

function png(seed) {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
    seed, seed + 1,
    seed + 2, seed + 3
  ]);
}

const fixtureFiles = {
  source:
    "ci-visual-try-on-source.png",
  lip:
    "ci-visual-try-on-lip.png",
  highlight:
    "ci-visual-try-on-highlight.png",
  lens:
    "ci-visual-try-on-lens.png"
};

await fs.mkdir(
  inputRoot,
  {
    recursive: true
  }
);

let previousState = null;
let hadPreviousState = false;

try {
  previousState =
    await fs.readFile(
      statePath
    );
  hadPreviousState = true;
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

try {
  await fs.writeFile(
    path.join(
      inputRoot,
      fixtureFiles.source
    ),
    png(0x01)
  );
  await fs.writeFile(
    path.join(
      inputRoot,
      fixtureFiles.lip
    ),
    png(0x11)
  );
  await fs.writeFile(
    path.join(
      inputRoot,
      fixtureFiles.highlight
    ),
    png(0x21)
  );
  await fs.writeFile(
    path.join(
      inputRoot,
      fixtureFiles.lens
    ),
    png(0x31)
  );

  const baseEnv = {
    ...process.env,
    FACE_LAB_VISUAL_TRY_ON_SOURCE_IMAGE:
      fixtureFiles.source,
    FACE_LAB_VISUAL_TRY_ON_LIP_REFERENCE:
      fixtureFiles.lip,
    FACE_LAB_VISUAL_TRY_ON_HIGHLIGHT_REFERENCE:
      fixtureFiles.highlight,
    FACE_LAB_VISUAL_TRY_ON_LENS_REFERENCE:
      fixtureFiles.lens,
    FACE_LAB_VISUAL_TRY_ON_LIVE_APPROVAL:
      "",
    OPENAI_API_KEY:
      ""
  };

  const precheck =
    spawnSync(
      process.execPath,
      [
        runnerPath,
        "precheck",
        campaignId
      ],
      {
        cwd:
          process.cwd(),
        env: baseEnv,
        encoding: "utf8"
      }
    );

  assert.equal(
    precheck.status,
    0,
    precheck.stderr
  );

  const precheckResult =
    JSON.parse(
      precheck.stdout
    );

  assert.equal(
    precheckResult.verdict,
    "FACE_LAB_VISUAL_TRY_ON_PRECHECK_PASS"
  );
  assert.equal(
    precheckResult.providerCalls,
    0
  );
  assert.equal(
    precheckResult.realProviderInvoked,
    false
  );
  assert.equal(
    precheckResult.references.length,
    3
  );

  const persistedPrecheck =
    JSON.parse(
      await fs.readFile(
        path.join(
          campaignDir,
          "precheck.json"
        ),
        "utf8"
      )
    );

  assert.equal(
    persistedPrecheck.status,
    "ready"
  );
  assert.equal(
    persistedPrecheck.providerCalls,
    0
  );
  assert.match(
    persistedPrecheck
      .binding
      .bindingSha256,
    /^[a-f0-9]{64}$/
  );

  const noApproval =
    spawnSync(
      process.execPath,
      [
        runnerPath,
        "canary",
        campaignId
      ],
      {
        cwd:
          process.cwd(),
        env: {
          ...baseEnv,
          CI: ""
        },
        encoding: "utf8"
      }
    );

  assert.notEqual(
    noApproval.status,
    0
  );
  assert.match(
    noApproval.stderr,
    /visual_try_on_canary_live_approval_required/
  );

  const ciForbidden =
    spawnSync(
      process.execPath,
      [
        runnerPath,
        "canary",
        campaignId
      ],
      {
        cwd:
          process.cwd(),
        env: {
          ...baseEnv,
          CI: "1",
          FACE_LAB_VISUAL_TRY_ON_LIVE_APPROVAL:
            "I_ACCEPT_ONE_OPENAI_IMAGE_COST"
        },
        encoding: "utf8"
      }
    );

  assert.notEqual(
    ciForbidden.status,
    0
  );
  assert.match(
    ciForbidden.stderr,
    /visual_try_on_canary_ci_forbidden/
  );

  await assert.rejects(
    () =>
      fs.access(
        path.join(
          campaignDir,
          "manifest.checkpoint.json"
        )
      ),
    {
      code: "ENOENT"
    }
  );

  await assert.rejects(
    () =>
      fs.access(
        path.join(
          campaignDir,
          "canary-gate.json"
        )
      ),
    {
      code: "ENOENT"
    }
  );

  console.log(
    JSON.stringify({
      status: "PASS",
      planVersion:
        FACE_LAB_VISUAL_TRY_ON_CANARY_PLAN_VERSION,
      precheckProviderCalls: 0,
      paidExecutionInCi:
        false,
      liveApprovalGuard:
        true,
      ciFailClosed:
        true,
      canaryOutputsCreated:
        0
    })
  );
} finally {
  await fs.rm(
    campaignDir,
    {
      recursive: true,
      force: true
    }
  );

  for (
    const fileName of
      Object.values(
        fixtureFiles
      )
  ) {
    await fs.rm(
      path.join(
        inputRoot,
        fileName
      ),
      {
        force: true
      }
    );
  }

  if (hadPreviousState) {
    await fs.mkdir(
      path.dirname(
        statePath
      ),
      {
        recursive: true
      }
    );
    await fs.writeFile(
      statePath,
      previousState
    );
  } else {
    await fs.rm(
      statePath,
      {
        force: true
      }
    );
  }
}
