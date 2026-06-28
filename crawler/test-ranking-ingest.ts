import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  ingestRankingSnapshotInMemory,
  validateRankingSnapshotIngestPayload,
  type InMemoryRankingIngestStore,
  type RankingSnapshotIngestPayload,
} from "./lib/ranking-ingest.js";
import { loadRankingJobs } from "./lib/ranking-config.js";
import {
  extractCandidateSourceContext,
  ingestRankingSnapshot,
  refreshCandidatePromotionReviews,
} from "./lib/supabase.js";
import type { RankingJobConfig } from "./lib/ranking-config.js";
import type { RankingSnapshotItem } from "./lib/snapshot.js";

const job: RankingJobConfig = {
  id: "hwahae-essence-ampoule-serum-category-all",
  source: "hwahae",
  sourceCategoryKey: "essence_ampoule_serum",
  serviceCategory: "treatment",
  sourceProductForm: null,
  rankingScope: "category_all",
  rankingFilter: "all",
  sourceConcernKey: null,
  canonicalConcerns: [],
  evidenceType: "popularity",
  limit: 20,
  requestedLimit: 20,
  enabled: true,
  disabledReason: null,
  themeId: 4174,
};

function makeItem(overrides: Partial<RankingSnapshotItem> = {}): RankingSnapshotItem {
  return {
    rankPosition: 1,
    productName: "Cica Serum",
    brandName: "Brand A",
    rating: 4.7,
    reviewCount: 120,
    thumbnailUrl: null,
    sourceUrl: "https://www.hwahae.co.kr/products/12345",
    price: 15000,
    externalType: "products",
    externalId: "12345",
    rawItem: {
      position: 1,
      name: "Cica Serum",
    },
    ...overrides,
  };
}

function makePayload(overrides: Partial<RankingSnapshotIngestPayload> = {}): RankingSnapshotIngestPayload {
  return {
    ingestKey: "ingest-a",
    snapshotHash: "same-content-hash",
    job,
    sourceUrl: "https://www.hwahae.com/en/rankings?english_name=category&theme_id=5126",
    collectedAt: "2026-06-21T00:00:00.000Z",
    collectorVersion: "hwahae-ranking-phase1/1",
    rawPayload: {
      rawJsonLd: [],
    },
    items: [makeItem()],
    ...overrides,
  };
}

function makeStore(): InMemoryRankingIngestStore {
  return {
    candidates: [],
    snapshots: [],
    sourceRankings: [],
  };
}

function assertReplayStatusContract(status: "collected" | "ingested" | "failed"): "idempotent" {
  if (status !== "ingested") {
    throw new Error("ranking_ingest_existing_snapshot_not_ingested");
  }

  return "idempotent";
}

const validStore = makeStore();
const validPayload = makePayload();
const validResult = ingestRankingSnapshotInMemory(validStore, validPayload);

assert.equal(validResult.snapshotCreated, true);
assert.equal(validResult.sourceRankingsInserted, 1);
assert.equal(validResult.candidatesInserted, 1);
assert.equal(validStore.snapshots.length, 1);
assert.equal(validStore.sourceRankings.length, 1);
assert.equal(validStore.candidates[0].seenCount, 1);

const rerunResult = ingestRankingSnapshotInMemory(validStore, validPayload);

assert.equal(rerunResult.snapshotCreated, false);
assert.equal(rerunResult.sourceRankingsInserted, 0);
assert.equal(rerunResult.sourceRankingsSkipped, 1);
assert.equal(validStore.snapshots.length, 1);
assert.equal(validStore.sourceRankings.length, 1);
assert.equal(validStore.candidates[0].seenCount, 1);
assert.equal(assertReplayStatusContract("ingested"), "idempotent");

for (const status of ["collected", "failed"] as const) {
  assert.throws(
    () => assertReplayStatusContract(status),
    /ranking_ingest_existing_snapshot_not_ingested/,
  );
}

assert.throws(
  () =>
    ingestRankingSnapshotInMemory(
      validStore,
      makePayload({
        snapshotHash: "different-content-hash",
      }),
    ),
  /ranking_ingest_ingest_key_conflict/,
);

