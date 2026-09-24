import { readFileSync } from "node:fs";
import {
  scaffoldRealPhotoStabilityRunManifest,
  scaffoldReferenceCorpusSourceManifest
} from "../lib/face-lab-source-manifest-scaffold.js";

const [mode, specPath] = process.argv.slice(2);
if (!mode || !specPath) {
  throw new Error(
    "Usage: node scripts/scaffold-face-lab-source-manifest.mjs <real-photo-stability|reference-corpus> <spec.json>"
  );
}
const spec = JSON.parse(readFileSync(specPath, "utf8"));

let result;
if (mode === "real-photo-stability") {
  result = scaffoldRealPhotoStabilityRunManifest(spec);
} else if (mode === "reference-corpus") {
  result = scaffoldReferenceCorpusSourceManifest(spec);
} else {
  throw new Error("face_lab_scaffold_mode_invalid:" + mode);
}

console.log(JSON.stringify({
  ok: true,
  mode,
  manifest: result.manifest,
  summary: result.summary,
  authority: {
    productionAuthority: false,
    normalizationAuthority: false,
    thresholdAuthority: false
  }
}, null, 2));
