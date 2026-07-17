import assert from "node:assert/strict";
import sharp from "sharp";
import {
  MAX_PROVIDER_IMAGE_EDGE,
  canonicalizeImageFile
} from "../lib/server/image-upload-boundary.js";

function createFile(bytes, type = "image/jpeg") {
  return {
    type,
    size: bytes.length,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  };
}

async function createJpeg(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 }
    }
  }).jpeg({ quality: 90 }).toBuffer();
}

async function verifyOversizedImageIsBounded() {
  const source = await createJpeg(2048, 1536);
  const result = await canonicalizeImageFile(createFile(source), source);

  assert.equal(result.ok, true);
  assert.equal(result.width, MAX_PROVIDER_IMAGE_EDGE);
  assert.equal(result.height, 768);
  assert.ok(result.width <= MAX_PROVIDER_IMAGE_EDGE);
  assert.ok(result.height <= MAX_PROVIDER_IMAGE_EDGE);
  assert.equal(result.totalPixels, result.width * result.height);
  assert.match(result.dataUrl, /^data:image\/jpeg;base64,/);
  assert.equal(result.dataUrl, `data:image/jpeg;base64,${result.bytes.toString("base64")}`);
}

async function verifySmallImageIsNotEnlarged() {
  const source = await createJpeg(640, 480);
  const result = await canonicalizeImageFile(createFile(source), source);

  assert.equal(result.ok, true);
  assert.equal(result.width, 640);
  assert.equal(result.height, 480);
  assert.ok(result.width <= MAX_PROVIDER_IMAGE_EDGE);
  assert.ok(result.height <= MAX_PROVIDER_IMAGE_EDGE);
}

assert.equal(MAX_PROVIDER_IMAGE_EDGE, 1024);
await verifyOversizedImageIsBounded();
await verifySmallImageIsNotEnlarged();

console.log("[verify-face-lab-provider-image-budget] PASS");
