import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getNeutralFaceCountAuthority } from "@/lib/face-lab-neutral-face-count-intake";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const GAP = 18;
const TILE = 720;

function resolvePublicAsset(assetPath) {
  if (
    typeof assetPath !== "string" ||
    !assetPath.startsWith("/") ||
    assetPath.includes("..")
  ) {
    throw new Error("neutral_visual_asset_path_invalid");
  }
  const resolved = path.join(PUBLIC_ROOT, assetPath.slice(1));
  if (!resolved.startsWith(PUBLIC_ROOT + path.sep)) {
    throw new Error("neutral_visual_asset_escape");
  }
  return resolved;
}

async function readSource(assetPath) {
  return readFile(resolvePublicAsset(assetPath));
}

async function renderSingle(assetPath) {
  const bytes = await readSource(assetPath);
  const mediaType = assetPath.endsWith(".jpg") ? "image/jpeg" : "image/png";
  return { bytes, mediaType };
}

async function renderObscured(presentation) {
  const source = await readSource(presentation.assetPaths[0]);
  const bytes = await sharp(source)
    .blur(presentation.blurPx)
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { bytes, mediaType: "image/png" };
}

async function renderComposite(assetPaths) {
  const tiles = await Promise.all(
    assetPaths.map(async (assetPath) => {
      const source = await readSource(assetPath);
      return sharp(source)
        .resize(TILE, TILE, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toBuffer();
    })
  );
  const width = tiles.length * TILE + (tiles.length - 1) * GAP;
  const bytes = await sharp({
    create: {
      width,
      height: TILE,
      channels: 4,
      background: { r: 245, g: 247, b: 250, alpha: 1 }
    }
  })
    .composite(
      tiles.map((input, index) => ({
        input,
        left: index * (TILE + GAP),
        top: 0
      }))
    )
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { bytes, mediaType: "image/png" };
}

export async function GET(_request, context) {
  const { reviewItemId } = await context.params;
  const authority = getNeutralFaceCountAuthority();
  if (authority.schemaVersion !== "face-count-neutral-review-authority-v2") {
    return new Response(null, { status: 404 });
  }
  const item = authority.orderedItems.find(
    (candidate) => candidate.reviewItemId === reviewItemId
  );
  if (!item) return new Response(null, { status: 404 });

  try {
    const { presentation } = item;
    let rendered;
    if (presentation.mode === "single") {
      rendered = await renderSingle(presentation.assetPaths[0]);
    } else if (presentation.mode === "obscured_single") {
      rendered = await renderObscured(presentation);
    } else if (presentation.mode === "composite") {
      rendered = await renderComposite(presentation.assetPaths);
    } else {
      return new Response(null, { status: 404 });
    }
    return new Response(rendered.bytes, {
      status: 200,
      headers: {
        "Content-Type": rendered.mediaType,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      }
    });
  } catch {
    return new Response(null, { status: 500 });
  }
}
