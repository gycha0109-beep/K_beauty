import "server-only";

import { executeProductQueryPreview } from "@/lib/server/product-query-preview-service";
import {
  PRODUCT_QUERY_STAGE_CANARY_CONTRACT_VERSION,
  executeProductQueryStageCanaryCore
} from "@/lib/product-query-stage-canary-core.mjs";

export { PRODUCT_QUERY_STAGE_CANARY_CONTRACT_VERSION };

export async function executeProductQueryStageCanary(query) {
  return executeProductQueryStageCanaryCore(query, {
    executePreview: executeProductQueryPreview
  });
}

export const PRODUCT_QUERY_STAGE_CANARY_LIMITS = Object.freeze({
  manualOnly: true,
  effectiveSampleBps: 0,
  repetitions: 2,
  authenticatedOnly: true,
  profileRead: false,
  historyRead: false,
  persistence: "none",
  productionActivation: false,
  productionShadow: false,
  automaticTrafficSampling: false,
  publicSearchCutover: false,
  recommendationLogWrite: false,
  directProductFactRead: false,
  taxonomyRuntimeAuthority: false,
  providerProductSelection: false,
  providerRankingAuthority: false,
  releaseGateImplemented: false
});
