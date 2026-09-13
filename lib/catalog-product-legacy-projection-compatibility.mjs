export const CATALOG_PRODUCT_LEGACY_PROJECTION_COMPATIBILITY_VERSION =
  "catalog-product-legacy-projection-compatibility-v1";

export const LEGACY_PROJECTION_COMPATIBILITY_STATUS = Object.freeze({
  LEGACY_PROJECTED: "LEGACY_PROJECTED",
  CATALOG_ONLY: "CATALOG_ONLY",
  INVALID: "INVALID",
});

function nullableText(value) {
  if (value == null || value === "") return null;
  return String(value);
}

function field(object, camelKey, snakeKey) {
  if (!object || typeof object !== "object") return null;
  return object[camelKey] ?? object[snakeKey] ?? null;
}

function result(status, reason, details = {}) {
  return Object.freeze({
    contractVersion: CATALOG_PRODUCT_LEGACY_PROJECTION_COMPATIBILITY_VERSION,
    status,
    reason,
    hasLegacyRecommendationProjection:
      status === LEGACY_PROJECTION_COMPATIBILITY_STATUS.LEGACY_PROJECTED,
    grantsRecommendationAdmission: false,
    recommendationAdmissionAuthority: "independent",
    ...details,
  });
}

function invalid(reason, details = {}) {
  return result(LEGACY_PROJECTION_COMPATIBILITY_STATUS.INVALID, reason, details);
}

function validTermId(value, taxonomyVersion, axis) {
  const normalized = nullableText(value);
  const prefix = `${taxonomyVersion}:${axis}:`;
  if (normalized == null || !normalized.startsWith(prefix)) return false;
  const termKey = normalized.slice(prefix.length);
  return /^[a-z0-9][a-z0-9_]*$/.test(termKey);
}

function canonicalTermsOf(object) {
  return Object.freeze({
    entityKindTermId: nullableText(field(object, "entityKindTermId", "entity_kind_term_id")),
    domainTermId: nullableText(field(object, "domainTermId", "domain_term_id")),
    recommendationFamilyTermId: nullableText(
      field(object, "recommendationFamilyTermId", "recommendation_family_term_id"),
    ),
    categoryTermId: nullableText(field(object, "categoryTermId", "category_term_id")),
    formTermId: nullableText(field(object, "formTermId", "form_term_id")),
  });
}

function sameCanonicalTerms(left, right) {
  return (
    left.entityKindTermId === right.entityKindTermId &&
    left.domainTermId === right.domainTermId &&
    left.recommendationFamilyTermId === right.recommendationFamilyTermId &&
    left.categoryTermId === right.categoryTermId &&
    left.formTermId === right.formTermId
  );
}

