#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import {
  aggregateProductQueryQuality,
  evaluateProductQueryQualityObservation
} from "../lib/product-query-beta-quality-evaluation-contract.mjs";

const CORPUS_PATH = "fixtures/data-ai22/product-query-quality-cases.json";

function parseArgs(argv) {
  const args = {
    expectedBaseline: false,
    observationsPath: null,
    outputPath: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--expected-baseline") args.expectedBaseline = true;
    else if (value === "--observations") args.observationsPath = argv[++index] || null;
    else if (value === "--output") args.outputPath = argv[++index] || null;
    else throw new Error(`unknown argument: ${value}`);
  }

  if (args.expectedBaseline === Boolean(args.observationsPath)) {
    throw new Error("choose exactly one of --expected-baseline or --observations <path>");
  }

  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const args = parseArgs(process.argv.slice(2));
const corpus = readJson(CORPUS_PATH);
const testCases = corpus.cases;

let observations;
if (args.expectedBaseline) {
  observations = testCases.map((testCase) => ({
    caseId: testCase.id,
    runtimeSucceeded: true,
    intent: testCase.expectedIntent
  }));
} else {
  const payload = readJson(args.observationsPath);
  observations = payload.observations;
}

if (!Array.isArray(observations)) {
  throw new Error("observations must be an array");
}

const observationById = new Map();
for (const observation of observations) {
  if (!observation?.caseId || observationById.has(observation.caseId)) {
    throw new Error("observation case IDs must be unique and non-empty");
  }
  observationById.set(observation.caseId, observation);
}

const expectedIds = new Set(testCases.map((testCase) => testCase.id));
const extraIds = [...observationById.keys()].filter((id) => !expectedIds.has(id));
if (extraIds.length > 0) {
  throw new Error(`unknown observation case IDs: ${extraIds.join(",")}`);
}

const evaluations = testCases.map((testCase) =>
  evaluateProductQueryQualityObservation(
    testCase,
    observationById.get(testCase.id) || {
      caseId: testCase.id,
      runtimeSucceeded: false
    }
  )
);

const aggregate = aggregateProductQueryQuality(testCases, evaluations);
const report = {
  reportVersion: "data-ai22-product-query-quality-report-v1",
  phase: "DATA-AI22",
  corpusVersion: corpus.corpusVersion,
  accepted: aggregate.accepted,
  metrics: aggregate.metrics,
  clusters: aggregate.clusters,
  failures: evaluations
    .filter((evaluation) => !evaluation.passed)
    .map((evaluation) => ({
      caseId: evaluation.caseId,
      failures: evaluation.failures,
      mismatchedFields: evaluation.mismatchedFields || [],
      criticalMismatchFields: evaluation.criticalMismatchFields || []
    })),
  privacy: {
    rawQueryRecorded: false,
    accountIdentifierRecorded: false,
    tokenRecorded: false,
    profileDataRecorded: false,
    historyDataRecorded: false
  }
};

const serialized = JSON.stringify(report, null, 2) + "\n";
if (args.outputPath) writeFileSync(args.outputPath, serialized, "utf8");
process.stdout.write(serialized);

if (!report.accepted) process.exitCode = 1;
