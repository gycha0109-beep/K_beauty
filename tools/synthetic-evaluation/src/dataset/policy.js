import {
  DATASET_ACTIVATION_POLICY,
  DATASET_GRAPH_POLICY,
  DATASET_LOCK_POLICY,
  DATASET_SOURCE_POLICY,
  DATASET_SPLIT_POLICY,
  G5_HOLDOUT_POLICY,
  REGRESSION_BASELINE_POLICY
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

function withDigest(policy) {
  return deepFreeze({ ...policy, digest: sha256Hex(stableStringify(policy)) });
}

export const DATASET_SOURCE_POLICY_RECORD = withDigest(DATASET_SOURCE_POLICY);
export const DATASET_GRAPH_POLICY_RECORD = withDigest(DATASET_GRAPH_POLICY);
export const DATASET_SPLIT_POLICY_RECORD = withDigest(DATASET_SPLIT_POLICY);
export const DATASET_LOCK_POLICY_RECORD = withDigest(DATASET_LOCK_POLICY);
export const DATASET_ACTIVATION_POLICY_RECORD = withDigest(DATASET_ACTIVATION_POLICY);
export const G5_HOLDOUT_POLICY_RECORD = withDigest(G5_HOLDOUT_POLICY);
export const REGRESSION_BASELINE_POLICY_RECORD = withDigest(REGRESSION_BASELINE_POLICY);
