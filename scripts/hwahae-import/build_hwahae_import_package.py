r'''
python ".\scripts\hwahae-import\build_hwahae_import_package.py" `
  --products ".\data\hwahae\products_rows.csv" `
  --candidates ".\data\hwahae\크롤링 한 제이슨.json" `
  --manual-overrides ".\data\hwahae\manual_overrides.csv" `
  --category 슈퍼베이스의 카테고리 enum `
  --out-dir ".\data\hwahae\review_out_슈퍼베이스의 카테고리 enum"
'''

import argparse
import csv
import json
import re
import sys
from pathlib import Path
from difflib import SequenceMatcher


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

GENERIC_WORDS = {
    # category words
    "토너", "에센스", "앰플", "세럼", "스킨", "로션", "크림", "클렌저", "클렌징", "폼", "워시",
    "선크림", "선", "패드", "마스크", "팩", "젤", "밤", "오일", "워터",
    # benefit words that are too broad for duplicate certainty
    "수분", "진정", "보습", "장벽", "약산성", "저자극", "피부", "케어", "밸런스",
    "시카", "수딩", "히알루론", "히알루론산", "판테놀", "마데카소사이드",
    # commerce/package words
    "기획", "더블", "세트", "증정", "대용량", "리필", "본품", "단품", "한정", "특가",
    "only화해", "화해", "올리브영", "단독", "new", "best", "ex", "리뉴얼",
    # units
    "ml", "g", "매", "개", "ea", "pcs", "p",
}

REQUIRED_PRODUCT_FIELDS = {"id", "brand", "name", "category"}
REQUIRED_CANDIDATE_FIELDS = {"id", "brand", "product_name", "category"}
VALID_OVERRIDE_DECISIONS = {"new", "exclude", "duplicate"}
MOISTURIZER_CATEGORIES = {
    "moisturizer_lotion_emulsion",
    "moisturizer_gel",
    "moisturizer_cream",
    "moisturizer_balm",
}


def read_csv(path):
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def read_override_ids(path):
    rows = []
    with open(path, "r", encoding="utf-8-sig") as f:
        for line_number, raw_line in enumerate(f, start=1):
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.lower() in {"external_id", "external id"}:
                continue
            rows.append({
                "external_id": line,
                "decision": "new",
                "note": f"manual restore from line {line_number}",
            })
    return rows




def read_json(path):
    with open(path, "r", encoding="utf-8-sig") as f:
        data = json.load(f)

    if isinstance(data, list):
        return data

    if isinstance(data, dict):
        for key in ("rows", "data", "products", "candidates", "items", "itemListElement"):
            value = data.get(key)
            if isinstance(value, list):
                return value

        # JSON-LD can be nested under @graph.
        graph = data.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                if isinstance(item, dict) and isinstance(item.get("itemListElement"), list):
                    return item["itemListElement"]

    raise ValueError(
        f"{path} JSON must be a list or an object containing one of: rows, data, products, candidates, items, itemListElement, @graph[].itemListElement"
    )


def read_rows(path):
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return read_csv(path)
    if suffix == ".json":
        return read_json(path)
    raise ValueError(f"Unsupported input file type: {path}. Use .csv or .json")


def extract_hwahae_url(row):
    value = row.get("source_url") or row.get("url") or row.get("href") or ""
    if value:
        return value

    item = row.get("item")
    if isinstance(item, dict):
        return item.get("url") or item.get("@id") or ""

    return ""


def extract_hwahae_name(row):
    value = row.get("product_name") or row.get("productName") or row.get("name") or ""
    if value:
        return value

    item = row.get("item")
    if isinstance(item, dict):
        return item.get("name") or ""

    return ""


def extract_hwahae_brand(row):
    value = row.get("brand") or row.get("brandName") or ""
    if isinstance(value, dict):
        return value.get("name") or ""
    if value:
        return value

    item = row.get("item")
    if isinstance(item, dict):
        brand = item.get("brand") or item.get("brandName") or ""
        if isinstance(brand, dict):
            return brand.get("name") or ""
        return brand or ""

    return ""


def extract_hwahae_rank(row, fallback_index):
    for key in ("rank", "position", "itemPosition"):
        if row.get(key) not in (None, ""):
            return row.get(key)
    return fallback_index


def extract_hwahae_price(row):
    for key in ("price", "price_krw", "lowPrice"):
        if row.get(key) not in (None, ""):
            return row.get(key)

    offers = row.get("offers")
    if isinstance(offers, dict):
        return offers.get("price") or ""

    item = row.get("item")
    if isinstance(item, dict):
        offers = item.get("offers")
        if isinstance(offers, dict):
            return offers.get("price") or ""
        for key in ("price", "lowPrice"):
            if item.get(key) not in (None, ""):
                return item.get(key)

    return ""


