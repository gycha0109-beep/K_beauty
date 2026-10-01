#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  buildFaceLabSimulationRouteColorReviewTemplate
} from "../lib/face-lab-v2/evaluation/simulation-route-color-review.js";

const inputPath =
  process.argv[2] ||
  process.env.FACE_LAB_SIMULATION_ROUTE_COLOR_INPUT;

if (!inputPath) {
  throw new Error(
    "Provide a private Gate G input JSON path"
  );
}

const input = JSON.parse(
  await fs.readFile(
    path.resolve(inputPath),
    "utf8"
  )
);

const template =
  buildFaceLabSimulationRouteColorReviewTemplate({
    caseId: input.caseId,
    analysis: input.analysis,
    rawState:
      input.faceLabV2State,
    locale: input.locale
  });

console.log(
  JSON.stringify(
    template,
    null,
    2
  )
);

if (template.status !== "ready") {
  process.exitCode = 1;
}
