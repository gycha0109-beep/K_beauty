import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  FACE_LAB_IMAGE_COST_PRICING_VERSION,
  estimateFaceLabImageCost
} from "../lib/face-lab-v2/image-generation-cost.js";

const exact =
  estimateFaceLabImageCost({
    input_tokens: 1200,
    input_tokens_details: {
      image_tokens: 1000,
      text_tokens: 200
    },
    output_tokens: 3000,
    output_tokens_details: {
      image_tokens: 3000
    },
    total_tokens: 4200
  });

assert.equal(
  exact.pricingVersion,
  FACE_LAB_IMAGE_COST_PRICING_VERSION
);
assert.equal(
  exact.estimatedCostNanoUsd,
  99_000_000
);

const conservative =
  estimateFaceLabImageCost({
    input_tokens: 1000,
    output_tokens: 1000,
    total_tokens: 2000
  });

assert.equal(
  conservative.estimatedCostNanoUsd,
  38_000_000,
  "unknown input-token mix must use the higher image-input rate instead of undercounting"
);

const runner =
  readFileSync(
    new URL(
      "./run-face-lab-v2-simulation-provider-pilot-e2e.mjs",
      import.meta.url
    ),
    "utf8"
  );
const route =
  readFileSync(
    new URL(
      "../app/api/face-lab-simulation-test/route.js",
      import.meta.url
    ),
    "utf8"
  );
const runtime =
  readFileSync(
    new URL(
      "../lib/openai-image-edit-runtime-core.js",
      import.meta.url
    ),
    "utf8"
  );
const service =
  readFileSync(
    new URL(
      "../lib/face-lab-v2/simulation-service-core.js",
      import.meta.url
    ),
    "utf8"
  );

for (const marker of [
  "manifest.checkpoint.json",
  "FACE_LAB_G_E2B_PROVIDER_E2E_REUSED_COMPLETE",
  "face_lab_g_e2b_generation_reused",
  "validateReusableCases",
  "loadReusableCampaignState",
  "reusedCaseCount",
  "generatedCaseCount",
  "estimatedCostNanoUsd",
  "providerAttemptCount",
  "costTelemetry",
  "FACE_LAB_E2E_NEW_OUTPUT_BUDGET",
  "FACE_LAB_PROVIDER_E2E_PARTIAL_BUDGET_REACHED",
  "generationBudgetReached",
  "face_lab_e2e_checkpoint_case_order_invalid",
  "intentPlanBinding",
  "manifest.intentPlanVersion",
  "manifest.surveyProfileVersion",
  "manifest.intentKeys"
]) {
  assert.ok(
    runner.includes(marker),
    `missing paid calibration resume marker: ${marker}`
  );
}

const mainSource =
  runner.slice(
    runner.indexOf(
      "async function main()"
    )
  );

assert.ok(
  mainSource.indexOf(
    "FACE_LAB_G_E2B_PROVIDER_E2E_REUSED_COMPLETE"
  ) <
    mainSource.indexOf(
      "await discoverPublicConfig"
    ),
  "complete campaign reuse must exit before auth/provider discovery"
);

assert.ok(
  runner.includes(
    "face_lab_e2e_checkpoint_path_invalid"
  ),
  "resumed output and review-input paths must remain confined to the campaign directory"
);

const paidCallIndex =
  mainSource.indexOf(
    "const simulation = await postSimulation"
  );
const paidBudgetGuardIndex =
  mainSource.indexOf(
    "generatedCaseCount >=\n        newOutputBudget"
  );

assert.ok(
  paidBudgetGuardIndex >= 0 &&
    paidBudgetGuardIndex <
      paidCallIndex,
  "new-output budget must be checked immediately before any new paid simulation call"
);
assert.ok(
  mainSource.includes(
    "break generationLoop"
  ),
  "paid budget must hard-stop the generation loop"
);
assert.ok(
  mainSource.includes(
    'buildManifest(\n        "partial"\n      )'
  ),
  "budget stop must persist a partial checkpoint instead of completing the wave"
);

for (const marker of [
  "X-Face-Lab-Provider-Attempts",
  "X-Face-Lab-Usage-Input-Image-Tokens",
  "X-Face-Lab-Usage-Input-Text-Tokens",
  "X-Face-Lab-Usage-Output-Image-Tokens",
  "X-Face-Lab-Estimated-Cost-Nano-USD",
  "X-Face-Lab-Cost-Pricing-Version"
]) {
  assert.ok(
    route.includes(marker),
    `missing simulation telemetry header: ${marker}`
  );
}

assert.ok(
  runtime.includes(
    "attemptCount += 1"
  )
);
assert.ok(
  runtime.includes(
    "attemptCount,"
  )
);
assert.ok(
  service.includes(
    "providerResult.attemptCount"
  )
);

console.log(
  "FACE_LAB_PAID_CALIBRATION_RESUME_COST=PASS"
);
