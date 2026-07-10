import assert from "node:assert/strict";
import {
  FORBIDDEN_SHADOW_ARTIFACT_FIELDS,
  REQUIRED_SHADOW_ARTIFACT_FIELDS,
  SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION,
  validateShadowRuntimeDryRunArtifact
} from "../lib/shadow-runtime-dry-run-artifact-schema.js";

function validArtifact(overrides = {}) {
  return {
    schemaVersion: SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION,
    evidenceType: "shadow_runtime_dry_run_schema_test",
    runtimeConnected: false,
    dryRunOnly: true,
    routeInvoked: false,
    supabaseWriteExecuted: false,
    runtimeMutation: false,
    baseline: {
      evidenceType: "baseline_schema_test",
      candidateRows: [{ productId: "schema-product-1", category: "serum", reasonKeys: ["baseline"] }]
    },
    shadow: {
      evidenceType: "shadow_runtime_dry_run_schema_test",
      candidateRows: [{
        productId: "schema-product-1",
        category: "serum",
        boundaryDecision: "downgrade_to_collapsed_candidate",
        candidatePolicyHint: "collapsed_candidate_hint",
        receiverDecision: "accept_collapsed_candidate_hint",
        reasonKeys: ["schema_test"]
      }]
    },
    comparison: {
      hiddenToCollapsedDelta: 1,
      collapsedToHiddenRegressionCount: 0,
      highRiskCollapsedReceiverCount: 0,
      metadataIncompleteCollapsedReceiverCount: 0,
      apiResponseShapeChanged: false,
      recommendationResultChanged: false,
      topPickChanged: false,
      supportingProductsChanged: false,
      budgetAlternativesChanged: false,
      dbWriteCount: 0
    },
    evidenceSeparation: {
      actualEvidenceBucket: "actual_complete_product_row_capture",
      pureReplayEvidenceBucket: "pure_engine_replay",
      syntheticCoverageBucket: "synthetic_contract_case",
      syntheticTreatedAsActualEvidence: false
    },
    artifactSanitization: {
      forbiddenFieldsPresent: false,
      fullApiResponseBodyDumped: false,
      envValuesPrinted: false
    },
    ...overrides
  };
}

function assertInvalidWithCode(artifact, code) {
  const result = validateShadowRuntimeDryRunArtifact(artifact);
  assert.equal(result.valid, false, `${code} sample should fail`);
  assert(
    result.errors.some((error) => error.code === code),
    `expected validation error code ${code}, got ${result.errors.map((error) => error.code).join(", ")}`
  );
  return result;
}

assert.equal(typeof SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION, "string");
assert(REQUIRED_SHADOW_ARTIFACT_FIELDS.includes("baseline"));
assert(REQUIRED_SHADOW_ARTIFACT_FIELDS.includes("shadow"));
assert(REQUIRED_SHADOW_ARTIFACT_FIELDS.includes("evidenceSeparation"));
assert(FORBIDDEN_SHADOW_ARTIFACT_FIELDS.includes("brand"));
assert(FORBIDDEN_SHADOW_ARTIFACT_FIELDS.includes("purchase_url"));
assert(FORBIDDEN_SHADOW_ARTIFACT_FIELDS.includes("review_text"));
assert(FORBIDDEN_SHADOW_ARTIFACT_FIELDS.includes("full_api_response_body"));

const validResult = validateShadowRuntimeDryRunArtifact(validArtifact());
assert.equal(validResult.valid, true);
assert.equal(validResult.summary.runtimeConnected, false);
assert.equal(validResult.summary.dryRunOnly, true);
assert.equal(validResult.summary.baselineSeparated, true);

assertInvalidWithCode(
  {
    ...validArtifact(),
    shadow: {
      evidenceType: "shadow_runtime_dry_run_schema_test",
      candidateRows: [{ productId: "schema-product-2", category: "serum", brand: "forbidden" }]
    }
  },
  "forbidden_field_present"
);

const missingRequired = validArtifact();
delete missingRequired.baseline;
assertInvalidWithCode(missingRequired, "missing_required_field");

assertInvalidWithCode(
  {
    ...validArtifact(),
    fullApiResponseBody: { ok: true }
  },
  "forbidden_field_present"
);

assertInvalidWithCode(
  {
    ...validArtifact(),
    shadow: {
      evidenceType: "shadow_runtime_dry_run_schema_test",
      candidateRows: [{ productId: "schema-product-3", category: "serum", productName: "forbidden" }]
    }
  },
  "forbidden_field_present"
);

assertInvalidWithCode(
  {
    ...validArtifact(),
    shadow: {
      evidenceType: "shadow_runtime_dry_run_schema_test",
      candidateRows: [{ productId: "schema-product-4", category: "serum", purchaseUrl: "https://example.invalid/p" }]
    }
  },
  "forbidden_field_present"
);

assertInvalidWithCode(
  {
    ...validArtifact(),
    shadow: {
      evidenceType: "shadow_runtime_dry_run_schema_test",
      candidateRows: [{ productId: "schema-product-5", category: "serum", reviewText: "forbidden" }]
    }
  },
  "forbidden_field_present"
);

assertInvalidWithCode(
  {
    ...validArtifact(),
    shadow: {
      evidenceType: "shadow_runtime_dry_run_schema_test",
      candidateRows: [{ productId: "schema-product-6", category: "serum", rawForm: { unsafe: true } }]
    }
  },
  "forbidden_field_present"
);

assertInvalidWithCode(
  {
    ...validArtifact(),
    shadow: {
      evidenceType: "shadow_runtime_dry_run_schema_test",
      candidateRows: [{ productId: "schema-product-7", category: "serum", image: "data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAA" }]
    }
  },
  "forbidden_field_present"
);

assertInvalidWithCode(
  {
    ...validArtifact(),
    artifactSanitization: {
      forbiddenFieldsPresent: false,
      fullApiResponseBodyDumped: false,
      envValuesPrinted: false
    },
    shadow: {
      evidenceType: "shadow_runtime_dry_run_schema_test",
      candidateRows: [{ productId: "schema-product-8", category: "serum", pii: "forbidden" }]
    }
  },
  "forbidden_field_present"
);

assertInvalidWithCode(
  {
    ...validArtifact(),
    shadow: {
      evidenceType: "shadow_runtime_dry_run_schema_test",
      candidateRows: [{ productId: "schema-product-9", category: "serum", secret: "api_key=abcdefghi" }]
    }
  },
  "forbidden_field_present"
);

assertInvalidWithCode(
  {
    ...validArtifact(),
    runtimeConnected: true
  },
  "runtime_connected_not_false"
);

assertInvalidWithCode(
  {
    ...validArtifact(),
    supabaseWriteExecuted: true
  },
  "supabase_write_executed_not_false"
);

assertInvalidWithCode(
  {
    ...validArtifact(),
    baseline: null
  },
  "baseline_missing"
);

const first = validateShadowRuntimeDryRunArtifact(validArtifact());
const second = validateShadowRuntimeDryRunArtifact(validArtifact());
assert.deepEqual(first, second, "schema validation should be deterministic");

console.log("verify-shadow-runtime-dry-run-artifact-schema passed");
