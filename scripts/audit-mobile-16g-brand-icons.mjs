import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  "public/images/brand/bejewely-icon-dark.png",
  "public/images/brand/bejewely-icon-light.png"
];

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function parsePng(relativePath) {
  const buffer = readFileSync(join(repoRoot, relativePath));
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") throw new Error(`${relativePath}: invalid PNG signature`);

  let offset = 8;
  let ihdr;
  const idat = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12]
      };
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }
  if (!ihdr) throw new Error(`${relativePath}: missing IHDR`);

  const channelsByColorType = new Map([[0, 1], [2, 3], [4, 2], [6, 4]]);
  const channels = channelsByColorType.get(ihdr.colorType) || null;
  const alphaAuditSupported = ihdr.bitDepth === 8 && ihdr.interlace === 0 && channels !== null;
  let transparentPixelCount = null;
  let translucentPixelCount = null;
  let minAlpha = null;

  if (alphaAuditSupported) {
    const bytesPerPixel = channels;
    const rowBytes = ihdr.width * channels;
    const inflated = inflateSync(Buffer.concat(idat));
    const expected = ihdr.height * (rowBytes + 1);
    if (inflated.length !== expected) {
      throw new Error(`${relativePath}: unexpected inflated size ${inflated.length}, expected ${expected}`);
    }

    let previous = Buffer.alloc(rowBytes);
    let inputOffset = 0;
    transparentPixelCount = 0;
    translucentPixelCount = 0;
    minAlpha = 255;

    for (let y = 0; y < ihdr.height; y += 1) {
      const filterType = inflated[inputOffset];
      inputOffset += 1;
      const raw = inflated.subarray(inputOffset, inputOffset + rowBytes);
      inputOffset += rowBytes;
      const row = Buffer.alloc(rowBytes);

      for (let x = 0; x < rowBytes; x += 1) {
        const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
        const up = previous[x] || 0;
        const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
        let value;
        if (filterType === 0) value = raw[x];
        else if (filterType === 1) value = (raw[x] + left) & 0xff;
        else if (filterType === 2) value = (raw[x] + up) & 0xff;
        else if (filterType === 3) value = (raw[x] + Math.floor((left + up) / 2)) & 0xff;
        else if (filterType === 4) value = (raw[x] + paeth(left, up, upLeft)) & 0xff;
        else throw new Error(`${relativePath}: unsupported filter ${filterType}`);
        row[x] = value;
      }

      if (ihdr.colorType === 6 || ihdr.colorType === 4) {
        const alphaIndex = channels - 1;
        for (let px = 0; px < ihdr.width; px += 1) {
          const alpha = row[px * channels + alphaIndex];
          if (alpha < minAlpha) minAlpha = alpha;
          if (alpha === 0) transparentPixelCount += 1;
          else if (alpha < 255) translucentPixelCount += 1;
        }
      }
      previous = row;
    }
  }

  const hasAnyNonOpaquePixels = alphaAuditSupported
    ? (transparentPixelCount || 0) + (translucentPixelCount || 0) > 0
    : null;
  const exact1024Square = ihdr.width === 1024 && ihdr.height === 1024;

  return {
    file: relativePath,
    name: basename(relativePath),
    sha256: createHash("sha256").update(buffer).digest("hex"),
    fileBytes: buffer.length,
    ...ihdr,
    square: ihdr.width === ihdr.height,
    exact1024Square,
    alphaAuditSupported,
    transparentPixelCount,
    translucentPixelCount,
    minAlpha,
    hasAnyNonOpaquePixels,
    expoRasterSourceCandidate: exact1024Square,
    iosRasterSourceCandidate: exact1024Square && alphaAuditSupported && hasAnyNonOpaquePixels === false,
    googlePlayListingDirectCandidate: ihdr.width === 512 && ihdr.height === 512 && buffer.length <= 1024 * 1024,
    googlePlayListingDerivativeRequired: !(ihdr.width === 512 && ihdr.height === 512 && buffer.length <= 1024 * 1024)
  };
}

const audited = candidates.map(parsePng);
const report = {
  schemaVersion: "mobile-16g-brand-icon-audit-v1",
  generatedAt: new Date().toISOString(),
  policyBasis: {
    expoRecommendedRasterSource: "1024x1024 PNG",
    iosRasterRequirementUsedByAudit: "exact square; 1024x1024 preferred; no transparent pixels",
    googlePlayListingRequirementUsedByAudit: "512x512 32-bit PNG, max 1024KB"
  },
  candidates: audited
};

const outputPath = join(repoRoot, "mobile-16g-icon-audit.json");
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(`MOBILE_16G_ICON_AUDIT_REPORT=${outputPath}`);
