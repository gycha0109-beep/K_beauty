import { readFileSync } from 'node:fs';
import {
  buildReverseArchetypeCollectionPlan,
  buildReverseArchetypeCollectionCoverage,
  validateReverseArchetypeCollectionLedger
} from '../lib/face-lab-reverse-archetype-research.js';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const sourceManifest = readJson(
  'evidence/facelab/reverse-archetype/pilot-v1/source-manifest.json'
);
const queryManifest = readJson(
  'evidence/facelab/reverse-archetype/pilot-v1/query-manifest.json'
);

const argument = process.argv[2];

if (argument === '--plan') {
  console.log(JSON.stringify(
    buildReverseArchetypeCollectionPlan({ sourceManifest, queryManifest }),
    null,
    2
  ));
  process.exit(0);
}

if (argument === '--next') {
  const ledgerPath = process.argv[3] ||
    'evidence/facelab/reverse-archetype/pilot-v1/collection-ledger.json';
  const ledger = readJson(ledgerPath);
  const validation = validateReverseArchetypeCollectionLedger(ledger, {
    sourceManifest,
    queryManifest
  });

  if (!validation.ok) {
    console.log(JSON.stringify({
      valid: false,
      errors: validation.errors
    }, null, 2));
    process.exit(1);
  }

  const plan = buildReverseArchetypeCollectionPlan({ sourceManifest, queryManifest });
  const completedTaskIds = new Set(
    ledger.batches.map((batch) => batch.retrievalSurfaceId + '|' + batch.queryId)
  );
  const nextTask = plan.tasks.find((task) => !completedTaskIds.has(task.taskId)) || null;

  console.log(JSON.stringify({
    valid: true,
    ledger: {
      runId: ledger.runId,
      status: ledger.status
    },
    progress: {
      plannedBatches: validation.coverage.plannedBatches,
      completeBatches: validation.coverage.completeBatches,
      blockedBatches: validation.coverage.blockedBatches,
      pendingBatches: validation.coverage.pendingBatches,
      capturedCandidates: validation.coverage.capturedCandidates
    },
    nextTask
  }, null, 2));
  process.exit(0);
}

if (!argument) {
  console.error(
    'usage: node scripts/face-lab-reverse-archetype-collection.mjs --plan | --next [ledger.json] | <collection.json>'
  );
  process.exit(1);
}

const input = readJson(argument);

if (input?.schemaVersion === 'face-lab-reverse-archetype-collection-ledger-v1') {
  const validation = validateReverseArchetypeCollectionLedger(input, {
    sourceManifest,
    queryManifest
  });

  console.log(JSON.stringify({
    valid: validation.ok,
    errors: validation.errors,
    ledger: {
      runFamily: input.runFamily,
      runId: input.runId,
      status: input.status,
      createdAt: input.createdAt
    },
    coverage: validation.coverage
  }, null, 2));

  if (!validation.ok) process.exitCode = 1;
  process.exit();
}

const batches = Array.isArray(input) ? input : input?.batches;

if (!Array.isArray(batches)) {
  console.error(
    'collection input must be a collection ledger, an array, or an object with a batches array'
  );
  process.exit(1);
}

const coverage = buildReverseArchetypeCollectionCoverage(batches, {
  sourceManifest,
  queryManifest
});

console.log(JSON.stringify(coverage, null, 2));

if (!coverage.valid) {
  process.exitCode = 1;
}
