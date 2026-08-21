import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const manifestPath = path.resolve(
  process.env.EVAL_P4_MANIFEST_PATH || "fixtures/persona-evaluation/eval-p4-cohort-freeze-manifest-v1.json"
);
const p3ReferenceRoot = path.resolve(process.env.EVAL_P4_P3_REFERENCE_ROOT || "_reference/persona-p3");
const artifactRoot = path.resolve(process.env.EVAL_P4_ARTIFACT_ROOT || "artifacts/eval-p4");

function invariant(condition, message, detail = null) {
  if (!condition) {
    const suffix = detail == null ? "" : `\n${JSON.stringify(detail, null, 2)}`;
    throw new Error(`${message}${suffix}`);
  }
}

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameObject(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function countBy(values) {
  return Object.fromEntries(
    [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map()).entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b), "en"))
  );
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const p3ModulePath = path.join(p3ReferenceRoot, manifest.execution_authority.p3_materializer_path);
const p3 = await import(pathToFileURL(p3ModulePath).href);

invariant(manifest.schema_version === "eval-p4-cohort-freeze-manifest-v1", "manifest schema mismatch");
invariant(manifest.freeze_contract_version === "eval-p4-cohort-freeze-v1", "freeze contract mismatch");
invariant(manifest.stage === "EVAL-P4", "stage mismatch");
invariant(typeof p3.materializeP3Personas === "function", "P3 materializer unavailable");
invariant(typeof p3.semanticHash === "function", "P3 semanticHash unavailable");
invariant(typeof p3.validateMaterializedPersona === "function", "P3 validator unavailable");

const sourceSet = p3.materializeP3Personas();
invariant(
  sourceSet.lineage?.cohort_hash === manifest.execution_authority.p3_combined_cohort_hash,
  "P3 source cohort hash drift",
  { expected: manifest.execution_authority.p3_combined_cohort_hash, actual: sourceSet.lineage?.cohort_hash }
);
invariant(sourceSet.personas.length === 40, "P3 source Persona count must remain 40");

const validationErrors = sourceSet.personas.flatMap((persona) =>
  p3.validateMaterializedPersona(persona).map((error) => ({ persona_id: persona.persona_id, ...error }))
);
invariant(validationErrors.length === 0, "P3 source Persona validation failed", validationErrors);

const sourceCoverage = sourceSet.personas.filter((persona) => persona.cohort_type === "COVERAGE_COHORT");
const sourceAdversarial = sourceSet.personas.filter((persona) => persona.cohort_type === "ADVERSARIAL_COHORT");
const sourcePopulation = sourceSet.personas.filter((persona) => persona.cohort_type === "POPULATION_PRIOR_COHORT");

invariant(sourceCoverage.length === 32, "P3 Coverage source count mismatch");
invariant(sourceAdversarial.length === 8, "P3 Adversarial source count mismatch");
invariant(sourcePopulation.length === 0, "P3 source unexpectedly contains Population-Prior Persona");
invariant(
  p3.semanticHash(sourceCoverage) === manifest.execution_authority.p3_source_coverage_hash,
  "P3 source Coverage payload hash drift"
);
invariant(
  p3.semanticHash(sourceAdversarial) === manifest.execution_authority.p3_source_adversarial_hash,
  "P3 source Adversarial payload hash drift"
);

const locked = Object.fromEntries(manifest.locked_cohorts.map((cohort) => [cohort.cohort_type, cohort]));
const coverageLock = locked.COVERAGE_COHORT;
const adversarialLock = locked.ADVERSARIAL_COHORT;

for (const cohort of [coverageLock, adversarialLock]) {
  invariant(cohort?.lifecycle === "LOCKED", "official technical cohort must be LOCKED", cohort);
  invariant(cohort.mutation_policy === "NEW_VERSION_REQUIRED", "LOCKED mutation policy must require a new version", cohort);
  invariant(cohort.weighting_strategy === "NONE", "technical P4 cohort must remain unweighted", cohort);
  invariant(cohort.market_prevalence_claim_allowed === false, "technical cohort cannot claim market prevalence", cohort);
  invariant(cohort.cross_cohort_raw_rate_comparison_allowed === false, "raw cross-cohort rate comparison must remain forbidden", cohort);
  invariant(cohort.prng_algorithm === "NONE" && cohort.seed === 0, "deterministic cohort lineage drift", cohort);
}

invariant(
  coverageLock.dedup_policy === "FIRST_OCCURRENCE_BY_P3_SOURCE_ORDER_PER_CANONICAL_DOMAIN_HASH",
  "Coverage dedup policy drift"
);

const firstByDomainHash = new Map();
const coverage = [];
const duplicateOf = {};
for (const persona of sourceCoverage) {
  const domainHash = p3.semanticHash(persona.domain);
  if (firstByDomainHash.has(domainHash)) {
    duplicateOf[persona.persona_id] = firstByDomainHash.get(domainHash);
  } else {
    firstByDomainHash.set(domainHash, persona.persona_id);
    coverage.push(persona);
  }
}
const adversarial = sourceAdversarial;

