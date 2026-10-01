#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  buildFaceLabSimulationIdentityScopeReview
} from "../lib/face-lab-v2/evaluation/simulation-identity-scope-review.js";

const inputPath =
  process.argv[2] ||
  process.env.FACE_LAB_SIMULATION_IDENTITY_SCOPE_INPUT;

if (!inputPath) {
  throw new Error(
    "Provide a review JSON path as argv[2] or FACE_LAB_SIMULATION_IDENTITY_SCOPE_INPUT"
  );
}

const resolved =
  path.resolve(inputPath);
const input = JSON.parse(
  await fs.readFile(
    resolved,
    "utf8"
  )
);

const review =
  buildFaceLabSimulationIdentityScopeReview(
    input
  );

console.log(
  JSON.stringify(review, null, 2)
);

if (review.status !== "ready") {
  process.exitCode = 1;
}
