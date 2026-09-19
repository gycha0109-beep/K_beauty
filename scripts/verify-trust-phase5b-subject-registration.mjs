#!/usr/bin/env node

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
  workbench: "app/admin/products/trust/TrustQueueWorkbench.js",
  page: "app/admin/products/trust/page.js",
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

for (const route of [source.preflightRoute, source.confirmRoute]) {
  check(
    route.includes("isAllowedAdminMutationRequest(request)"),
    "same-origin admin mutation gate missing"
  );
  check(
    route.includes("ADMIN_CAPABILITIES.PRODUCTS_REVIEW"),
    "Subject action must require admin.products.review"
  );
  check(
    route.includes("!access.allowed || !access.userId"),
    "Subject action must require a real authorized actor"
  );
  check(route.includes('runtime = "nodejs"'), "Subject route must be Node runtime");
  check(route.includes("no-store"), "Subject route must disable caching");
}

check(
  source.preflightRoute.includes("reviewedIdentity: body.reviewedIdentity"),
  "preflight must receive explicit reviewed Subject identity"
);
check(
  source.confirmRoute.includes("reviewedIdentity: body.reviewedIdentity"),
  "confirm must receive the exact reviewed Subject identity"
);

for (const forbidden of [
  ".insert(",
  ".update(",
  ".delete(",
  ".upsert(",
  "admin_adopt_trust_evidence_candidate_v1",
  "admin_confirm_product_fact_v1",
  "recommendation_logs",
  "recommendation_results",
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
  "only existing governed Subject writer may register the Subject"
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
  '"product-fact-subject-identity-v1"',
  '"trust-phase5-admin-subject-review-v1"',
  '"variantKeyReviewedAsNull"',
  '"formulationRevisionKey"',
  '"marketApplicability"',
  '"trust_subject_identity_market_mismatch"',
  "catalogIdentityIsProductFactAuthority: false",
  'identity_status: "resolved"',
  'current_state: "current"',
  "predecessor_subject_id: null",
  "supersession_kind: null"
]) {
  check(source.identity.includes(token), `identity contract missing: ${token}`);
}

for (const forbiddenIdentity of [
  "TRUST_SUBJECT_FORMULATION_PREFIX",
  "formulationIdentityBasis",
  "trust-phase5-review-",
  "evidenceDigest.slice",
  "formulation_revision_key: formulationRevisionKey"
]) {
  check(
    !source.identity.includes(forbiddenIdentity),
    `catalog-derived formulation identity remains: ${forbiddenIdentity}`
  );
}

check(
  source.identity.includes(
    "reviewedIdentity.marketApplicability !== intakeMarket"
  ),
  "reviewed market must be checked against live intake market"
);
check(
  source.identity.includes(
    "evidence.authority_boundary.product_fact_write_allowed !== false"
  ),
  "catalog Product Fact authority boundary must remain explicitly false"
);
check(
  source.identity.includes("catalog_context_digest: catalogContextDigest"),
  "catalog context must invalidate stale preflight without becoming PF identity"
);
check(
  source.identity.includes("sibling_tasks: taskStates"),
  "all intake task state must bind stale preflight"
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
  source.workbench.includes("intakeMarket={item.intake?.market ?? null}"),
  "UI must show the live intake market without auto-filling it"
);
check(
  source.page.includes("ADMIN_CAPABILITIES.PRODUCTS_REVIEW"),
  "page must derive review capability"
);
check(
  source.action.includes("if (!canReview)"),
  "read-only admins must not receive mutation controls"
);
for (const token of [
  "Formulation revision key",
  "Variant key",
  "Market applicability",
  "variantKeyReviewedAsNull",
  "catalog evidence에서 자동 생성하지 않습니다",
  "Subject 등록 Preflight",
  "명시적으로 Subject 등록",
  "Evidence 채택",
  "Product Fact confirmation"
]) {
  check(source.action.includes(token), `review UI contract missing: ${token}`);
}
check(
  !source.action.includes("trust-phase5-review-"),
  "client must not synthesize a formulation revision"
);

check(
  source.orchestration.includes("trust_subject_registration_stale_proposal"),
  "confirm must fail closed when reviewed identity changes"
);
check(
  source.orchestration.includes("trust_subject_registration_stale_preflight"),
  "confirm must fail closed when live state changes"
);
check(
  source.orchestration.includes("loadCurrentMarketSubjects") &&
    source.orchestration.includes(
      "trust_subject_registration_competing_subject_detected"
    ),
  "competing current Subject drift must fail closed"
);
check(
  source.orchestration.includes('code === "23505"'),
  "uniqueness races must map to conflict"
);
check(
  source.orchestration.includes("alreadyRegistered"),
  "exact semantic retry path must remain idempotent"
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

const identityModule = await import(
  `data:text/javascript;base64,${Buffer.from(source.identity).toString("base64")}`
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
  candidate: "44444444-4444-4444-8444-444444444444"
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
      market: "KR",
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
      identity_resolution_state: "resolved",
      identity_resolution_version: "crawler-identity-resolution-v1",
      identity_resolution_evidence: {
        authority_boundary: {
          product_fact_write_allowed: false
        },
        providers: [
          {
            provider: "fixture_official",
            locator: "https://brand.example/products/fixture"
          }
        ]
      },
      promotion_payload: {
        catalog_only_review: {
          product_write_allowed: false
        }
      },
      updated_at: "2026-09-19T00:00:00.000Z"
    },
    tasks: [
      {
        id: ids.task,
        fact_key: "contains_active",
        state: "REVIEW_REQUIRED",
        blocker_code: "SUBJECT_CREATION_REQUIRED",
        subject_id: null,
        updated_at: "2026-09-19T00:00:00.000Z"
      }
    ]
  };
}

