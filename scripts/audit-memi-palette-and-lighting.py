#!/usr/bin/env python3
"""Local-only exploratory MEMI-DS palette/illumination audit (never infers pathology).

Requires installed Pillow and NumPy; reads local image/mask bytes only.
Never treats an unknown PNG palette index as a pathology class or a score.
"""
import argparse
import json
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image


def palette_info(path):
    with Image.open(path) as im:
        if im.mode != "P":
            raise ValueError("Expected paletted PNG, got " + im.mode)
        if im.format != "PNG":
            raise ValueError("Expected PNG")
        pixels = np.array(im, dtype=np.uint8, copy=True)
        palette = im.getpalette()
    ids, counts = np.unique(pixels, return_counts=True)
    if not set(ids.tolist()).issubset(set(range(6))):
        raise ValueError("Unexpected palette indices; refusing any semantic decoding")
    return {
        "width": int(pixels.shape[1]), "height": int(pixels.shape[0]),
        "mode": "P", "indices": {str(int(i)): int(n) for i, n in zip(ids, counts)},
        "paletteRGB": {
            str(int(i)): (palette[3*int(i):3*int(i)+3] if palette and len(palette) >= 3*(int(i)+1) else None)
            for i in ids
        },
        "semanticMapping": "UNVERIFIED", "segmentationGold": False
    }, pixels


def roi_indices(width, height, rect):
    if not isinstance(rect, list) or len(rect) != 4 or any(
        not isinstance(v, (int, float)) or not 0 <= v <= 1 for v in rect
    ):
        raise ValueError("ROI requires normalized [x,y,w,h] in [0,1]")
    x, y, w, h = rect
    if w <= 0 or h <= 0 or x+w > 1.0000001 or y+h > 1.0000001:
        raise ValueError("ROI outside image")
    x1, y1 = int(x*width), int(y*height)
    x2, y2 = min(width, max(x1+1, int((x+w)*width))), min(height, max(y1+1, int((y+h)*height)))
    return x1, y1, x2, y2


def lighting_signals(image, rect, palette_pixels=None):
    """Image brightness/specular proxies, NOT melasma predictions or measured oiliness."""
    image = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
    height, width = image.shape[:2]
    x1, y1, x2, y2 = roi_indices(width, height, rect)
    roi = image[y1:y2, x1:x2]
    if roi.shape[0] < 3 or roi.shape[1] < 6:
        raise ValueError("ROI too small for meaningful three-zone comparison")
    lum = .2126*roi[..., 0] + .7152*roi[..., 1] + .0722*roi[..., 2]
    saturation = roi.max(axis=-1) - roi.min(axis=-1)
    # These are fixed exploratory capture proxies, NOT clinically validated thresholds.
    specular = (roi.max(axis=-1) > .96) & (saturation < .14)
    local_median = float(np.median(lum))
    underlit = lum < min(.28, .65*local_median)
    thirds = np.array_split(lum, 3, axis=1)
    medians = [float(np.median(t)) for t in thirds]
    out = {
        "roiPixels": int(lum.size),
        "luminanceMedian": round(local_median, 5),
        "leftCenterRightLuminanceMedians": [round(v, 5) for v in medians],
        "luminanceThirdsRange": round(max(medians)-min(medians), 5),
        "specularCandidateFraction": round(float(np.mean(specular)), 5),
        "darkCandidateFraction": round(float(np.mean(underlit)), 5),
        "meaning": "Capture-condition indicators ONLY; not lesions, causes or physical sebum/hydration."
    }
    if palette_pixels is not None:
        if palette_pixels.shape != image.shape[:2]:
            raise ValueError("Image/mask resolution mismatch; cannot compare indices")
        index_roi = palette_pixels[y1:y2, x1:x2]
        # Nonzero is an UNINTERPRETED palette value, not a positive melasma annotation.
        nonzero = index_roi != 0
        out["uninterpretedNonzeroIndexPixels"] = int(nonzero.sum())
        out["uninterpretedNonzeroOnSpecularCandidatePixels"] = int((nonzero & specular).sum())
        out["uninterpretedNonzeroOnDarkCandidatePixels"] = int((nonzero & underlit).sum())
        out["warning"] = "Overlap is NOT false-positive/false-negative area without verified index semantics AND corrected independent gold."
    return out


