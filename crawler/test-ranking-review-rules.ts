import assert from "node:assert/strict";

type EvidenceType = "concern_relevance" | "popularity";
type ReviewStatus = "queued" | "reviewing" | "approved" | "rejected" | "deferred";

interface ObservationFixture {
  candidateId: string;
  concernKey: string | null;
  evidenceType: EvidenceType;
  rank: number;
  collectedAt: string;
}

interface ReviewFixture {
  candidateId: string;
  status: ReviewStatus;
}

interface ConcernGroup {
  concernKey: string;
  observationCount: number;
  distinctObservedDates: number;
  firstObservedDate: string;
  lastObservedDate: string;
  bestRank: number;
  latestRank: number;
}

interface CandidateSummary {
  candidateId: string;
  distinctConcernCount: number;
  concernTop15Count: number;
  repeatedConcernCount: number;
  popularityObservationCount: number;
  queueEligible: boolean;
  selectionReason: string;
  priorityScore: number;
  productsWritten: 0;
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

function summarizeCandidate(candidateId: string, observations: ObservationFixture[]): CandidateSummary {
  const candidateObservations = observations.filter((observation) => observation.candidateId === candidateId);
  const concernObservations = candidateObservations.filter(
    (observation) => observation.evidenceType === "concern_relevance" && observation.concernKey,
  );
  const popularityObservations = candidateObservations.filter((observation) => observation.evidenceType === "popularity");
  const concernGroups = new Map<string, ObservationFixture[]>();

  for (const observation of concernObservations) {
    const concernKey = observation.concernKey ?? "";
    concernGroups.set(concernKey, [...(concernGroups.get(concernKey) ?? []), observation]);
  }

  const groups: ConcernGroup[] = Array.from(concernGroups.entries()).map(([concernKey, groupObservations]) => {
    const dates = groupObservations.map((observation) => getKstDate(observation.collectedAt));
    const latest = groupObservations.reduce(latestObservation);

    return {
      concernKey,
      observationCount: groupObservations.length,
      distinctObservedDates: new Set(dates).size,
      firstObservedDate: dates.sort()[0],
      lastObservedDate: dates.sort().at(-1) ?? dates[0],
      bestRank: Math.min(...groupObservations.map((observation) => observation.rank)),
      latestRank: latest.rank,
    };
  });

  const distinctConcernCount = groups.length;
  const concernTop15Count = groups.filter((group) => group.latestRank <= 15).length;
  const repeatedConcernCount = groups.filter((group) => group.distinctObservedDates >= 2).length;
  const popularityObservationCount = popularityObservations.length;
  const queueEligible = concernTop15Count > 0 || repeatedConcernCount > 0 || distinctConcernCount >= 2;
  const reasonParts = [
    concernTop15Count > 0 ? "concern top 15 evidence" : null,
    repeatedConcernCount > 0 ? "repeated same-concern evidence" : null,
    distinctConcernCount >= 2 ? "multiple concern evidence" : null,
    popularityObservationCount > 0 ? "popularity ranking evidence" : null,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    candidateId,
    distinctConcernCount,
    concernTop15Count,
    repeatedConcernCount,
    popularityObservationCount,
    queueEligible,
    selectionReason: queueEligible ? reasonParts.join("; ") : "currently below queue threshold under ranking-review-v2",
    priorityScore: queueEligible ? 1 : 0,
    productsWritten: 0,
  };
}

function refreshReviews(
  observations: ObservationFixture[],
  existingReviews: ReviewFixture[],
): { summaries: CandidateSummary[]; protectedChanged: number; productsWritten: 0 } {
  const candidateIds = Array.from(
    new Set([...observations.map((observation) => observation.candidateId), ...existingReviews.map((review) => review.candidateId)]),
  );
  const summaries = candidateIds.map((candidateId) => summarizeCandidate(candidateId, observations));
  const protectedChanged = existingReviews.filter((review) =>
    ["approved", "rejected", "deferred"].includes(review.status),
  ).filter((review) => {
    const summary = summaries.find((entry) => entry.candidateId === review.candidateId);
    return summary?.queueEligible === false && summary.priorityScore !== 0;
  }).length;

  return {
    summaries,
    protectedChanged,
    productsWritten: 0,
  };
}

const sameDayObservations: ObservationFixture[] = [
  { candidateId: "same-day", concernKey: "acne", evidenceType: "concern_relevance", rank: 20, collectedAt: "2026-06-21T23:00:00.000Z" },
  { candidateId: "same-day", concernKey: "acne", evidenceType: "concern_relevance", rank: 20, collectedAt: "2026-06-22T01:00:00.000Z" },
  { candidateId: "same-day", concernKey: "acne", evidenceType: "concern_relevance", rank: 20, collectedAt: "2026-06-22T08:25:00.000Z" },
];
const sameDaySummary = summarizeCandidate("same-day", sameDayObservations);
assert.equal(sameDaySummary.repeatedConcernCount, 0);
assert.equal(sameDaySummary.queueEligible, false);

const twoDateSummary = summarizeCandidate("two-date", [
  { candidateId: "two-date", concernKey: "acne", evidenceType: "concern_relevance", rank: 22, collectedAt: "2026-06-22T08:00:00.000Z" },
  { candidateId: "two-date", concernKey: "acne", evidenceType: "concern_relevance", rank: 25, collectedAt: "2026-06-29T08:00:00.000Z" },
]);
assert.equal(twoDateSummary.repeatedConcernCount, 1);
assert.equal(twoDateSummary.queueEligible, true);
assert.match(twoDateSummary.selectionReason, /repeated same-concern evidence/);

const top15Summary = summarizeCandidate("top15", [
  { candidateId: "top15", concernKey: "acne", evidenceType: "concern_relevance", rank: 8, collectedAt: "2026-06-22T08:00:00.000Z" },
]);
assert.equal(top15Summary.queueEligible, true);
assert.equal(top15Summary.selectionReason, "concern top 15 evidence");

const fallenSummary = summarizeCandidate("fallen", [
  { candidateId: "fallen", concernKey: "acne", evidenceType: "concern_relevance", rank: 8, collectedAt: "2026-06-22T08:00:00.000Z" },
  { candidateId: "fallen", concernKey: "acne", evidenceType: "concern_relevance", rank: 30, collectedAt: "2026-06-22T09:00:00.000Z" },
]);
assert.equal(fallenSummary.concernTop15Count, 0);
assert.equal(fallenSummary.queueEligible, false);

const outsideTop50Summary = summarizeCandidate("outside", [
  { candidateId: "outside", concernKey: "acne", evidenceType: "concern_relevance", rank: 30, collectedAt: "2026-06-22T08:00:00.000Z" },
]);
assert.equal(outsideTop50Summary.queueEligible, false);

const popularityOnlySummary = summarizeCandidate("popularity", [
  { candidateId: "popularity", concernKey: null, evidenceType: "popularity", rank: 1, collectedAt: "2026-06-22T08:00:00.000Z" },
]);
assert.equal(popularityOnlySummary.queueEligible, false);

const refreshResult = refreshReviews(sameDayObservations, [
  { candidateId: "approved", status: "approved" },
  { candidateId: "rejected", status: "rejected" },
  { candidateId: "deferred", status: "deferred" },
]);
assert.equal(refreshResult.protectedChanged, 0);
assert.equal(refreshResult.productsWritten, 0);

console.log("ranking review rule test passed");