function reviewed(overrides = {}) {
  return {
    variantKey: null,
    variantKeyReviewedAsNull: true,
    formulationRevisionKey: "reviewed-formulation-r1",
    formulationLabel: "Fixture reviewed formulation",
    marketApplicability: "KR",
    regionApplicability: null,
    validFrom: null,
    validTo: null,
    ...overrides
  };
}

const first = buildTrustSubjectIdentityProposal(fixture(), reviewed());
const repeat = buildTrustSubjectIdentityProposal(fixture(), reviewed());

check(first.payload.variant_key === null, "reviewed null variant must remain null");
check(
  first.reviewedIdentity.variantKeyReviewedAsNull === true,
  "null variant must carry explicit reviewer intent"
);
check(
  first.payload.formulation_revision_key === "reviewed-formulation-r1",
  "formulation revision must be the reviewer-provided value"
);
check(
  first.payload.formulation_label === "Fixture reviewed formulation",
  "formulation label must be reviewer-provided"
);
check(
  first.payload.market_applicability === "KR",
  "market must be reviewer-provided and match intake"
);
check(
  first.payload.subject_identity_serializer_version ===
    "product-fact-subject-identity-v1",
  "deployed Subject serializer must be preserved"
);
check(
  canonicalTrustSubjectJson(first.semanticIdentity) ===
    JSON.stringify({
      formulation_revision_key: "reviewed-formulation-r1",
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
  first.payload.subject_semantic_key ===
    digestTrustSubjectValue(first.semanticIdentity),
  "Subject semantic key replay mismatch"
);
check(
  first.proposalDigest === repeat.proposalDigest &&
    first.preflightHash === repeat.preflightHash,
  "identical reviewed input and state must be deterministic"
);

const catalogChange = fixture();
catalogChange.candidate.identity_resolution_evidence.providers[0].locator =
  "https://brand.example/products/fixture-v2";
const catalogProposal = buildTrustSubjectIdentityProposal(
  catalogChange,
  reviewed()
);
check(
  catalogProposal.payload.subject_semantic_key ===
    first.payload.subject_semantic_key,
  "catalog evidence must not manufacture or re-key PF Subject identity"
);
check(
  catalogProposal.proposalDigest === first.proposalDigest,
  "catalog evidence must not enter reviewed PF identity proposal"
);
check(
  catalogProposal.preflightHash !== first.preflightHash,
  "catalog evidence drift must invalidate preflight"
);

const taskChange = fixture();
taskChange.tasks[0].updated_at = "2026-09-19T00:02:00.000Z";
const taskProposal = buildTrustSubjectIdentityProposal(taskChange, reviewed());
check(
  taskProposal.proposalDigest === first.proposalDigest,
  "task state must not alter Subject identity"
);
check(
  taskProposal.preflightHash !== first.preflightHash,
  "task state drift must invalidate preflight"
);

const formulationChange = buildTrustSubjectIdentityProposal(
  fixture(),
  reviewed({ formulationRevisionKey: "reviewed-formulation-r2" })
);
check(
  formulationChange.payload.subject_semantic_key !==
    first.payload.subject_semantic_key,
  "reviewed formulation change must re-key Subject"
);

const variantChange = buildTrustSubjectIdentityProposal(
  fixture(),
  reviewed({
    variantKey: "SERUM_30ML",
    variantKeyReviewedAsNull: false
  })
);
check(
  variantChange.payload.variant_key === "SERUM_30ML",
  "reviewed variant must be preserved"
);
check(
  variantChange.payload.subject_semantic_key !==
    first.payload.subject_semantic_key,
  "reviewed variant change must re-key Subject"
);

expectThrow(
  () =>
    buildTrustSubjectIdentityProposal(
      fixture(),
      reviewed({ marketApplicability: "US" })
    ),
  "trust_subject_identity_market_mismatch"
);
expectThrow(
  () =>
    buildTrustSubjectIdentityProposal(
      fixture(),
      reviewed({ variantKeyReviewedAsNull: false })
    ),
  "trust_subject_identity_variant_review_required"
);
expectThrow(
  () =>
    buildTrustSubjectIdentityProposal(fixture(), {
      ...reviewed(),
      unexpected: "no"
    }),
  "trust_subject_identity_reviewed_input_invalid"
);

const authorityEscalation = fixture();
authorityEscalation.candidate.identity_resolution_evidence.authority_boundary.product_fact_write_allowed =
  true;
expectThrow(
  () =>
    buildTrustSubjectIdentityProposal(authorityEscalation, reviewed()),
  "trust_subject_identity_catalog_authority_boundary_invalid"
);

const stale = fixture();
stale.task.state = "RESEARCH_PENDING";
expectThrow(
  () => buildTrustSubjectIdentityProposal(stale, reviewed()),
  "trust_subject_registration_state_not_reviewable"
);

check(
  source.workflow.includes("node-version: 22"),
  "Phase 5B workflow must use Node 22"
);
for (const token of [
  "node scripts/verify-trust-phase5b-subject-registration.mjs",
  "node scripts/verify-product-fact-subject-registration-v1.mjs",
  "node scripts/verify-trust-subject-resolution.mjs",
  "node scripts/verify-trust-phase5-admin-queue.mjs",
  "npm run architecture:guard",
  "npm run build",
  "git diff --check"
]) {
  check(source.workflow.includes(token), `workflow gate missing: ${token}`);
}

console.log(
  JSON.stringify({
    status: "PASS",
    assertions,
    subject_semantic_key: first.payload.subject_semantic_key,
    formulation_revision_key: first.payload.formulation_revision_key
  })
);
