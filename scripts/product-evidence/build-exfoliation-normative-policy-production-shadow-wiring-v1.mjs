#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

export const STAGE = "V2.1-9E";
export const VERSION = "exfoliation-normative-policy-production-shadow-wiring-validation-v1";
export const OUTPUT = "exfoliation-normative-policy-production-shadow-wiring-validation-v1.json";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((key) => [key, stable(value[key])])
  );
}

export function canonical(value) {
  return JSON.stringify(stable(value), null, 2) + "\n";
}

export function build() {
  return {
    stage: STAGE,
    version: VERSION,
    boundary: "POST_SCORE_POST_SORT_ELIGIBILITY_OVERLAY_BEFORE_RESULT_ASSEMBLY",
    authorized_mode: "SHADOW",
    default_mode: "OFF",
    enforce_authorized: false,
    runtime_effect: "OBSERVATION_ONLY",
    canonical_mutation_authorized: false,
    restrict_behavior: "HYPOTHETICAL_EXCLUSION_ONLY",
    governed_runtime_product_count: 4,
    authority_gap_behavior: "DEFER_INSUFFICIENT_AUTHORITY",
    production_config_control: "HUMAN_OPERATOR_MEDIATED_VERCEL_PRODUCTION_ENV",
    expected_164x12_actions: {
      ALLOW: 2,
      CAUTION: 12,
      RESTRICT: 6,
      DEFER: 772,
      NOT_APPLICABLE: 1176
    },
    expected_restrict_positions: [72, 118, 130, 147, 149, 153],
    canonical_delta_off: 0,
    canonical_delta_shadow: 0,
    enforce_active: false
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputDir = process.env.V21_9E_OUTPUT_DIR ||
    "evidence/product-decision-axis-non-numeric-shadow-v1";
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, OUTPUT), canonical(build()), "utf8");
}