invariant(coverage.length === 29, "Coverage deduplicated count mismatch", { actual: coverage.length });
invariant(adversarial.length === 8, "Adversarial locked count mismatch");
invariant(
  sameObject(duplicateOf, coverageLock.dedup_duplicate_of),
  "Coverage duplicate map drift",
  { expected: coverageLock.dedup_duplicate_of, actual: duplicateOf }
);
invariant(
  sameArray(Object.keys(duplicateOf), coverageLock.dedup_excluded_ids),
  "Coverage dedup exclusion order drift",
  { expected: coverageLock.dedup_excluded_ids, actual: Object.keys(duplicateOf) }
);

const coverageIds = coverage.map((persona) => persona.persona_id);
const adversarialIds = adversarial.map((persona) => persona.persona_id);
invariant(sameArray(coverageIds, coverageLock.member_ids), "Coverage locked membership drift", { expected: coverageLock.member_ids, actual: coverageIds });
invariant(sameArray(adversarialIds, adversarialLock.member_ids), "Adversarial locked membership drift", { expected: adversarialLock.member_ids, actual: adversarialIds });
invariant(new Set([...coverageIds, ...adversarialIds]).size === 37, "Locked technical cohort membership overlap detected");

const coverageHash = p3.semanticHash(coverage);
const adversarialHash = p3.semanticHash(adversarial);
invariant(
  coverageHash === coverageLock.cohort_hash,
  "Coverage LOCKED cohort hash mismatch",
  { expected: coverageLock.cohort_hash, actual: coverageHash }
);
invariant(
  adversarialHash === adversarialLock.cohort_hash,
  "Adversarial LOCKED cohort hash mismatch",
  { expected: adversarialLock.cohort_hash, actual: adversarialHash }
);

function verifyProvenance(personas, lock, expectedPurpose, expectedOversamplingFlag) {
  for (const persona of personas) {
    invariant(persona.population === null, "P4 technical Persona must not acquire Population fields", { persona_id: persona.persona_id });
    invariant(persona.scenario_modifiers?.purpose === expectedPurpose, "P4 technical cohort purpose drift", { persona_id: persona.persona_id });
    invariant(
      persona.scenario_modifiers?.oversampling_flags?.includes(expectedOversamplingFlag),
      "P4 oversampling semantics missing",
      { persona_id: persona.persona_id }
    );
    invariant(Array.isArray(persona.attribute_provenance) && persona.attribute_provenance.length > 0, "Persona provenance missing", { persona_id: persona.persona_id });
    for (const provenance of persona.attribute_provenance) {
      invariant(
        provenance.source_class === lock.expected_attribute_source_class,
        "attribute source-class drift",
        { persona_id: persona.persona_id, provenance }
      );
      invariant(
        provenance.correlation_basis === lock.expected_correlation_basis,
        "correlation-basis drift",
        { persona_id: persona.persona_id, provenance }
      );
      invariant(
        provenance.authority_ceiling === "SIMULATION_INPUT_ALLOWED",
        "attribute authority ceiling drift",
        { persona_id: persona.persona_id, provenance }
      );
    }
  }
}

verifyProvenance(coverage, coverageLock, "TECHNICAL_COVERAGE", "NON_REPRESENTATIVE_TECHNICAL_COVERAGE");
verifyProvenance(adversarial, adversarialLock, "TECHNICAL_ADVERSARIAL", "NON_REPRESENTATIVE_ADVERSARIAL");

const populationPrior = manifest.population_prior;
invariant(populationPrior.lifecycle === "DEFERRED_NOT_LOCKED", "Population-Prior lifecycle must remain deferred");
invariant(populationPrior.lock_allowed === false, "Population-Prior lock cannot be enabled without P2 adoption authority");
invariant(populationPrior.persona_count === 0, "Population-Prior count must remain zero");
invariant(populationPrior.authorized_population_dataset === "NONE", "P4 must not silently adopt a Population dataset");
invariant(populationPrior.authorized_population_field_registry === "EMPTY", "P4 must not invent Population fields");
invariant(populationPrior.population_realism_claim_allowed === false, "Population realism cannot be claimed");
invariant(populationPrior.recommendation_use_allowed === false, "Layer A recommendation use cannot be enabled");

const candidateDecisions = Object.fromEntries(
  populationPrior.candidate_revalidation.map((item) => [item.candidate_id, item.p4_decision])
);
invariant(
  candidateDecisions["nvidia-nemotron-personas-korea"] === "HOLD_FOR_REVISION_PINNED_ADOPTION_RECORD",
  "Nemotron candidate must not be silently adopted"
);
invariant(
  candidateDecisions.personahub === "RESEARCH_REFERENCE_ONLY_NOT_POPULATION_SEED",
  "PersonaHub must not be promoted to Population seed"
);

