import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = {
  identity: "lib/admin/trust-subject-identity.js",
  orchestration: "lib/admin/trust-subject-registration.js",
  preflightRoute:
    "app/api/admin/trust/subject-registration/preflight/route.js",
  confirmRoute:
    "app/api/admin/trust/subject-registration/confirm/route.js",
  action: "app/admin/products/trust/TrustSubjectRegistrationAction.js",
  page: "app/admin/products/trust/page.js",
  workbench: "app/admin/products/trust/TrustQueueWorkbench.js",
  subjectMigration:
    "supabase/migrations/20260810174410_product_fact_subject_registration_v1.sql",
  phase2:
    "supabase/migrations/20260915112124_trust_phase2_subject_resolution_v1.sql",
  workflow: ".github/workflows/trust-phase5b-subject-registration.yml"
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, relativePath]) => [
    key,
    fs.readFileSync(path.join(root, relativePath), "utf8")
  ])
);

let assertions = 0;
function check(condition, message) {
  assertions += 1;
  if (!condition) {
    throw new Error(message);
  }
}

function expectThrow(fn, code) {
  assertions += 1;
  try {
    fn();
  } catch (error) {
    if (error?.code === code || error?.message === code) {
      return;
    }
    throw new Error(
      `expected ${code}, received ${error?.code || error?.message || error}`
    );
  }
  throw new Error(`expected throw: ${code}`);
}

check(
  source.orchestration.startsWith('import "server-only";'),
  "Subject registration orchestration must be server-only"
);
check(
  source.preflightRoute.includes("isAllowedAdminMutationRequest(request)"),
  "preflight origin gate missing"
);
check(
  source.confirmRoute.includes("isAllowedAdminMutationRequest(request)"),
  "confirm origin gate missing"
);
for (const route of [source.preflightRoute, source.confirmRoute]) {
  check(
    route.includes(
      "requireAdminCapability(\n    ADMIN_CAPABILITIES.PRODUCTS_REVIEW\n  )"
    ),
    "Subject action must require admin.products.review"
  );
  check(
    route.includes("!access.allowed || !access.userId"),
    "Subject action must require a real authorized actor"
  );
  check(route.includes('runtime = "nodejs"'), "Subject route must be Node runtime");
  check(route.includes("no-store"), "Subject route must disable caching");
}

for (const forbidden of [
  ".insert(",
  ".update(",
  ".delete(",
  ".upsert(",
  "admin_adopt_trust_evidence_candidate_v1",
  "admin_confirm_product_fact_v1",
  "recommendation_logs",
  "recommendation_results",
  "admin_activate",
  "recommendation_cutover"
]) {
  check(
    !source.orchestration.toLowerCase().includes(forbidden.toLowerCase()),
    `orchestration contains forbidden mutation/authority: ${forbidden}`
  );
}

