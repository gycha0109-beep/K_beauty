import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

type EvidenceType = "concern_relevance" | "popularity";
type QueuePolicy = "top_15_immediate" | "rank_16_30_persistent" | "rank_31_50_reinforced";

const REVIEW_RULE_VERSION = "ranking-review-v2";

interface ObservationFixture {
  candidateId: string;
  concernKey: string | null;
  evidenceType: EvidenceType;
  rank: number;
  collectedAt: string;
}

interface PolicyResult {
  queueEligible: boolean;
  queuePolicy: QueuePolicy | null;
  selectionReason: string;
  priorityScore: number;
  evidenceSnapshot: {
    rule_version: string;
    queue_eligible: boolean;
    queue_policy: QueuePolicy | null;
    qualification: {
      reason: QueuePolicy | null;
      concern: string | null;
      latest_rank: number | null;
      distinct_observed_dates: number;
      reinforcement_reasons: string[];
    };
  };
  productsWritten: 0;
}

interface ConcernGroup {
  concernKey: string;
  latestRank: number;
  latestCollectedAt: string;
  distinctObservedDates: number;
}

function getKstDate(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoTimestamp));
}

function latestObservation(left: ObservationFixture, right: ObservationFixture): ObservationFixture {
  const timeComparison = right.collectedAt.localeCompare(left.collectedAt);

  if (timeComparison !== 0) {
    return timeComparison > 0 ? right : left;
  }

  return right.rank < left.rank ? right : left;
}

function summarizeConcernGroups(candidateId: string, observations: ObservationFixture[]): ConcernGroup[] {
  const concernGroups = new Map<string, ObservationFixture[]>();

  for (const observation of observations) {
    if (observation.candidateId !== candidateId || observation.evidenceType !== "concern_relevance" || !observation.concernKey) {
      continue;
    }

    concernGroups.set(observation.concernKey, [...(concernGroups.get(observation.concernKey) ?? []), observation]);
  }

  return Array.from(concernGroups.entries()).map(([concernKey, groupObservations]) => {
    const latest = groupObservations.reduce(latestObservation);
    const observedDates = groupObservations.map((observation) => getKstDate(observation.collectedAt));

    return {
      concernKey,
      latestRank: latest.rank,
      latestCollectedAt: latest.collectedAt,
      distinctObservedDates: new Set(observedDates).size,
    };
  });
}

function getLatestPopularityRank(candidateId: string, observations: ObservationFixture[]): number | null {
  const popularityObservations = observations.filter(
    (observation) => observation.candidateId === candidateId && observation.evidenceType === "popularity",
  );

  if (popularityObservations.length === 0) {
    return null;
  }

  return popularityObservations.reduce(latestObservation).rank;
}

function classifyCandidate(candidateId: string, observations: ObservationFixture[]): PolicyResult {
  const concernGroups = summarizeConcernGroups(candidateId, observations);
  const latestPopularityRank = getLatestPopularityRank(candidateId, observations);
  const observedDistinctConcernCount = concernGroups.length;

  const rankedGroups = concernGroups
    .map((group) => {
      const reinforcementReasons = [
        latestPopularityRank !== null && latestPopularityRank <= 30 ? "latest_popularity_rank_lte_30" : null,
        observedDistinctConcernCount >= 2 ? "two_or_more_distinct_concerns" : null,
      ].filter((reason): reason is string => Boolean(reason));
      let queuePolicy: QueuePolicy | null = null;

      if (group.latestRank <= 15) {
        queuePolicy = "top_15_immediate";
      } else if (group.latestRank >= 16 && group.latestRank <= 30 && group.distinctObservedDates >= 2) {
        queuePolicy = "rank_16_30_persistent";
      } else if (
        group.latestRank >= 31 &&
        group.latestRank <= 50 &&
        group.distinctObservedDates >= 3 &&
        reinforcementReasons.length > 0
      ) {
        queuePolicy = "rank_31_50_reinforced";
      }

      return {
        ...group,
        queuePolicy,
        reinforcementReasons,
        basePriority:
          queuePolicy === "top_15_immediate"
            ? 100
            : queuePolicy === "rank_16_30_persistent"
              ? 70
              : queuePolicy === "rank_31_50_reinforced"
                ? 45
                : 0,
      };
    })
    .filter((group) => group.queuePolicy !== null)
    .sort((left, right) => right.basePriority - left.basePriority || left.latestRank - right.latestRank);

  const selected = rankedGroups[0];
  const queuePolicy = selected?.queuePolicy ?? null;
  const selectionReason =
    queuePolicy === "top_15_immediate"
      ? "top_15_immediate: latest concern rank <= 15"
      : queuePolicy === "rank_16_30_persistent"
        ? "rank_16_30_persistent: latest concern rank 16-30 on >= 2 KST observed dates"
        : queuePolicy === "rank_31_50_reinforced"
          ? "rank_31_50_reinforced: latest concern rank 31-50 on >= 3 KST observed dates with reinforcement"
          : "currently below queue threshold under ranking-review-v2";

  return {
    queueEligible: queuePolicy !== null,
    queuePolicy,
    selectionReason,
    priorityScore: selected ? selected.basePriority + Math.max(0, 51 - selected.latestRank) : 0,
    evidenceSnapshot: {
      rule_version: REVIEW_RULE_VERSION,
      queue_eligible: queuePolicy !== null,
      queue_policy: queuePolicy,
      qualification: {
        reason: queuePolicy,
        concern: selected?.concernKey ?? null,
        latest_rank: selected?.latestRank ?? null,
        distinct_observed_dates: selected?.distinctObservedDates ?? 0,
        reinforcement_reasons: selected?.reinforcementReasons ?? [],
      },
    },
    productsWritten: 0,
  };
}