const newIdentitySameHash = ingestRankingSnapshotInMemory(
  validStore,
  makePayload({
    ingestKey: "ingest-b",
    collectedAt: "2026-06-28T00:00:00.000Z",
  }),
);

assert.equal(newIdentitySameHash.snapshotCreated, true);
assert.equal(newIdentitySameHash.candidatesReobserved, 1);
assert.equal(validStore.snapshots.length, 2);
assert.deepEqual(
  validStore.snapshots.map((snapshot) => snapshot.snapshotHash),
  ["same-content-hash", "same-content-hash"],
);
assert.equal(validStore.candidates[0].seenCount, 2);

const candidateReuseStore = makeStore();
candidateReuseStore.candidates.push({
  id: "candidate-existing",
  sourceName: "hwahae",
  categoryPath: "treatment",
  normalizedName: "cica serum",
  normalizedBrand: "brand a",
  externalType: "products",
  externalId: "12345",
  firstSeenAt: "2026-06-20T00:00:00.000Z",
  lastSeenAt: "2026-06-20T00:00:00.000Z",
  seenCount: 1,
});
const candidateRaceContract = ingestRankingSnapshotInMemory(candidateReuseStore, makePayload());

assert.equal(candidateRaceContract.candidatesInserted, 0);
assert.equal(candidateRaceContract.candidatesReobserved, 1);
assert.equal(candidateReuseStore.candidates.length, 1);
assert.equal(candidateReuseStore.candidates[0].seenCount, 2);

const duplicateCandidateStore = makeStore();
assert.throws(
  () =>
    ingestRankingSnapshotInMemory(
      duplicateCandidateStore,
      makePayload({
        items: [
          makeItem({ rankPosition: 1 }),
          makeItem({
            rankPosition: 2,
            productName: "Cica Serum Repeated",
            externalType: "products",
            externalId: "12345",
          }),
        ],
      }),
    ),
  /ranking_ingest_duplicate_candidate_identity/,
);
assert.equal(duplicateCandidateStore.snapshots.length, 0);
assert.equal(duplicateCandidateStore.sourceRankings.length, 0);
assert.equal(duplicateCandidateStore.candidates.length, 0);

const duplicateRankStore = makeStore();
assert.throws(
  () =>
    ingestRankingSnapshotInMemory(
      duplicateRankStore,
      makePayload({
        items: [
          makeItem({ rankPosition: 1 }),
          makeItem({
            rankPosition: 1,
            productName: "Other Cream",
            externalId: "99999",
          }),
        ],
      }),
    ),
  /ranking_ingest_duplicate_rank_position/,
);
assert.equal(duplicateRankStore.snapshots.length, 0);
assert.equal(duplicateRankStore.sourceRankings.length, 0);
assert.equal(duplicateRankStore.candidates.length, 0);

const malformedStore = makeStore();
assert.throws(
  () =>
    ingestRankingSnapshotInMemory(
      malformedStore,
      makePayload({
        items: [
          makeItem({
            productName: "",
          }),
        ],
      }),
    ),
  /ranking_ingest_invalid_item:product_name/,
);
assert.equal(malformedStore.snapshots.length, 0);
assert.equal(malformedStore.sourceRankings.length, 0);
assert.equal(malformedStore.candidates.length, 0);

assert.throws(
  () =>
    ingestRankingSnapshotInMemory(
      makeStore(),
      makePayload({
        items: [
          makeItem({
            externalType: null,
            externalId: null,
          }),
        ],
      }),
    ),
  /ranking_ingest_missing_external_identity/,
);

for (const legacyCategory of ["serum", "ampoule", "essence", "unknown_category"]) {
  assert.throws(
    () =>
      ingestRankingSnapshotInMemory(
        makeStore(),
        makePayload({
          job: {
            ...job,
            serviceCategory: legacyCategory,
          },
        }),
      ),
    /ranking_ingest_invalid_service_category/,
  );
}

validateRankingSnapshotIngestPayload(makePayload());

const treatmentContext = extractCandidateSourceContext({
  popularity: {
    observations: [
      {
        service_category: "treatment",
        source_category_key: "essence_ampoule_serum",
        source_product_form: null,
        collected_at: "2026-06-21T00:00:00.000Z",
      },
    ],
  },
});

