import argparse
import csv
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = ROOT_DIR / "data" / "hwahae"
BUILD_SCRIPT = Path(__file__).resolve().parent / "build_hwahae_import_package.py"
TREATMENT_CATEGORY = "treatment"

ALLOWED_CATEGORIES = {
    "cleanser",
    "toner_essence",
    "toner_pad",
    "treatment",
    "moisturizer",
    "moisturizer_lotion_emulsion",
    "moisturizer_gel",
    "moisturizer_cream",
    "moisturizer_balm",
    "sunscreen",
}
ALLOWED_TREATMENT_PRODUCT_FORMS = {
    "serum",
    "ampoule",
    "essence",
    "booster",
    "peeling_solution",
}
LEGACY_AMBIGUOUS_CATEGORY_NAMES = {"serum", "ampoule", "essence"}

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")
os.environ.setdefault("PYTHONUTF8", "1")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")


def load_dotenv(path):
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def get_required_env(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def normalize_supabase_url(value):
    return value if value.startswith("http") else f"https://{value}"


def normalize_token(value):
    if value is None:
        return ""
    return str(value).strip().lower()


def strip_rank_suffix(stem):
    normalized = stem.strip().lower().replace("-", "_").replace(" ", "_")
    normalized = re.sub(r"_?top\d+$", "", normalized)
    normalized = re.sub(r"_?\d+개?$", "", normalized)
    return normalized.strip("_")


def read_json_batch(path):
    with path.open("r", encoding="utf-8-sig") as f:
        data = json.load(f)

    if isinstance(data, list):
        return data, {}

    if isinstance(data, dict):
        metadata = data.get("batch_metadata") or {}
        if metadata and not isinstance(metadata, dict):
            raise ValueError(f"{path}: batch_metadata must be an object.")

        for key in ("rows", "data", "products", "candidates", "items", "itemListElement"):
            value = data.get(key)
            if isinstance(value, list):
                return value, metadata

        graph = data.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                if isinstance(item, dict) and isinstance(item.get("itemListElement"), list):
                    return item["itemListElement"], metadata

    raise ValueError(f"{path} JSON must be a list or an object containing candidate rows.")


def read_json_rows(path):
    rows, _metadata = read_json_batch(path)
    return rows


def validate_category_product_form(category, product_form, label):
    if not category:
        raise ValueError(f"{label}: canonical_category is required.")

    if category not in ALLOWED_CATEGORIES:
        raise ValueError(
            f"{label}: invalid canonical_category {category!r}; expected one of {sorted(ALLOWED_CATEGORIES)}."
        )

    if category != TREATMENT_CATEGORY:
        if product_form:
            raise ValueError(f"{label}: product_form must be null/absent unless canonical_category is 'treatment'.")
        return

    if not product_form:
        raise ValueError(f"{label}: treatment canonical_category requires product_form.")

    if product_form not in ALLOWED_TREATMENT_PRODUCT_FORMS:
        raise ValueError(
            f"{label}: invalid treatment product_form {product_form!r}; "
            f"expected one of {sorted(ALLOWED_TREATMENT_PRODUCT_FORMS)}."
        )


def parse_batch_metadata(metadata, path):
    if not metadata:
        return None

    category = normalize_token(metadata.get("canonical_category"))
    product_form = normalize_token(metadata.get("product_form"))
    validate_category_product_form(category, product_form, f"{path}: batch_metadata")
    return {"category": category, "product_form": product_form or None}


def infer_category_from_filename(path):
    key = strip_rank_suffix(path.stem)

    if key in LEGACY_AMBIGUOUS_CATEGORY_NAMES:
        raise RuntimeError(
            f"{path.name}: raw filename category {key!r} is ambiguous/legacy. "
            "Add batch_metadata with canonical_category and product_form."
        )

    if key in ALLOWED_CATEGORIES:
        return key

    raise RuntimeError(
        f"Cannot infer canonical category from {path.name!r}. "
        "Use a canonical category filename or add batch_metadata."
    )


def row_product_form(row, label):
    snake = normalize_token(row.get("product_form"))
    camel = normalize_token(row.get("productForm"))
    if snake and camel and snake != camel:
        raise ValueError(f"{label}: conflicting product_form and productForm values.")
    return snake or camel


def validate_and_prepare_rows(rows, category, product_form, metadata_present, path):
    prepared = []
    counts = {}

    for idx, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            continue

        label = f"{path}: row {idx}"
        row_category = normalize_token(row.get("category"))
        row_form = row_product_form(row, label)

        if row_category and row_category != category:
            raise ValueError(
                f"{label}: row category {row_category!r} conflicts with file category {category!r}."
            )

        if metadata_present:
            if category == TREATMENT_CATEGORY:
                if row_form and row_form != product_form:
                    raise ValueError(
                        f"{label}: row product_form {row_form!r} conflicts with batch_metadata product_form {product_form!r}."
                    )
                final_form = product_form
            else:
                if row_form:
                    raise ValueError(f"{label}: non-treatment rows must not contain product_form.")
                final_form = None
        else:
            final_form = row_form or None
            validate_category_product_form(category, final_form, label)

        counts[final_form or "null"] = counts.get(final_form or "null", 0) + 1
        prepared.append(
            {
                **row,
                "category": category,
                "inferredCategory": category,
                "product_form": final_form,
                "productForm": final_form,
            }
        )

    return prepared, counts


def prepare_candidates_file(job, temp_dir=None):
    rows, metadata = read_json_batch(job["file"])
    parsed_metadata = parse_batch_metadata(metadata, job["file"])
    metadata_present = parsed_metadata is not None
    category = parsed_metadata["category"] if metadata_present else job["category"]
    product_form = parsed_metadata["product_form"] if metadata_present else None
    prepared, counts = validate_and_prepare_rows(
        rows,
        category,
        product_form,
        metadata_present,
        job["file"],
    )

    needs_prepared_file = metadata_present or category == TREATMENT_CATEGORY
    if not needs_prepared_file:
        return job["file"], counts

    if temp_dir is None:
        return job["file"], counts

    prepared_path = Path(temp_dir) / f"{job['file'].stem}_prepared_candidates.json"
    with prepared_path.open("w", encoding="utf-8") as f:
        json.dump(prepared, f, ensure_ascii=False, indent=2)

    return prepared_path, counts


def format_product_form_counts(counts):
    if not counts:
        return ""
    return ", ".join(f"{key}={counts[key]}" for key in sorted(counts))


def discover_jobs(data_dir):
    jobs = []
    for path in sorted(data_dir.glob("*.json")):
        if path.name.startswith("."):
            continue

        rows, metadata = read_json_batch(path)
        parsed_metadata = parse_batch_metadata(metadata, path)
        category = parsed_metadata["category"] if parsed_metadata else infer_category_from_filename(path)
        jobs.append(
            {
                "file": path,
                "label": strip_rank_suffix(path.stem),
                "category": category,
                "out_dir": data_dir / f"product_out_{strip_rank_suffix(path.stem)}",
                "row_count": len(rows),
            }
        )
    return jobs


def fetch_products(supabase_url, service_role_key):
    products = []
    page_size = 1000
    offset = 0
    encoded_select = urllib.parse.quote("id,brand,name,category", safe=",")
    base_url = f"{supabase_url.rstrip('/')}/rest/v1/products?select={encoded_select}&order=brand.asc,name.asc"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Accept": "application/json",
    }

    while True:
        request = urllib.request.Request(base_url, headers={**headers, "Range": f"{offset}-{offset + page_size - 1}"})
        with urllib.request.urlopen(request, timeout=30) as response:
            batch = json.loads(response.read().decode("utf-8"))
        if not isinstance(batch, list):
            raise RuntimeError("Unexpected Supabase products response; expected a JSON array.")
        products.extend(batch)
        if len(batch) < page_size:
            return products
        offset += page_size


