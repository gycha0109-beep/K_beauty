#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  buildFaceLabSimulationRouteColorReview
} from "../lib/face-lab-v2/evaluation/simulation-route-color-review.js";

const inputPath =
  process.argv[2] ||
  process.env.FACE_LAB_SIMULATION_ROUTE_COLOR_INPUT;

if (!inputPath) {
  throw new Error(
    "Provide a completed Route/Color review JSON path"
  );
}

const input = JSON.parse(
  await fs.readFile(
    path.resolve(inputPath),
    "utf8"
  )
);

const review =
  buildFaceLabSimulationRouteColorReview({
    caseId: input.caseId,
    reviewerRef:
      input.reviewerRef,
    analysis: input.analysis,
    rawState:
      input.faceLabV2State,
    locale: input.locale,
    renderSpecSha256:
      input.renderSpecSha256,
    routeOperations:
      input.routeOperations,
    colorTargets:
      input.colorTargets
  });

console.log(
  JSON.stringify(
    review,
    null,
    2
  )
);

if (review.status !== "ready") {
  process.exitCode = 1;
}