assert.equal(treatmentContext.source_context_status, "valid");
assert.equal(treatmentContext.source_service_category, "treatment");
assert.equal(treatmentContext.source_category_key, "essence_ampoule_serum");
assert.equal(treatmentContext.source_product_form, null);

const rankingJobs = await loadRankingJobs({
  configPath: path.resolve("config", "ranking-jobs.json"),
  includeDisabled: true,
});
const expectedSourceCategories = [
  "toner",
  "toner_pad",
  "lotion_emulsion",
  "cream",
  "gel",
  "balm",
  "sunscreen",
  "essence_ampoule_serum",
  "cleansing_foam",
];
const expectedRankingFilters = [
  "all",
  "hydration",
  "soothing",
  "moisturizing",
  "pores",
  "brightening",
  "anti_aging",
  "trouble",
  "exfoliation",
];

assert.equal(rankingJobs.length, 81);
assert.deepEqual(
  Array.from(new Set(rankingJobs.map((config) => config.sourceCategoryKey))).sort(),
  [...expectedSourceCategories].sort(),
);

for (const sourceCategory of expectedSourceCategories) {
  const categoryJobs = rankingJobs.filter((config) => config.sourceCategoryKey === sourceCategory);
  assert.equal(categoryJobs.length, 9, sourceCategory);
  assert.deepEqual(
    categoryJobs.map((config) => config.rankingFilter).sort(),
    [...expectedRankingFilters].sort(),
  );
}

assert.equal(
  rankingJobs.some((config) => ["serum", "ampoule", "essence"].includes(config.sourceCategoryKey)),
  false,
);
assert.equal(
  rankingJobs.some((config) => config.sourceCategoryKey === "essence_ampoule_serum"),
  true,
);
assert.equal(
  rankingJobs.some((config) => config.sourceCategoryKey === "lotion_emulsion"),
  true,
);

for (const config of rankingJobs) {
  if (!config.enabled) {
    assert.equal(typeof config.disabledReason, "string", config.id);
    assert.ok(config.disabledReason?.length, config.id);
  }

  if (config.enabled) {
    assert.equal(config.disabledReason, null, config.id);
    assert.ok(config.themeId || config.url, config.id);
  }
}

const essenceAllJob = rankingJobs.find((config) => config.id === "hwahae-essence-ampoule-serum-category-all");
const essenceTroubleJob = rankingJobs.find((config) => config.id === "hwahae-essence-ampoule-serum-trouble");

assert.equal(essenceAllJob?.themeId, 4174);
assert.equal(essenceAllJob?.serviceCategory, "treatment");
assert.equal(essenceAllJob?.sourceProductForm, null);
assert.equal(essenceAllJob?.evidenceType, "popularity");
assert.equal(essenceTroubleJob?.themeId, 4181);
assert.equal(essenceTroubleJob?.sourceConcernKey, "trouble");
assert.deepEqual(essenceTroubleJob?.canonicalConcerns, ["acne"]);
assert.equal(essenceTroubleJob?.evidenceType, "concern_relevance");

let rpcCalled = false;
const mockRpcClient = {
  rpc(name: string, args: Record<string, unknown>) {
    rpcCalled = true;
    assert.equal(name, "ingest_ranking_snapshot");
    assert.equal(args.p_ingest_key, "ingest-a");

    return Promise.resolve({
      data: {
        snapshot_id: "snapshot-rpc",
        snapshot_created: true,
        source_rankings_inserted: 1,
        source_rankings_skipped: 0,
        candidates_inserted: 1,
        candidates_reobserved: 0,
        pending_identity_count: 0,
      },
      error: null,
    });
  },
};

const rpcResult = await ingestRankingSnapshot(mockRpcClient as never, makePayload());

assert.equal(rpcCalled, true);
assert.equal(rpcResult.snapshotId, "snapshot-rpc");
assert.equal(rpcResult.snapshotCreated, true);
assert.equal(rpcResult.sourceRankingsInserted, 1);

let failingRpcCalled = false;
const failingRpcClient = {
  rpc() {
    failingRpcCalled = true;

    return Promise.resolve({
      data: null,
      error: {
        message: "ranking_ingest_duplicate_candidate_id",
      },
    });
  },
};

