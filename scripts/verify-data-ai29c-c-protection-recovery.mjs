import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractStrictFactCandidate } from "./trust-research-worker.mjs";

const root = process.cwd();
const read = (path) => {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) throw new Error(`missing file: ${path}`);
  return readFileSync(absolute, "utf8");
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (text, value, label) =>
  assert(text.includes(value), `${label} missing: ${value}`);
const excludes = (text, value, label) =>
  assert(!text.includes(value), `${label} unexpectedly contains: ${value}`);

const migration = read(
  "supabase/migrations/20260929113000_data_ai29c_c_protection_recovery_tasks_v1.sql"
);
const worker = read("scripts/trust-research-worker.mjs");

[
  "data-ai29c-protection-recovery-v1",
  "read_data_ai29c_protection_recovery_v1",
  "enqueue_data_ai29c_protection_recovery_tasks_v1",
  "water_resistance_duration",
  "productionCutoverAuthorized",
  "outdoorRankableSignalAuthorized",
  "legacyLeadPresent",
  "RESEARCH_PENDING",
  "product_specific_primary",
  "grant execute on function public.read_data_ai29c_protection_recovery_v1()",
  "grant execute on function public.enqueue_data_ai29c_protection_recovery_tasks_v1()",
].forEach((value) => includes(migration, value, "DATA-AI29C-C migration"));

[
  "explicit-water-resistance-duration-v1",
  'metric: "water_resistance_duration"',
  'method_context: "explicit_product_claim"',
  'timepoint: "labeled_duration"',
].forEach((value) => includes(worker, value, "DATA-AI29C-C worker"));

excludes(
  migration,
  "select public.enqueue_data_ai29c_protection_recovery_tasks_v1()",
  "automatic recovery enqueue"
);
excludes(migration, "water_resistant_minutes as water_duration", "legacy authority copy");
excludes(worker, "Broad Spectrum", "Broad Spectrum coercion");

assert(
  !/(insert\s+into|update|delete\s+from)\s+public\.(product_fact_instances|product_fact_current|product_fact_confirmations|product_evidence_records|product_evidence_sources|product_evidence_source_subject_bindings|product_fact_subjects)\b/i.test(
    migration
  ),
  "DATA-AI29C-C migration must not mutate Product Fact authority tables"
);
assert(
  !/(insert\s+into|update|delete\s+from)\s+public\.recommendation/i.test(migration),
  "DATA-AI29C-C migration must not mutate Recommendation authority"
);
assert(
  !/grant\s+execute[\s\S]{0,180}(read_data_ai29c_protection_recovery_v1|enqueue_data_ai29c_protection_recovery_tasks_v1)[\s\S]{0,80}to\s+(?:anon|authenticated|public)/i.test(
    migration
  ),
  "DATA-AI29C-C recovery RPCs must remain service-role-only"
);

const english = extractStrictFactCandidate(
  "water_resistance_duration",
  "Broad Spectrum SPF 50. Water resistant (80 minutes)."
);
assert(
  english?.normalizedValue?.amount === 80 &&
    english?.normalizedValue?.unit === "minutes",
  "explicit English water-resistance duration did not normalize"
);
assert(
  english?.qualifier?.metric === "water_resistance_duration" &&
    english?.qualifier?.method_context === "explicit_product_claim" &&
    english?.qualifier?.timepoint === "labeled_duration",
  "water-resistance qualifier contract invalid"
);

const korean = extractStrictFactCandidate(
  "water_resistance_duration",
  "80분 워터프루프 지속"
);
assert(
  korean?.normalizedValue?.amount === 80,
  "explicit Korean water-resistance duration did not normalize"
);

const japaneseDuration = extractStrictFactCandidate(
  "water_resistance_duration",
  "耐水性 40分"
);
assert(
  japaneseDuration?.normalizedValue?.amount === 40,
  "explicit Japanese water-resistance duration did not normalize"
);

assert(
  extractStrictFactCandidate("water_resistance_duration", "UV耐水性★★") === null,
  "UV water-resistance star rating must not be converted to minutes"
);
assert(
  extractStrictFactCandidate(
    "water_resistance_duration",
    "Water resistant sunscreen for outdoor use"
  ) === null,
  "durationless water-resistance claim must remain unknown"
);
assert(
  extractStrictFactCandidate("uva_label", "Broad Spectrum SPF 50") === null,
  "Broad Spectrum must not be coerced to a PA/UVA label"
);

console.log("DATA_AI29C_C_PROTECTION_RECOVERY_CONTRACT_VERIFIED");
