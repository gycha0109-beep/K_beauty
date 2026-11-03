#!/usr/bin/env python3
"""Private MEMI capture-condition audit: nonclinical photo/frame-level proxies.

No face localization, pigment inference, human identities, source file changes or training.
Requires Python 3.10+, Pillow, NumPy. Never uploads/prints per-sample identifiers.
"""
from pathlib import Path
from collections import defaultdict
import argparse
import json
import statistics
import tempfile
import numpy as np
from PIL import Image

def frame_features(image):
    photo = image.convert("RGB")
    photo.thumbnail((384, 384))
    rgb = np.asarray(photo, dtype=np.float32) / 255.0
    lum = .2126*rgb[:,:,0] + .7152*rgb[:,:,1] + .0722*rgb[:,:,2]
    saturation = rgb.max(axis=2) - rgb.min(axis=2)
    zones = np.array_split(lum, 3, axis=1)
    medians = [float(np.median(z)) for z in zones]
    return {
        "luminanceMedian": round(float(np.median(lum)), 5),
        "leftCenterRightLumMedian": [round(x, 5) for x in medians],
        "horizontalMedianRange": round(max(medians)-min(medians),5),
        "clippedBrightFraction": round(float(np.mean(lum > .95)), 5),
        "brightNeutralFraction": round(float(np.mean((lum > .92) & (saturation < .12))),5),
        "lowLumFraction": round(float(np.mean(lum < .20)),5),
        "note": "Frame-level capture proxies only. Background/lighting may dominate; no anatomical ROI, clinical condition or false-mark area inferred."
    }

def aggregate(rows):
    groups = defaultdict(list)
    for row in rows:
        for key in (row["group"]+"/"+row["pose"],
                    row["group"]+"/"+row["reviewStatus"],
                    "all"):
            groups[key].append(row)
    return {
        name:{
            "n":len(items),
            "horizontalRangeMedian":round(statistics.median(x["capture"]["horizontalMedianRange"] for x in items),5),
            "brightNeutralFractionMedian":round(statistics.median(x["capture"]["brightNeutralFraction"] for x in items),5),
            "lowLumFractionMedian":round(statistics.median(x["capture"]["lowLumFraction"] for x in items),5),
        } for name,items in sorted(groups.items())
    }

def run(root, qc):
    if qc.get("schemaVersion")!="memi-ds-review-qc-v1" or not isinstance(qc.get("records"),list):
        raise ValueError("Expected private reviewer QC input")
    rows=[]
    for rec in qc["records"]:
        if rec.get("group") not in ("Flaky","Punctate") or not isinstance(rec.get("name"),str):
            raise ValueError("Invalid QC record")
        base=root/(rec["group"]+"_Image")/(rec["group"]+"_Image")
        img=base/(rec["name"]+".jpg")
        if not img.is_file(): raise ValueError("Missing original photo in known Figshare layout")
        with Image.open(img) as im:
            values=frame_features(im)
        rows.append({"sampleId":rec["id"],"group":rec["group"],"pose":rec["pose"],
                     "reviewStatus":rec["reviewerOriginal"]["status"],
                     "reviewFlags":rec["flags"],
                     "capture":values})
    return {"schemaVersion":"memi-capture-frame-proxy-v1",
            "notModelPerformance":True, "roi":"FULL_FRAME_NOT_FACE",
            "errorCausality":"NOT_ESTABLISHED","rightsForModelTraining":"UNVERIFIED",
            "sampleCount":len(rows),"groupSummaries":aggregate(rows),"samples":rows}

def test():
    dark=np.full((60,90,3),20,dtype=np.uint8)
    light=np.full((60,90,3),180,dtype=np.uint8)
    light[:,:20]=255
    a,b=frame_features(Image.fromarray(dark)),frame_features(Image.fromarray(light))
    assert a["lowLumFraction"]>b["lowLumFraction"]
    assert b["brightNeutralFraction"]>a["brightNeutralFraction"]
    assert b["horizontalMedianRange"]>0
    rows=[{"group":"Flaky","pose":"F","reviewStatus":"pass","capture":a},
          {"group":"Flaky","pose":"L","reviewStatus":"fail","capture":b}]
    assert aggregate(rows)["all"]["n"]==2
    assert aggregate(rows)["Flaky/F"]["n"]==1
    print("MEMI capture-proxy synthetic test PASS")

if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--self-test",action="store_true")
    p.add_argument("--root")
    p.add_argument("--qc")
    p.add_argument("--out")
    a=p.parse_args()
    if a.self_test: test()
    else:
        if not a.root or not a.qc or not a.out: p.error("--root, --qc, --out are required")
        root,inp,out=Path(a.root).resolve(),Path(a.qc).resolve(),Path(a.out).resolve()
        if not root.is_dir() or not inp.is_file():raise ValueError("Missing local inputs")
        if any((x/".git").exists() for x in (out.parent,*out.parents)):
            raise ValueError("Private capture output cannot be inside a Git worktree")
        if out in (inp,):raise ValueError("Output cannot replace QC input")
        j=run(root,json.loads(inp.read_text(encoding="utf-8")))
        with out.open("x",encoding="utf-8") as f:json.dump(j,f,ensure_ascii=False,indent=2)
        print(json.dumps({k:v for k,v in j.items() if k!="samples"},ensure_ascii=False,indent=2))