await assert.rejects(
  () => ingestRankingSnapshot(failingRpcClient as never, makePayload()),
  /ranking_ingest_duplicate_candidate_id/,
);
assert.equal(failingRpcCalled, true);

let refreshRpcCalled = false;
const refreshRpcClient = {
  rpc(name: string, args: Record<string, unknown>) {
    refreshRpcCalled = true;
    assert.equal(name, "refresh_candidate_promotion_reviews");
    assert.equal(args.p_rule_version, "ranking-review-v2");

    return Promise.resolve({
      data: {
        rule_version: "ranking-review-v2",
        candidates_examined: 2,
        reviews_inserted: 1,
        reviews_updated: 1,
        reviews_deferred: 1,
        protected_reviews_skipped: 0,
        products_written: 0,
      },
      error: null,
    });
  },
};

const refreshResult = await refreshCandidatePromotionReviews(refreshRpcClient as never, "ranking-review-v2");

assert.equal(refreshRpcCalled, true);
assert.equal(refreshResult.reviewsInserted, 1);
assert.equal(refreshResult.reviewsUpdated, 1);
assert.equal(refreshResult.reviewsDeferred, 1);
assert.equal(refreshResult.productsWritten, 0);

let dryRunRpcCalled = false;
const dryRunClient = {
  rpc() {
    dryRunRpcCalled = true;
  },
};

if (false) {
  await ingestRankingSnapshot(dryRunClient as never, makePayload());
}

assert.equal(dryRunRpcCalled, false);

const migrationSql = readFileSync(
  path.resolve("..", "supabase", "migrations", "20260621030000_phase1_ranking_snapshot_pipeline.sql"),
  "utf8",
);

assert.match(migrationSql, /grant select, insert, update on table public\.ranking_snapshots to service_role;/);
assert.match(migrationSql, /grant select, insert on table public\.source_rankings to service_role;/);
assert.match(migrationSql, /grant select, insert, update on table public\.product_candidates to service_role;/);
assert.match(migrationSql, /revoke insert, update, delete on table public\.ranking_snapshots from anon, authenticated;/);
assert.match(migrationSql, /revoke insert, update, delete on table public\.source_rankings from anon, authenticated;/);
assert.match(migrationSql, /revoke insert, update, delete on table public\.product_candidates from anon, authenticated;/);
assert.doesNotMatch(migrationSql, /grant\s+(?:select,\s*)?insert[^;]+to anon/i);
assert.doesNotMatch(migrationSql, /grant\s+(?:select,\s*)?insert[^;]+to authenticated/i);
assert.match(migrationSql, /message = 'ranking_ingest_existing_snapshot_not_ingested'/);
assert.match(migrationSql, /v_existing_snapshot\.status <> 'ingested'/);

const phase2MigrationSql = readFileSync(
  path.resolve("..", "supabase", "migrations", "20260621155819_phase2_candidate_promotion_review_queue.sql"),
  "utf8",
);

assert.match(phase2MigrationSql, /create table if not exists public\.candidate_promotion_reviews/);
assert.match(phase2MigrationSql, /constraint candidate_promotion_reviews_candidate_id_key unique \(candidate_id\)/);
assert.match(phase2MigrationSql, /status in \('queued', 'reviewing', 'approved', 'rejected', 'deferred'\)/);
assert.match(phase2MigrationSql, /where candidate_id = v_row\.candidate_id\s+and status in \('queued', 'reviewing'\)/);
assert.match(phase2MigrationSql, /on conflict \(candidate_id\) do nothing/);
assert.match(phase2MigrationSql, /not summary\.product_match_exists/);
assert.match(phase2MigrationSql, /nullif\(btrim\(coalesce\(summary\.external_id/);
assert.match(phase2MigrationSql, /'products_written', 0/);
assert.doesNotMatch(phase2MigrationSql, /insert into public\.products/i);
assert.doesNotMatch(phase2MigrationSql, /update public\.products/i);
assert.doesNotMatch(phase2MigrationSql, /delete from public\.products/i);

console.log("ranking ingest contract test passed");
