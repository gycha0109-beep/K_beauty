import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  canonicalizeImageBuffer,
  fingerprintCanonicalBuffer,
  inspectImageBuffer
} from "../../src/index.js";

async function raster(format, width = 512, height = 512) {
  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 40, b: 60 }
    }
  });
  if (format === "png") pipeline = pipeline.png();
  if (format === "jpeg") pipeline = pipeline.jpeg();
  if (format === "webp") pipeline = pipeline.webp();
  return pipeline.toBuffer();
}

test("PNG, JPEG, and static WebP pass inspection", async () => {
  for (const [format, name] of [["png", "sample.png"], ["jpeg", "sample.jpg"], ["webp", "sample.webp"]]) {
    const result = await inspectImageBuffer(await raster(format), name);
    assert.equal(result.ok, true, format);
    assert.equal(result.inspection.detectedFormat, format);
    assert.match(result.inspection.assetId, /^asset_[a-f0-9]{24}$/);
  }
});

test("extension spoof and undersized images fail closed", async () => {
  const spoofed = await inspectImageBuffer(await raster("png"), "sample.jpg");
  assert.equal(spoofed.ok, false);
  assert.equal(spoofed.errors[0].code, "mime_decode_mismatch");

  const small = await inspectImageBuffer(await raster("png", 256, 512), "small.png");
  assert.equal(small.ok, false);
  assert.equal(small.errors[0].code, "dimension_below_minimum");
});

test("canonicalization applies orientation without resize and strips metadata", async () => {
  const oriented = await sharp({
    create: {
      width: 600,
      height: 800,
      channels: 3,
      background: { r: 80, g: 100, b: 120 }
    }
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();

  const inspected = await inspectImageBuffer(oriented, "oriented.jpg");
  assert.equal(inspected.ok, true);
  const canonical = await canonicalizeImageBuffer(oriented);
  assert.equal(canonical.ok, true);
  assert.equal(canonical.canonical.width, 800);
  assert.equal(canonical.canonical.height, 600);
  assert.equal(canonical.canonical.width * canonical.canonical.height, 600 * 800);

  const metadata = await sharp(canonical.canonical.buffer).metadata();
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.format, "png");
});

test("dHash fingerprint is stable and 64-bit hex", async () => {
  const source = await raster("png");
  const canonical = await canonicalizeImageBuffer(source);
  const first = await fingerprintCanonicalBuffer(canonical.canonical.buffer);
  const second = await fingerprintCanonicalBuffer(canonical.canonical.buffer);
  assert.deepEqual(first, second);
  assert.match(first.value, /^[a-f0-9]{16}$/);
});