def audit(mask_path, photo_path=None, roi_file=None):
    mask, idx = palette_info(mask_path)
    report = {"schemaVersion":"memi-palette-lighting-audit-v1", "palette":mask,
              "trainingAllowed":False, "measuredModelQuality":False}
    if photo_path:
        with Image.open(photo_path) as im:
            image = im.copy().convert("RGB")
        if image.size != (mask["width"], mask["height"]):
            raise ValueError("Photo/mask sizes differ")
        if roi_file:
            definition = json.loads(Path(roi_file).read_text(encoding="utf-8"))
            if (definition.get("schemaVersion") != "memi-roi-v1" or
                definition.get("reviewStatus") != "human_defined" or
                not isinstance(definition.get("regions"), dict)):
                raise ValueError("Region JSON must be independently human-defined; no guessed forehead boxes")
            report["regions"] = {name: lighting_signals(image, rect, idx)
                                 for name, rect in definition["regions"].items()}
        else:
            report["regions"] = {}
            report["roiStatus"] = "NOT_PROVIDED_NO_ANATOMICAL_CLAIMS"
    return report


def self_test():
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        mask = Image.new("P", (36, 24), color=0)
        palette = [0,0,0, 255,0,0, 0,255,0, 0,0,255, 250,250,250, 110,110,110]
        mask.putpalette(palette + [0]*(768-len(palette)))
        px = np.zeros((24,36), dtype=np.uint8)
        px[1:4, 1:5] = 2
        mask.putdata(px.flatten().tolist())
        mask.save(root/"m.png")
        a, decoded = palette_info(root/"m.png")
        assert a["indices"]["2"] == 12
        assert a["semanticMapping"] == "UNVERIFIED"
        assert decoded[2,3] == 2
        photo = np.full((24,36,3), 175, dtype=np.uint8)
        photo[:, 0:8] = 33
        photo[:, 16:20] = 255
        p = Image.fromarray(photo, mode="RGB")
        p.save(root/"p.png")
        reg = lighting_signals(p, [0,0,1,1],decoded)
        assert reg["specularCandidateFraction"] > 0
        assert reg["darkCandidateFraction"] > 0
        assert reg["uninterpretedNonzeroIndexPixels"] == 12
        assert "false" not in str(reg).lower()
        (root/"regions.json").write_text(json.dumps({"schemaVersion":"memi-roi-v1","reviewStatus":"human_defined","regions":{"test":[0,0,1,1]}}),encoding="utf-8")
        actual = audit(root/"m.png",root/"p.png",root/"regions.json")
        assert actual["trainingAllowed"] is False and "test" in actual["regions"]
        try:
            roi_indices(36,24,[.8,.0,.4,.5])
            raise AssertionError("Invalid ROI should fail")
        except ValueError: pass
        px[5,5] = 6
        mask.putdata(px.flatten().tolist())
        mask.save(root/"bad.png")
        try:
            palette_info(root/"bad.png")
            raise AssertionError("Unknown index should fail")
        except ValueError: pass
        print("MEMI palette/lighting self-test PASS (synthetic masks and synthetic RGB only)")


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mask",help="Private local paletted PNG; no writes to original")
    parser.add_argument("--photo",help="Matching private local photo (optional)")
    parser.add_argument("--roi-json",help="Human-defined normalized ROI rectangles JSON (optional)")
    parser.add_argument("--out",help="New private output path; exclusive creation")
    parser.add_argument("--self-test", action="store_true")
    opt=parser.parse_args()
    if opt.self_test:
        self_test()
    else:
        if not opt.mask: parser.error("--mask required unless --self-test")
        result=audit(opt.mask,opt.photo,opt.roi_json)
        # No source face path, photo pixels, or mask path in output.
        body=json.dumps(result,ensure_ascii=False,indent=2)+"\n"
        if opt.out:
            output=Path(opt.out)
            if output.resolve() in {Path(opt.mask).resolve(), Path(opt.photo).resolve() if opt.photo else None}:
                raise ValueError("Refusing to overwrite source data")
            with output.open("x",encoding="utf-8") as fh: fh.write(body)
        else: print(body)
