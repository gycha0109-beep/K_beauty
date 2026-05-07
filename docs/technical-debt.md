# Technical Debt

## Product Catalog Scaling

`lib/product-source.js` currently loads products with a broad read and a fixed cap. That is acceptable for a small launch catalog, but it will become fragile as the skincare pool grows and makeup categories are added.

Follow-up improvements:

- Remove `.select("*")` and load only fields needed by the deterministic recommendation engine.
- Replace the fixed newest-product cap with paginated loading or category-scoped candidate loading.
- Add and use `active` / `recommendable` flags so inactive or incomplete products do not enter scoring.
- Move category aliases, concern vocabulary, and display labels toward DB-backed taxonomy/config instead of hardcoded maps.
- Keep public product reads behind an explicit safe column list or public view.
- Separate skincare and future makeup taxonomy before makeup products enter the same recommendation pool.

These changes should be handled separately from launch cleanup because they can affect candidate selection and scoring coverage.