def parse_external_from_url(url):
    text = str(url or "")
    match = re.search(r"/(goods|products|product)/(\d+)", text)
    if match:
        return match.group(1), match.group(2)
    match = re.search(r"/goods/(\d+)", text)
    if match:
        return "goods", match.group(1)
    return "", ""


def normalize_candidate_rows(rows, category):
    normalized = []
    for idx, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            continue

        source_url = extract_hwahae_url(row)
        external_type = row.get("external_type") or ""
        external_id = row.get("external_id") or ""
        if not external_type or not external_id:
            parsed_type, parsed_id = parse_external_from_url(source_url)
            external_type = external_type or parsed_type
            external_id = external_id or parsed_id

        candidate_id = row.get("id") or external_id or str(idx)
        candidate_category = row.get("category") or category

        normalized.append({
            **row,
            "id": str(candidate_id),
            "rank": extract_hwahae_rank(row, idx),
            "brand": extract_hwahae_brand(row),
            "product_name": extract_hwahae_name(row),
            "category": candidate_category,
            "price": extract_hwahae_price(row),
            "source": row.get("source") or "hwahae",
            "external_type": external_type,
            "external_id": external_id,
            "source_url": source_url,
            "concern": row.get("concern") or "all",
        })

    return normalized


def normalize_product_rows(rows):
    normalized = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        normalized.append({
            **row,
            "id": row.get("id") or row.get("product_id") or "",
            "brand": row.get("brand") or row.get("brand_name") or row.get("normalized_brand") or "",
            "name": row.get("name") or row.get("product_name") or "",
            "category": row.get("category") or "",
        })
    return normalized


def write_csv(path, rows, fieldnames):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_json(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)


