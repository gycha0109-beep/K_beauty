// Research-only ROI geometry. Does not detect a face or validate that a
// polygon contains bare skin: those remain prerequisites of the caller.
export const PERSONAL_COLOR_CHEEK_MASK_VERSION = "face-lab-personal-color-cheek-masks-v1";

const MAX_PIXELS = 1024 * 1024;
const MIN_SAMPLES = 16;
const MAX_POLYGON_VERTICES = 16;
const MAX_EXCLUSION_POLYGONS = 12;
const MAX_RASTER_WORK = 25_000_000;

function hold(reason) {
  return {
    schemaVersion: PERSONAL_COLOR_CHEEK_MASK_VERSION,
    status: "insufficient_evidence",
    reason,
    skinRegionMasks: null,
    exclusionMask: null,
    sampleCount: null,
    sourceImagePersisted: false
  };
}

function finitePoint(value) {
  return (
    value && typeof value === "object" && !Array.isArray(value) &&
    Number.isFinite(value.x) && Number.isFinite(value.y) &&
    value.x >= 0 && value.x <= 1 && value.y >= 0 && value.y <= 1
  );
}

function signedArea(polygon) {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a.x * b.y - a.y * b.x;
  }
  return sum / 2;
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function edgesIntersect(a, b, c, d) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  // Contact (including touching endpoints/collinearity) is invalid.
  if (Math.abs(abC) < 1e-12 || Math.abs(abD) < 1e-12 ||
    Math.abs(cdA) < 1e-12 || Math.abs(cdB) < 1e-12) return true;
  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0);
}

function validPolygon(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3 ||
    polygon.length > MAX_POLYGON_VERTICES ||
    !polygon.every(finitePoint) ||
    Math.abs(signedArea(polygon)) < 1e-6
  ) return false;

  for (let i = 0; i < polygon.length; i += 1) {
    for (let j = i + 1; j < polygon.length; j += 1) {
      // Adjacent edges share an endpoint by design.
      if (j === i + 1 || (i === 0 && j === polygon.length - 1)) continue;
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const c = polygon[j];
      const d = polygon[(j + 1) % polygon.length];
      if (edgesIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

function containsPoint(polygon, x, y) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > y) !== (b.y > y) &&
      x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x
    ) inside = !inside;
  }
  return inside;
}

function bounds(polygon, width, height) {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  return {
    minCol: Math.max(0, Math.floor(Math.min(...xs) * width)),
    maxCol: Math.min(width - 1, Math.ceil(Math.max(...xs) * width) - 1),
    minRow: Math.max(0, Math.floor(Math.min(...ys) * height)),
    maxRow: Math.min(height - 1, Math.ceil(Math.max(...ys) * height) - 1)
  };
}

function rasterize(polygons, width, height) {
  const mask = new Uint8Array(width * height);
  for (const polygon of polygons) {
    const { minCol, maxCol, minRow, maxRow } = bounds(polygon, width, height);
    for (let row = minRow; row <= maxRow; row += 1) {
      const y = (row + 0.5) / height;
      for (let col = minCol; col <= maxCol; col += 1) {
        if (containsPoint(polygon, (col + 0.5) / width, y)) {
          mask[row * width + col] = 1;
        }
      }
    }
  }
  return mask;
}

/**
 * Convert independently reviewed normalized photo-coordinate polygons into
 * ephemeral binary masks for measurePersonalColorPhotoLab.
 *
 * 'leftCheek'/'rightCheek' refer to IMAGE-LEFT/IMAGE-RIGHT, not anatomical
 * side. No built-in face detector, mirror correction, skin verification,
 * shadow or makeup recognition is performed. An explicit exclusion polygon
 * set is required. Unverified geometry must never be promoted to a
 * production skin-color measurement.
 */
export function buildPersonalColorCheekMasks({
  width,
  height,
  cheekPolygons,
  exclusionPolygons
} = {}) {
  if (
    !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
    width <= 0 || height <= 0 ||
    width * height > MAX_PIXELS
  ) return hold("invalid_pixel_dimensions");

  const left = cheekPolygons?.leftCheek;
  const right = cheekPolygons?.rightCheek;
  if (!validPolygon(left) || !validPolygon(right)) return hold("cheek_geometry_unverified");
  if (
    !Array.isArray(exclusionPolygons) ||
    exclusionPolygons.length < 1 ||
    exclusionPolygons.length > MAX_EXCLUSION_POLYGONS ||
    !exclusionPolygons.every(validPolygon)
  ) return hold("exclusion_geometry_unverified");

  // Defend browser callers against pathologically complex polygons. The
  // bound is conservative and counts bbox pixel checks × edge tests.
  const work = [left, right, ...exclusionPolygons].reduce((total, polygon) => {
    const b = bounds(polygon, width, height);
    return total +
      Math.max(0, b.maxCol - b.minCol + 1) *
      Math.max(0, b.maxRow - b.minRow + 1) *
      polygon.length;
  }, 0);
  if (work > MAX_RASTER_WORK) return hold("geometry_work_budget_exceeded");

  // Catch left/right swaps; don't infer orientation from face landmarks.
  const center = (polygon) => polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
  if (center(left) >= center(right)) return hold("cheek_orientation_mismatch");

  const leftMask = rasterize([left], width, height);
  const rightMask = rasterize([right], width, height);
  const exclusionMask = rasterize(exclusionPolygons, width, height);
  let leftCount = 0;
  let rightCount = 0;

  for (let index = 0; index < leftMask.length; index += 1) {
    if (leftMask[index] && rightMask[index]) return hold("overlapping_cheek_regions");
    if (exclusionMask[index]) continue;
    leftCount += leftMask[index];
    rightCount += rightMask[index];
  }
  if (leftCount < MIN_SAMPLES || rightCount < MIN_SAMPLES) {
    return hold("insufficient_unexcluded_cheek_pixels");
  }

  return {
    schemaVersion: PERSONAL_COLOR_CHEEK_MASK_VERSION,
    status: "masks_ready",
    reason: null,
    skinRegionMasks: {
      leftCheek: leftMask,
      rightCheek: rightMask
    },
    exclusionMask,
    sampleCount: { leftCheek: leftCount, rightCheek: rightCount },
    sourceImagePersisted: false
  };
}
