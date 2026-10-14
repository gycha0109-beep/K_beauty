import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildFaceLabCatalogStatusPresentation as present,
  FACE_LAB_CATALOG_STATUS_PRESENTATION_VERSION
} from "../lib/face-lab-v2/catalog-status-presentation.js";
import {
  FACE_LAB_INDEPENDENT_PUBLISHED_READ_VERSION as READ_VERSION
} from "../lib/face-lab-v2/independent-catalog-published-read-core.js";

const base = {
  readVersion: READ_VERSION,
  status: "dry_run",
  reason: "mock_publication_verified",
  selectionCount: 1,
  governedSourceVerified: false,
  renderReady: false,
  imageModelInvoked: false,
  previewSpec: {
    status: "ready",
    fakeBrandName: "Do not leak fixture",
    fakeShadeLabel: "Do not leak fixture"
  },
  authority: null,
  providerRequest: null
};

const koEmpty = present(null);
const enEmpty = present(null, { locale: "en" });
assert.equal(koEmpty.version, FACE_LAB_CATALOG_STATUS_PRESENTATION_VERSION);
assert.equal(koEmpty.status, "not_ready");
assert.ok(koEmpty.body.includes("실제 구매 가능한 제품"));
assert.equal(enEmpty.status, "not_ready");
assert.ok(enEmpty.body.includes("purchasable products"));
assert.equal(/[가-힣]/.test(JSON.stringify(enEmpty)), false);

const fixture = present(base);
assert.equal(fixture.status, "not_ready");
assert.equal(JSON.stringify(fixture).includes("Do not leak"), false);
assert.equal(fixture.items.length, 0);
assert.equal(fixture.canPurchase, false);
assert.equal(fixture.canSelectProduct, false);
assert.equal(fixture.isRealCatalogReady, false);
assert.equal(fixture.displayProductImages, false);
assert.equal(fixture.selectedProductId, null);
assert.equal(fixture.selectedVariantId, null);
assert.equal(fixture.selectedShadeId, null);

for (const reason of [
  "published_read_identity_mismatch",
  "published_read_current_state_mismatch",
  "published_read_review_or_preview_failed",
  "published_read_duplicate_slot",
  "published_read_snapshot_not_available",
  "published_read_composition_invalid"
]) {
  const result = present({ ...base, status: "blocked", reason });
  assert.equal(result.status, "blocked", reason);
  assert.equal(result.canPurchase, false, reason);
  assert.deepEqual(result.items, [], reason);
}

assert.equal(
  present({ ...base, status: "unavailable", reason: "published_read_source_unavailable" }).status,
  "source_not_ready"
);

for (const invalid of [
  {},
  { ...base, readVersion: "unknown" },
  { ...base, status: "ready", reason: "approved" },
  { ...base, status: "dry_run", governedSourceVerified: true },
  { ...base, status: "dry_run", renderReady: true },
  { ...base, status: "dry_run", imageModelInvoked: true },
  { ...base, status: "dry_run", reason: "approved_by_browser" }
]) {
  const result = present(invalid);
  assert.equal(result.status, "blocked", JSON.stringify(invalid));
  assert.equal(result.canSelectProduct, false);
  assert.equal(result.canPurchase, false);
}

const before = JSON.stringify(base);
present(base);
assert.equal(JSON.stringify(base), before, "presentation must not mutate a dry-run source");

// The client-side adapter must never transitively bundle the Node-only
// independent published reader (it imports node:crypto via the review gate).
const adapterSource = readFileSync(
  new URL("../lib/face-lab-v2/catalog-status-presentation.js", import.meta.url),
  "utf8"
);
assert.ok(adapterSource.includes(READ_VERSION), "browser wire version must track the reader");
assert.ok(!adapterSource.includes('from "./independent-catalog-published-read-core.js"'));
assert.ok(!adapterSource.includes("from './independent-catalog-published-read-core.js'"));

const component = readFileSync(
  new URL("../components/full-report/face-lab/FaceLabV2Result.jsx", import.meta.url),
  "utf8"
);
assert.ok(component.includes('data-testid="face-lab-catalog-availability"'));
assert.ok(component.includes("buildFaceLabCatalogStatusPresentation(catalogRead"));
assert.ok(component.includes("view.execution.domains.length > 0 || view.productGuides.length > 0"));
assert.ok(component.includes("catalogStatus.body"));

console.log("FACE_LAB_CATALOG_STATUS_PRESENTATION=PASS");