function observation(
  candidateId: string,
  rank: number,
  collectedAt: string,
  concernKey = "acne",
): ObservationFixture {
  return {
    candidateId,
    concernKey,
    evidenceType: "concern_relevance",
    rank,
    collectedAt,
  };
}

function popularity(candidateId: string, rank: number, collectedAt: string): ObservationFixture {
  return {
    candidateId,
    concernKey: null,
    evidenceType: "popularity",
    rank,
    collectedAt,
  };
}

function assertPolicy(
  label: string,
  observations: ObservationFixture[],
  expectedPolicy: QueuePolicy | null,
): PolicyResult {
  const result = classifyCandidate(label, observations);

  assert.equal(result.queuePolicy, expectedPolicy, label);
  assert.equal(result.queueEligible, expectedPolicy !== null, label);
  assert.equal(result.evidenceSnapshot.rule_version, REVIEW_RULE_VERSION, label);
  assert.equal(result.productsWritten, 0, label);

  return result;
}

assertPolicy("rank-15-one-date", [observation("rank-15-one-date", 15, "2026-06-20T01:00:00.000Z")], "top_15_immediate");

assertPolicy("rank-16-one-date", [observation("rank-16-one-date", 16, "2026-06-20T01:00:00.000Z")], null);

assertPolicy("rank-16-two-dates", [
  observation("rank-16-two-dates", 18, "2026-06-20T01:00:00.000Z"),
  observation("rank-16-two-dates", 16, "2026-06-21T01:00:00.000Z"),
], "rank_16_30_persistent");

assertPolicy("rank-30-two-dates", [
  observation("rank-30-two-dates", 22, "2026-06-20T01:00:00.000Z"),
  observation("rank-30-two-dates", 30, "2026-06-21T01:00:00.000Z"),
], "rank_16_30_persistent");

assertPolicy("rank-31-two-dates-no-reinforcement", [
  observation("rank-31-two-dates-no-reinforcement", 31, "2026-06-20T01:00:00.000Z"),
  observation("rank-31-two-dates-no-reinforcement", 31, "2026-06-21T01:00:00.000Z"),
], null);

const popularityReinforced = assertPolicy("rank-31-three-dates-popularity-30", [
  observation("rank-31-three-dates-popularity-30", 31, "2026-06-20T01:00:00.000Z"),
  observation("rank-31-three-dates-popularity-30", 34, "2026-06-21T01:00:00.000Z"),
  observation("rank-31-three-dates-popularity-30", 31, "2026-06-22T01:00:00.000Z"),
  popularity("rank-31-three-dates-popularity-30", 30, "2026-06-22T01:30:00.000Z"),
], "rank_31_50_reinforced");
assert.deepEqual(popularityReinforced.evidenceSnapshot.qualification.reinforcement_reasons, ["latest_popularity_rank_lte_30"]);

const concernReinforced = assertPolicy("rank-31-three-dates-two-concerns", [
  observation("rank-31-three-dates-two-concerns", 31, "2026-06-20T01:00:00.000Z", "acne"),
  observation("rank-31-three-dates-two-concerns", 31, "2026-06-21T01:00:00.000Z", "acne"),
  observation("rank-31-three-dates-two-concerns", 31, "2026-06-22T01:00:00.000Z", "acne"),
  observation("rank-31-three-dates-two-concerns", 75, "2026-06-22T02:00:00.000Z", "pores"),
], "rank_31_50_reinforced");
assert.deepEqual(concernReinforced.evidenceSnapshot.qualification.reinforcement_reasons, ["two_or_more_distinct_concerns"]);

assertPolicy("rank-31-three-dates-popularity-31-one-concern", [
  observation("rank-31-three-dates-popularity-31-one-concern", 31, "2026-06-20T01:00:00.000Z"),
  observation("rank-31-three-dates-popularity-31-one-concern", 31, "2026-06-21T01:00:00.000Z"),
  observation("rank-31-three-dates-popularity-31-one-concern", 31, "2026-06-22T01:00:00.000Z"),
  popularity("rank-31-three-dates-popularity-31-one-concern", 31, "2026-06-22T01:30:00.000Z"),
], null);

