#!/usr/bin/env python3
"""Local-only MEMI-DS inventory, mask integrity and lighting-ROI audit.

Requires Pillow and NumPy. No writes to source images/masks. Output is a private,
additive JSON artifact; no existing source, QC file or destination is overwritten.
Never interprets indices 0..5 as pigment/clinical labels.
"""
import argparse
import hashlib
import importlib.util
import json
import tempfile
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image

GROUPS = {"Flaky", "Punctate"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
SKIP_PARTS = {"review_assets", "__pycache__", "node_modules", ".git"}
THIS_DIR = Path(__file__).resolve().parent


def _module():
    spec = importlib.util.spec_from_file_location(
        "memi_palette_light", THIS_DIR / "audit-memi-palette-and-lighting.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def find_assets(root):
    """Classifies only exact group-relative stems. Any duplicate is a hard error."""
    result = defaultdict(dict)
    seen = set()
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXT:
            continue
        parts = path.relative_to(root).parts
        if any(part.lower() in SKIP_PARTS or "audit" in part.lower()
               for part in parts[:-1]):
            continue
        group_parts = [part for part in parts[:-1] if part in GROUPS]
        if len(set(group_parts)) != 1 or not group_parts:
            continue
        group = group_parts[0]
        # The reviewed sample name is e.g. 15_L; never reconstruct filenames by guessing.
        stem = path.stem
        if not __import__("re").fullmatch(r"[0-9]+_[FLR]", stem):
            continue
        with Image.open(path) as image:
            kind = "mask" if path.suffix.lower() == ".png" and image.mode == "P" else "image"
        key = group + "/" + stem
        index_key = (key, kind)
        if index_key in seen:
            raise ValueError("Ambiguous duplicate asset for sample: " + key + ", " + kind)
        seen.add(index_key)
        result[key][kind] = path
    return result


def load_qc(path, expect131):
    qc = json.loads(Path(path).read_text(encoding="utf-8"))
    if qc.get("schemaVersion") != "memi-ds-review-qc-v1" or not isinstance(qc.get("records"), list):
        raise ValueError("Review QC v1 required; run audit-memi-review-qc.mjs first")
    if expect131 and len(qc["records"]) != 131:
        raise ValueError("Expected 131 QC records; source partial-release mismatch")
    seen = set()
    for row in qc["records"]:
        if row.get("id") in seen or row.get("id") != row.get("group", "") + "/" + row.get("name", ""):
            raise ValueError("Duplicate or inconsistent QC ID")
        if row.get("group") not in GROUPS or row.get("triageBand") is None:
            raise ValueError("Malformed QC record")
        seen.add(row["id"])
    return qc


def scan(root, qc, roi_spec=None):
    mod = _module()
    found = find_assets(root)
    wanted = {r["id"] for r in qc["records"]}
    unknown = sorted(set(found) - wanted)
    if unknown:
        raise ValueError("Extra matching assets not represented by private QC records: " + str(len(unknown)))
    if roi_spec is not None:
        if roi_spec.get("schemaVersion") != "memi-roi-by-sample-v1" or roi_spec.get("reviewStatus") != "human_defined":
            raise ValueError("ROI annotations must explicitly be independently human-defined")
        if set(roi_spec.get("samples", {})) - wanted:
            raise ValueError("ROI file contains unknown samples")
    palette_profiles = Counter()
    mask_index_support = Counter()
    poses = Counter()
    issues = []
    private_rows = []
    hashes = {}
    for row in sorted(qc["records"], key=lambda r: r["id"]):
        rid = row["id"]
        assets = found.get(rid, {})
        if set(assets) != {"image", "mask"}:
            raise ValueError("Missing image/mask or unsupported PNG layout: " + rid)
        img_path, mask_path = assets["image"], assets["mask"]
        mask_meta, _ = mod.palette_info(mask_path)
        with Image.open(img_path) as source:
            source_size = source.size
            source.verify()
        if source_size != (mask_meta["width"], mask_meta["height"]):
            raise ValueError("Image-mask resolution mismatch: " + rid)
        image_hash, mask_hash = sha256(img_path), sha256(mask_path)
        if image_hash in hashes:
            raise ValueError("Exact duplicate photo detected: " + rid)
        hashes[image_hash] = rid
        profile = json.dumps(mask_meta["paletteRGB"], sort_keys=True)
        palette_profiles[profile] += 1
        for index in mask_meta["indices"]:
            mask_index_support[index] += 1
        poses[row["group"] + "/" + row["pose"]] += 1
        sample = {
            "id": rid,
            "group": row["group"],
            "pose": row["pose"],
            "tentativeNumericFamily": row["tentativeNumericFamily"],
            "sourceImageSha256": image_hash,
            "sourceMaskSha256": mask_hash,
            "size": {"width": source_size[0], "height": source_size[1]},
            "indexCounts": mask_meta["indices"],
            "indexRGB": mask_meta["paletteRGB"],
            "qcBand": row["triageBand"],
            "reviewFlags": row["flags"],
            "trainingAllowed": False,
            "subjectSplit": None,
            "pixelLabelsSemanticallyValid": False,
            "illuminationRegions": {},
        }
        # No automatically guessed "forehead" or "shadow-side cheek" rectangles.
        rois = (roi_spec or {}).get("samples", {}).get(rid, {})
        if rois:
            with Image.open(img_path) as original:
                preview = original.convert("RGB")
                preview.thumbnail((512, 512))
            for name, rect in rois.items():
                sample["illuminationRegions"][name] = mod.lighting_signals(preview, rect)
        else:
            sample["roiStatus"] = "NOT_DEFINED_NO_ANATOMICAL_CONCLUSION"
        private_rows.append(sample)
    if len(palette_profiles) > 1:
        issues.append("Palette RGB profiles vary; numeric indices MUST NOT be assigned meanings without upstream specification")
    return {
        "schemaVersion": "memi-ds-private-batch-audit-v1",
        "evaluationMeaning": "Source asset integrity, reviewer QA and capture proxies; NOT segmentation/model accuracy",
        "sourceReviewSha256": qc.get("sourceReviewSha256"),
        "rights": "COMMERCIAL_TRAINING_BLOCKED",
        "maskIndexSemantics": "UNVERIFIED",
        "subjectLeakage": "NOT_CHECKED_NO_VERIFIED_IDENTITIES",
        "count": len(private_rows),
        "groupPoseCounts": dict(sorted(poses.items())),
        "paletteIndexSampleSupport": dict(sorted(mask_index_support.items())),
        "distinctPaletteRGBProfiles": len(palette_profiles),
        "warnings": issues,
        "samples": private_rows,
    }


def self_test():
    with tempfile.TemporaryDirectory() as temp:
        base = Path(temp)
        root = base / "src"
        records = []
        for group, name, status in (("Flaky", "1_L", "pass"),
                                    ("Punctate", "2_F", "fail")):
            (root / group / "images").mkdir(parents=True)
            (root / group / "masks").mkdir(parents=True)
            image = Image.new("RGB", (48, 32), color=(145 if group == "Flaky" else 146, 116, 110))
            image.putpixel((0, 0), (10 if group == "Flaky" else 200, 20, 30))
            image.save(root / group / "images" / (name + ".png"))
            mask = Image.new("P", (48, 32), color=0)
            mask.putpalette([0, 0, 0, 255, 0, 0, 0, 255, 0] + [0] * (768 - 9))
            mask.putpixel((5, 5), 2)
            mask.save(root / group / "masks" / (name + ".png"))
            records.append({
                "id": group + "/" + name, "group": group, "name": name,
                "pose": name.split("_")[-1],
                "triageBand": "clean_pass_candidate" if status == "pass" else "annotation_issue_review",
                "tentativeNumericFamily": name.split("_")[0], "flags": [],
            })
        qc = {"schemaVersion": "memi-ds-review-qc-v1", "records": records}
        found = find_assets(root)
        assert len(found) == 2 and all(set(x) == {"image", "mask"} for x in found.values())
        report = scan(root, qc)
        assert report["count"] == 2
        assert report["paletteIndexSampleSupport"]["2"] == 2
        assert report["maskIndexSemantics"] == "UNVERIFIED"
        assert all(not x["trainingAllowed"] and x["subjectSplit"] is None for x in report["samples"])
        roi = {"schemaVersion": "memi-roi-by-sample-v1", "reviewStatus": "human_defined",
               "samples": {"Flaky/1_L": {"operator_selected": [0, 0, .5, .5]}}}
        with_roi = scan(root, qc, roi)
        assert "operator_selected" in with_roi["samples"][0]["illuminationRegions"]
        try:
            scan(root, qc, {"schemaVersion": "memi-roi-by-sample-v1", "reviewStatus": "auto",
                            "samples": {}})
            raise AssertionError("Ungrounded ROI must fail")
        except ValueError:
            pass
        (root / "Flaky" / "extra").mkdir()
        Image.new("RGB", (48, 32)).save(root / "Flaky" / "extra" / "1_L.jpg")
        try:
            scan(root, qc)
            raise AssertionError("Duplicate asset must fail")
        except ValueError:
            pass
        print("MEMI private batch self-test PASS (synthetic assets, matching, ROI gate, duplicates)")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", help="MEMI original photo/mask parent folder; academy PC only")
    parser.add_argument("--qc", help="Private QC JSON produced by JS triage")
    parser.add_argument("--roi-json", help="Optional independent ROI rectangles keyed by exact review ID")
    parser.add_argument("--out", help="New private output file, creation fails if it already exists")
    parser.add_argument("--expect-131", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.root or not args.qc or not args.out:
        parser.error("--root --qc --out are required")
    root, qcfile, out = Path(args.root).resolve(), Path(args.qc).resolve(), Path(args.out).resolve()
    if not root.is_dir():
        raise ValueError("Dataset root directory not found")
    if out in {qcfile, root} or out == Path(__file__).resolve():
        raise ValueError("Output cannot replace original/QC files")
    if out.is_relative_to(THIS_DIR.parent):
        raise ValueError("Output must not be placed under public Git working tree")
    qc = load_qc(qcfile, args.expect_131)
    roi = json.loads(Path(args.roi_json).read_text(encoding="utf-8")) if args.roi_json else None
    result = scan(root, qc, roi)
    if args.expect_131 and result["count"] != 131:
        raise ValueError("Expected all 131 local pairs")
    # File opened only after full validation. Never overwrite or output face pixels.
    with out.open("x", encoding="utf-8") as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    print(json.dumps({k: v for k, v in result.items() if k != "samples"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