def write_products_csv(path, products):
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["id", "brand", "name", "category"], extrasaction="ignore")
        writer.writeheader()
        writer.writerows(products)


def find_manual_overrides(data_dir):
    for filename in ("manual_overrides.txt", "manual_overrides.ids", "manual_overrides.csv"):
        path = data_dir / filename
        if path.exists():
            return path
    return data_dir / "manual_overrides.txt"


def run_job(job, products_csv, manual_overrides, dry_run=False, temp_dir=None):
    candidates_file, product_form_counts = prepare_candidates_file(job, temp_dir=temp_dir)
    command = [
        sys.executable,
        str(BUILD_SCRIPT),
        "--products",
        str(products_csv),
        "--candidates",
        str(candidates_file),
        "--category",
        job["category"],
        "--out-dir",
        str(job["out_dir"]),
    ]

    if manual_overrides.exists():
        command.extend(["--manual-overrides", str(manual_overrides)])

    print(f"\n[{job['label']}] {job['file'].name} -> {job['category']} -> {job['out_dir']}", flush=True)
    if product_form_counts is not None:
        print(f"product_form counts: {format_product_form_counts(product_form_counts)}", flush=True)
    if dry_run:
        print(" ".join(f'"{part}"' if " " in part else part for part in command))
        return

    subprocess.run(command, cwd=ROOT_DIR, check=True)


def main():
    parser = argparse.ArgumentParser(
        description="Prepare Hwahae category JSON files into per-category product_out folders using live Supabase products."
    )
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR), help="Directory containing category-named Hwahae JSON files.")
    parser.add_argument("--dry-run", action="store_true", help="Print planned jobs without creating output files.")
    args = parser.parse_args()

    load_dotenv(ROOT_DIR / ".env")
    load_dotenv(ROOT_DIR / ".env.local")

    data_dir = Path(args.data_dir)
    if not data_dir.is_absolute():
        data_dir = ROOT_DIR / data_dir

    if not data_dir.exists():
        raise RuntimeError(f"Data directory does not exist: {data_dir}")

    jobs = discover_jobs(data_dir)
    if not jobs:
        print(f"No category JSON files found in {data_dir}")
        return

    manual_overrides = find_manual_overrides(data_dir)

    print(f"Found {len(jobs)} Hwahae JSON file(s).")
    if args.dry_run:
        products_csv = data_dir / "_live_products_rows.csv"
        for job in jobs:
            run_job(job, products_csv, manual_overrides, dry_run=True)
        return

    supabase_url = normalize_supabase_url(get_required_env("NEXT_PUBLIC_SUPABASE_URL"))
    service_role_key = get_required_env("SUPABASE_SERVICE_ROLE_KEY")

    products = fetch_products(supabase_url, service_role_key)
    print(f"Fetched {len(products)} live Supabase product(s).")

    with tempfile.TemporaryDirectory(prefix="hwahae_products_") as temp_dir:
        products_csv = Path(temp_dir) / "products_rows.csv"
        write_products_csv(products_csv, products)
        for job in jobs:
            run_job(job, products_csv, manual_overrides, temp_dir=temp_dir)


if __name__ == "__main__":
    main()