assertPolicy("rank-50-valid-reinforcement", [
  observation("rank-50-valid-reinforcement", 50, "2026-06-20T01:00:00.000Z"),
  observation("rank-50-valid-reinforcement", 50, "2026-06-21T01:00:00.000Z"),
  observation("rank-50-valid-reinforcement", 50, "2026-06-22T01:00:00.000Z"),
  popularity("rank-50-valid-reinforcement", 30, "2026-06-22T01:30:00.000Z"),
], "rank_31_50_reinforced");

assertPolicy("rank-51", [
  observation("rank-51", 31, "2026-06-20T01:00:00.000Z"),
  observation("rank-51", 31, "2026-06-21T01:00:00.000Z"),
  observation("rank-51", 51, "2026-06-22T01:00:00.000Z"),
  observation("rank-51", 80, "2026-06-22T02:00:00.000Z", "pores"),
  popularity("rank-51", 1, "2026-06-22T01:30:00.000Z"),
], null);

assertPolicy("three-crawls-one-kst-date", [
  observation("three-crawls-one-kst-date", 16, "2026-06-21T00:00:00.000Z"),
  observation("three-crawls-one-kst-date", 16, "2026-06-21T03:00:00.000Z"),
  observation("three-crawls-one-kst-date", 16, "2026-06-21T10:00:00.000Z"),
], null);

const popularityOnly = assertPolicy("popularity-only", [
  popularity("popularity-only", 1, "2026-06-22T01:00:00.000Z"),
], null);
assert.equal(popularityOnly.evidenceSnapshot.queue_eligible, false);

const migrationSql = readFileSync(
  path.resolve("..", "supabase", "migrations", "20260627224615_ranking_review_v2_b_policy.sql"),
  "utf8",
);
const policyConcernsSql = migrationSql.slice(
  migrationSql.indexOf("policy_concerns as ("),
  migrationSql.indexOf("policy_choice as ("),
);
const lowerRankPolicySql = policyConcernsSql.slice(
  policyConcernsSql.indexOf("when cg.latest_rank between 31 and 50"),
  policyConcernsSql.indexOf("end as queue_policy"),
);
const distinctConcernReinforcementSql = policyConcernsSql.slice(
  policyConcernsSql.indexOf("two_or_more_distinct_concerns"),
  policyConcernsSql.indexOf("end as reinforcement_reasons"),
);

assert.match(migrationSql, /'ranking-review-v2'/);
assert.doesNotMatch(migrationSql, new RegExp(`ranking-review-${"v1"}`));
assert.match(migrationSql, /'top_15_immediate'/);
assert.match(migrationSql, /'rank_16_30_persistent'/);
assert.match(migrationSql, /'rank_31_50_reinforced'/);
assert.match(migrationSql, /at time zone 'Asia\/Seoul'/);
assert.match(migrationSql, /latest_rank between 16 and 30[\s\S]+distinct_observed_dates >= 2/);
assert.match(lowerRankPolicySql, /cg\.latest_rank between 31 and 50/);
assert.match(lowerRankPolicySql, /cg\.distinct_observed_dates >= 3/);
assert.match(lowerRankPolicySql, /ps\.popularity_latest_rank <= 30/);
assert.match(lowerRankPolicySql, /coalesce\(cs\.distinct_concern_count, 0\) >= 2/);
assert.doesNotMatch(lowerRankPolicySql, /latest_rank <= 50[\s\S]+distinct_concern/);
assert.match(distinctConcernReinforcementSql, /coalesce\(cs\.distinct_concern_count, 0\) >= 2/);
assert.doesNotMatch(distinctConcernReinforcementSql, /latest_rank <= 50/);
assert.doesNotMatch(migrationSql, /qualifying_distinct_concern_count/);
assert.match(migrationSql, /set status = 'deferred'/);
assert.match(migrationSql, /where candidate_id = v_row\.candidate_id\s+and status in \('queued', 'reviewing'\)/);
assert.match(migrationSql, /where reviews\.status in \('queued', 'reviewing'\)/);
assert.match(migrationSql, /on conflict \(candidate_id\) do nothing/);
assert.match(migrationSql, /not summary\.product_match_exists/);
assert.match(migrationSql, /nullif\(btrim\(coalesce\(summary\.external_id/);
assert.match(migrationSql, /'reviews_deferred'/);
assert.match(migrationSql, /'products_written', 0/);
assert.doesNotMatch(migrationSql, /^\s*insert into public\.products/im);
assert.doesNotMatch(migrationSql, /^\s*update public\.products/im);
assert.doesNotMatch(migrationSql, /^\s*delete from public\.products/im);

console.log("ranking review B policy test passed");
