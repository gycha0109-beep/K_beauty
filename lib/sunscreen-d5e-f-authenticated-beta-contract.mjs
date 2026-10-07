import {
  D5C_SUNSCREEN_CANARY_PRODUCT_IDS,
} from "./sunscreen-d5c-canary-authority-contract.mjs";
import {
  D5E_E_COSRX_CANARY_PRODUCT_ID,
} from "./sunscreen-d5e-e-cosrx-canary-authority-contract.mjs";

export const D5E_F_AUTHENTICATED_BETA_CONTRACT_VERSION =
  "data-ai29c-d5e-f-authenticated-beta-allowlist-expansion-v1";

export const D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS = Object.freeze([
  ...D5C_SUNSCREEN_CANARY_PRODUCT_IDS,
  D5E_E_COSRX_CANARY_PRODUCT_ID,
]);

export const D5E_F_AUTHENTICATED_BETA_TARGET_COUNT = 4;
export const D5E_F_AUTHENTICATED_BETA_COMBINED_SUNSCREEN_COUNT = 15;

export function isD5eFAuthenticatedBetaProductId(productId) {
  return D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS.includes(productId);
}
