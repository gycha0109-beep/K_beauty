import {
  CAMPAIGN_METRIC_POLICY,
  CAMPAIGN_REPORT_POLICY,
  T8_EXPORTER_ID,
  T8_EXPORTER_VERSION,
  T8_RENDERER_VERSION,
  T8_THUMBNAIL_POLICY
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

export const REPORT_POLICY = deepFreeze({
  ...CAMPAIGN_REPORT_POLICY,
  digest: sha256Hex(stableStringify(CAMPAIGN_REPORT_POLICY))
});

export const METRIC_POLICY = deepFreeze({
  ...CAMPAIGN_METRIC_POLICY,
  digest: sha256Hex(stableStringify(CAMPAIGN_METRIC_POLICY))
});

export const THUMBNAIL_POLICY = deepFreeze({
  ...T8_THUMBNAIL_POLICY,
  digest: sha256Hex(stableStringify(T8_THUMBNAIL_POLICY))
});

export const EXPORTER_PROFILE = deepFreeze({
  exporterId: T8_EXPORTER_ID,
  exporterVersion: T8_EXPORTER_VERSION,
  rendererVersion: T8_RENDERER_VERSION
});

export const REPORT_LIMITATIONS = Object.freeze([
  "This pilot contains exactly 20 planned primary slots per run and is not population-representative.",
  "Counts and rates are descriptive and do not establish causality or statistical significance.",
  "Generation intent is not an observed label or ground truth.",
  "G4 references are reported as of campaign closeout and are not dataset-split or G5 authority.",
  "Provider comparisons, when permitted, isolate only the frozen generation Provider field and do not establish an intrinsic winner."
]);