invariant(manifest.regression_cohort.lifecycle === "NOT_CREATED", "P4 must not silently create a LOCKED_REGRESSION_COHORT");
invariant(manifest.authority_ceiling.evidence_class === "SYNTHETIC_SIMULATION_EVIDENCE", "synthetic evidence namespace drift");
for (const key of [
  "organic_production_evidence",
  "controlled_production_evidence",
  "real_user_truth",
  "market_prevalence",
  "satisfaction_or_conversion_truth",
  "product_fact_authority",
  "enforce_authority"
]) {
  invariant(manifest.authority_ceiling[key] === false, `authority escalation detected: ${key}`);
}

const sourceCoverageDomainHashes = sourceCoverage.map((persona) => p3.semanticHash(persona.domain));
const coverageDomainHashes = coverage.map((persona) => p3.semanticHash(persona.domain));
const adversarialDomainHashes = adversarial.map((persona) => p3.semanticHash(persona.domain));

invariant(new Set(sourceCoverageDomainHashes).size === 29, "P3 Coverage collapse diagnostic changed");
invariant(new Set(coverageDomainHashes).size === 29, "Locked Coverage still contains duplicate Domain states");
invariant(new Set(adversarialDomainHashes).size === 8, "Adversarial Persona collapse detected");
invariant(new Set([...coverageDomainHashes, ...adversarialDomainHashes]).size === 37, "Cross-cohort locked Domain-state overlap detected");

const allLockedPersonas = [...coverage, ...adversarial];
const summary = {
  schema_version: "eval-p4-cohort-freeze-summary-v1",
  stage: "EVAL-P4",
  terminal_outcome: "COVERAGE_ADVERSARIAL_LOCKED_POPULATION_PRIOR_DEFERRED",
  execution_authority: manifest.execution_authority,
  freeze_manifest_semantic_hash: p3.semanticHash(manifest),
  source_combined_cohort_hash: sourceSet.lineage.cohort_hash,
  source_collapse_diagnostic: {
    p3_coverage_persona_count: sourceCoverage.length,
    p3_coverage_unique_domain_patterns: new Set(sourceCoverageDomainHashes).size,
    duplicate_of: duplicateOf
  },
  locked_cohorts: {
    coverage: {
      cohort_id: coverageLock.cohort_id,
      lifecycle: coverageLock.lifecycle,
      source_persona_count: sourceCoverage.length,
      persona_count: coverage.length,
      cohort_hash: coverageHash,
      unique_domain_patterns: new Set(coverageDomainHashes).size,
      dedup_excluded_ids: coverageLock.dedup_excluded_ids
    },
    adversarial: {
      cohort_id: adversarialLock.cohort_id,
      lifecycle: adversarialLock.lifecycle,
      source_persona_count: sourceAdversarial.length,
      persona_count: adversarial.length,
      cohort_hash: adversarialHash,
      unique_domain_patterns: new Set(adversarialDomainHashes).size
    }
  },
  population_prior: {
    lifecycle: populationPrior.lifecycle,
    persona_count: populationPrior.persona_count,
    authorized_population_dataset: populationPrior.authorized_population_dataset,
    reason_code: populationPrior.reason_code
  },
  locked_collapse_diagnostics: {
    combined_persona_count: allLockedPersonas.length,
    unique_domain_patterns: new Set([...coverageDomainHashes, ...adversarialDomainHashes]).size,
    skin_type_distribution: countBy(allLockedPersonas.map((persona) => persona.domain.skinType)),
    sensitivity_distribution: countBy(allLockedPersonas.map((persona) => persona.domain.sensitivity)),
    primary_concern_distribution: countBy(allLockedPersonas.map((persona) => persona.domain.primaryConcern)),
    sunscreen_preference_state_distribution: countBy(allLockedPersonas.map((persona) => persona.domain.sunscreen.preferenceState))
  },
  weighting_and_comparability: {
    coverage_weighting: coverageLock.weighting_strategy,
    adversarial_weighting: adversarialLock.weighting_strategy,
    raw_cross_cohort_rate_comparison_allowed: false,
    market_prevalence_claim_allowed: false
  },
  authority_ceiling: manifest.authority_ceiling
};

fs.mkdirSync(artifactRoot, { recursive: true });
fs.writeFileSync(path.join(artifactRoot, "cohort-freeze-summary-v1.json"), `${JSON.stringify(summary, null, 2)}\n`);
fs.writeFileSync(path.join(artifactRoot, "locked-cohort-manifest-v1.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log("EVAL-P4 cohort freeze verifier: PASS");
console.log(`source_coverage_unique_domain_patterns=${summary.source_collapse_diagnostic.p3_coverage_unique_domain_patterns}/32`);
console.log(`coverage_locked_count=${coverage.length}`);
console.log(`coverage_cohort_hash=${coverageHash}`);
console.log(`adversarial_cohort_hash=${adversarialHash}`);
console.log(`freeze_manifest_semantic_hash=${summary.freeze_manifest_semantic_hash}`);
console.log(`locked_unique_domain_patterns=${summary.locked_collapse_diagnostics.unique_domain_patterns}/37`);
console.log("population_prior=DEFERRED_NOT_LOCKED");