const rpcNames = [
  ...source.orchestration.matchAll(/\.rpc\(\s*["']([^"']+)["']/g)
].map((match) => match[1]);
check(rpcNames.length === 2, "orchestration must call exactly two RPCs");
check(
  rpcNames[0] === "admin_register_product_fact_subject_v1",
  "first/only Subject writer must be existing governed registration RPC"
);
check(
  rpcNames[1] === "process_catalog_trust_product_v1",
  "post-registration refresh must reuse canonical TRUST processor"
);

check(
  source.subjectMigration.includes(
    "create or replace function public.admin_register_product_fact_subject_v1("
  ),
  "governed Subject registration RPC missing"
);
check(
  source.subjectMigration.includes("'admin.products.review'"),
  "governed Subject RPC capability boundary missing"
);
check(
  source.subjectMigration.includes("to service_role;"),
  "governed Subject RPC must remain service-role only"
);
check(
  source.phase2.includes(
    "create or replace function public.process_catalog_trust_product_v1("
  ),
  "canonical TRUST processor missing"
);

for (const token of [
  'TRUST_SUBJECT_PROPOSAL_VERSION =\n  "trust-phase5-subject-identity-proposal-v1"',
  'TRUST_SUBJECT_IDENTITY_RESOLUTION_VERSION =\n  "trust-phase5-admin-reviewed-catalog-identity-v1"',
  'PRODUCT_FACT_SUBJECT_SERIALIZER_VERSION =\n  "product-fact-subject-identity-v1"',
  'TRUST_SUBJECT_FORMULATION_PREFIX = "trust-phase5-review-"',
  '"catalog-only-candidate-identity-evidence-v1"',
  '"catalog-only-candidate-approval-v1"',
  '"catalog-only-product-transactional-adoption-v1"',
  "product_fact_write_allowed !== false",
  "semantic_variant_key",
  "variant_key: null",
  "market_applicability: market",
  "requiresExplicitConfirmation: true",
  "automaticRegistration: false"
]) {
  check(source.identity.includes(token), `identity contract missing: ${token}`);
}

check(
  source.identity.includes("reviewedAt") &&
    source.identity.includes("reviewedBy"),
  "review lineage must be required"
);
check(
  source.identity.includes(
    "formulationIdentityBasis"
  ),
  "opaque formulation identity basis missing"
);
check(
  !/const formulationIdentityBasis = \{[\s\S]*?reviewed_at:[\s\S]*?\};/.test(
    source.identity
  ),
  "administrative review timestamp must not enter formulation identity"
);
check(
  !/const formulationIdentityBasis = \{[\s\S]*?reviewed_by:[\s\S]*?\};/.test(
    source.identity
  ),
  "administrative reviewer must not enter formulation identity"
);

check(
  !source.workbench.includes("\\nimport"),
  "workbench import section must not contain escaped newline literals"
);
check(
  source.workbench.includes('blockerCode === "SUBJECT_CREATION_REQUIRED"'),
  "UI action must be limited to Subject creation blocker"
);
check(
  source.workbench.includes('identityState === "SUBJECT_CREATION_REQUIRED"'),
  "UI action must require matching intake identity state"
);
check(
  source.page.includes("ADMIN_CAPABILITIES.PRODUCTS_REVIEW"),
  "page must derive review capability"
);
check(
  source.action.includes("if (!canReview)"),
  "read-only admins must not receive mutation controls"
);
check(
  source.action.includes("Subject 등록 Preflight") &&
    source.action.includes("명시적으로 Subject 등록"),
  "two-step explicit preflight/confirm UI missing"
);
check(
  source.action.includes("Evidence 채택") &&
    source.action.includes("Product Fact confirmation"),
  "UI must state downstream non-automation boundary"
);
check(
  source.orchestration.includes("trust_subject_registration_stale_proposal"),
  "confirm must fail closed when the identity proposal changes"
);
check(
  source.orchestration.includes("loadCurrentMarketSubjects") &&
    source.orchestration.includes("trust_subject_registration_competing_subject_detected"),
  "preflight/confirm must fail closed on competing current Subject drift"
);
check(
  source.orchestration.includes('code === "23505"'),
  "database uniqueness races must map to a conflict instead of retryable outage"
);
check(
  source.confirmRoute.includes("proposalDigest: body.proposalDigest"),
  "confirm route must forward the stable proposal digest"
);
check(
  source.action.includes("proposalDigest: preflight.proposalDigest"),
  "client confirm must bind the reviewed proposal digest"
);

for (const liveValue of [
  "da5df70c-8cdd-4eb2-93b6-ede46c2f171d",
  "6a9627b6-a5da-458f-84f7-3a40f91453be",
  "노스카나인 트러블 세럼",
  "FATION"
]) {
  const implementation = [
    source.identity,
    source.orchestration,
    source.preflightRoute,
    source.confirmRoute,
    source.action,
    source.page,
    source.workbench
  ].join("\n");
  check(
    !implementation.includes(liveValue),
    `Production target must not be hard-coded: ${liveValue}`
  );
}

const identityModuleSource = source.identity;
const identityModule = await import(
  `data:text/javascript;base64,${Buffer.from(identityModuleSource).toString(
    "base64"
  )}`
);
const {
  buildTrustSubjectIdentityProposal,
  canonicalTrustSubjectJson,
  digestTrustSubjectValue
} = identityModule;

const ids = {
  task: "11111111-1111-4111-8111-111111111111",
  intake: "22222222-2222-4222-8222-222222222222",
  product: "33333333-3333-4333-8333-333333333333",
  candidate: "44444444-4444-4444-8444-444444444444",
  reviewer: "55555555-5555-4555-8555-555555555555"
};

function fixture() {
  return {
    task: {
      id: ids.task,
      intake_id: ids.intake,
      product_id: ids.product,
      subject_id: null,
      state: "REVIEW_REQUIRED",
      blocker_code: "SUBJECT_CREATION_REQUIRED",
      updated_at: "2026-09-19T00:00:00.000Z"
    },
    intake: {
      id: ids.intake,
      product_id: ids.product,
      source_candidate_id: ids.candidate,
      market: "kr",
      subject_id: null,
      identity_state: "SUBJECT_CREATION_REQUIRED",
      trust_state: "REVIEW_REQUIRED",
      updated_at: "2026-09-19T00:00:00.000Z"
    },
    product: {
      id: ids.product,
      brand: "Fixture Brand",
      name: "Fixture Serum",
      category: "treatment"
    },
    candidate: {
      id: ids.candidate,
      matched_product_id: ids.product,
      review_status: "promoted",
      reviewed_at: "2026-09-18T23:50:00.000Z",
      reviewed_by: ids.reviewer,
      updated_at: "2026-09-19T00:00:00.000Z",
      identity_resolution_state: "resolved",
      identity_resolution_version: "crawler-identity-resolution-v1",
      identity_resolution_evidence: {
        contract_version: "catalog-only-candidate-identity-evidence-v1",
        approval_contract: "catalog-only-candidate-approval-v1",
        reviewed_at: "2026-09-18T23:50:00.000Z",
        authority_boundary: {
          product_fact_write_allowed: false
        },
        convergence_dimensions: ["presentation", "brand", "product_name"],
        providers: [
          {
            provider: "fixture_retailer",
            locator: "https://retailer.example/products/fixture",
            external_id: "fixture-1",
            external_type: "products",
            presentation: "30 ml",
            canonical_name: "Fixture Serum",
            canonical_brand: "Fixture Brand"
          },
          {
            provider: "fixture_official",
            locator: "https://brand.example/products/fixture",
            presentation: "30 ml",
            canonical_name: "Fixture Serum",
            canonical_brand: "Fixture Brand",
            product_name_en: "Fixture Serum"
          }
        ]
      },
      promotion_payload: {
        catalog_only_review: {
          contract_version: "catalog-only-candidate-approval-v1",
          source_rule_key: "fixture:treatment",
          taxonomy_version: "catalog-taxonomy-v1",
          product_write_allowed: false,
          recommendation_admission_allowed: false
        },
        catalog_only_adoption: {
          product_id: ids.product,
          contract_version: "catalog-only-product-transactional-adoption-v1",
          source_rule_key: "fixture:treatment",
          taxonomy_version: "catalog-taxonomy-v1",
          recommendation_admission_allowed: false
        }
      }
    }
  };
}

const first = buildTrustSubjectIdentityProposal(fixture());
const repeat = buildTrustSubjectIdentityProposal(fixture());

check(first.payload.variant_key === null, "variant must stay null without reviewed semantic variant");
check(
  first.payload.market_applicability === "KR",
  "market must be normalized from governed intake"
);
check(
  first.payload.formulation_revision_key.startsWith("trust-phase5-review-"),
  "opaque formulation revision prefix invalid"
);
check(
  /^[0-9a-f]{64}$/.test(first.payload.subject_semantic_key),
  "Subject semantic key must be SHA-256"
);
check(
  first.payload.subject_identity_serializer_version ===
    "product-fact-subject-identity-v1",
  "deployed Subject serializer must be preserved"
);
check(
  first.payload.formulation_label ===
    `TRUST reviewed identity ${first.evidenceDigest.slice(0, 12)}`,
  "Subject display label must remain stable and evidence-bound"
);
check(
  canonicalTrustSubjectJson(first.semanticIdentity) ===
    JSON.stringify({
      formulation_revision_key: first.payload.formulation_revision_key,
      market_applicability: "KR",
      product_id: ids.product,
      region_applicability: null,
      valid_from: null,
      valid_to: null,
      variant_key: null
    }),
  "operational seven-field semantic identity shape drifted"
);
check(
  first.payload.subject_semantic_key === digestTrustSubjectValue(first.semanticIdentity),
  "Subject semantic key replay mismatch"
);
check(
  first.evidenceDigest === repeat.evidenceDigest &&
    first.proposalDigest === repeat.proposalDigest &&
    first.preflightHash === repeat.preflightHash,
  "identical input must be deterministic"
);

const timestampOnly = fixture();
timestampOnly.candidate.reviewed_at = "2026-09-19T00:01:00.000Z";
timestampOnly.candidate.identity_resolution_evidence.reviewed_at =
  "2026-09-19T00:01:00.000Z";
const timestampProposal = buildTrustSubjectIdentityProposal(timestampOnly);
check(
  timestampProposal.payload.formulation_revision_key ===
    first.payload.formulation_revision_key,
  "administrative re-review time must not create a new formulation identity"
);
check(
  timestampProposal.payload.subject_semantic_key ===
    first.payload.subject_semantic_key,
  "administrative re-review time must not re-key the Subject"
);
check(
  timestampProposal.proposalDigest !== first.proposalDigest,
  "review-lineage change must remain visible in proposal digest"
);

const displayRename = fixture();
displayRename.product.brand = "Renamed Fixture Brand";
displayRename.product.name = "Renamed Fixture Serum";
const displayRenameProposal =
  buildTrustSubjectIdentityProposal(displayRename);
check(
  displayRenameProposal.payload.formulation_label ===
    first.payload.formulation_label &&
    displayRenameProposal.payload.subject_semantic_key ===
      first.payload.subject_semantic_key,
  "catalog display rename must not create a new Subject identity"
);

const stateOnly = fixture();
stateOnly.task.updated_at = "2026-09-19T00:02:00.000Z";
const stateProposal = buildTrustSubjectIdentityProposal(stateOnly);
check(
  stateProposal.proposalDigest === first.proposalDigest,
  "state timestamp must not alter identity proposal"
);
check(
  stateProposal.preflightHash !== first.preflightHash,
  "state timestamp drift must invalidate preflight"
);

const evidenceChange = fixture();
evidenceChange.candidate.identity_resolution_evidence.providers[1].locator =
  "https://brand.example/products/fixture-v2";
const evidenceProposal = buildTrustSubjectIdentityProposal(evidenceChange);
check(
  evidenceProposal.payload.formulation_revision_key !==
    first.payload.formulation_revision_key,
  "frozen identity evidence change must change opaque revision proposal"
);
check(
  evidenceProposal.payload.subject_semantic_key !==
    first.payload.subject_semantic_key,
  "formulation identity change must change Subject semantic key"
);

const noOfficial = fixture();
noOfficial.candidate.identity_resolution_evidence.providers[1].provider =
  "fixture_secondary";
expectThrow(
  () => buildTrustSubjectIdentityProposal(noOfficial),
  "trust_subject_identity_official_provider_required"
);

const semanticVariant = fixture();
semanticVariant.candidate.identity_resolution_evidence.semantic_variant_key =
  "UNREVIEWED_VARIANT";
expectThrow(
  () => buildTrustSubjectIdentityProposal(semanticVariant),
  "trust_subject_identity_semantic_variant_requires_separate_review"
);

const stale = fixture();
stale.task.state = "RESEARCH_PENDING";
expectThrow(
  () => buildTrustSubjectIdentityProposal(stale),
  "trust_subject_registration_state_not_reviewable"
);

const promotionDrift = fixture();
promotionDrift.candidate.promotion_payload.catalog_only_adoption.source_rule_key =
  "fixture:other";
expectThrow(
  () => buildTrustSubjectIdentityProposal(promotionDrift),
  "trust_subject_identity_catalog_promotion_lineage_invalid"
);

check(
  source.workflow.includes("node-version: 22"),
  "Phase 5B workflow must use Node 22"
);
check(
  source.workflow.includes(
    "node scripts/verify-trust-phase5b-subject-registration.mjs"
  ),
  "Phase 5B focused verifier step missing"
);
check(
  source.workflow.includes(
    "node scripts/verify-product-fact-subject-registration-v1.mjs"
  ),
  "existing Subject authority verifier missing"
);
check(
  source.workflow.includes("node scripts/verify-trust-subject-resolution.mjs"),
  "TRUST subject resolver regression missing"
);
check(
  source.workflow.includes(
    "node scripts/verify-trust-phase5-admin-queue.mjs"
  ),
  "Phase 5A queue regression missing"
);
check(
  source.workflow.includes("npm run architecture:guard"),
  "architecture guard missing"
);
check(source.workflow.includes("npm run build"), "production build missing");
check(
  source.workflow.includes("git diff --check"),
  "exact-head diff hygiene missing"
);

console.log(
  JSON.stringify({
    status: "PASS",
    assertions,
    formulation_revision_key: first.payload.formulation_revision_key,
    subject_semantic_key: first.payload.subject_semantic_key
  })
);
