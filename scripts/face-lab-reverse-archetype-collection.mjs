import { readFileSync } from 'node:fs';
import {
  buildReverseArchetypeCollectionPlan,
  buildReverseArchetypeCollectionCoverage
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

if (!argument) {
  console.error(
    'usage: node scripts/face-lab-reverse-archetype-collection.mjs --plan | <collection.json>'
  );
  process.exit(1);
}

const input = readJson(argument);
const batches = Array.isArray(input) ? input : input?.batches;

if (!Array.isArray(batches)) {
  console.error('collection input must be an array or an object with a batches array');
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
