import { createHash } from "node:crypto";
import { normalizeProductCategory, resolveProductCategorySemantics } from "./product-category-normalizer.js";
import { resolveProductFunctionalProfile } from "./product-functional-profile.js";
import {
  buildCurrentProductSnapshotFromSource,
  buildRecommendationProductFromSource
} from "./product-source.js";

export const PRODUCT_DATA_SUFFICIENCY_AUDIT_VERSION = "product-data-sufficiency-audit-v1";