def clean_text(value):
    text = str(value or "").lower()
    text = re.sub(r"\[[^\]]*\]", " ", text)
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"1\s*\+\s*1", " ", text)
    text = re.sub(r"더블\s*기획|더블기획|기획\s*세트|기획세트|증정|only\s*화해|올리브영\s*단독", " ", text)
    text = re.sub(r"\b\d+(\.\d+)?\s*(ml|g|매|ea|개|p|pcs)\b", " ", text, flags=re.I)
    text = re.sub(r"[^가-힣a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def compact(value):
    return re.sub(r"\s+", "", clean_text(value))


def tokens(value):
    result = []
    for token in clean_text(value).split():
        if len(token) < 2:
            continue
        if token in GENERIC_WORDS:
            continue
        if token.isdigit():
            continue
        result.append(token)
    return sorted(set(result))


def overlap(a_tokens, b_tokens):
    b = set(b_tokens)
    return [t for t in a_tokens if t in b]


def similarity(a, b):
    return round(SequenceMatcher(None, compact(a), compact(b)).ratio(), 4)


def safe_int(value):
    if str(value or "").strip() == "":
        return None
    try:
        return int(float(str(value).replace(",", "")))
    except ValueError:
        return None


def get_external_key(row):
    source = row.get("source") or "hwahae"
    external_type = row.get("external_type") or ""
    external_id = row.get("external_id") or ""
    if external_type and external_id:
        return f"{source}::{external_type}::{external_id}"
    return ""


def candidate_dedupe_key(row):
    external_key = get_external_key(row)
    if external_key:
        return f"external::{external_key}"

    return "name::{}::{}::{}".format(
        row.get("category") or "",
        compact(row.get("brand")),
        compact(row.get("product_name")),
    )


def candidate_keys(row):
    keys = []
    candidate_id = row.get("id") or row.get("candidate_id") or ""
    if candidate_id:
        keys.append(f"id::{candidate_id}")
    external_key = get_external_key(row)
    if external_key:
        keys.append(f"external::{external_key}")
    external_id = row.get("external_id") or ""
    if external_id:
        keys.append(f"external_id::{external_id}")
    keys.append(candidate_dedupe_key(row))
    return keys


def candidate_quality(row):
    score = 0
    if row.get("external_id"):
        score += 100
    if row.get("source_url"):
        score += 50
    if row.get("price"):
        score += 10
    rank = safe_int(row.get("rank"))
    if rank is not None:
        score += max(0, 30 - rank)
    return score


def make_review_row(candidate, decision, matched=None, match_meta=None, note=""):
    matched = matched or {}
    match_meta = match_meta or {}
    return {
        "review_decision": decision,
        "candidate_id": candidate.get("id"),
        "category": candidate.get("category"),
        "rank": candidate.get("rank"),
        "candidate_brand": candidate.get("brand"),
        "candidate_name": candidate.get("product_name"),
        "candidate_tokens": " | ".join(tokens(candidate.get("product_name"))),
        "candidate_external_type": candidate.get("external_type"),
        "candidate_external_id": candidate.get("external_id"),
        "candidate_source_url": candidate.get("source_url"),
        "matched_product_id": matched.get("id"),
        "matched_brand": matched.get("brand"),
        "matched_name": matched.get("name"),
        "matched_category": matched.get("category"),
        "matched_tokens": " | ".join(tokens(matched.get("name"))),
        "overlap_tokens": " | ".join(match_meta.get("overlap_tokens", [])),
        "similarity": match_meta.get("similarity", ""),
        "match_rule": match_meta.get("rule", ""),
        "override_decision": match_meta.get("override_decision", ""),
        "review_note": note or match_meta.get("override_note", ""),
    }


def make_filtered_row(candidate, reason, matched=None, match_meta=None):
    matched = matched or {}
    match_meta = match_meta or {}

    return {
        "filter_reason": reason,
        "candidate_id": candidate.get("id"),
        "category": candidate.get("category"),
        "rank": candidate.get("rank"),
        "candidate_brand": candidate.get("brand"),
        "candidate_name": candidate.get("product_name"),
        "candidate_tokens": " | ".join(tokens(candidate.get("product_name"))),
        "candidate_external_type": candidate.get("external_type"),
        "candidate_external_id": candidate.get("external_id"),
        "candidate_source_url": candidate.get("source_url"),
        "matched_product_id": matched.get("id"),
        "matched_brand": matched.get("brand"),
        "matched_name": matched.get("name"),
        "matched_category": matched.get("category"),
        "matched_tokens": " | ".join(tokens(matched.get("name"))),
        "overlap_tokens": " | ".join(match_meta.get("overlap_tokens", [])),
        "similarity": match_meta.get("similarity", ""),
        "match_rule": match_meta.get("rule", ""),
        "override_decision": match_meta.get("override_decision", ""),
        "override_note": match_meta.get("override_note", ""),
    }


def dedupe_candidates(candidates):
    kept = {}
    filtered = []

    for row in candidates:
        key = candidate_dedupe_key(row)
        current = kept.get(key)

        if current is None:
            kept[key] = row
            continue

        if candidate_quality(row) > candidate_quality(current):
            filtered.append(make_filtered_row(current, "candidate_internal_duplicate", row))
            kept[key] = row
        else:
            filtered.append(make_filtered_row(row, "candidate_internal_duplicate", current))

    return list(kept.values()), filtered


def find_best_product_match(candidate, products):
    c_category = candidate.get("category") or ""
    c_brand = compact(candidate.get("brand"))
    c_name = candidate.get("product_name") or ""
    c_tokens = tokens(c_name)

    best = None

    for product in products:
        p_category = product.get("category") or ""
        if p_category != c_category and not (c_category in MOISTURIZER_CATEGORIES and p_category == "moisturizer"):
            continue

        p_brand = compact(product.get("brand"))
        p_name = product.get("name") or ""
        p_tokens = tokens(p_name)
        ov = overlap(c_tokens, p_tokens)
        sim = similarity(c_name, p_name)

        same_brand = c_brand and p_brand and c_brand == p_brand

        if same_brand and len(ov) >= 1:
            score = 1000 + len(ov) * 100 + sim * 50
            rule = "same_category_same_brand_token_overlap"
        elif len(ov) >= 2:
            score = 500 + len(ov) * 100 + sim * 50
            rule = "same_category_cross_brand_token_overlap_2plus"
        elif sim >= 0.72:
            score = 300 + sim * 100
            rule = "same_category_high_name_similarity"
        else:
            continue

        if best is None or score > best["score"]:
            best = {
                "product": product,
                "score": score,
                "overlap_tokens": ov,
                "similarity": sim,
                "rule": rule,
            }

    return best


def validate_headers(rows, required, label):
    if not rows:
        raise ValueError(f"{label} input is empty")

    fields = set(rows[0].keys())
    missing = required - fields
    if missing:
        raise ValueError(f"{label} input missing fields after normalization: {sorted(missing)}")


def has_override_key(row):
    return bool(
        (row.get("candidate_id") or "").strip()
        or (row.get("external_id") or "").strip()
        or (row.get("matched_product_id") or "").strip()
    )


def get_override_decision(row):
    decision = (row.get("decision") or "").strip().lower()
    if decision:
        return decision
    if has_override_key(row):
        return "new"
    return ""


def validate_overrides(rows):
    for idx, row in enumerate(rows, start=2):
        decision = get_override_decision(row)
        if not decision:
            continue
        if decision not in VALID_OVERRIDE_DECISIONS:
            raise ValueError(
                f"manual overrides row {idx}: decision must be one of {sorted(VALID_OVERRIDE_DECISIONS)}, got {decision!r}"
            )


def load_overrides(path):
    if not path:
        return {}, []
    override_path = Path(path)
    if not override_path.exists():
        return {}, []

    if override_path.suffix.lower() in {".txt", ".ids", ".list"}:
        rows = read_override_ids(override_path)
    else:
        rows = read_csv(override_path)
    validate_overrides(rows)

    by_key = {}
    for row in rows:
        decision = get_override_decision(row)
        if not decision:
            continue

        keys = []
        if row.get("candidate_id"):
            keys.append(f"id::{row.get('candidate_id')}")
        source = row.get("source") or "hwahae"
        external_type = row.get("external_type") or ""
        external_id = row.get("external_id") or ""
        if external_type and external_id:
            keys.append(f"external::{source}::{external_type}::{external_id}")
        if external_id:
            keys.append(f"external_id::{external_id}")

        if not keys:
            continue

        normalized = {
            "decision": decision,
            "note": row.get("note") or "",
            "matched_product_id": row.get("matched_product_id") or "",
        }
        for key in keys:
            by_key[key] = normalized

    return by_key, rows


def get_override(candidate, overrides_by_key):
    for key in candidate_keys(candidate):
        if key in overrides_by_key:
            return overrides_by_key[key]
    return None


def filter_by_category(rows, category):
    if not category:
        return rows
    if category in MOISTURIZER_CATEGORIES:
        return [row for row in rows if (row.get("category") or "") in {category, "moisturizer"}]
    return [row for row in rows if (row.get("category") or "") == category]


def find_product_by_id(products, product_id):
    if not product_id:
        return None
    for product in products:
        if str(product.get("id") or "") == str(product_id):
            return product
    return None

def has_one_plus_one(name):
    return bool(re.search(r"1\s*\+\s*1", str(name or "")))

def is_hwahae_only(name):
    text = str(name or "").lower()
    compact_text = re.sub(r"\s+", "", text)
    return "only화해" in compact_text or "화해only" in compact_text

def adjusted_price(candidate):
    price = safe_int(candidate.get("price"))
    if price is None:
        return None
    if has_one_plus_one(candidate.get("product_name")):
        return price // 2
    return price

def normalized_source_url(candidate):
    if is_hwahae_only(candidate.get("product_name")):
        return candidate.get("source_url") or None
    return None

def to_final_json_row(candidate):
    return {
        "source": candidate.get("source") or "hwahae",
        "external_type": candidate.get("external_type") or None,
        "external_id": candidate.get("external_id") or None,
        "source_url": normalized_source_url(candidate),
        "category": candidate.get("category") or None,
        "concern": candidate.get("concern") or None,
        "rank": safe_int(candidate.get("rank")),
        "brand": candidate.get("brand") or None,
        "product_name": candidate.get("product_name") or None,
        "normalized_brand": compact(candidate.get("brand")),
        "normalized_name": compact(candidate.get("product_name")),
        "price": adjusted_price(candidate),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Review Hwahae import candidates against existing products and apply manual override decisions."
    )
    parser.add_argument("--products", required=True, help="CSV/JSON export from products table. Required fields after normalization: id, brand, name, category")
    parser.add_argument("--candidates", required=True, help="Hwahae candidate CSV/JSON. JSON-LD ItemList is supported; category can be supplied with --category.")
    parser.add_argument("--manual-overrides", default="", help="Optional CSV with candidate_id/external_id + decision(new|exclude|duplicate) + note")
    parser.add_argument("--category", default="", help="Optional category filter. If omitted, all candidate categories are processed.")
    parser.add_argument("--out-dir", default="data/hwahae/review_out")
    args = parser.parse_args()

    products = normalize_product_rows(read_rows(Path(args.products)))
    candidates = normalize_candidate_rows(read_rows(Path(args.candidates)), args.category)

    validate_headers(products, REQUIRED_PRODUCT_FIELDS, "products")
    validate_headers(candidates, REQUIRED_CANDIDATE_FIELDS, "candidates")

    products = filter_by_category(products, args.category)
    candidates = filter_by_category(candidates, args.category)

    overrides_by_key, override_rows = load_overrides(args.manual_overrides)

    deduped_candidates, filtered_internal = dedupe_candidates(candidates)

    # Restore candidates that were removed by internal dedupe when the user explicitly forces them as new/exclude/duplicate.
    candidate_map = {candidate_dedupe_key(row): row for row in deduped_candidates}
    selected_keys = {candidate_dedupe_key(row) for row in deduped_candidates}
    selected_candidates = list(deduped_candidates)

    for row in candidates:
        override = get_override(row, overrides_by_key)
        if not override:
            continue
        key = candidate_dedupe_key(row)
        if key not in selected_keys:
            selected_candidates.append(row)
            selected_keys.add(key)
            candidate_map[key] = row

    review_rows = []
    filtered_rows = []
    final_new = []

    # Keep internal duplicate rows for traceability, unless the duplicate itself was restored by override.
    restored_ids = {str(row.get("id") or "") for row in selected_candidates if get_override(row, overrides_by_key)}
    for row in filtered_internal:
        if str(row.get("candidate_id") or "") not in restored_ids:
            filtered_rows.append(row)

    for candidate in selected_candidates:
        override = get_override(candidate, overrides_by_key)
        match = find_best_product_match(candidate, products)
        matched_product = match["product"] if match else {}
        meta = {
            "overlap_tokens": match["overlap_tokens"] if match else [],
            "similarity": match["similarity"] if match else "",
            "rule": match["rule"] if match else "no_match",
        }

        if override:
            meta["override_decision"] = override["decision"]
            meta["override_note"] = override.get("note", "")
            forced_match = find_product_by_id(products, override.get("matched_product_id"))
            if forced_match:
                matched_product = forced_match
                meta["rule"] = "manual_matched_product_id"

            if override["decision"] == "new":
                final_new.append(to_final_json_row(candidate))
                review_rows.append(make_review_row(candidate, "manual_new", matched_product, meta))
                continue

            if override["decision"] == "exclude":
                filtered_rows.append(make_filtered_row(candidate, "manual_exclude", matched_product, meta))
                review_rows.append(make_review_row(candidate, "manual_exclude", matched_product, meta))
                continue

            if override["decision"] == "duplicate":
                filtered_rows.append(make_filtered_row(candidate, "manual_duplicate", matched_product, meta))
                review_rows.append(make_review_row(candidate, "manual_duplicate", matched_product, meta))
                continue

        if match:
            filtered_rows.append(make_filtered_row(candidate, "matched_existing_product", matched_product, meta))
            review_rows.append(make_review_row(candidate, "duplicate_candidate", matched_product, meta))
        else:
            final_new.append(to_final_json_row(candidate))
            review_rows.append(make_review_row(candidate, "new_candidate", {}, meta))

    out_dir = Path(args.out_dir)
    review_fields = [
        "review_decision",
        "candidate_id",
        "category",
        "rank",
        "candidate_brand",
        "candidate_name",
        "candidate_tokens",
        "candidate_external_type",
        "candidate_external_id",
        "candidate_source_url",
        "matched_product_id",
        "matched_brand",
        "matched_name",
        "matched_category",
        "matched_tokens",
        "overlap_tokens",
        "similarity",
        "match_rule",
        "override_decision",
        "review_note",
    ]

    filtered_fields = [
        "filter_reason",
        "candidate_id",
        "category",
        "rank",
        "candidate_brand",
        "candidate_name",
        "candidate_tokens",
        "candidate_external_type",
        "candidate_external_id",
        "candidate_source_url",
        "matched_product_id",
        "matched_brand",
        "matched_name",
        "matched_category",
        "matched_tokens",
        "overlap_tokens",
        "similarity",
        "match_rule",
        "override_decision",
        "override_note",
    ]

    write_csv(out_dir / "hwahae_match_review.csv", review_rows, review_fields)
    write_csv(out_dir / "hwahae_filtered_out.csv", filtered_rows, filtered_fields)
    write_json(out_dir / "hwahae_final_new_candidates.json", final_new)

    print(json.dumps({
        "products": len(products),
        "input_candidates": len(candidates),
        "deduped_candidates": len(deduped_candidates),
        "manual_override_rows": len([row for row in override_rows if get_override_decision(row)]),
        "filtered_out": len(filtered_rows),
        "final_new_candidates": len(final_new),
        "out_dir": str(out_dir),
        "outputs": [
            "hwahae_match_review.csv",
            "hwahae_filtered_out.csv",
            "hwahae_final_new_candidates.json",
        ],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