export function resolveCatalogProductLegacyProjectionCompatibility({
  product,
  assignment,
  projection = null,
  expectedTaxonomyVersion = "catalog-taxonomy-v1",
} = {}) {
  const productId = nullableText(product?.id);
  if (!productId) return invalid("MISSING_PRODUCT_ID");

  if (!assignment || typeof assignment !== "object") {
    return invalid("MISSING_CANONICAL_ASSIGNMENT", { productId });
  }

  const assignmentProductId = nullableText(field(assignment, "productId", "product_id"));
  if (assignmentProductId !== productId) {
    return invalid("PRODUCT_ASSIGNMENT_ID_MISMATCH", { productId, assignmentProductId });
  }

  const taxonomyVersion = nullableText(field(assignment, "taxonomyVersion", "taxonomy_version"));
  if (taxonomyVersion !== expectedTaxonomyVersion) {
    return invalid("TAXONOMY_VERSION_MISMATCH", {
      productId,
      taxonomyVersion,
      expectedTaxonomyVersion,
    });
  }

  const assignmentState = nullableText(field(assignment, "assignmentState", "assignment_state"));
  if (!new Set(["shadow", "canonical"]).has(assignmentState)) {
    return invalid("CANONICAL_ASSIGNMENT_STATE_INVALID", {
      productId,
      taxonomyVersion,
      assignmentState,
    });
  }

  const canonicalTerms = canonicalTermsOf(assignment);
  if (
    !validTermId(canonicalTerms.entityKindTermId, taxonomyVersion, "entity_kind") ||
    !validTermId(canonicalTerms.domainTermId, taxonomyVersion, "domain") ||
    !validTermId(
      canonicalTerms.recommendationFamilyTermId,
      taxonomyVersion,
      "recommendation_family",
    ) ||
    !validTermId(canonicalTerms.categoryTermId, taxonomyVersion, "category") ||
    (canonicalTerms.formTermId != null &&
      !validTermId(canonicalTerms.formTermId, taxonomyVersion, "form"))
  ) {
    return invalid("CANONICAL_ASSIGNMENT_TERMS_INVALID", { productId, taxonomyVersion });
  }

  const productCategory = nullableText(product?.category);
  const productForm = nullableText(product?.product_form ?? product?.productForm);
  const legacyProjectionKey = nullableText(
    field(assignment, "legacyProjectionKey", "legacy_projection_key"),
  );

  if (!legacyProjectionKey) {
    if (projection != null) {
      return invalid("UNREFERENCED_LEGACY_PROJECTION_SUPPLIED", {
        productId,
        taxonomyVersion,
      });
    }
    if (productCategory != null || productForm != null) {
      return invalid("LEGACY_FIELDS_WITHOUT_PROJECTION", {
        productId,
        taxonomyVersion,
        productCategory,
        productForm,
      });
    }
    return result(LEGACY_PROJECTION_COMPATIBILITY_STATUS.CATALOG_ONLY, "NO_LEGACY_PROJECTION", {
      productId,
      taxonomyVersion,
      assignmentState,
      legacyProjectionKey: null,
      legacyCategory: null,
      legacyProductForm: null,
    });
  }

  if (!projection || typeof projection !== "object") {
    return invalid("MISSING_REFERENCED_LEGACY_PROJECTION", {
      productId,
      taxonomyVersion,
      legacyProjectionKey,
    });
  }

  const projectionKey = nullableText(field(projection, "projectionKey", "projection_key"));
  if (projectionKey !== legacyProjectionKey) {
    return invalid("LEGACY_PROJECTION_KEY_MISMATCH", {
      productId,
      taxonomyVersion,
      legacyProjectionKey,
      projectionKey,
    });
  }

  const projectionTaxonomyVersion = nullableText(
    field(projection, "taxonomyVersion", "taxonomy_version"),
  );
  if (projectionTaxonomyVersion !== taxonomyVersion) {
    return invalid("LEGACY_PROJECTION_VERSION_MISMATCH", {
      productId,
      taxonomyVersion,
      projectionTaxonomyVersion,
    });
  }

  const projectionLifecycleState = nullableText(
    field(projection, "lifecycleState", "lifecycle_state"),
  );
  if (projectionLifecycleState !== "active") {
    return invalid("LEGACY_PROJECTION_LIFECYCLE_INVALID", {
      productId,
      taxonomyVersion,
      legacyProjectionKey,
      projectionLifecycleState,
    });
  }

  const projectionCanonicalTerms = canonicalTermsOf(projection);
  if (!sameCanonicalTerms(projectionCanonicalTerms, canonicalTerms)) {
    return invalid("LEGACY_PROJECTION_CANONICAL_TERMS_MISMATCH", {
      productId,
      taxonomyVersion,
      legacyProjectionKey,
    });
  }

  const legacyCategory = nullableText(field(projection, "legacyCategory", "legacy_category"));
  const legacyProductForm = nullableText(
    field(projection, "legacyProductForm", "legacy_product_form"),
  );
  if (!legacyCategory) {
    return invalid("LEGACY_PROJECTION_CATEGORY_MISSING", {
      productId,
      taxonomyVersion,
      legacyProjectionKey,
    });
  }

  if (productCategory !== legacyCategory || productForm !== legacyProductForm) {
    return invalid("LEGACY_PROJECTION_FIELDS_MISMATCH", {
      productId,
      taxonomyVersion,
      legacyProjectionKey,
      productCategory,
      productForm,
      legacyCategory,
      legacyProductForm,
    });
  }

  return result(
    LEGACY_PROJECTION_COMPATIBILITY_STATUS.LEGACY_PROJECTED,
    "EXACT_LEGACY_PROJECTION",
    {
      productId,
      taxonomyVersion,
      assignmentState,
      legacyProjectionKey,
      legacyCategory,
      legacyProductForm,
    },
  );
}
