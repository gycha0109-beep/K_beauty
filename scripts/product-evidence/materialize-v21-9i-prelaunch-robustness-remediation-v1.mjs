#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ARTIFACT_FILE,
  MANIFEST_FILE,
  ROOT,
  buildAll,
  buildManifest,
  canonical,
  sha256
} from "./build-v21-9i-prelaunch-robustness-remediation-v1.mjs";

const artifact = await buildAll();
const artifactBytes = Buffer.from(canonical(artifact), "utf8");
const manifest = buildManifest(artifactBytes);
const manifestBytes = Buffer.from(canonical(manifest), "utf8");

mkdirSync(ROOT, { recursive: true });
writeFileSync(path.join(ROOT, ARTIFACT_FILE), artifactBytes);
writeFileSync(path.join(ROOT, MANIFEST_FILE), manifestBytes);

console.log(JSON.stringify({
  stage: "V2.1-9I",
  materializer: "materialize-v21-9i-prelaunch-robustness-remediation-v1",
  artifact_sha256: sha256(artifactBytes),
  artifact_file: ARTIFACT_FILE,
  manifest_file: MANIFEST_FILE,
  status: "WRITTEN"
}));
